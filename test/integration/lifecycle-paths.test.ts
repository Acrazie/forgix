import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInvocation } from "../../src/cli.ts";
import { canonicalize, sha256Prefixed } from "../../src/core/digest.ts";
import { StateStoreError } from "../../src/core/schema.ts";
import {
  MACRO_PHASES,
  TASK_STATUSES,
  createTaskStateStore,
  deriveMacroPhase,
  validateTaskState,
} from "../../src/task/index.ts";
import type { AssuranceEvidenceRecord, AssuranceReceipt } from "../../src/types.ts";
import { expectThrown } from "../support/expect-error.ts";
import { makeTaskState, seedLegacyTask } from "../support/helpers-v6.ts";

test("Quick and Plan both traverse all five macro phases cleanly", () => {
  for (const profile of ["quick", "plan"] as const) {
    const phases = new Set(
      (
        [
          "new",
          "intaking",
          "discovering",
          "awaiting_profile_choice",
          "planning",
          "awaiting_approval",
          "executing",
          "assuring",
        ] as const
      ).map((status) =>
        deriveMacroPhase(
          makeTaskState({
            taskId: `lifecycle-${profile}`,
            status,
            profile,
          }),
        ),
      ),
    );
    expect([...MACRO_PHASES].every((phase) => phases.has(phase))).toBe(true);
  }

  const quickGate = makeTaskState({
    taskId: "lifecycle-quick",
    status: "awaiting_approval",
    profile: "quick",
  });
  expect(quickGate.shape?.projection).toBeUndefined();

  const planGate = makeTaskState({
    taskId: "lifecycle-plan",
    status: "awaiting_approval",
    profile: "plan",
  });
  expect(planGate.shape?.projection?.status).toBe("Proposed");

  const planExec = makeTaskState({
    taskId: "lifecycle-plan",
    status: "executing",
    profile: "plan",
  });
  expect(planExec.shape?.projection?.status).toBe("Approved");
  expect(deriveMacroPhase(planExec)).toBe("BUILD");
});

test("BUILD is one native state and ASSURE enforces 2-strike rule and computes completion receipt", async () => {
  expect(TASK_STATUSES).not.toContain("reviewing");
  expect(TASK_STATUSES).not.toContain("verifying");
  expect(TASK_STATUSES).not.toContain("finished");

  const assuring = makeTaskState({
    taskId: "assure-task",
    status: "assuring",
    profile: "plan",
  });
  expect(deriveMacroPhase(assuring)).toBe("ASSURE");

  const opId = assuring.shape!.contract!.assuranceContract!.operations[0]!.id;
  expectThrown(
    () =>
      validateTaskState({
        ...assuring,
        assurance: {
          schemaVersion: 1,
          evidenceIndex: [],
          issues: [
            {
              issueId: "issue:stable",
              operationId: opId,
              status: "active",
              correctionAttempts: 2,
              rootCauseRequired: false,
              evidenceRef: "evidence:finding",
            },
          ],
        },
      }),
    (error) => error instanceof StateStoreError && error.code === "state_invalid",
  );

  const evidenceBody: Omit<AssuranceEvidenceRecord, "digest"> = {
    schemaVersion: 1,
    evidenceId: "ev:check:test",
    operationId: opId,
    subjectIds: ["criterion.main"],
    verifierKind: "command",
    result: "passed",
    verifierDigest: "verifier:bun-test",
    observedFingerprint: "workspace:verified",
    detailRef: "log:bun-test",
    recordedAt: "2026-08-01T00:07:00.000Z",
  };
  const evidence: AssuranceEvidenceRecord = {
    ...evidenceBody,
    digest: sha256Prefixed(canonicalize(evidenceBody)),
  };
  const candidate = {
    ...assuring,
    assurance: {
      schemaVersion: 1 as const,
      evidenceIndex: [evidence],
      issues: [
        {
          issueId: "issue:stable",
          operationId: opId,
          status: "resolved" as const,
          correctionAttempts: 2,
          rootCauseRequired: true,
          evidenceRef: "evidence:finding",
        },
      ],
    },
  };
  expect(validateTaskState(candidate).assurance?.receipt).toBeUndefined();

  const root = await mkdtemp(join(tmpdir(), "forgix-assure-test-"));
  execFileSync("git", ["init", "-q", root]);
  try {
    await seedLegacyTask(root, {
      ...assuring,
      assurance: { schemaVersion: 1, evidenceIndex: [] },
    });
    const store = createTaskStateStore(root);
    const completed = await store.save("assure-task", candidate);
    const receipt: AssuranceReceipt | undefined = completed.assurance?.receipt;
    expect(receipt).toBeDefined();
    expect(receipt?.schemaVersion).toBe(2);
    expect(receipt?.taskId).toBe("assure-task");
    expect(receipt?.contractDigest).toBe(assuring.contractDigest);
    expect(completed.assurance?.completionIndex).toEqual(["ev:check:test"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI task validate, save, status, and gate integrate end-to-end", async () => {
  const root = await mkdtemp(join(tmpdir(), "forgix-cli-task-"));
  execFileSync("git", ["init", "-q", root]);
  try {
    const awaiting = makeTaskState({
      taskId: "cli-e2e",
      status: "awaiting_approval",
      profile: "plan",
    });

    const validated = await runInvocation(["task", "validate"], {
      workspaceRoot: root,
      task: { input: JSON.stringify(awaiting) },
    });
    expect(validated.status).toBe("valid");

    await seedLegacyTask(root, awaiting);
    const saved = await runInvocation(["task", "save", "cli-e2e"], {
      workspaceRoot: root,
      task: { input: JSON.stringify(awaiting) },
    });
    expect(saved.status).toBe("saved");

    const statusBefore = await runInvocation(["status", "cli-e2e"], {
      workspaceRoot: root,
    });
    expect(statusBefore.status).toBe("awaiting_approval");
    expect((statusBefore.data as { macroPhase: string }).macroPhase).toBe("GATE");

    const view = await runInvocation(["task", "gate", "cli-e2e", "--view"], {
      workspaceRoot: root,
    });
    expect(view.status).toBe("ready");

    const approved = await runInvocation(
      ["task", "gate", "cli-e2e", "--approve", `--digest=${awaiting.contractDigest}`],
      {
        workspaceRoot: root,
        task: { decidedAt: "2026-08-01T00:05:00.000Z" },
      },
    );
    expect(approved.status).toBe("approved");
    expect((approved.data as { status: string }).status).toBe("executing");

    const statusAfter = await runInvocation(["status", "cli-e2e"], {
      workspaceRoot: root,
    });
    expect((statusAfter.data as { status: string; macroPhase: string }).macroPhase).toBe("BUILD");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ASSURANCE_RECEIPT_VERSION,
  classifyAssureCompletion,
  computeAssuranceReceiptDigest,
  observeExternalArtifacts,
  observeWorktreeSnapshot,
} from "../../src/core/assure-completion.ts";
import { canonicalize, sha256Prefixed } from "../../src/core/digest.ts";
import { StateStoreError } from "../../src/core/schema.ts";
import {
  computeTaskNextActionEnvelope,
  createTaskStateStore,
  validateTaskState,
} from "../../src/task/index.ts";
import type { AssuranceEvidenceRecord, AssuranceReceipt, TaskState } from "../../src/types.ts";
import { makeTaskState, seedLegacyTask } from "../support/helpers-v6.ts";

function buildPassingAssuringState(
  taskId: string,
  extra?: Partial<TaskState["assurance"]>,
): TaskState {
  const base = makeTaskState({ taskId, status: "assuring", profile: "plan" });
  const opId = base.shape!.contract!.assuranceContract!.operations[0]!.id;
  const evidenceBody: Omit<AssuranceEvidenceRecord, "digest"> = {
    schemaVersion: 1,
    evidenceId: "ev:check:1",
    operationId: opId,
    subjectIds: ["criterion.main"],
    verifierKind: "command",
    result: "passed",
    verifierDigest: "verifier:bun-test",
    observedFingerprint: "workspace:verified",
    detailRef: "log:bun-test",
    recordedAt: "2026-11-23T01:00:00.000Z",
  };
  const evidence: AssuranceEvidenceRecord = {
    ...evidenceBody,
    digest: sha256Prefixed(canonicalize(evidenceBody)),
  };
  return {
    ...base,
    assurance: {
      schemaVersion: 1,
      evidenceIndex: [evidence],
      ...extra,
    },
  };
}

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "forgix-adr0041-"));
  execFileSync("git", ["init", "-q", root]);
  execFileSync("git", ["-C", root, "config", "user.email", "test@forgix.local"]);
  execFileSync("git", ["-C", root, "config", "user.name", "Test"]);
  await writeFile(join(root, "README.md"), "init\n", "utf8");
  execFileSync("git", ["-C", root, "add", "README.md"]);
  execFileSync("git", ["-C", root, "commit", "-q", "-m", "chore: init"]);
  return root;
}

async function expectRejected(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
    expect.unreachable("Expected promise to reject");
  } catch (error) {
    expect(error).toBeInstanceOf(StateStoreError);
  }
}

test("ADR 0041: refuses injected completion proof and never synthesizes receipts on read", async () => {
  const root = await createGitRepo();
  try {
    const store = createTaskStateStore(root);
    const ready = buildPassingAssuringState("adr41-inject");

    // Read-only validation never synthesizes receipt or completionIndex
    const validated = validateTaskState(ready);
    expect(validated.assurance?.receipt).toBeUndefined();
    expect(validated.assurance?.completionIndex).toBeUndefined();
    expect(classifyAssureCompletion(validated)).toBe("none");

    // Injecting completionIndex via save is rejected
    await expectRejected(
      store.save(
        "adr41-inject",
        {
          ...ready,
          assurance: { ...ready.assurance!, completionIndex: ["ev:check:1"] },
        },
        { create: true },
      ),
    );

    // Injecting assure.completed event via save is rejected
    await expectRejected(
      store.save(
        "adr41-inject",
        {
          ...ready,
          history: [
            ...ready.history,
            {
              sequence: ready.history.length + 1,
              at: "2026-11-23T01:00:00.000Z",
              type: "assure.completed",
              refs: [{ kind: "artifact", ref: "assurance:adr41-inject" }],
            },
          ],
        },
        { create: true },
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ADR 0041: seals v2 receipt + completionIndex + assure.completed atomically and blocks subsequent saves", async () => {
  const root = await createGitRepo();
  try {
    await writeFile(join(root, "artifact.bin"), "binary-payload-v1", "utf8");
    const store = createTaskStateStore(root);
    const ready = buildPassingAssuringState("adr41-seal", {
      externalArtifacts: ["artifact.bin"],
    });
    const expectedArtifacts = observeExternalArtifacts(root, ["artifact.bin"]);
    expect(expectedArtifacts).toBeDefined();

    await seedLegacyTask(root, {
      ...ready,
      assurance: { schemaVersion: 1, evidenceIndex: [] },
    });
    const expectedSnapshot = observeWorktreeSnapshot(root);
    expect(expectedSnapshot).toBeDefined();
    const sealed = await store.save("adr41-seal", ready);
    expect(classifyAssureCompletion(sealed)).toBe("verified");
    expect(sealed.assurance?.receipt?.schemaVersion).toBe(ASSURANCE_RECEIPT_VERSION);
    expect(sealed.assurance?.receipt?.worktreeDigest).toBe(expectedSnapshot);
    expect(sealed.assurance?.receipt?.artifactDigests).toEqual(expectedArtifacts);
    expect(sealed.assurance?.completionIndex).toEqual(["ev:check:1"]);

    const completedEvent = sealed.history.find((e) => e.type === "assure.completed");
    expect(completedEvent).toBeDefined();
    expect((completedEvent as { receiptVersion?: number }).receiptVersion).toBe(2);
    expect((completedEvent as { receiptDigest?: string }).receiptDigest).toBe(
      sealed.assurance?.receipt?.receiptDigest,
    );

    const envelope = computeTaskNextActionEnvelope(sealed);
    expect(envelope.role).toBe("terminal");
    expect(envelope.allowedCommands.some((cmd) => cmd.includes("save"))).toBe(false);

    // Subsequent save is rejected
    await expectRejected(store.save("adr41-seal", { ...sealed, revision: sealed.revision + 1 }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ADR 0041: classifies historical v1 pairs vs incomplete single-half states without backfill", async () => {
  const root = await createGitRepo();
  try {
    const store = createTaskStateStore(root);
    const base = buildPassingAssuringState("adr41-hist");
    const v1Body: Omit<AssuranceReceipt, "receiptDigest"> = {
      schemaVersion: 1,
      taskId: base.taskId,
      contractDigest: base.contractDigest!,
      verifiedSnapshotFingerprint: "workspace:verified",
      evidenceIndexDigest: sha256Prefixed(canonicalize(base.assurance!.evidenceIndex)),
      completedAt: "2026-11-23T01:00:00.000Z",
    };
    const v1Receipt: AssuranceReceipt = {
      ...v1Body,
      receiptDigest: computeAssuranceReceiptDigest(v1Body as AssuranceReceipt),
    };

    const historicalState: TaskState = {
      ...base,
      assurance: {
        ...base.assurance!,
        completionIndex: ["ev:check:1"],
        receipt: v1Receipt,
      },
      history: [
        ...base.history,
        {
          sequence: base.history.length + 1,
          at: "2026-11-23T01:00:00.000Z",
          type: "assure.completed",
          refs: [{ kind: "artifact", ref: `assurance:${base.taskId}` }],
        },
      ],
    };
    await seedLegacyTask(root, historicalState);
    const loadedHist = await store.load("adr41-hist");
    expect(classifyAssureCompletion(loadedHist)).toBe("historical");
    const histEnvelope = computeTaskNextActionEnvelope(loadedHist);
    expect(histEnvelope.activeInvariants).toContain("assure_completion_historical");
    expect(histEnvelope.allowedCommands.some((cmd) => cmd.includes("save"))).toBe(false);

    // Receipt-only state without assure.completed event is incomplete and preserved unchanged on read
    const halfBase = buildPassingAssuringState("adr41-half");
    const halfBody: Omit<AssuranceReceipt, "receiptDigest"> = {
      ...v1Body,
      taskId: "adr41-half",
      contractDigest: halfBase.contractDigest!,
      evidenceIndexDigest: sha256Prefixed(canonicalize(halfBase.assurance!.evidenceIndex)),
    };
    const receiptOnly: TaskState = {
      ...halfBase,
      assurance: {
        ...halfBase.assurance!,
        completionIndex: ["ev:check:1"],
        receipt: {
          ...halfBody,
          receiptDigest: computeAssuranceReceiptDigest(halfBody as AssuranceReceipt),
        },
      },
    };
    await seedLegacyTask(root, receiptOnly);
    const rawBefore = await readFile(join(root, ".forgix/tasks/adr41-half.json"), "utf8");
    const loadedHalf = await store.load("adr41-half");
    const rawAfter = await readFile(join(root, ".forgix/tasks/adr41-half.json"), "utf8");
    expect(rawAfter).toBe(rawBefore);
    expect(classifyAssureCompletion(loadedHalf)).toBe("incomplete");
    const halfEnvelope = computeTaskNextActionEnvelope(loadedHalf);
    expect(halfEnvelope.activeInvariants).toContain("assure_completion_incomplete");
    expect(halfEnvelope.allowedCommands.some((cmd) => cmd.includes("save"))).toBe(false);
    await expectRejected(
      store.save("adr41-half", { ...loadedHalf, revision: loadedHalf.revision + 1 }),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ADR 0041: fails closed when declared external artifact is missing", async () => {
  const root = await createGitRepo();
  try {
    const store = createTaskStateStore(root);
    const ready = buildPassingAssuringState("adr41-missing-art", {
      externalArtifacts: ["missing.tgz"],
    });
    await seedLegacyTask(root, {
      ...ready,
      assurance: { schemaVersion: 1, evidenceIndex: [] },
    });
    await expectRejected(store.save("adr41-missing-art", ready));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

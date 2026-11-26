import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { stringify } from "yaml";
import { HELP_TEXT, parseInvocation, runInvocation } from "../../src/cli.ts";
import { EXIT_CODES, InvocationError, StateStoreError } from "../../src/core/schema.ts";
import { computeRoadmapCandidateDigest, type RoadmapState } from "../../src/roadmap/index.ts";
import { expectRejected, expectThrown } from "../support/expect-error.ts";
import {
  computeContractDigest,
  makeAwaitingApprovalTaskState,
  makeTaskState,
  seedLegacyTask,
} from "../support/helpers-v6.ts";
import { projectProfileInput } from "../support/project-profile.ts";

function buildRoadmapDraft(): RoadmapState {
  const base: RoadmapState = {
    schemaVersion: 1,
    sessionId: "cli-next-action",
    phase: "synthesis",
    codebaseKind: "existing",
    projectMode: "create",
    visualFormat: "tree",
    updatedAt: "2026-11-18T10:00:00.000Z",
    productVisionPath: "docs/product-vision.md",
    productVisionSummary: "Declarative software factory roadmap.",
    themes: [{ id: "t-factory", title: "Factory", summary: "Guardrails and telemetry" }],
    sharedContracts: [
      {
        id: "c-kernel",
        title: "Kernel Spec",
        kind: "formal-spec",
        status: "planned",
        summary: "Formal kernel invariants",
        invariants: ["Safety and liveness hold"],
        verificationHint: "lean4: lake build ForgixKernel",
      },
    ],
    features: [
      {
        id: "f-core",
        title: "Core Guardrails",
        summary: "Deterministic envelopes and telemetry",
        priority: "P0",
        risk: "low",
        wave: 1,
        scopeIn: ["CLI envelopes"],
        scopeOut: ["Cloud service"],
      },
    ],
    workItems: [
      {
        id: "wi-envelope",
        featureId: "f-core",
        title: "Next-Action Envelope",
        objective: "Emit deterministic nextAction on CLI transitions",
        scopeIn: ["src/cli.ts"],
        scopeOut: ["UI"],
        acceptanceCriteria: ["CLI transitions emit nextAction"],
        risk: "low",
        priority: "P0",
        wave: 1,
        blockedBy: [],
        providesContractIds: ["c-kernel"],
      },
    ],
    verificationCheckpoints: [
      {
        id: "cp-wave-1",
        title: "Wave 1 verification",
        scopeType: "wave",
        targetIds: ["wave-1"],
        dependsOnWorkItemIds: ["wi-envelope"],
        checks: ["bun test"],
        independentVerifierRequired: true,
      },
    ],
  };
  const candidateDigest = computeRoadmapCandidateDigest(base);
  return {
    ...base,
    candidateDigest,
    audit: {
      candidateDigest,
      auditedAt: "2026-11-18T10:01:00.000Z",
      auditorContext: "independent-auditor",
      findings: [],
      passed: true,
    },
    approval: {
      approved: true,
      approvedAt: "2026-11-18T10:02:00.000Z",
      digest: candidateDigest,
      actor: "acrazie",
    },
  };
}

describe("CLI Next-Action Envelope, Autonomous Proof Floor, and Telemetry/Retro", () => {
  test("parses telemetry record, telemetry summary, and retro subcommands", () => {
    expect(HELP_TEXT).toContain("telemetry record");
    expect(HELP_TEXT).toContain("telemetry summary");
    expect(HELP_TEXT).toContain("retro");
    expect(parseInvocation(["telemetry", "record"])).toEqual({ command: "telemetry_record" });
    expect(parseInvocation(["telemetry", "summary"])).toEqual({ command: "telemetry_summary" });
    expect(parseInvocation(["retro"])).toEqual({ command: "retro" });
  });

  test("emits nextAction envelope on task, roadmap, and project-profile transitions", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgix-cli-envelope-"));
    execFileSync("git", ["init", "-q", root]);
    try {
      await writeFile(join(root, ".gitignore"), ".forgix/roadmap/\n.forgix/init/\n", "utf8");

      const awaiting = makeAwaitingApprovalTaskState({
        taskId: "env-cli",
        profile: "plan",
        risk: "low",
      });

      const taskValidated = await runInvocation(["task", "validate"], {
        workspaceRoot: root,
        task: { input: JSON.stringify(awaiting) },
      });
      const tvData = taskValidated.data as {
        nextAction: {
          role: string;
          phase: string;
          allowedCommands: string[];
          activeInvariants: string[];
        };
      };
      expect(tvData.nextAction.phase).toBe("GATE");
      expect(tvData.nextAction.role).toBe("gate");
      expect(tvData.nextAction.allowedCommands).toContain(
        "forgix task gate env-cli --approve --digest=<contract-digest>",
      );

      await seedLegacyTask(root, awaiting);
      const taskSaved = await runInvocation(["task", "save", "env-cli"], {
        workspaceRoot: root,
        task: { input: JSON.stringify(awaiting) },
      });
      expect((taskSaved.data as typeof tvData).nextAction.phase).toBe("GATE");

      const gateView = await runInvocation(["task", "gate", "env-cli", "--view"], {
        workspaceRoot: root,
      });
      expect((gateView.data as typeof tvData).nextAction.phase).toBe("GATE");

      const gateApproved = await runInvocation(
        ["task", "gate", "env-cli", "--approve", `--digest=${awaiting.contractDigest}`],
        {
          workspaceRoot: root,
          task: { decidedAt: "2026-11-18T10:05:00.000Z" },
        },
      );
      expect(gateApproved.status).toBe("approved");
      expect((gateApproved.data as typeof tvData).nextAction.phase).toBe("BUILD");
      expect((gateApproved.data as typeof tvData).nextAction.role).toBe("build");

      const profileValidated = await runInvocation(["project-profile", "validate"], {
        workspaceRoot: root,
        projectProfile: { input: stringify(projectProfileInput()) },
      });
      expect((profileValidated.data as typeof tvData).nextAction.phase).toBe("awaiting_approval");

      const profilePublished = await runInvocation(["project-profile", "publish"], {
        workspaceRoot: root,
        projectProfile: { input: stringify(projectProfileInput()) },
      });
      expect((profilePublished.data as typeof tvData).nextAction.phase).toBe("published");

      const draft = buildRoadmapDraft();
      const roadmapSaved = await runInvocation(["roadmap", "session-save"], {
        workspaceRoot: root,
        roadmap: { input: stringify(draft) },
      });
      expect((roadmapSaved.data as typeof tvData).nextAction.phase).toBe("synthesis");

      const roadmapViewed = await runInvocation(["roadmap", "session-view"], {
        workspaceRoot: root,
      });
      expect((roadmapViewed.data as typeof tvData).nextAction.phase).toBe("synthesis");

      const roadmapPublished = await runInvocation(["roadmap", "publish"], {
        workspaceRoot: root,
        roadmap: { now: "2026-11-18T10:10:00.000Z" },
      });
      expect((roadmapPublished.data as typeof tvData).nextAction.phase).toBe("published");

      const selectReady = await runInvocation(["roadmap", "select-ready"], {
        workspaceRoot: root,
      });
      expect((selectReady.data as typeof tvData).nextAction.phase).toBe("execution");

      const cpRecorded = await runInvocation(["roadmap", "checkpoint-record"], {
        workspaceRoot: root,
        roadmap: {
          input: JSON.stringify({
            checkpointId: "cp-wave-1",
            observedRoadmapDigest: (roadmapPublished.data as { contentDigest: string })
              .contentDigest,
            status: "Passed",
            verifiedAt: "2026-11-18T10:15:00.000Z",
            verifierContext: "independent-verifier",
            checksRun: ["bun test", "lean4: lake build ForgixKernel"],
            summary: "Wave 1 verified",
          }),
        },
      });
      expect((cpRecorded.data as typeof tvData).nextAction.phase).toBe("checkpoint");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("refuses autonomous issuance even when the CLI recognizes the command", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgix-cli-proof-floor-"));
    try {
      const awaiting = makeAwaitingApprovalTaskState({
        taskId: "slop-task",
        profile: "plan",
        risk: "low",
      });
      delete awaiting.shape!.contract!.validations[0]!.command;
      awaiting.shape!.contract!.assuranceContract!.operations = [
        {
          ...awaiting.shape!.contract!.assuranceContract!.operations[0]!,
          kind: "user-observation",
        },
      ];
      awaiting.shape!.contract!.digest = computeContractDigest(awaiting.shape!.contract!);
      awaiting.contractDigest = awaiting.shape!.contract!.digest;

      await seedLegacyTask(root, awaiting);

      const denied = await runInvocation(
        ["task", "gate", "slop-task", "--autonomous", "--issue=#99"],
        {
          workspaceRoot: root,
        },
      );
      expect(denied.status).toBe("blocked");
      expect(denied.data).toMatchObject({ reason: "autonomous_authorization_unavailable" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("records telemetry JSONL with secret redaction, summarizes rates, and outputs prioritized retro proposals", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgix-cli-telemetry-"));
    try {
      const rec1 = await runInvocation(["telemetry", "record"], {
        workspaceRoot: root,
        telemetry: {
          now: "2026-11-18T11:00:00.000Z",
          input: JSON.stringify({
            type: "assure.check_failed",
            taskId: "task-1",
            issueId: "issue:lint-escape",
            escapeHatchKind: ["oxlint", "disable"].join("-"),
            phaseBounces: 1,
            detail: "Blocked token ghp_1234567890abcdefghij1234567890",
          }),
        },
      });
      expect(rec1.status).toBe("recorded");

      await runInvocation(["telemetry", "record"], {
        workspaceRoot: root,
        telemetry: {
          now: "2026-11-18T11:02:00.000Z",
          input: JSON.stringify({
            type: "assure.check_failed",
            taskId: "task-2",
            issueId: "issue:lint-escape",
            phaseBounces: 1,
          }),
        },
      });

      await runInvocation(["telemetry", "record"], {
        workspaceRoot: root,
        telemetry: {
          now: "2026-11-18T11:05:00.000Z",
          input: JSON.stringify({
            type: "assure.completed",
            taskId: "task-3",
            firstPassAssure: true,
          }),
        },
      });

      const jsonlRaw = await readFile(join(root, ".forgix", "telemetry", "runs.jsonl"), "utf8");
      expect(jsonlRaw).not.toContain("ghp_1234567890abcdefghij1234567890");
      expect(jsonlRaw).toContain("[REDACTED]");

      const summaryRes = await runInvocation(["telemetry", "summary"], { workspaceRoot: root });
      expect(summaryRes.status).toBe("ok");
      const summaryData = summaryRes.data as {
        totalEvents: number;
        firstPassAssureRate: number;
        recurringIssueIds: string[];
        phaseBounces: number;
        escapeHatchBlocks: number;
      };
      expect(summaryData.totalEvents).toBe(3);
      expect(summaryData.recurringIssueIds).toEqual(["issue:lint-escape"]);
      expect(summaryData.phaseBounces).toBe(2);
      expect(summaryData.escapeHatchBlocks).toBe(1);
      expect(summaryData.firstPassAssureRate).toBeGreaterThan(0);
      expect(summaryData.firstPassAssureRate).toBeLessThan(1);

      const retroRes = await runInvocation(["retro"], { workspaceRoot: root });
      expect(retroRes.status).toBe("ok");
      const retroData = retroRes.data as {
        proposals: Array<{ priority: number; category: string; kind: string; targetPath: string }>;
      };
      expect(retroData.proposals.map((p) => [p.priority, p.category])).toEqual([
        [1, "mechanical_guardrail"],
        [2, "surface_verification_rule"],
        [3, "skill_budget_bounded_doc"],
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("parses guardrails check [--strict] and advertises it in HELP_TEXT and assuring nextAction", async () => {
    expect(HELP_TEXT).toContain("guardrails check [--strict]");
    expect(parseInvocation(["guardrails", "check"])).toEqual({
      command: "guardrails_check",
      strict: false,
    });
    expect(parseInvocation(["guardrails", "check", "--strict"])).toEqual({
      command: "guardrails_check",
      strict: true,
    });
    expect(parseInvocation(["--harness", "claude", "guardrails", "check", "--strict"])).toEqual({
      command: "guardrails_check",
      strict: true,
      harness: "claude",
    });

    for (const badArgv of [
      ["guardrails"],
      ["guardrails", "unknown"],
      ["guardrails", "check", "--unknown"],
      ["guardrails", "check", "--strict", "--strict"],
    ]) {
      expectThrown(
        () => parseInvocation(badArgv),
        (err) => err instanceof InvocationError && err.exitCode === EXIT_CODES.INVALID_INVOCATION,
      );
    }

    const root = await mkdtemp(join(tmpdir(), "forgix-cli-assure-env-"));
    try {
      const assuring = makeTaskState({ taskId: "assure-task", status: "assuring" });
      const validated = await runInvocation(["task", "validate"], {
        workspaceRoot: root,
        task: { input: JSON.stringify(assuring) },
      });
      const data = validated.data as {
        nextAction: { phase: string; role: string; allowedCommands: string[] };
      };
      expect(data.nextAction.phase).toBe("ASSURE");
      expect(data.nextAction.role).toBe("assure");
      expect(data.nextAction.allowedCommands).toContain("forgix guardrails check");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("runs guardrails check passing/blocking, inherits .forgix/project.yaml rules, and blocks in --strict mode", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgix-cli-guardrails-"));
    const oxlintToken = ["oxlint", "disable"].join("-");
    try {
      const emptyPassed = await runInvocation(["guardrails", "check"], {
        workspaceRoot: root,
        guardrails: { input: "{}" },
      });
      expect(emptyPassed.command).toBe("guardrails_check");
      expect(emptyPassed.status).toBe("passed");
      expect(emptyPassed.data).toMatchObject({
        passed: true,
        clean: true,
        nextAction: {
          role: "assure",
          phase: "ASSURE",
          allowedCommands: ["forgix task save <task-id>", "forgix telemetry record"],
          activeInvariants: [
            "protected_surface_write_deny",
            "no_unapproved_escape_hatches",
            "surface_verification_rules",
          ],
        },
      });

      const satisfiedStrict = await runInvocation(["guardrails", "check", "--strict"], {
        workspaceRoot: root,
        guardrails: {
          input: stringify({
            diffText: "+++ b/src/cli.ts\n+const ok = true;\n",
            changedPaths: ["src/cli.ts"],
            executedCommands: ["bun run pack:runtime", "bun run test:runtime"],
            executedVerifiers: ["runtime-evidence"],
          }),
        },
      });
      expect(satisfiedStrict.status).toBe("passed");

      const blockedResult = await runInvocation(["guardrails", "check"], {
        workspaceRoot: root,
        guardrails: {
          input: JSON.stringify({
            diffText: `+++ b/src/cli.ts\n+// ${oxlintToken}\n`,
            changedPaths: ["src/cli.ts", ".forgix/policy.yaml"],
            executedCommands: ["bun test"],
            executedVerifiers: ["command"],
          }),
        },
      });
      expect(blockedResult.command).toBe("guardrails_check");
      expect(blockedResult.status).toBe("blocked");
      expect(blockedResult.data).toMatchObject({
        passed: false,
        clean: false,
        escapeHatches: { passed: false },
        protectedSurfaces: { passed: false, unapprovedPaths: [".forgix/policy.yaml"] },
        surfaceVerification: { passed: false, matchedRuleIds: ["runtime-packaging-surface"] },
        nextAction: {
          role: "assure",
          phase: "ASSURE",
          allowedCommands: ["forgix guardrails check --strict", "forgix telemetry record"],
          activeInvariants: [
            "protected_surface_write_deny",
            "no_unapproved_escape_hatches",
            "surface_verification_rules",
          ],
        },
      });

      await expectRejected(
        () =>
          runInvocation(["guardrails", "check", "--strict"], {
            workspaceRoot: root,
            guardrails: {
              input: JSON.stringify({
                diffText: `+++ b/src/cli.ts\n+// ${oxlintToken}\n`,
                changedPaths: ["src/cli.ts", ".forgix/policy.yaml"],
                executedCommands: [],
                executedVerifiers: [],
              }),
            },
          }),
        (err) =>
          err instanceof StateStoreError &&
          err.code === "state_blocked" &&
          err.exitCode === EXIT_CODES.BLOCKED &&
          err.message.includes(".forgix/policy.yaml") &&
          err.message.includes("runtime-packaging-surface") &&
          err.message.includes("src/cli.ts"),
      );

      const profile = projectProfileInput();
      profile.content.protectedSurfaces = ["docs/locked/**"];
      profile.content.surfaceVerificationRules = [
        {
          id: "custom-api-surface",
          pathGlobs: ["api/**"],
          requiredVerifierKinds: ["command"],
          requiredCommands: ["bun test api"],
        },
      ];
      await runInvocation(["project-profile", "publish"], {
        workspaceRoot: root,
        projectProfile: { input: stringify(profile) },
      });

      const inheritedBlocked = await runInvocation(["guardrails", "check"], {
        workspaceRoot: root,
        guardrails: {
          input: JSON.stringify({
            changedPaths: ["docs/locked/spec.md", "api/handler.ts"],
            executedCommands: [],
            executedVerifiers: [],
          }),
        },
      });
      expect(inheritedBlocked.status).toBe("blocked");
      expect(inheritedBlocked.data).toMatchObject({
        passed: false,
        protectedSurfaces: { unapprovedPaths: ["docs/locked/spec.md"] },
        surfaceVerification: {
          matchedRuleIds: ["custom-api-surface"],
          missingCommands: ["bun test api"],
        },
      });

      const inheritedSatisfied = await runInvocation(["guardrails", "check", "--strict"], {
        workspaceRoot: root,
        guardrails: {
          input: JSON.stringify({
            changedPaths: ["docs/locked/spec.md", "api/handler.ts"],
            approvedPaths: ["docs/locked/**"],
            executedCommands: ["bun test api"],
            executedVerifiers: ["command"],
          }),
        },
      });
      expect(inheritedSatisfied.status).toBe("passed");

      const explicitOverride = await runInvocation(["guardrails", "check", "--strict"], {
        workspaceRoot: root,
        guardrails: {
          input: JSON.stringify({
            changedPaths: ["docs/locked/spec.md"],
            protectedSurfaces: ["custom/other/**"],
            surfaceVerificationRules: [
              {
                id: "other-surface",
                pathGlobs: ["other/**"],
                requiredVerifierKinds: ["command"],
                requiredCommands: ["bun test"],
              },
            ],
          }),
        },
      });
      expect(explicitOverride.status).toBe("passed");

      await Promise.all(
        [
          "[]",
          JSON.stringify({ diffText: 123 }),
          JSON.stringify({ changedPaths: "src/cli.ts" }),
          JSON.stringify({ surfaceVerificationRules: "bad" }),
          JSON.stringify({ surfaceVerificationRules: [{ id: "" }] }),
          JSON.stringify({ surfaceVerificationRules: [{ id: "r1", pathGlobs: "src/**" }] }),
          JSON.stringify({
            surfaceVerificationRules: [
              { id: "r1", pathGlobs: ["src/**"], requiredVerifierKinds: ["bogus"] },
            ],
          }),
          JSON.stringify({
            surfaceVerificationRules: [
              {
                id: "r1",
                pathGlobs: ["src/**"],
                requiredVerifierKinds: ["command"],
                requiredCommands: "bun test",
              },
            ],
          }),
        ].map((badInput) =>
          expectRejected(
            () =>
              runInvocation(["guardrails", "check"], {
                workspaceRoot: root,
                guardrails: { input: badInput },
              }),
            (err) =>
              err instanceof InvocationError && err.exitCode === EXIT_CODES.INVALID_INVOCATION,
          ),
        ),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

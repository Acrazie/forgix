import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInvocation } from "../../src/cli.ts";
import { canonicalize, sha256Prefixed } from "../../src/core/digest.ts";
import { EXIT_CODES, StateStoreError } from "../../src/core/schema.ts";
import {
  MACRO_PHASES,
  TASK_STATUSES,
  applyTaskGateDecision,
  computeNextActionEnvelope,
  computeTaskNextActionEnvelope,
  createTaskStateStore,
  deriveMacroPhase,
  evaluateAutonomousGateEligibility,
  preflightGate,
  renderGateCard,
  renderGateContract,
  renderPlanProjection,
  validateTaskState,
} from "../../src/task/index.ts";
import type {
  AssuranceEvidenceRecord,
  CanonicalChangeContract,
  TaskState,
} from "../../src/types.ts";
import { expectRejected, expectThrown } from "../support/expect-error.ts";
import {
  computeContractDigest,
  makeAwaitingApprovalTaskState,
  makeNewTaskState,
  makeProductDesign,
  makeShapeState,
  makeTaskState,
  seedLegacyTask,
} from "../support/helpers-v6.ts";

describe("task/index", () => {
  test("deriveMacroPhase maps active, blocked, and terminal statuses accurately", () => {
    expect([...MACRO_PHASES]).toEqual(["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE"]);
    expect(TASK_STATUSES).toHaveLength(13);

    expect(deriveMacroPhase(makeTaskState({ status: "new" }))).toBe("INTAKE");
    expect(deriveMacroPhase(makeTaskState({ status: "intaking" }))).toBe("INTAKE");
    expect(deriveMacroPhase(makeTaskState({ status: "awaiting_intake_decision" }))).toBe("INTAKE");
    expect(deriveMacroPhase(makeTaskState({ status: "discovering" }))).toBe("SHAPE");
    expect(deriveMacroPhase(makeTaskState({ status: "awaiting_shape_decision" }))).toBe("SHAPE");
    expect(deriveMacroPhase(makeTaskState({ status: "awaiting_profile_choice" }))).toBe("SHAPE");
    expect(deriveMacroPhase(makeTaskState({ status: "planning" }))).toBe("SHAPE");
    expect(deriveMacroPhase(makeTaskState({ status: "awaiting_approval" }))).toBe("GATE");
    expect(deriveMacroPhase(makeTaskState({ status: "executing" }))).toBe("BUILD");
    expect(deriveMacroPhase(makeTaskState({ status: "assuring" }))).toBe("ASSURE");

    const blockedExec = makeTaskState({ status: "blocked", blockedFrom: "executing" });
    expect(deriveMacroPhase(blockedExec)).toBe("BUILD");

    const cancelledGate = makeTaskState({ status: "cancelled" });
    expect(deriveMacroPhase(cancelledGate)).toBe("GATE");
    expectThrown(
      () => deriveMacroPhase({ ...cancelledGate, history: [] }),
      (error) => error instanceof StateStoreError && error.code === "state_invalid",
    );

    const awaitingFromBlocked = makeTaskState({ status: "blocked", blockedFrom: "assuring" });
    const terminalFromBlocked = validateTaskState({
      ...awaitingFromBlocked,
      status: "failed",
      revision: awaitingFromBlocked.revision + 1,
      resumeTo: undefined,
      resumeReason: undefined,
      history: [
        ...awaitingFromBlocked.history,
        {
          sequence: awaitingFromBlocked.history.length + 1,
          at: "2026-08-01T00:08:00.000Z",
          type: "state.transition",
          from: "blocked",
          to: "failed",
          revision: awaitingFromBlocked.revision + 1,
          sourceFingerprint: "fp:failed-blocked",
          terminalSource: "blocked",
          terminalResumeTo: "assuring",
        },
      ],
    });
    expect(deriveMacroPhase(terminalFromBlocked)).toBe("ASSURE");
  });

  test("renderPlanProjection renders deterministic markdown including guide and risks", () => {
    const baseContract: Omit<CanonicalChangeContract, "digest"> = {
      schemaVersion: 1,
      artifactId: "artifact:proj",
      revision: 1,
      profile: "plan",
      risk: "medium",
      productBaselineRef: "design:product-baseline:1",
      scope: ["Add token bucket limiter."],
      nonGoals: ["Do not change billing."],
      acceptanceCriteria: [
        {
          id: "criterion.rate",
          description: "Limiter enforces 10 req/s per IP.",
          validationIds: ["validation.rate"],
          dependencyNodeId: "criterion.rate",
        },
      ],
      tasks: [
        {
          id: "task.middleware",
          description: "Create rate-limit middleware.",
          criterionIds: ["criterion.rate"],
          dependsOnTaskIds: [],
          dependencyNodeId: "task.middleware",
        },
        {
          id: "task.wire",
          description: "Wire middleware into API router.",
          criterionIds: ["criterion.rate"],
          dependsOnTaskIds: ["task.middleware"],
          dependencyNodeId: "task.wire",
        },
      ],
      validations: [
        {
          id: "validation.rate",
          description: "Run rate limiter integration tests.",
          criterionIds: ["criterion.rate"],
          command: "bun test test/rate.test.ts",
          dependencyNodeId: "validation.rate",
        },
      ],
      risks: [
        {
          id: "risk.burst",
          description: "Burst traffic could exhaust memory.",
          control: "Use bounded LRU map with fixed TTL.",
          dependencyNodeId: "risk.burst",
        },
      ],
      guide: {
        dependencyNodeId: "guide.rate",
        content: ["Apply limiter before auth token parsing."],
        requiredBecause: [
          {
            kind: "non_obvious_order",
            evidenceIds: ["evidence.main"],
            riskIds: ["risk.burst"],
          },
        ],
      },
    };
    const contract: CanonicalChangeContract = {
      ...baseContract,
      digest: computeContractDigest(baseContract),
    };
    const md1 = renderPlanProjection(contract);
    const md2 = renderPlanProjection(contract);
    expect(md1).toBe(md2);
    expect(md1).toContain("Add token bucket limiter.");
    expect(md1).toContain("depends on: task.middleware");
    expect(md1).toContain("`bun test test/rate.test.ts`");
    expect(md1).toContain("Use bounded LRU map with fixed TTL.");
    expect(md1).toContain("Apply limiter before auth token parsing.");
  });

  test("validateTaskState enforces transition, design, freshness, hygiene, and assurance invariants", () => {
    const base = makeNewTaskState({ taskId: "val-task" });
    const shape = makeShapeState({ taskId: "val-task" });

    expectThrown(
      () =>
        validateTaskState({
          ...base,
          status: "planning",
          revision: 1,
          shape,
          history: [
            ...base.history,
            {
              sequence: 2,
              at: "2026-08-01T00:01:00.000Z",
              type: "state.transition",
              from: "new",
              to: "planning",
              revision: 1,
              sourceFingerprint: "fp:bad",
            },
          ],
        }),
      (error) => error instanceof StateStoreError && error.code === "state_invalid",
    );

    const badDimensionDesign = makeProductDesign("bad");
    badDimensionDesign.productBaseline.dimensions =
      badDimensionDesign.productBaseline.dimensions.slice(1);
    expect(() => validateTaskState({ ...base, design: badDimensionDesign })).toThrow(/baseline|5/i);

    const cyclicDesign = makeProductDesign("cyclic");
    cyclicDesign.graph.nodes[0]!.dependsOn = [cyclicDesign.graph.nodes[1]!.id];
    cyclicDesign.graph.nodes[1]!.dependsOn = [cyclicDesign.graph.nodes[0]!.id];
    expect(() => validateTaskState({ ...base, design: cyclicDesign })).toThrow(/cycle/);

    const awaiting = makeAwaitingApprovalTaskState({ taskId: "stale-task" });
    const staleShape = structuredClone(awaiting.shape!);
    staleShape.evidence[0]!.observedValue = "sha256:stale-different";
    expect(preflightGate({ ...awaiting, shape: staleShape }).ready).toBe(false);

    expectThrown(
      () => validateTaskState(makeNewTaskState({ taskId: "sec", objective: "Use /Users/bob/key" })),
      (error) => error instanceof StateStoreError && error.code === "state_invalid",
    );

    const assuring = makeTaskState({ taskId: "pending-obs", status: "assuring", profile: "plan" });
    const opId = assuring.shape!.contract!.assuranceContract!.operations[0]!.id;
    const failedEvidenceBody: Omit<AssuranceEvidenceRecord, "digest"> = {
      schemaVersion: 1,
      evidenceId: "ev:fail",
      operationId: opId,
      subjectIds: ["criterion.main"],
      verifierKind: "command",
      result: "failed",
      verifierDigest: "verifier:bun-test",
      observedFingerprint: "workspace:bad",
      detailRef: "log:fail",
      recordedAt: "2026-08-01T00:07:00.000Z",
    };
    const withFailed = validateTaskState({
      ...assuring,
      assurance: {
        schemaVersion: 1,
        evidenceIndex: [
          {
            ...failedEvidenceBody,
            digest: sha256Prefixed(canonicalize(failedEvidenceBody)),
          },
        ],
      },
    });
    expect(withFailed.assurance?.receipt).toBeUndefined();
  });

  test("GATE preflight, card, intent parsing, and decisions cover all branches", () => {
    const awaiting = makeAwaitingApprovalTaskState({
      taskId: "gate-unit",
      profile: "plan",
      risk: "low",
    });

    const preflight = preflightGate(awaiting);
    expect(preflight.ready).toBe(true);
    expect(preflight.contractDigest).toBe(awaiting.contractDigest ?? null);

    const card = renderGateCard(awaiting, preflight);
    expect(card.split("\n")).toHaveLength(5);
    expect(card).toContain("Plan : 1 tâches · 1 critères · 1 validations");
    expect(card).toContain(`Contrat : ${awaiting.contractDigest!.slice(0, 8)}…`);
    expect(card).toContain("[Approuver] [Modifier] [Rejeter] [Voir]");
    const renderedContract = renderGateContract(awaiting);
    expect(renderedContract).toContain(
      `# Plan Projection: ${awaiting.shape!.contract!.artifactId}`,
    );
    expect(renderedContract).toContain(`Digest: ${awaiting.contractDigest}`);

    expect(evaluateAutonomousGateEligibility(awaiting, { issueRef: "#42" }).eligible).toBe(true);
    expect(evaluateAutonomousGateEligibility(awaiting).eligible).toBe(false);
    const highRiskAwaiting = makeAwaitingApprovalTaskState({
      taskId: "gate-high",
      risk: "high",
    });
    expect(
      evaluateAutonomousGateEligibility(highRiskAwaiting, { issueRef: "acrazie/forgix#42" })
        .eligible,
    ).toBe(false);

    const withQuestion: TaskState = {
      ...awaiting,
      design: {
        ...awaiting.design,
        activeQuestion: {
          schemaVersion: 1,
          id: "q1",
          decisionKey: "dk1",
          kind: "product",
          owner: "intake",
          subjectIds: ["product:scope"],
          prerequisiteIds: [],
          prompt: "Confirm scope boundary?",
          mode: "choice",
          options: [
            { id: "opt1", label: "Narrow", consequences: ["Small diff"] },
            { id: "opt2", label: "Broad", consequences: ["Large diff"] },
          ],
          recommendedOptionId: "opt1",
          recommendationBasis: "Lowest risk",
          confidence: "high",
          priorRole: "planning",
          selectionReason: "Scope check",
          directConsequences: ["Updates baseline"],
          freeFormAllowed: true,
          clarificationCount: 0,
        },
      },
    };
    const questionBlocked = preflightGate(withQuestion);
    expect(questionBlocked.ready).toBe(false);
    expect(questionBlocked.blockers).toContain("active_design_question");

    const invalidQuestion = structuredClone(withQuestion);
    invalidQuestion.design.activeQuestion!.recommendedOptionId = "nonexistent";
    expect(() => validateTaskState(invalidQuestion)).toThrow(/recommendedOptionId|option/i);

    const planningState = makeTaskState({ taskId: "plan-only", status: "planning" });
    expect(preflightGate(planningState).ready).toBe(false);
    expect(renderGateCard(planningState)).toContain("[Approuver] [Modifier] [Rejeter] [Voir]");
    expect(renderGateContract(planningState)).toContain("Aucun contrat canonique disponible.");

    const autoApproved = applyTaskGateDecision(awaiting, {
      decision: "autonomous",
      issueRef: "#42",
      decidedAt: "2026-08-01T00:05:00.000Z",
    });
    expect(autoApproved.state.status).toBe("executing");
    expect(autoApproved.state.planApproval?.actor).toBe("autonomous_policy");
    expect(autoApproved.state.planApproval?.issueRef).toBe("#42");

    const changed = applyTaskGateDecision(awaiting, {
      decision: "change",
      instruction: "Add rollback criteria.",
      decidedAt: "2026-08-01T00:05:00.000Z",
    });
    expect(changed.state.status).toBe("planning");
    expect(changed.state.planApproval).toBeUndefined();

    const rejected = applyTaskGateDecision(awaiting, {
      decision: "reject",
      decidedAt: "2026-08-01T00:05:00.000Z",
    });
    expect(rejected.state.status).toBe("cancelled");

    const planning = makeTaskState({ taskId: "not-gate", status: "planning" });
    expectThrown(
      () => applyTaskGateDecision(planning, { decision: "approve" }),
      (error) =>
        error instanceof StateStoreError &&
        error.code === "state_blocked" &&
        error.exitCode === EXIT_CODES.BLOCKED,
    );
  });

  test("CLI status (global and per-task), resume, and task gate subcommands reject missing tasks cleanly", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgix-task-cli-"));
    try {
      const globalEmpty = await runInvocation(["status"], { workspaceRoot: root });
      expect(globalEmpty.status).toBe("read-only");
      expect(globalEmpty.data).toEqual({ taskId: undefined });

      await expectRejected(
        () => runInvocation(["status", "missing-id"], { workspaceRoot: root }),
        (error) => error instanceof StateStoreError && error.code === "state_not_found",
      );

      const store = createTaskStateStore(root);
      const awaiting = makeAwaitingApprovalTaskState({ taskId: "cli-ops", profile: "plan" });
      await seedLegacyTask(root, awaiting);

      const singleStatus = await runInvocation(["status", "cli-ops"], { workspaceRoot: root });
      expect(singleStatus.status).toBe("awaiting_approval");
      expect((singleStatus.data as { macroPhase: string }).macroPhase).toBe("GATE");

      const resumed = await runInvocation(["resume", "cli-ops"], {
        workspaceRoot: root,
        captureSnapshot: async () => ({
          available: false,
          snapshot: {
            schemaVersion: 1,
            capturedAt: "2026-08-01T00:00:00.000Z",
            plan: "unknown",
            account: {},
            quota: { pressure: "unknown", source: "unknown" },
            models: [],
            warnings: [],
            provenance: { plan: "unknown", quota: "unknown", models: "unknown" },
          },
          error: "unavailable",
        }),
        env: {},
        entrypointPath: "/usr/local/bin/forgix",
      });
      expect(resumed.command).toBe("resume");
      expect((resumed.data as { taskId: string }).taskId).toBe("cli-ops");

      const changeOutcome = await runInvocation(
        ["task", "gate", "cli-ops", "--change=Split migration task"],
        {
          workspaceRoot: root,
          task: { decidedAt: "2026-08-01T00:05:00.000Z" },
        },
      );
      expect(changeOutcome.status).toBe("change_requested");
      expect((await store.load("cli-ops")).status).toBe("planning");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("Autonomous Proof Floor rejects model-inspection and user-observation without executable verifiers", () => {
    const awaiting = makeAwaitingApprovalTaskState({
      taskId: "proof-floor",
      profile: "plan",
      risk: "medium",
    });

    const modelOnly = structuredClone(awaiting);
    delete modelOnly.shape!.contract!.validations[0]!.command;
    modelOnly.shape!.contract!.assuranceContract!.operations = [
      {
        ...modelOnly.shape!.contract!.assuranceContract!.operations[0]!,
        kind: "model-inspection",
      },
    ];
    modelOnly.shape!.contract!.digest = computeContractDigest(modelOnly.shape!.contract!);
    modelOnly.contractDigest = modelOnly.shape!.contract!.digest;

    const modelEligibility = evaluateAutonomousGateEligibility(modelOnly, { issueRef: "#42" });
    expect(modelEligibility.eligible).toBe(false);
    expect(modelEligibility.reasons).toContain("autonomous_proof_floor_violated");

    expectThrown(
      () =>
        applyTaskGateDecision(modelOnly, {
          decision: "autonomous",
          issueRef: "#42",
          decidedAt: "2026-08-01T00:05:00.000Z",
        }),
      (err) => err instanceof StateStoreError && err.code === "state_blocked",
    );

    const formalVerified = structuredClone(awaiting);
    delete formalVerified.shape!.contract!.validations[0]!.command;
    formalVerified.shape!.contract!.assuranceContract!.operations = [
      {
        ...formalVerified.shape!.contract!.assuranceContract!.operations[0]!,
        kind: "lean4",
      },
    ];
    formalVerified.shape!.contract!.digest = computeContractDigest(formalVerified.shape!.contract!);
    formalVerified.contractDigest = formalVerified.shape!.contract!.digest;

    const formalEligibility = evaluateAutonomousGateEligibility(formalVerified, {
      issueRef: "local:wi-formal",
    });
    expect(formalEligibility.eligible).toBe(true);
  });

  test("task envelope omits GATE actions ruled out by persisted state", () => {
    const state = makeAwaitingApprovalTaskState({ taskId: "gate-actions", risk: "high" });
    expect(computeTaskNextActionEnvelope(state).allowedCommands).toContain(
      "forgix task gate gate-actions --approve --digest=<contract-digest>",
    );
    expect(computeTaskNextActionEnvelope(state).allowedCommands).not.toContain(
      "forgix task gate gate-actions --autonomous --issue=<ref>",
    );
    const shape = state.shape!;
    delete shape.evidence[0]!.observedValue;
    shape.sourceFingerprints![0]!.value = "sha256:source-v2";
    expect(preflightGate(state).blockers).toContain("stale_evidence");
    const commands = computeTaskNextActionEnvelope(state).allowedCommands;
    expect(commands).toContain("forgix task gate gate-actions --view");
    expect(commands).not.toContain(
      "forgix task gate gate-actions --approve --digest=<contract-digest>",
    );
  });

  test("computeNextActionEnvelope emits deterministic role, phase, allowedCommands, and activeInvariants", () => {
    for (const status of [
      "new",
      "intaking",
      "discovering",
      "awaiting_profile_choice",
      "planning",
      "awaiting_approval",
      "executing",
      "assuring",
      "blocked",
      "cancelled",
    ] as const) {
      const state = makeTaskState({ taskId: "env-task", status });
      const envelope = computeNextActionEnvelope(state);
      expect(envelope).toEqual(computeTaskNextActionEnvelope(state));
      expect(envelope.phase).toBe(deriveMacroPhase(state));
      expect(envelope.role.length).toBeGreaterThan(0);
      expect(envelope.allowedCommands.length).toBeGreaterThan(0);
      expect(envelope.activeInvariants.length).toBeGreaterThan(0);
    }
  });
});

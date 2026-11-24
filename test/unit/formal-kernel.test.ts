import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG, applyPolicy, resolveConfig } from "../../src/core/config.ts";
import {
  type DependencyGraph,
  canonicalize,
  dependencyClosure,
  sha256Hex,
  sha256Prefixed,
  validateDependencyGraph,
} from "../../src/core/digest.ts";
import { PolicyError, StateStoreError } from "../../src/core/schema.ts";
import {
  type RoadmapState,
  RoadmapError,
  buildWorkItemBranchAndWorktree,
  computeRoadmapCandidateDigest,
  invalidateDependentsOnContractChange,
  publishRoadmap,
  recordCheckpointResult,
  selectEligibleWorkItems,
  transitionRoadmapWorkItemStatus,
  validateRoadmapState,
} from "../../src/roadmap/index.ts";
import {
  TASK_STATUSES,
  applyTaskGateDecision,
  createTaskStateStore,
  deriveMacroPhase,
  evaluateAutonomousGateEligibility,
  preflightGate,
  validateTaskState,
} from "../../src/task/index.ts";
import {
  REQUIRED_FORMAL_FILES,
  REQUIRED_LEAN_THEOREMS,
  buildReachableTaskStateForStatus,
  formalCanTransition,
  formalCheckExecutionSafety,
  formalCheckSharedContractCoverage,
  formalDependencyClosure,
  formalDeriveMacroPhase,
  formalEvaluateAutonomousGate,
  formalEvaluatePolicyMonotonicity,
  formalEvaluateProofFloor,
  formalIsDeterministicVerifier,
  formalSelectParallelWave,
  formalSelectiveContractInvalidation,
  runDifferentialConformanceOracle,
  scanLeanContentForEscapeHatches,
  scanTlaCfgContentForEscapeHatches,
  scanTlaContentForEscapeHatches,
  verifyFormalKernelFiles,
} from "../../scripts/verify-formal-kernel.ts";

const WORD_SORRY = ["sor", "ry"].join("");
const WORD_ADMIT = ["ad", "mit"].join("");
const WORD_UNSAFE = ["un", "safe"].join("");
const WORD_AXIOM = ["ax", "iom"].join("");
const LINE_DEADLOCK_FALSE = ["CHECK_DEADLOCK", "FALSE"].join(" ");

describe("formal specification kernel & escape hatch scanner", () => {
  test("verifies all required TLA+ and Lean 4 formal specification files exist with zero escape hatches", () => {
    const report = verifyFormalKernelFiles();
    expect(report.valid).toBe(true);
    expect(report.violations).toEqual([]);
    for (const requiredFile of REQUIRED_FORMAL_FILES) {
      expect(report.checkedFiles).toContain(requiredFile);
    }
  });

  test("rejects Lean 4 proof holes, unverified modifiers, and missing core theorems", () => {
    const holeSample = `namespace Sample\ntheorem broken : True := by ${WORD_SORRY}\nend Sample\n`;
    expect(scanLeanContentForEscapeHatches("Sample.lean", holeSample).map((v) => v.code)).toContain(
      "lean_proof_hole_sorry",
    );

    const admitSample = `namespace Sample\ntheorem broken : True := by ${WORD_ADMIT}\nend Sample\n`;
    expect(
      scanLeanContentForEscapeHatches("Sample.lean", admitSample).map((v) => v.code),
    ).toContain("lean_proof_hole_admit");

    const unsafeSample = `namespace Sample\n${WORD_UNSAFE} def fastEval : Nat := 0\nend Sample\n`;
    expect(
      scanLeanContentForEscapeHatches("Sample.lean", unsafeSample).map((v) => v.code),
    ).toContain("lean_unsafe_declaration");

    const postulateSample = `namespace Sample\n${WORD_AXIOM} assumed_truth : True\nend Sample\n`;
    expect(
      scanLeanContentForEscapeHatches("Sample.lean", postulateSample).map((v) => v.code),
    ).toContain("lean_unapproved_axiom");

    const incompleteKernel = "namespace ForgixKernel.Invariants\nend ForgixKernel.Invariants\n";
    const missingTheorems = scanLeanContentForEscapeHatches(
      "formal/lean/ForgixKernel/Invariants.lean",
      incompleteKernel,
      { requireCoreTheorems: true },
    );
    expect(missingTheorems.length).toBe(REQUIRED_LEAN_THEOREMS.length);
    expect(missingTheorems[0]?.code).toBe("lean_missing_theorem");
  });

  test("rejects TLA+ disabled deadlock checks, state-pruning constraints, and weakened bounds", () => {
    const badTla = `---- MODULE BadSpec ----\n${LINE_DEADLOCK_FALSE}\n`;
    const tlaViolations = scanTlaContentForEscapeHatches("BadSpec.tla", badTla, [
      "Safety",
      "Liveness",
    ]);
    expect(tlaViolations.map((v) => v.code)).toEqual(
      expect.arrayContaining([
        "tla_missing_module_footer",
        "tla_deadlock_disabled",
        "tla_missing_invariant",
      ]),
    );

    const weakenedCfg = [
      "SPECIFICATION Spec",
      "CONSTANTS",
      "  MaxWorkItems = 2",
      "  MaxParallel = 1",
      "CONSTRAINT StateLimit",
      "INVARIANT Safety",
      "PROPERTY Liveness",
      LINE_DEADLOCK_FALSE,
    ].join("\n");

    const cfgViolations = scanTlaCfgContentForEscapeHatches("RoadmapParallel.cfg", weakenedCfg, {
      MaxWorkItems: 3,
      MaxParallel: 2,
    });
    expect(cfgViolations.map((v) => v.code)).toEqual(
      expect.arrayContaining([
        "tla_cfg_deadlock_disabled",
        "tla_cfg_deadlock_not_enabled",
        "tla_cfg_unapproved_constraint",
        "tla_cfg_weakened_constant_bound",
      ]),
    );
  });
});

describe("differential conformance oracle — TaskLifecycleV6", () => {
  test("passes the complete differential conformance suite across all 169 transitions and invariants", () => {
    const summary = runDifferentialConformanceOracle();
    expect(summary.failures).toEqual([]);
    expect(summary.passed).toBe(true);
    expect(summary.transitionPairsChecked).toBe(TASK_STATUSES.length * TASK_STATUSES.length);
    expect(summary.macroPhaseVectorsChecked).toBe(TASK_STATUSES.length);
    expect(summary.gateVectorsChecked).toBe(64);
    expect(summary.dagClosureVectorsChecked).toBeGreaterThanOrEqual(5);
    expect(summary.contractCoverageVectorsChecked).toBeGreaterThanOrEqual(2);
    expect(summary.parallelRoadmapVectorsChecked).toBeGreaterThanOrEqual(3);
    expect(summary.policyMonotonicityVectorsChecked).toBeGreaterThanOrEqual(3);
  });

  test("enforces digest-bound receipt safety and blocks tampered or unapproved execution states", () => {
    const awaiting = buildReachableTaskStateForStatus("awaiting_approval", "low");
    const approved = applyTaskGateDecision(awaiting, {
      decision: "approve",
      decidedAt: "2026-11-18T00:05:00.000Z",
    }).state;

    const formalValid = formalCheckExecutionSafety({
      status: approved.status,
      risk: approved.risk,
      contractDigest: approved.contractDigest ?? null,
      receiptActor: approved.planApproval?.actor ?? "none",
      receiptDigest: approved.planApproval?.contractDigest ?? null,
      hasOpenQuestion: false,
      hasUnresolvedDecision: false,
      hasValidIssueRef: true,
      proofFloorMet: true,
    });
    expect(formalValid.safe).toBe(true);
    expect(() => validateTaskState(approved)).not.toThrow();

    // Mutating the contract after approval invalidates digest binding in both formal model and runtime
    const mutated = structuredClone(approved);
    mutated.shape!.contract!.scope = ["Mutated scope after gate approval"];
    const newContractDigest = sha256Hex(canonicalize({ ...mutated.shape!.contract!, digest: "" }));
    const formalMutated = formalCheckExecutionSafety({
      status: mutated.status,
      risk: mutated.risk,
      contractDigest: newContractDigest,
      receiptActor: mutated.planApproval?.actor ?? "none",
      receiptDigest: mutated.planApproval?.contractDigest ?? null,
      hasOpenQuestion: false,
      hasUnresolvedDecision: false,
      hasValidIssueRef: true,
      proofFloorMet: true,
    });
    expect(formalMutated.safe).toBe(false);
    expect(formalMutated.violations).toContain("contract_digest_mismatch");
    expect(() => validateTaskState(mutated)).toThrow(StateStoreError);

    // Removing planApproval while in executing status is rejected by both
    const withoutReceipt = structuredClone(approved);
    delete withoutReceipt.planApproval;
    const formalMissing = formalCheckExecutionSafety({
      status: withoutReceipt.status,
      risk: withoutReceipt.risk,
      contractDigest: withoutReceipt.contractDigest ?? null,
      receiptActor: "none",
      receiptDigest: null,
      hasOpenQuestion: false,
      hasUnresolvedDecision: false,
      hasValidIssueRef: true,
      proofFloorMet: true,
    });
    expect(formalMissing.safe).toBe(false);
    expect(formalMissing.violations).toContain("missing_approval_receipt");
    expect(() => validateTaskState(withoutReceipt)).toThrow(StateStoreError);
  });

  test("enforces Autonomous Gate eligibility and Autonomous Proof Floor across verifier kinds", () => {
    expect(formalIsDeterministicVerifier("command")).toBe(true);
    expect(formalIsDeterministicVerifier("runtime-evidence")).toBe(true);
    expect(formalIsDeterministicVerifier("tla-tlc")).toBe(true);
    expect(formalIsDeterministicVerifier("lean4")).toBe(true);
    expect(formalIsDeterministicVerifier("model-inspection")).toBe(false);
    expect(formalIsDeterministicVerifier("user-observation")).toBe(false);

    expect(formalEvaluateProofFloor([["command"], ["tla-tlc", "model-inspection"]])).toBe(true);
    expect(formalEvaluateProofFloor([["lean4"], ["runtime-evidence"]])).toBe(true);
    expect(formalEvaluateProofFloor([["model-inspection"]])).toBe(false);
    expect(formalEvaluateProofFloor([["user-observation"]])).toBe(false);
    expect(formalEvaluateProofFloor([])).toBe(false);

    // Low/medium risk with valid issueRef passes autonomous gate in both formal kernel and runtime
    for (const risk of ["low", "medium"] as const) {
      const state = buildReachableTaskStateForStatus("awaiting_approval", risk);
      const preflight = preflightGate(state);
      expect(
        formalEvaluateAutonomousGate({
          risk,
          hasOpenQuestion: false,
          hasUnresolvedDecision: false,
          hasValidIssueRef: true,
          preflightReady: preflight.ready,
          proofFloorMet: true,
        }),
      ).toBe(true);
      expect(evaluateAutonomousGateEligibility(state, { issueRef: "#42" }).eligible).toBe(true);
      const outcome = applyTaskGateDecision(state, {
        decision: "autonomous",
        issueRef: "#42",
        decidedAt: "2026-11-18T00:05:00.000Z",
      });
      expect(outcome.state.status).toBe("executing");
      expect(outcome.receipt?.actor).toBe("autonomous_policy");
    }

    // High/critical risk is rejected for autonomous gate in both formal kernel and runtime
    for (const risk of ["high", "critical"] as const) {
      const state = buildReachableTaskStateForStatus("awaiting_approval", risk);
      expect(
        formalEvaluateAutonomousGate({
          risk,
          hasOpenQuestion: false,
          hasUnresolvedDecision: false,
          hasValidIssueRef: true,
          preflightReady: true,
          proofFloorMet: true,
        }),
      ).toBe(false);
      expect(evaluateAutonomousGateEligibility(state, { issueRef: "#42" }).eligible).toBe(false);
      expect(() =>
        applyTaskGateDecision(state, {
          decision: "autonomous",
          issueRef: "#42",
          decidedAt: "2026-11-18T00:05:00.000Z",
        }),
      ).toThrow(StateStoreError);
    }
  });

  test("conforms on ASSURE completion receipt synthesis, 2-strike escalation, and blocked terminal resume", async () => {
    const assuring = buildReachableTaskStateForStatus("assuring", "low");
    expect(assuring.assurance?.receipt).toBeUndefined();

    // 2-strike active issue without rootCauseRequired is rejected
    const twoStrikeInvalid = structuredClone(assuring);
    twoStrikeInvalid.assurance = {
      schemaVersion: 1,
      evidenceIndex: [],
      issues: [
        {
          issueId: "issue.flaky",
          operationId: "check:test",
          status: "active",
          correctionAttempts: 2,
          rootCauseRequired: false,
          evidenceRef: "ev:fail",
        },
      ],
    };
    expect(() => validateTaskState(twoStrikeInvalid)).toThrow(StateStoreError);

    // Passing evidence for all acceptance criteria synthesizes a digest-bound AssuranceReceipt
    const completed = structuredClone(assuring);
    completed.assurance = {
      schemaVersion: 1,
      evidenceIndex: [
        {
          schemaVersion: 1,
          evidenceId: "ev.pass.1",
          operationId: "check:test",
          subjectIds: ["criterion.1"],
          verifierKind: "command",
          result: "passed",
          verifierDigest: "sha256:verifier",
          observedFingerprint: "fp:snap:1",
          detailRef: "logs/test.log",
          recordedAt: "2026-11-18T00:07:00.000Z",
          digest: sha256Prefixed({ id: "ev.pass.1" }),
        },
      ],
    };
    // Read-only validation does not synthesize receipt; locked save seals v2 receipt
    expect(validateTaskState(completed).assurance?.receipt).toBeUndefined();
    const repoRoot = mkdtempSync(join(tmpdir(), "forgix-fk-assure-"));
    execFileSync("git", ["init", "-q", repoRoot]);
    try {
      const preAssure = {
        ...completed,
        assurance: { schemaVersion: 1 as const, evidenceIndex: [] },
      };
      const tasksDir = join(repoRoot, ".forgix", "tasks");
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, `${completed.taskId}.json`), JSON.stringify(preAssure), "utf8");
      const savedCompleted = await createTaskStateStore(repoRoot).save(completed.taskId, completed);
      expect(savedCompleted.assurance?.receipt?.contractDigest).toBe(completed.contractDigest);
      expect(savedCompleted.assurance?.receipt?.schemaVersion).toBe(2);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }

    // Blocked -> cancelled derives macro-phase from terminalResumeTo in both formal model and runtime
    const blockedExec = buildReachableTaskStateForStatus("executing", "low");
    const blockedState = validateTaskState({
      ...blockedExec,
      status: "blocked",
      revision: blockedExec.revision + 1,
      resumeTo: "executing",
      resumeReason: "Wait for dependency",
      history: [
        ...blockedExec.history,
        {
          sequence: blockedExec.history.length + 1,
          at: "2026-11-18T00:06:00.000Z",
          type: "state.transition",
          from: "executing",
          to: "blocked",
          revision: blockedExec.revision + 1,
          sourceFingerprint: "fp:block-exec",
        },
      ],
    });
    const cancelledFromBlocked = validateTaskState({
      ...blockedState,
      status: "cancelled",
      revision: blockedState.revision + 1,
      resumeTo: undefined,
      resumeReason: undefined,
      history: [
        ...blockedState.history,
        {
          sequence: blockedState.history.length + 1,
          at: "2026-11-18T00:07:00.000Z",
          type: "state.transition",
          from: "blocked",
          to: "cancelled",
          revision: blockedState.revision + 1,
          sourceFingerprint: "fp:cancel-blocked",
          terminalSource: "blocked",
          terminalResumeTo: "executing",
        },
      ],
    });
    expect(deriveMacroPhase(cancelledFromBlocked)).toBe("BUILD");
    expect(
      formalDeriveMacroPhase({
        status: "cancelled",
        terminalSource: "blocked",
        terminalResumeTo: "executing",
      }),
    ).toBe("BUILD");
    expect(formalCanTransition("cancelled", "intaking")).toBe(false);
  });
});

function makeContractCoverageCandidate(overrides: {
  consumerBlockedBy: string[];
  providerWave: number;
  consumerWave: number;
  contractStatus?: "planned" | "existing" | "verified";
}): RoadmapState {
  return {
    schemaVersion: 1,
    sessionId: "contract-check",
    phase: "audit",
    codebaseKind: "existing",
    projectMode: "create",
    visualFormat: "tree",
    updatedAt: "2026-11-18T00:00:00.000Z",
    themes: [{ id: "t1", title: "Theme", summary: "Summary" }],
    sharedContracts: [
      {
        id: "c-api",
        title: "API Contract",
        kind: "api",
        status: overrides.contractStatus ?? "planned",
        summary: "REST schema",
        invariants: ["Status 200"],
        verificationHint: "bun test",
      },
    ],
    features: [
      {
        id: "f1",
        title: "Feature 1",
        summary: "Summary",
        priority: "P0",
        risk: "low",
        wave: 1,
        scopeIn: ["In"],
        scopeOut: ["Out"],
      },
    ],
    workItems: [
      {
        id: "wi-provider",
        featureId: "f1",
        title: "Provider",
        objective: "Provide c-api",
        scopeIn: ["src/api"],
        scopeOut: ["None"],
        acceptanceCriteria: ["Tested"],
        risk: "low",
        priority: "P0",
        wave: overrides.providerWave,
        blockedBy: [],
        providesContractIds: overrides.contractStatus === "existing" ? [] : ["c-api"],
        consumesContractIds: [],
      },
      {
        id: "wi-consumer",
        featureId: "f1",
        title: "Consumer",
        objective: "Consume c-api",
        scopeIn: ["src/client"],
        scopeOut: ["None"],
        acceptanceCriteria: ["Tested"],
        risk: "low",
        priority: "P1",
        wave: overrides.consumerWave,
        blockedBy: overrides.consumerBlockedBy,
        providesContractIds: [],
        consumesContractIds: ["c-api"],
      },
    ],
  };
}

describe("differential conformance oracle — DAG closure, Shared Contracts, RoadmapParallel & Policy", () => {
  test("matches Lean 4 selective transitive dependency closure and idempotence on DAGs", () => {
    const graph: DependencyGraph = {
      schemaVersion: 1,
      nodes: [
        { id: "n1", kind: "source", dependsOn: [] },
        { id: "n2", kind: "evidence", dependsOn: ["n1"] },
        { id: "n3", kind: "criterion", dependsOn: ["n2"] },
        { id: "n4", kind: "task", dependsOn: ["n3"] },
        { id: "independent", kind: "source", dependsOn: [] },
        { id: "independent.child", kind: "evidence", dependsOn: ["independent"] },
      ],
    };

    const closureN1 = dependencyClosure(graph, ["n1"]);
    const formalN1 = formalDependencyClosure(graph.nodes, ["n1"]);
    expect(closureN1).toEqual(formalN1);
    expect(closureN1).toEqual(["n1", "n2", "n3", "n4"]);
    expect(closureN1).not.toContain("independent");
    expect(closureN1).not.toContain("independent.child");

    // Idempotence: closure(closure(S)) == closure(S)
    expect(dependencyClosure(graph, closureN1)).toEqual(closureN1);
    expect(formalDependencyClosure(graph.nodes, formalN1)).toEqual(formalN1);

    // Cycle rejection
    const cyclicGraph: DependencyGraph = {
      schemaVersion: 1,
      nodes: [
        { id: "a", kind: "task", dependsOn: ["b"] },
        { id: "b", kind: "task", dependsOn: ["a"] },
      ],
    };
    expect(() => validateDependencyGraph(cyclicGraph)).toThrow();
  });

  test("enforces Shared Contract coverage (consumes subset of provides + blockedBy) and wave monotonicity", () => {
    const scenarios = [
      {
        label: "valid ancestor provider in wave 1 -> wave 2",
        consumerBlockedBy: ["wi-provider"],
        providerWave: 1,
        consumerWave: 2,
        contractStatus: "planned" as const,
        expectedValid: true,
      },
      {
        label: "existing contract requires no provider or blockedBy link",
        consumerBlockedBy: [],
        providerWave: 1,
        consumerWave: 1,
        contractStatus: "existing" as const,
        expectedValid: true,
      },
      {
        label: "missing blockedBy link to contract provider",
        consumerBlockedBy: [],
        providerWave: 1,
        consumerWave: 2,
        contractStatus: "planned" as const,
        expectedValid: false,
      },
      {
        label: "wave inversion (consumer in wave 1, provider in wave 2)",
        consumerBlockedBy: ["wi-provider"],
        providerWave: 2,
        consumerWave: 1,
        contractStatus: "planned" as const,
        expectedValid: false,
      },
    ];

    for (const scenario of scenarios) {
      const candidate = makeContractCoverageCandidate(scenario);
      const formal = formalCheckSharedContractCoverage({
        workItems: candidate.workItems.map((w) => ({
          id: w.id,
          wave: w.wave ?? 1,
          blockedBy: w.blockedBy,
          providesContractIds: w.providesContractIds ?? [],
          consumesContractIds: w.consumesContractIds ?? [],
        })),
        contracts: (candidate.sharedContracts ?? []).map((c) => ({
          id: c.id,
          status: c.status,
        })),
      });
      expect(formal.valid).toBe(scenario.expectedValid);
      if (scenario.expectedValid) {
        expect(() => validateRoadmapState(candidate)).not.toThrow();
      } else {
        expect(() => validateRoadmapState(candidate)).toThrow(RoadmapError);
      }
    }
  });

  test("conforms on RoadmapParallel worktree isolation, MaxParallel bound, and checkpoint gating", () => {
    const base: RoadmapState = {
      schemaVersion: 1,
      sessionId: "parallel-sim",
      phase: "synthesis",
      codebaseKind: "existing",
      projectMode: "create",
      visualFormat: "tree",
      updatedAt: "2026-11-18T00:00:00.000Z",
      themes: [{ id: "t1", title: "Parallel", summary: "Parallel execution" }],
      sharedContracts: [
        {
          id: "c-1",
          title: "Contract 1",
          kind: "interface",
          status: "planned",
          summary: "Contract 1",
          invariants: ["Inv 1"],
          verificationHint: "bun test",
        },
      ],
      features: [
        {
          id: "f-w1",
          title: "Wave 1",
          summary: "Wave 1",
          priority: "P0",
          risk: "low",
          wave: 1,
          scopeIn: ["w1"],
          scopeOut: ["none"],
        },
        {
          id: "f-w2",
          title: "Wave 2",
          summary: "Wave 2",
          priority: "P1",
          risk: "medium",
          wave: 2,
          scopeIn: ["w2"],
          scopeOut: ["none"],
        },
      ],
      workItems: [
        {
          id: "wi-1",
          featureId: "f-w1",
          title: "Alpha item",
          objective: "Alpha",
          scopeIn: ["a"],
          scopeOut: ["none"],
          acceptanceCriteria: ["a passes"],
          risk: "low",
          priority: "P0",
          wave: 1,
          blockedBy: [],
          providesContractIds: ["c-1"],
          consumesContractIds: [],
          status: "Ready",
        },
        {
          id: "wi-2",
          featureId: "f-w1",
          title: "Beta item",
          objective: "Beta",
          scopeIn: ["b"],
          scopeOut: ["none"],
          acceptanceCriteria: ["b passes"],
          risk: "low",
          priority: "P1",
          wave: 1,
          blockedBy: [],
          providesContractIds: [],
          consumesContractIds: [],
          status: "Ready",
        },
        {
          id: "wi-3",
          featureId: "f-w2",
          title: "Gamma consumer",
          objective: "Gamma",
          scopeIn: ["g"],
          scopeOut: ["none"],
          acceptanceCriteria: ["g passes"],
          risk: "medium",
          priority: "P1",
          wave: 2,
          blockedBy: ["wi-1", "wi-2"],
          providesContractIds: [],
          consumesContractIds: ["c-1"],
          status: "Backlog",
        },
      ],
      verificationCheckpoints: [
        {
          id: "cp-w1",
          title: "Wave 1 Checkpoint",
          scopeType: "wave",
          targetIds: ["wave-1"],
          dependsOnWorkItemIds: ["wi-1", "wi-2"],
          checks: ["bun test"],
          independentVerifierRequired: true,
          status: "pending",
        },
      ],
    };
    const digest = computeRoadmapCandidateDigest(base);
    const readyToPublish: RoadmapState = {
      ...base,
      candidateDigest: digest,
      audit: {
        candidateDigest: digest,
        auditedAt: "2026-11-18T00:01:00.000Z",
        auditorContext: "auditor",
        findings: [],
        passed: true,
      },
      approval: {
        approved: true,
        approvedAt: "2026-11-18T00:02:00.000Z",
        digest,
        actor: "operator",
      },
    };

    const published = publishRoadmap(readyToPublish);
    const wave1Selection = selectEligibleWorkItems(readyToPublish, {
      limit: 2,
      maxRisk: "medium",
    });
    expect(wave1Selection.eligible.map((e) => e.workItem.id)).toEqual(["wi-1", "wi-2"]);
    expect(wave1Selection.eligible.length).toBeLessThanOrEqual(2);

    // Worktree isolation invariant: concurrent items never share a branch or worktreePath
    const wt1 = buildWorkItemBranchAndWorktree(wave1Selection.eligible[0]!.workItem);
    const wt2 = buildWorkItemBranchAndWorktree(wave1Selection.eligible[1]!.workItem);
    expect(wt1.branch).not.toBe(wt2.branch);
    expect(wt1.worktreePath).not.toBe(wt2.worktreePath);

    // Selective invalidation when c-1 changes after wi-1 is Done and wi-3 is Ready
    let progressed = transitionRoadmapWorkItemStatus(readyToPublish, "wi-1", "Done").state;
    progressed = transitionRoadmapWorkItemStatus(progressed, "wi-2", "Done").state;
    expect(progressed.workItems.find((w) => w.id === "wi-3")?.status).toBe("Ready");

    const invalidated = invalidateDependentsOnContractChange(progressed, ["c-1"], {
      runtimeState: published.runtime,
    });
    const formalInv = formalSelectiveContractInvalidation({
      workItems: progressed.workItems.map((w) => ({
        id: w.id,
        featureId: w.featureId,
        status: w.status ?? "Backlog",
        blockedBy: w.blockedBy,
        consumesContractIds: w.consumesContractIds ?? [],
      })),
      checkpoints: (progressed.verificationCheckpoints ?? []).map((cp) => ({
        id: cp.id,
        scopeType: cp.scopeType,
        targetIds: cp.targetIds,
        dependsOnWorkItemIds: cp.dependsOnWorkItemIds,
      })),
      changedContractIds: ["c-1"],
    });
    expect(invalidated.invalidatedWorkItemIds).toEqual(formalInv.invalidatedWorkItemIds);
    expect(invalidated.invalidatedWorkItemIds).toEqual(["wi-3"]);
    expect(invalidated.state.workItems.find((w) => w.id === "wi-1")?.status).toBe("Done");
    expect(invalidated.state.workItems.find((w) => w.id === "wi-2")?.status).toBe("Done");

    // Passing checkpoint unlocks Wave 2
    const passedRuntime = recordCheckpointResult(published.runtime, {
      observedRoadmapDigest: published.runtime.roadmapDigest,
      checkpointId: "cp-w1",
      status: "Passed",
      verifierContext: "verifier",
      checksRun: ["bun test"],
      summary: "Passed",
    });
    for (const ws of passedRuntime.workItemStates) {
      ws.status = ws.id === "wi-3" ? "Ready" : "Done";
    }
    const unlocked = selectEligibleWorkItems(progressed, {
      limit: 2,
      maxRisk: "medium",
      runtimeState: passedRuntime,
    });
    const formalUnlocked = formalSelectParallelWave({
      workItems: progressed.workItems.map((w) => ({
        id: w.id,
        wave: w.wave ?? 1,
        priority: w.priority,
        risk: w.risk,
        status: w.id === "wi-3" ? "Ready" : "Done",
        blockedBy: w.blockedBy,
      })),
      checkpoints: [
        {
          id: "cp-w1",
          scopeType: "wave",
          targetIds: ["wave-1"],
          dependsOnWorkItemIds: ["wi-1", "wi-2"],
          passed: true,
        },
      ],
      maxParallel: 2,
      maxRisk: "medium",
    });
    expect(unlocked.eligible.map((e) => e.workItem.id)).toEqual(formalUnlocked.eligibleIds);
    expect(unlocked.eligible.map((e) => e.workItem.id)).toEqual(["wi-3"]);
  });

  test("enforces Policy precedence monotonicity against local overlay and flag overrides", () => {
    const resolved = resolveConfig([
      { source: "defaults", value: DEFAULT_CONFIG },
      { source: "user", value: { worktree: { mode: "auto" } } },
      { source: "repo", value: { worktree: { mode: "required" }, harness: "codex" } },
      { source: "local", value: { worktree: { mode: "auto" } } },
      { source: "flags", value: { harness: "antigravity" } },
    ]);

    const formal = formalEvaluatePolicyMonotonicity({
      layers: [
        { source: "defaults", values: { "worktree.mode": "auto", merge: "never" } },
        { source: "user", values: { "worktree.mode": "auto" } },
        { source: "repo", values: { "worktree.mode": "required", harness: "codex" } },
        { source: "local", values: { "worktree.mode": "auto" } },
        { source: "flags", values: { harness: "antigravity" } },
      ],
      requirements: { "worktree.mode": "required" },
      prohibitions: { harness: "claude" },
    });

    expect(formal.allowed).toBe(false);
    expect(formal.violatedPath).toBe("worktree.mode");
    expect(resolved.provenance["worktree.mode"]).toBe("local");
    expect(resolved.provenance.harness).toBe("flags");

    expect(() =>
      applyPolicy(resolved, {
        schemaVersion: 1,
        requirements: { "worktree.mode": "required" },
        prohibitions: { harness: "claude" },
        bounds: {},
        locks: ["worktree.mode"],
      }),
    ).toThrow(PolicyError);
  });
});

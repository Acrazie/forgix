import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const config = { schemaVersion: 1 };
const policy = { schemaVersion: 1, requirements: {}, prohibitions: {}, bounds: {}, locks: [] };

async function api() {
  return import(bundle);
}

function input(mode = "quick", taskId = "task-v2") {
  return {
    taskId,
    mode,
    modeEvidenceRef: `request:${taskId}:mode`,
    configSnapshot: config,
    policySnapshot: policy,
    intake: completeIntake(mode, taskId)
  };
}

function completeIntake(mode, taskId) {
  return {
    schemaVersion: 1,
    brief: {
      schemaVersion: 1,
      objective: `Exercise ${taskId}`,
      successSignal: { description: "Expected state reached", observationMethod: "State assertion" },
      mode,
      risk: mode === "critical" ? "critical" : mode === "standard" ? "medium" : "low",
      provenance: { sourceRefs: ["request"], capturedAt: "2026-07-28T00:00:00.000Z", freshnessRefs: ["test"] },
      technicalUnknowns: []
    },
    decisions: [],
    answeredDecisionKeys: [],
    invalidations: [],
    contradictions: [],
    semanticComplete: true,
    deterministicComplete: true,
    checkpointDue: false,
    semanticRetryCount: 0,
    metrics: {
      modelCalls: 1, questionsAsked: 0, questionsAvoided: 0, distinctQuestions: 0,
      recommendationsAccepted: 0, recommendationsModified: 0, zeroQuestionPath: true,
      lateReopenings: 0, modeChanges: 0
    }
  };
}

function attest(createGuardAttestation, state, ...guards) {
  return guards.map((guard) => createGuardAttestation(state, guard, {
    observedFingerprint: `observed:${guard}:${state.revision}`,
    evidenceRefs: [`evidence:${guard}:${state.revision}`],
    provenance: guard.includes("approval") ? "human-approval" : guard.startsWith("handoff") ? "repository-observation" : "deterministic-check",
    ...(guard === "review_satisfied" ? { result: "not_applicable" } : {})
  }));
}

async function toAwaiting(mode = "quick") {
  const { createGuardAttestation, createState, transition } = await api();
  const state = createState(input(mode, `task-${mode}`));
  return transition(state, "awaiting_mode_confirmation", {
    guardEvidence: attest(createGuardAttestation, state, "effective_constraints_valid")
  });
}

async function toExecuting(mode = "quick") {
  const { createGuardAttestation, transition } = await api();
  const awaiting = await toAwaiting(mode);
  const guards = mode === "quick"
    ? ["intake_complete", "mode_confirmed", "routing_ready", "quick_scope_bounded"]
    : ["intake_complete", "mode_confirmed", "routing_ready", ...(mode === "critical" ? ["critical_workspace_ready"] : [])];
  const target = mode === "quick" ? "executing" : "discovering";
  return transition(awaiting, target, { guardEvidence: attest(createGuardAttestation, awaiting, ...guards) });
}

test("registry is canonical, deeply frozen, and macro-phase derivation is total", async () => {
  const { GUARD_IDS, MACRO_PHASES, STATE_MACHINE, TASK_STATUSES, createState, deriveMacroPhase } = await api();
  assert.deepEqual(TASK_STATUSES, Object.keys(STATE_MACHINE));
  assert.equal(TASK_STATUSES.length, 18);
  const visit = (value) => {
    if (typeof value !== "object" || value === null) return;
    assert.equal(Object.isFrozen(value), true);
    for (const nested of Object.values(value)) visit(nested);
  };
  visit(STATE_MACHINE);
  assert.equal(Object.isFrozen(GUARD_IDS), true);
  assert.equal(Object.isFrozen(MACRO_PHASES), true);
  assert.throws(() => { STATE_MACHINE.finished.transitions.new = { guards: [], conditionalGuards: [] }; }, TypeError);

  for (const status of TASK_STATUSES) {
    if (status === "blocked") assert.equal(deriveMacroPhase({ status, resumeTo: "reviewing", history: [] }), "ASSURE");
    else if (status === "cancelled" || status === "failed") {
      assert.equal(deriveMacroPhase({ status, history: [{ type: "state.transition", from: "executing", to: status, revision: 1, terminalSource: "executing" }] }), "BUILD");
    } else assert.match(deriveMacroPhase({ status, history: [] }), /^(INTAKE|SHAPE|GATE|BUILD|ASSURE|HANDOFF)$/);
  }
  assert.throws(() => deriveMacroPhase({
    status: "failed",
    history: [{ type: "state.transition", from: "blocked", to: "failed", revision: 1, terminalSource: "blocked", terminalResumeTo: "finished" }]
  }), /operational resumeTo/);
  assert.equal(createState(input()).schemaVersion, 2);
});

test("guard IDs cannot assert success; evidence is structured and state-bound", async () => {
  const { createGuardAttestation, createState, transition } = await api();
  const state = createState(input("quick", "guarded"));
  assert.throws(() => transition(state, "awaiting_mode_confirmation", { satisfiedGuards: ["effective_constraints_valid"] }), /Unknown transition options/);
  assert.throws(() => transition(state, "awaiting_mode_confirmation"), /effective_constraints_valid/);

  const evidence = createGuardAttestation(state, "effective_constraints_valid", {
    observedFingerprint: "config:sha256:one",
    evidenceRefs: ["check:config:1"],
    provenance: "deterministic-check"
  });
  const stale = { ...evidence, stateRevision: 4 };
  assert.throws(() => transition(state, "awaiting_mode_confirmation", { guardEvidence: [stale] }), /stale, malformed, or unproven/);
  assert.equal(transition(state, "awaiting_mode_confirmation", { guardEvidence: [evidence] }).status, "awaiting_mode_confirmation");
});

test("terminal success rejects missing or declarative trusted-guard claims", async () => {
  const { createGuardAttestation, transition } = await api();
  let state = await toExecuting("quick");
  state = transition(state, "validating", { guardEvidence: attest(createGuardAttestation, state, "task_authorized") });
  state = transition(state, "verifying", { guardEvidence: attest(createGuardAttestation, state, "validation_fresh", "review_satisfied") });
  assert.deepEqual(state.history.at(-1).guardEvidence.map((item) => item.guard), ["validation_fresh", "review_satisfied"]);
  assert.throws(() => transition(state, "finished_local"), /Unmet transition guards.*verification_complete.*handoff_intent_resolved/);
  assert.throws(() => transition(state, "finished_local", { satisfiedGuards: ["verification_complete", "handoff_intent_resolved"] }), /Unknown transition options/);
  assert.throws(() => transition(state, "finished_local", {
    guardEvidence: attest(createGuardAttestation, state, "verification_complete", "handoff_intent_resolved")
  }), /requires trusted evaluator/);
});

test("resume requires exact target plus reconciliation and target-entry evidence", async () => {
  const { createGuardAttestation, transition } = await api();
  const executing = await toExecuting("quick");
  const blocked = transition(executing, "blocked", { resumeTo: "executing", remainingActions: ["Resume approved task."] });
  assert.throws(() => transition(executing, "blocked", { resumeTo: "new", remainingActions: ["Restart."] }), /operational, non-stable resumeTo/);
  assert.throws(() => transition(blocked, "discovering"), /exact resumeTo/);
  assert.throws(() => transition(blocked, "executing"), /resume_reconciled.*approval_current.*task_authorized/);
  const resumeEvidence = attest(createGuardAttestation, blocked, "resume_reconciled", "approval_current", "task_authorized");
  assert.throws(() => transition({ ...blocked, remainingActions: ["Different destructive action."] }, "executing", {
    guardEvidence: resumeEvidence
  }), /stale, malformed, or unproven/);
  const resumed = transition(blocked, "executing", {
    guardEvidence: resumeEvidence
  });
  assert.equal(resumed.status, "executing");
});

test("critical workspace guard is conditional and never required for Standard", async () => {
  const { createGuardAttestation, transition } = await api();
  const standard = await toAwaiting("standard");
  assert.equal(transition(standard, "discovering", {
    guardEvidence: attest(createGuardAttestation, standard, "intake_complete", "mode_confirmed", "routing_ready")
  }).status, "discovering");

  const critical = await toAwaiting("critical");
  assert.throws(() => transition(critical, "executing", {
    guardEvidence: attest(createGuardAttestation, critical, "intake_complete", "mode_confirmed", "routing_ready", "quick_scope_bounded")
  }), /not allowed for mode critical/);
  assert.throws(() => transition(critical, "discovering", {
    guardEvidence: attest(createGuardAttestation, critical, "intake_complete", "mode_confirmed", "routing_ready")
  }), /critical_workspace_ready/);
  assert.equal(transition(critical, "discovering", {
    guardEvidence: attest(createGuardAttestation, critical, "intake_complete", "mode_confirmed", "routing_ready", "critical_workspace_ready")
  }).status, "discovering");
});

test("pre-build gate is state-bound and Critical completion rejects declarative verification", async () => {
  const { createGateDecision, createGuardAttestation, migrateStateToV2, transition } = await api();
  let standard = await toExecuting("standard"); // discovering
  standard = transition(standard, "planning", { guardEvidence: attest(createGuardAttestation, standard, "discovery_sufficient") });
  assert.throws(() => transition(standard, "blocked", { resumeTo: "awaiting_approval", remainingActions: ["Wait gate."] }), /existing pendingGate/);
  standard = transition(standard, "awaiting_approval", { contractDigest: "sha256:contract", guardEvidence: attest(createGuardAttestation, standard, "discovery_sufficient", "contract_complete") });
  assert.equal(standard.pendingGate, "pre_build");
  const preApproved = createGateDecision(standard, { decision: "approved", evidenceRef: "approval:pre:1" });
  assert.throws(() => transition(standard, "verifying", { gateDecision: preApproved }), /cannot transition/);
  standard = transition(standard, "executing", {
    gateDecision: preApproved,
    guardEvidence: attest(createGuardAttestation, standard, "approval_current", "task_authorized")
  });
  assert.equal(standard.status, "executing");
  assert.equal(standard.history.at(-1).gateDecision.evidenceRef, "approval:pre:1");
  assert.equal(standard.history.at(-1).gateContext, "pre_build");
  const tamperedGate = structuredClone(standard);
  Object.assign(tamperedGate.history.at(-1), { gateContext: "critical_completion", contractDigest: "other" });
  Object.assign(tamperedGate.history.at(-1).gateDecision, { gate: "critical_completion", contractDigest: "other" });
  assert.throws(() => migrateStateToV2(tamperedGate), /invalid gate decision context|gate digest\/context differs/);

  let critical = await toExecuting("critical"); // discovering
  critical = transition(critical, "planning", { guardEvidence: attest(createGuardAttestation, critical, "discovery_sufficient") });
  critical = transition(critical, "awaiting_approval", { contractDigest: "sha256:c", guardEvidence: attest(createGuardAttestation, critical, "discovery_sufficient", "contract_complete") });
  critical = transition(critical, "executing", {
    gateDecision: createGateDecision(critical, { decision: "approved", evidenceRef: "approval:pre:c" }),
    guardEvidence: attest(createGuardAttestation, critical, "approval_current", "task_authorized")
  });
  critical = transition(critical, "validating", { guardEvidence: attest(createGuardAttestation, critical, "task_authorized") });
  critical = transition(critical, "reviewing", { guardEvidence: attest(createGuardAttestation, critical, "validation_fresh") });
  critical = transition(critical, "verifying", { guardEvidence: attest(createGuardAttestation, critical, "review_satisfied") });
  assert.throws(() => transition(critical, "awaiting_approval", { guardEvidence: attest(createGuardAttestation, critical, "verification_complete") }), /requires trusted evaluator/);
});

test("runtime V2 validation rejects schema extras and terminal spoofing", async () => {
  const { StateMigrationError, createGuardAttestation, createState, migrateStateToV2, transition } = await api();
  const base = createState(input("quick", "strict"));
  assert.throws(() => migrateStateToV2({ ...base, unexpected: "accepted" }), (error) => error instanceof StateMigrationError && error.code === "state_invalid");
  const spoof = {
    ...base,
    status: "failed",
    revision: 1,
    history: [{ type: "state.transition", from: "blocked", to: "failed", revision: 1, terminalSource: "blocked", terminalResumeTo: "finished" }]
  };
  assert.throws(() => migrateStateToV2(spoof), (error) => error instanceof StateMigrationError && error.code === "state_invalid");

  let native = await toExecuting("quick");
  native = transition(native, "validating", { guardEvidence: attest(createGuardAttestation, native, "task_authorized") });
  const tamperedHistory = structuredClone(native.history);
  tamperedHistory.find((event) => event.type === "state.transition").guardEvidence[0].stateFingerprint = "tampered";
  assert.throws(() => migrateStateToV2({ ...native, history: tamperedHistory }), (error) => error instanceof StateMigrationError && error.code === "state_invalid");

  const verifying = transition(native, "verifying", { guardEvidence: attest(createGuardAttestation, native, "validation_fresh", "review_satisfied") });
  const fakeFinished = {
    ...verifying,
    status: "finished_local",
    revision: verifying.revision + 1,
    history: [...verifying.history, {
      type: "state.transition",
      from: "verifying",
      to: "finished_local",
      revision: verifying.revision + 1,
      guardEvidence: ["verification_complete", "handoff_intent_resolved"].map((guard) => ({
        schemaVersion: 1,
        guard,
        stateRevision: verifying.revision,
        stateFingerprint: `migration:v1:state:${verifying.revision}`,
        observedFingerprint: "fake",
        evidenceRefs: ["fake"],
        provenance: "migration-history",
        result: "passed"
      })),
      legacyData: { migratedFromSchemaVersion: 1 }
    }]
  };
  assert.throws(() => migrateStateToV2(fakeFinished), (error) => error instanceof StateMigrationError && error.code === "state_invalid");
});

function legacy(overrides = {}) {
  return {
    schemaVersion: 1,
    taskId: "legacy",
    status: "resolving",
    configSnapshot: config,
    policySnapshot: policy,
    issues: [],
    reviewCycle: 0,
    remainingActions: [],
    history: [
      { from: "new", to: "awaiting_mode_confirmation" },
      { from: "awaiting_mode_confirmation", to: "executing" },
      { from: "executing", to: "validating" },
      { from: "validating", to: "resolving" }
    ],
    ...overrides
  };
}

test("pure V1 migration uses exact V1 enum and coherent complete history", async () => {
  const { StateMigrationError, migrateStateToV2 } = await api();
  const base = legacy();
  const original = structuredClone(base);
  const migrated = migrateStateToV2(base);
  assert.equal(migrated.migrationRequired, true);
  assert.equal(migrated.state.status, "resolving_build");
  assert.equal(migrated.state.mode, "quick");
  assert.equal(migrated.state.history.find((event) => event.type === "state.transition").guardEvidence[0].provenance, "migration-history");
  assert.deepEqual(base, original);

  const assure = migrateStateToV2(legacy({
    status: "blocked",
    resumeTo: "resolving",
    remainingActions: ["Fix review finding."],
    history: [
      { from: "new", to: "awaiting_mode_confirmation" },
      { from: "awaiting_mode_confirmation", to: "executing" },
      { from: "executing", to: "validating" },
      { from: "validating", to: "reviewing" },
      { from: "reviewing", to: "resolving" },
      { from: "resolving", to: "blocked" }
    ]
  }));
  assert.equal(assure.state.resumeTo, "resolving_assure");

  assert.throws(() => migrateStateToV2(legacy({ status: "resolving_assure", history: [] })), (error) => error instanceof StateMigrationError && error.code === "state_invalid");
});

test("migration refuses broken chains, unproved terminal success, ambiguous mode, and future versions", async () => {
  const { StateMigrationError, migrateStateToV2 } = await api();
  assert.throws(() => migrateStateToV2(legacy({
    status: "blocked",
    resumeTo: "resolving",
    remainingActions: ["resume"],
    history: [
      { from: "new", to: "awaiting_mode_confirmation" },
      { from: "awaiting_mode_confirmation", to: "executing" },
      { from: "executing", to: "validating" },
      { from: "validating", to: "reviewing" },
      { from: "reviewing", to: "resolving" },
      { from: "resolving", to: "reviewing" },
      { from: "resolving", to: "blocked" }
    ]
  })), (error) => error instanceof StateMigrationError && error.code === "state_invalid");
  assert.throws(() => migrateStateToV2(legacy({ status: "finished_local", history: [] })), (error) => error instanceof StateMigrationError && error.code === "state_invalid");
  assert.throws(() => migrateStateToV2(legacy({
    status: "finished_local",
    history: [
      { from: "new", to: "awaiting_mode_confirmation" },
      { from: "awaiting_mode_confirmation", to: "executing" },
      { from: "executing", to: "validating" },
      { from: "validating", to: "verifying" },
      { from: "verifying", to: "finished_local" }
    ]
  })), (error) => error instanceof StateMigrationError && error.code === "state_migration_ambiguous");
  assert.throws(() => migrateStateToV2(legacy({
    status: "handing_off",
    history: [
      { from: "new", to: "awaiting_mode_confirmation" },
      { from: "awaiting_mode_confirmation", to: "executing" },
      { from: "executing", to: "validating" },
      { from: "validating", to: "verifying" },
      { from: "verifying", to: "handing_off" }
    ]
  })), (error) => error instanceof StateMigrationError && error.code === "state_migration_ambiguous");
  assert.throws(() => migrateStateToV2(legacy({ status: "discovering", history: [
    { from: "new", to: "awaiting_mode_confirmation" },
    { from: "awaiting_mode_confirmation", to: "discovering" }
  ] })), (error) => error instanceof StateMigrationError && error.code === "state_migration_ambiguous");
  assert.throws(() => migrateStateToV2({ schemaVersion: 3, status: "new" }), (error) => error instanceof StateMigrationError && error.code === "state_version_unsupported");
});

test("detects changed configuration snapshots and preserves routing compatibility", async () => {
  const { addRoutingDecision, compareSnapshot, createState } = await api();
  assert.deepEqual(compareSnapshot({ configSnapshot: config, policySnapshot: policy }, { config, policy }), { changed: false, reasons: [] });
  assert.equal(compareSnapshot({ configSnapshot: config, policySnapshot: policy }, { config: { schemaVersion: 2 }, policy }).changed, true);
  const routingSnapshot = {
    schemaVersion: 1,
    capturedAt: "2026-07-12T10:00:00.000Z",
    plan: "plus",
    account: { planType: "plus" },
    quota: { windowDurationMins: 300, usedPercent: 20, pressure: "normal", source: "app-server" },
    models: [{ id: "gpt-5.6-luna", supportedReasoningEfforts: ["low", "medium"] }],
    warnings: [],
    provenance: { plan: "account/read", quota: "account/rateLimits/read", models: "model/list" }
  };
  const state = createState({ ...input("quick", "route"), routingSnapshot });
  const decision = { stage: "discover", model: "gpt-5.6-luna", effort: "medium", quotaPressure: "normal", reason: "safe", warnings: [] };
  assert.deepEqual(addRoutingDecision(state, decision).routingDecisions, [decision]);
  assert.equal(compareSnapshot(state, { config, policy, routingSnapshot: { ...routingSnapshot, capturedAt: "later" } }).changed, false);
});

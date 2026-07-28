import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const config = { schemaVersion: 1 };
const policy = { schemaVersion: 1, requirements: {}, prohibitions: {}, bounds: {}, locks: [] };

async function api() {
  return import(bundle);
}

function input(taskId = "resume-context") {
  return {
    taskId,
    mode: "quick",
    modeEvidenceRef: `request:${taskId}:mode`,
    configSnapshot: config,
    policySnapshot: policy,
    intake: completeIntake("quick", taskId),
    at: "2026-07-18T10:00:00+02:00"
  };
}

function completeIntake(mode, suffix) {
  return {
    schemaVersion: 1,
    brief: {
      schemaVersion: 1,
      objective: `Exercise ${suffix}`,
      successSignal: { description: "Resume path succeeds", observationMethod: "State assertions pass" },
      mode,
      risk: mode === "critical" ? "critical" : mode === "standard" ? "medium" : "low",
      provenance: { sourceRefs: ["request"], capturedAt: "2026-07-28T00:00:00.000Z", freshnessRefs: ["test"] },
      technicalUnknowns: []
    },
    decisions: [], answeredDecisionKeys: [], invalidations: [], contradictions: [],
    semanticComplete: true, deterministicComplete: true, checkpointDue: false, semanticRetryCount: 0,
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
    provenance: "deterministic-check"
  }));
}

function lifecycleInput(mode, suffix) {
  const sourceDigest = `sha256:contract:${mode}:${suffix}`;
  return {
    ...input(`gate-${mode}-${suffix}`),
    mode,
    intake: completeIntake(mode, suffix),
    verificationRequirements: {
      schemaVersion: 1,
      sourceDigest,
      criterionIds: ["criterion-1"],
      mandatoryCheckIds: ["test"]
    }
  };
}

function verificationInput(state) {
  const observation = (id) => ({
    id,
    stateRevision: state.revision,
    observedFingerprint: `sha256:${state.taskId}:${id}`,
    evidenceRef: `evidence:${state.taskId}:${id}`,
    exitCode: 0
  });
  return { criteria: [observation("criterion-1")], mandatoryChecks: [observation("test")] };
}

async function reachPreBuildGate(mode, suffix) {
  const { createGuardAttestation, createState, transition } = await api();
  let state = createState(lifecycleInput(mode, suffix));
  state = transition(state, "awaiting_mode_confirmation", { guardEvidence: attest(createGuardAttestation, state, "effective_constraints_valid") });
  state = transition(state, "discovering", {
    guardEvidence: attest(createGuardAttestation, state, "intake_complete", "mode_confirmed", "routing_ready", ...(mode === "critical" ? ["critical_workspace_ready"] : []))
  });
  state = transition(state, "planning", { guardEvidence: attest(createGuardAttestation, state, "discovery_sufficient") });
  return transition(state, "awaiting_approval", {
    contractDigest: `sha256:contract:${mode}:${suffix}`,
    guardEvidence: attest(createGuardAttestation, state, "discovery_sufficient", "contract_complete")
  });
}

async function reachCriticalVerification(suffix) {
  const { createGateDecision, createGuardAttestation, transition } = await api();
  let state = await reachPreBuildGate("critical", suffix);
  state = transition(state, "executing", {
    gateDecision: createGateDecision(state, { decision: "approved", evidenceRef: `approval:pre:${suffix}` }),
    guardEvidence: attest(createGuardAttestation, state, "approval_current", "task_authorized")
  });
  state = transition(state, "validating", { guardEvidence: attest(createGuardAttestation, state, "task_authorized") });
  state = transition(state, "reviewing", { guardEvidence: attest(createGuardAttestation, state, "validation_fresh") });
  return transition(state, "verifying", { guardEvidence: attest(createGuardAttestation, state, "review_satisfied") });
}

test("new state persists compact resume owners without persisting macroPhase", async () => {
  const { createState, deriveMacroPhase } = await api();
  const state = createState(input());
  assert.equal(Object.hasOwn(state, "macroPhase"), false);
  assert.equal(deriveMacroPhase(state), "INTAKE");
  assert.deepEqual(state.history.map(({ sequence, type }) => ({ sequence, type })), [{ sequence: 1, type: "task.created" }]);
  assert.equal(state.history[0].at, "2026-07-18T08:00:00.000Z");
  assert.deepEqual(state.contextCapsule.fingerprints.map(({ id, kind }) => ({ id, kind })), [
    { id: "config", kind: "config" },
    { id: "policy", kind: "policy" }
  ]);
  assert.equal(JSON.stringify(state).includes("macroPhase"), false);
});

test("resume context stores only owner references, provenance, and fingerprints", async () => {
  const { createState, migrateStateToV2, updateResumeContext } = await api();
  const state = createState(input("owners"));
  const updated = updateResumeContext(state, {
    remainingActions: ["Resume approved task T-3."],
    activeArtifact: { artifactId: "change:17", ownerRef: "artifact:change:17", fingerprint: "sha256:artifact" },
    activeWorktree: { worktreeRef: "git-worktree:task-17", gitFingerprint: "sha256:git" },
    contextCapsule: {
      schemaVersion: 1,
      fingerprints: [
        { id: "git", kind: "git", value: "sha256:git", provenanceRef: "git:HEAD" },
        { id: "artifact", kind: "artifact", value: "sha256:artifact", provenanceRef: "artifact:change:17" }
      ],
      entries: [
        { section: "objective", ownerRef: "artifact:change:17#objective", provenanceRef: "artifact:change:17", fingerprintRefs: ["artifact"] },
        { section: "relevant_code", ownerRef: "repo:symbols:task-17", provenanceRef: "git:HEAD", fingerprintRefs: ["git"] }
      ]
    },
    at: "2026-07-18T08:01:00Z"
  });
  assert.deepEqual(updated.remainingActions, ["Resume approved task T-3."]);
  assert.equal(updated.activeArtifact.ownerRef, "artifact:change:17");
  assert.equal(updated.activeWorktree.worktreeRef, "git-worktree:task-17");
  assert.equal(updated.history.at(-1).type, "context.updated");
  assert.equal(updated.history.at(-1).refs.every((ref) => !Object.hasOwn(ref, "payload")), true);
  assert.throws(() => migrateStateToV2({
    ...updated,
    contextCapsule: {
      ...updated.contextCapsule,
      entries: [{ section: "evidence", ownerRef: "artifact:evidence", provenanceRef: "review:1", fingerprintRefs: ["missing"] }]
    }
  }), /unknown fingerprints/);
  assert.throws(() => migrateStateToV2({ ...updated, detailedEvidence: { output: "secret" } }), /schema validation failed/);
});

test("structured history enforces stable types, RFC 3339 time, monotone sequence, and compact refs", async () => {
  const { createState, migrateStateToV2, recordHistoryEvent } = await api();
  let state = createState(input("events"));
  state = recordHistoryEvent(state, { type: "artifact.recorded", refs: [{ kind: "artifact", ref: "artifact:1", fingerprint: "sha256:one" }], at: "2026-07-18T08:02:00Z" });
  assert.equal(state.history.at(-1).sequence, 2);
  assert.equal(state.history.at(-1).at, "2026-07-18T08:02:00.000Z");
  assert.throws(() => recordHistoryEvent(state, { type: "unknown", refs: [{ kind: "x", ref: "y" }] }), /Unsupported workflow history event type/);
  assert.throws(() => recordHistoryEvent(state, { type: "task.created", refs: [{ kind: "x", ref: "y" }] }), /Unsupported workflow history event type/);
  assert.throws(() => recordHistoryEvent(state, { type: "issue.recorded", refs: [{ kind: "issue", ref: "issue:1" }], at: "yesterday" }), /RFC 3339/);
  assert.throws(() => recordHistoryEvent(state, { type: "issue.recorded", refs: [{ kind: "issue", ref: "line1\nraw-output" }] }), /non-compact references/);
  const tampered = structuredClone(state);
  tampered.history[1].sequence = 9;
  assert.throws(() => migrateStateToV2(tampered), /sequence is non-monotonic/);
});

test("history compacts oldest events into exact D-05 summary and remains resumable", async () => {
  const { HISTORY_LIMIT, createGuardAttestation, createState, guardStateFingerprint, migrateStateToV2, recordHistoryEvent, transition } = await api();
  let state = createState(input("compact"));
  const beforeEventFingerprint = guardStateFingerprint(state);
  for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
    state = recordHistoryEvent(state, {
      type: index % 2 === 0 ? "issue.recorded" : "correction.recorded",
      refs: [{ kind: "issue", ref: `issue:${index}` }],
      at: new Date(Date.UTC(2026, 6, 18, 8, 3, index)).toISOString()
    });
  }
  assert.equal(state.history.length, HISTORY_LIMIT);
  assert.deepEqual({
    removedCount: state.historySummary.removedCount,
    firstSequence: state.historySummary.firstSequence,
    lastSequence: state.historySummary.lastSequence,
    firstRetained: state.history[0].sequence,
    lastRetained: state.history.at(-1).sequence
  }, { removedCount: 6, firstSequence: 1, lastSequence: 6, firstRetained: 7, lastRetained: 206 });
  assert.equal(Object.values(state.historySummary.typeCounts).reduce((sum, count) => sum + count, 0), 6);
  assert.notEqual(guardStateFingerprint(state), beforeEventFingerprint);

  const entryEvidence = attest(createGuardAttestation, state, "effective_constraints_valid");
  state = transition(state, "awaiting_mode_confirmation", { guardEvidence: entryEvidence, at: "2026-07-18T09:00:00Z" });
  assert.equal(state.revision, 1);
  assert.equal(state.history.at(-1).revision, 1);
  assert.equal(state.history.at(-1).sequence, 207);

  for (let index = 0; index < HISTORY_LIMIT; index += 1) {
    state = recordHistoryEvent(state, { type: "context.updated", refs: [{ kind: "context", ref: `capsule:${index}` }] });
  }
  assert.equal(state.history.some((event) => event.type === "state.transition"), false);
  assert.equal(state.historySummary.typeCounts["state.transition"], 1);
  assert.equal(state.historySummary.lastTransition.to, "awaiting_mode_confirmation");
  assert.throws(() => migrateStateToV2({ ...state, status: "validating" }), /latest history status/);
  assert.throws(() => migrateStateToV2({
    ...state,
    historySummary: { ...state.historySummary, lastTransition: { ...state.historySummary.lastTransition, revision: 9 } }
  }), /transition anchor is inconsistent/);
  const resumeEvidence = attest(createGuardAttestation, state, "intake_complete", "mode_confirmed", "routing_ready", "quick_scope_bounded");
  state = transition(state, "executing", { guardEvidence: resumeEvidence });
  assert.equal(state.revision, 2);
  assert.equal(state.history.at(-1).revision, 2);
  assert.equal(state.history.at(-1).from, "awaiting_mode_confirmation");
});

test("compaction preserves Standard gate binding and rejects digest rebinding", async () => {
  const { HISTORY_LIMIT, createGateDecision, createGuardAttestation, migrateStateToV2, recordHistoryEvent, transition } = await api();
  let state = await reachPreBuildGate("standard", "compact-standard");
  for (let index = 0; index < HISTORY_LIMIT; index += 1) {
    state = recordHistoryEvent(state, { type: "context.updated", refs: [{ kind: "context", ref: `standard:${index}` }] });
  }
  assert.equal(state.history.some((event) => event.type === "state.transition"), false);
  assert.deepEqual({
    gateContext: state.historySummary.activeGate.gateContext,
    contractDigest: state.historySummary.activeGate.contractDigest,
    entryFrom: state.historySummary.activeGate.entryFrom
  }, {
    gateContext: "pre_build",
    contractDigest: "sha256:contract:standard:compact-standard",
    entryFrom: "planning"
  });
  assert.throws(() => migrateStateToV2({ ...state, contractDigest: "sha256:rebound" }), /state-bound verification requirements/);
  assert.throws(() => migrateStateToV2({
    ...state,
    historySummary: {
      ...state.historySummary,
      activeGate: { ...state.historySummary.activeGate, contractDigest: "sha256:rebound" }
    }
  }), /active gate anchor/);
  assert.throws(() => migrateStateToV2({
    ...state,
    contractDigest: "sha256:rebound",
    historySummary: {
      ...state.historySummary,
      activeGate: { ...state.historySummary.activeGate, contractDigest: "sha256:rebound" }
    }
  }), /state-bound verification requirements/);

  const decision = createGateDecision(state, { decision: "approved", evidenceRef: "approval:standard:compacted" });
  const executing = transition(state, "executing", {
    gateDecision: decision,
    guardEvidence: attest(createGuardAttestation, state, "approval_current", "task_authorized")
  });
  assert.throws(() => migrateStateToV2({ ...executing, contractDigest: "sha256:rebound" }), /state-bound verification requirements/);
});

test("Critical approval consumes authenticated compacted verification receipt", async () => {
  const {
    HISTORY_LIMIT,
    createGateDecision,
    evaluateCriticalCompletionApproval,
    evaluateVerification,
    migrateStateToV2,
    recordHistoryEvent,
    transition
  } = await api();
  let state = await reachCriticalVerification("compact-critical");
  state = transition(state, "awaiting_approval", { guardEvidence: [evaluateVerification(state, verificationInput(state))] });
  for (let index = 0; index < HISTORY_LIMIT; index += 1) {
    state = recordHistoryEvent(state, { type: "context.updated", refs: [{ kind: "context", ref: `critical:${index}` }] });
  }
  assert.equal(state.history.some((event) => event.type === "state.transition"), false);
  assert.equal(state.historySummary.activeGate.gateContext, "critical_completion");
  assert.equal(state.historySummary.activeGate.verificationReceipt.evaluator, "verification");
  const decision = createGateDecision(state, { decision: "approved", evidenceRef: "approval:critical:compacted" });
  const approval = evaluateCriticalCompletionApproval(state, decision);
  assert.equal(approval.evaluatorReceipt.evaluator, "critical_completion");

  const tampered = structuredClone(state);
  tampered.historySummary.activeGate.verificationReceipt.inputDigest = "sha256:tampered";
  assert.throws(() => migrateStateToV2(tampered), /invalid digest/);
});

test("history refs reject cardinality bombs, oversized payloads, unknown kinds, and oversized totals", async () => {
  const { HISTORY_REFERENCE_LIMIT, createState, recordHistoryEvent } = await api();
  const state = createState(input("bounded-refs"));
  assert.throws(() => recordHistoryEvent(state, {
    type: "issue.recorded",
    refs: Array.from({ length: 10_000 }, (_, index) => ({ kind: "issue", ref: `issue:${index}` }))
  }), new RegExp(`1\\.\\.${HISTORY_REFERENCE_LIMIT}`));
  assert.throws(() => recordHistoryEvent(state, {
    type: "issue.recorded",
    refs: [{ kind: "raw-payload", ref: "issue:1" }]
  }), /malformed or non-compact/);
  assert.throws(() => recordHistoryEvent(state, {
    type: "issue.recorded",
    refs: [{ kind: "issue", ref: `issue:${"x".repeat(600)}` }]
  }), /malformed or non-compact/);
  assert.throws(() => recordHistoryEvent(state, {
    type: "issue.recorded",
    refs: Array.from({ length: HISTORY_REFERENCE_LIMIT }, (_, index) => ({ kind: "issue", ref: `issue:${index}:${"x".repeat(250)}` }))
  }), /compact size bound/);
});

test("owner field values remain backward-compatible and history uses bounded owner tokens", async () => {
  const { createState, migrateStateToV2, updateResumeContext } = await api();
  const longValue = `é ${"x".repeat(700)}`;
  const state = createState({
    ...input("task one tâche-1"),
    modeEvidenceRef: `request mode ${longValue}`
  });
  assert.deepEqual(state.history[0].refs, [
    { kind: "task", ref: "state:taskId" },
    { kind: "mode-evidence", ref: "state:modeEvidenceRef" }
  ]);
  const updated = updateResumeContext(state, {
    activeArtifact: { artifactId: `artifact ${longValue}`, ownerRef: `owner ${longValue}`, fingerprint: `artifact fingerprint ${longValue}` },
    activeWorktree: { worktreeRef: `worktree ${longValue}`, gitFingerprint: `git fingerprint ${longValue}` }
  });
  assert.equal(updated.activeArtifact.artifactId.includes("é "), true);
  assert.equal(updated.activeWorktree.worktreeRef.includes("é "), true);
  assert.deepEqual(updated.history.at(-1).refs.map(({ kind, ref }) => ({ kind, ref })), [
    { kind: "context-capsule", ref: "state:contextCapsule" },
    { kind: "artifact", ref: "state:activeArtifact" },
    { kind: "worktree", ref: "state:activeWorktree" }
  ]);
  assert.equal(updated.history.at(-1).refs.every((ref) => ref.fingerprint === undefined || /^sha256:[a-f0-9]{64}$/.test(ref.fingerprint)), true);

  const legacy = {
    schemaVersion: 1,
    taskId: "tâche one",
    status: "new",
    configSnapshot: config,
    policySnapshot: policy,
    issues: [],
    reviewCycle: 0,
    remainingActions: [],
    history: []
  };
  const migrated = migrateStateToV2(legacy, { mode: "quick", modeEvidenceRef: `migration mode ${longValue}` }).state;
  assert.equal(migrated.taskId, "tâche one");
  assert.equal(migrated.history[0].refs[0].ref, "state:taskId");
});

test("RFC 3339 validation rejects impossible calendars and accepts leap years", async () => {
  const { createState, recordHistoryEvent, validateSchema } = await api();
  const state = createState(input("calendar"));
  for (const invalidAt of ["2026-02-31T10:00:00Z", "2025-02-29T10:00:00Z", "2026-04-31T10:00:00Z", "2026-01-01T24:00:00Z", "2026-01-01T10:00:00+24:00"] ) {
    assert.throws(() => recordHistoryEvent(state, { type: "issue.recorded", refs: [{ kind: "issue", ref: "issue:date" }], at: invalidAt }), /valid RFC 3339 calendar/);
    const invalidState = structuredClone(state);
    invalidState.history[0].at = invalidAt;
    assert.equal(validateSchema("state", invalidState).valid, false, invalidAt);
  }
  const leap = recordHistoryEvent(state, {
    type: "issue.recorded",
    refs: [{ kind: "issue", ref: "issue:leap" }],
    at: "2024-02-29T23:59:59.123+02:00"
  });
  assert.equal(leap.history.at(-1).at, "2024-02-29T21:59:59.123Z");
  assert.equal(validateSchema("state", leap).valid, true);
});

test("P1.1 V2 remains readable and receives deterministic envelope on next write", async () => {
  const { createGuardAttestation, createState, migrateStateToV2, transition } = await api();
  let state = createState(input("legacy-v2"));
  state = transition(state, "awaiting_mode_confirmation", {
    guardEvidence: attest(createGuardAttestation, state, "effective_constraints_valid")
  });
  const legacyV2 = structuredClone(state);
  legacyV2.history = legacyV2.history.filter((event) => event.type === "state.transition");
  for (const event of legacyV2.history) {
    delete event.sequence;
    delete event.at;
  }
  delete legacyV2.contextCapsule;
  assert.deepEqual(migrateStateToV2(legacyV2).state, legacyV2);
  const evidence = attest(createGuardAttestation, legacyV2, "intake_complete", "mode_confirmed", "routing_ready", "quick_scope_bounded");
  const upgraded = transition(legacyV2, "executing", { guardEvidence: evidence, at: "2026-07-18T09:30:00Z" });
  assert.deepEqual(upgraded.history.map(({ sequence }) => sequence), [1, 2]);
  assert.equal(upgraded.history[0].at, "1970-01-01T00:00:00.000Z");
});

test("V1 migration timestamps are pure and terminal source remains retained", async () => {
  const { migrateStateToV2 } = await api();
  const legacy = {
    schemaVersion: 1,
    taskId: "deterministic-v1",
    status: "cancelled",
    configSnapshot: config,
    policySnapshot: policy,
    issues: [],
    reviewCycle: 0,
    remainingActions: [],
    history: [
      { from: "new", to: "awaiting_mode_confirmation", rawOutput: "token=do-not-copy", prompt: "private conversation" },
      { from: "awaiting_mode_confirmation", to: "cancelled" }
    ]
  };
  const migrationOptions = { mode: "quick", modeEvidenceRef: "migration:test:mode" };
  const first = migrateStateToV2(legacy, migrationOptions);
  const second = migrateStateToV2(legacy, migrationOptions);
  assert.deepEqual(first, second);
  assert.equal(first.state.history.find((event) => event.type === "state.transition" && event.to === "cancelled").terminalSource, "awaiting_mode_confirmation");
  assert.equal(first.state.history.every((event) => Number.isFinite(Date.parse(event.at))), true);
  assert.equal(JSON.stringify(first.state).includes("do-not-copy"), false);
  assert.equal(JSON.stringify(first.state).includes("private conversation"), false);
});

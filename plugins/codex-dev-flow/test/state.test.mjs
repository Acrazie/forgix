import assert from "node:assert/strict";
import { test } from "node:test";
import { attest, taskInput, toDiscovering, toGate, toPlanning } from "./helpers-v3.mjs";
const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const api = () => import(bundle);

test("V3 registry is frozen, mode-free, and covers canonical INTAKE/SHAPE statuses", async () => {
  const a = await api();
  assert.deepEqual(a.TASK_STATUSES, Object.keys(a.STATE_MACHINE));
  for (const status of [
    "intaking",
    "discovering",
    "awaiting_profile_choice",
    "planning",
    "awaiting_intake_decision",
  ])
    assert.ok(a.TASK_STATUSES.includes(status));
  for (const removed of ["awaiting_mode_confirmation"])
    assert.equal(a.TASK_STATUSES.includes(removed), false);
  assert.equal(a.GUARD_IDS.includes("mode_confirmed"), false);
  assert.equal(a.GUARD_IDS.includes("profile_selected"), true);
  assert.equal(JSON.stringify(a.buildStateMachineProjection()).includes("modes"), false);
  assert.equal(Object.isFrozen(a.STATE_MACHINE), true);
  assert.equal(a.createState(taskInput()).schemaVersion, 3);
});

test("every Intake enters Discovery; direct BUILD bypass is impossible", async () => {
  const a = await api();
  let state = a.createState(taskInput("no-bypass"));
  state = a.transition(state, "intaking", {
    guardEvidence: attest(a, state, "effective_constraints_valid"),
  });
  assert.throws(() => a.transition(state, "executing"), /Invalid state transition/);
  state = a.transition(state, "discovering", {
    guardEvidence: [
      a.attestIntakeComplete(state, "intake:complete"),
      ...attest(a, state, "routing_ready", "workspace_ready"),
    ],
  });
  assert.equal(state.status, "discovering");
  assert.ok(state.shape);
});

test("Discovery, explicit profile choice, Planning, then generic GATE are enforced", async () => {
  const a = await api();
  const discovering = await toDiscovering(a, "ordered-shape");
  assert.throws(() => a.transition(discovering, "planning"), /Invalid state transition/);
  const planning = await toPlanning(a, "quick", "ordered-shape-2");
  assert.equal(planning.status, "planning");
  assert.equal(planning.shape.preparationProfileChoice.selectedProfile, "quick");
  const gate = await toGate(a, "plan", "ordered-shape-3");
  assert.equal(gate.pendingGate, "pre_build");
  assert.equal(gate.shape.contract.profile, "plan");
});

test("trusted Discovery and Planning guards cannot be forged", async () => {
  const a = await api();
  const state = await toDiscovering(a, "trusted-shape");
  assert.throws(
    () =>
      a.createGuardAttestation(state, "discovery_sufficient", {
        observedFingerprint: "fake",
        evidenceRefs: ["fake"],
        provenance: "deterministic-check",
      }),
    /trusted evaluator/,
  );
  assert.throws(
    () =>
      a.createGuardAttestation(state, "contract_complete", {
        observedFingerprint: "fake",
        evidenceRefs: ["fake"],
        provenance: "deterministic-check",
      }),
    /trusted evaluator/,
  );
});

test("Decision Escalation enters INTAKE and resumes exact SHAPE role", async () => {
  const a = await api();
  const discovering = await toDiscovering(a, "escalation-state");
  const waiting = a.transition(discovering, "awaiting_intake_decision");
  assert.equal(a.deriveMacroPhase(waiting), "INTAKE");
  assert.throws(() => a.transition(waiting, "executing"), /Invalid state transition/);
});

test("V1/V2 are rejected explicitly; no migration API remains", async () => {
  const a = await api();
  for (const schemaVersion of [1, 2])
    assert.throws(
      () => a.loadStateV3({ schemaVersion }),
      (error) =>
        error instanceof a.StateValidationError &&
        error.code === "state_schema_incompatible" &&
        /No migration/.test(error.message),
    );
  assert.equal(a.migrateStateToV2, undefined);
  assert.throws(
    () => a.loadStateV3({ ...a.createState(taskInput("strict")), mode: "quick" }),
    /schema validation failed/,
  );
});

test("GATE decision and blocked resume remain state-bound", async () => {
  const a = await api();
  let state = await toGate(a, "quick", "gate-resume");
  const decision = a.createGateDecision(state, {
    decision: "approved",
    evidenceRef: "approval:pre",
  });
  state = a.transition(state, "executing", {
    gateDecision: decision,
    guardEvidence: attest(a, state, "approval_current", "task_authorized"),
  });
  state = a.transition(state, "blocked", {
    resumeTo: "executing",
    remainingActions: ["Restore write access"],
  });
  assert.throws(() => a.transition(state, "planning"), /exact resumeTo/);
  const resumed = a.transition(state, "executing", {
    guardEvidence: attest(a, state, "resume_reconciled", "approval_current", "task_authorized"),
  });
  assert.equal(resumed.status, "executing");
});

test("durable trusted receipts reject post-persistence tampering", async () => {
  const a = await api();
  const state = await toGate(a, "quick", "receipt-tamper");
  const tampered = structuredClone(state);
  const evidence = tampered.history
    .filter((item) => item.type === "state.transition")
    .flatMap((item) => item.guardEvidence ?? [])
    .find((item) => item.guard === "contract_complete");
  evidence.evaluatorReceipt.inputDigest = "tampered";
  assert.throws(() => a.loadStateV3(tampered), /evaluator receipt.*invalid/i);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { attest, toGate } from "./helpers-v3.mjs";
const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const api = () => import(bundle);

function observation(state, id) { return { id, stateRevision: state.revision, observedFingerprint: `observed:${id}:${state.revision}`, evidenceRef: `evidence:${id}:${state.revision}`, exitCode: 0 }; }
function verification(a, state) { return a.evaluateVerification(state, { criteria: [observation(state, "criterion:1")], mandatoryChecks: [observation(state, "test")] }); }
function localIntent(a, state) { return a.evaluateHandoffIntent(state, { delivery: "local", intentEvidenceRef: `intent:local:${state.revision}`, actions: [] }); }

async function finish(profile) {
  const a = await api(); let state = await toGate(a, profile, `lifecycle-${profile}`);
  state = a.transition(state, "executing", { gateDecision: a.createGateDecision(state, { decision: "approved", evidenceRef: `approval:${profile}` }), guardEvidence: attest(a, state, "approval_current", "task_authorized") });
  state = a.transition(state, "validating", { guardEvidence: attest(a, state, "task_authorized") });
  state = a.transition(state, "verifying", { guardEvidence: attest(a, state, "validation_fresh", "review_satisfied") });
  return a.transition(state, "finished_local", { guardEvidence: [verification(a, state), localIntent(a, state)] });
}

test("Quick and Plan both traverse all six phases", async () => {
  const a = await api();
  for (const profile of ["quick", "plan"]) {
    const state = await finish(profile);
    const phases = new Set(state.history.filter((item) => item.type === "state.transition").map((item) => a.deriveMacroPhase({ ...state, status: item.to, history: state.history.slice(0, state.history.indexOf(item) + 1), ...(item.to === "blocked" ? { resumeTo: item.terminalResumeTo } : {}) })));
    for (const phase of ["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE", "HANDOFF"]) assert.ok(phases.has(phase), `${profile} lacks ${phase}`);
    assert.equal(state.status, "finished_local");
  }
});

test("validation and assurance correction loops remain profile-neutral", async () => {
  const a = await api(); let state = await toGate(a, "plan", "loops-v3");
  state = a.transition(state, "executing", { gateDecision: a.createGateDecision(state, { decision: "approved", evidenceRef: "approval:loops" }), guardEvidence: attest(a, state, "approval_current", "task_authorized") });
  state = a.transition(state, "validating", { guardEvidence: attest(a, state, "task_authorized") });
  state = a.transition(state, "resolving_build", { guardEvidence: attest(a, state, "correction_budget_available") });
  state = a.transition(state, "validating", { guardEvidence: attest(a, state, "correction_budget_available") });
  state = a.transition(state, "reviewing", { guardEvidence: attest(a, state, "validation_fresh") });
  state = a.transition(state, "resolving_assure", { guardEvidence: attest(a, state, "correction_budget_available") });
  state = a.transition(state, "reviewing", { guardEvidence: attest(a, state, "correction_budget_available") });
  state = a.transition(state, "verifying", { guardEvidence: attest(a, state, "review_satisfied") });
  assert.equal(state.status, "verifying");
});

test("risk—not preparation profile—drives critical workspace safeguard", async () => {
  const a = await api();
  assert.deepEqual(a.decideWorktree({ risk: "critical", requested: false, concurrent: false, checkoutSafe: true }), { required: true, reason: "critical_risk" });
  assert.deepEqual(a.decideWorktree({ risk: "low", policyRequired: true, requested: false, concurrent: false, checkoutSafe: true }), { required: true, reason: "policy" });
});

test("trusted terminal guards reject raw attestations and stale observations", async () => {
  const a = await api(); let state = await toGate(a, "quick", "trusted-terminal");
  state = a.transition(state, "executing", { gateDecision: a.createGateDecision(state, { decision: "approved", evidenceRef: "approval:trusted" }), guardEvidence: attest(a, state, "approval_current", "task_authorized") });
  state = a.transition(state, "validating", { guardEvidence: attest(a, state, "task_authorized") });
  state = a.transition(state, "verifying", { guardEvidence: attest(a, state, "validation_fresh", "review_satisfied") });
  assert.throws(() => a.createGuardAttestation(state, "verification_complete", { observedFingerprint: "fake", evidenceRefs: ["fake"], provenance: "deterministic-check" }), /trusted evaluator/);
  assert.throws(() => a.evaluateVerification(state, { criteria: [{ ...observation(state, "criterion:1"), stateRevision: state.revision - 1 }], mandatoryChecks: [observation(state, "test")] }), /stale/);
});

// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { expect, test } from "bun:test";
import { attest, toGate } from "../support/helpers-v5.ts";
const api = async () => sourceApi;

function observation(state, id) {
  return {
    id,
    stateRevision: state.revision,
    observedFingerprint: `observed:${id}:${state.revision}`,
    evidenceRef: `evidence:${id}:${state.revision}`,
    exitCode: 0,
  };
}
function verification(a, state) {
  return a.evaluateVerification(state, {
    criteria: [observation(state, "criterion:1")],
    mandatoryChecks: [observation(state, "test")],
  });
}
async function finish(profile) {
  const a = await api();
  let state = await toGate(a, profile, `lifecycle-${profile}`);
  state = a.transition(state, "executing", {
    gateDecision: a.createGateDecision(state, {
      decision: "approved",
    }),
  });
  state = a.transition(state, "verifying", {
    guardEvidence: attest(a, state, "review_satisfied"),
  });
  return a.transition(state, "finished", {
    guardEvidence: [verification(a, state)],
  });
}

test("Quick and Plan both traverse all five phases", async () => {
  const a = await api();
  for (const profile of ["quick", "plan"]) {
    const state = await finish(profile);
    const phases = new Set(
      state.history
        .filter((item) => item.type === "state.transition")
        .map((item) =>
          a.deriveMacroPhase({
            ...state,
            status: item.to,
            history: state.history.slice(0, state.history.indexOf(item) + 1),
            ...(item.to === "blocked" ? { resumeTo: item.terminalResumeTo } : {}),
          }),
        ),
    );
    for (const phase of ["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE"])
      expect(phases.has(phase), `${profile} lacks ${phase}`).toBeTruthy();
    expect(state.status).toBe("finished");
    expect(state.verificationReceipt).toBeTruthy();
  }
});

test("BUILD is one native execution state and ASSURE owns correction loops", async () => {
  const a = await api();
  let state = await toGate(a, "plan", "loops-v5");
  state = a.transition(state, "executing", {
    gateDecision: a.createGateDecision(state, {
      decision: "approved",
    }),
  });
  expect(a.deriveMacroPhase(state)).toBe("BUILD");
  expect(a.STATE_MACHINE.executing.capsule.produces).toEqual([]);
  state = a.transition(state, "reviewing");
  state = a.transition(state, "resolving_assure", {
    guardEvidence: attest(a, state, "correction_budget_available"),
  });
  state = a.transition(state, "reviewing", {
    guardEvidence: attest(a, state, "correction_budget_available"),
  });
  state = a.transition(state, "verifying", { guardEvidence: attest(a, state, "review_satisfied") });
  expect(state.status).toBe("verifying");
});

test("risk—not preparation profile—drives critical workspace safeguard", async () => {
  const a = await api();
  expect(
    a.decideWorktree({ risk: "critical", requested: false, concurrent: false, checkoutSafe: true }),
  ).toEqual({ required: true, reason: "critical_risk" });
  expect(
    a.decideWorktree({
      risk: "low",
      policyRequired: true,
      requested: false,
      concurrent: false,
      checkoutSafe: true,
    }),
  ).toEqual({ required: true, reason: "policy" });
});

test("trusted terminal guards reject raw attestations and stale observations", async () => {
  const a = await api();
  let state = await toGate(a, "quick", "trusted-terminal");
  state = a.transition(state, "executing", {
    gateDecision: a.createGateDecision(state, {
      decision: "approved",
    }),
  });
  state = a.transition(state, "verifying", {
    guardEvidence: attest(a, state, "review_satisfied"),
  });
  expect(() =>
    a.createGuardAttestation(state, "verification_complete", {
      observedFingerprint: "fake",
      evidenceRefs: ["fake"],
      provenance: "deterministic-check",
    }),
  ).toThrow(/trusted evaluator/);
  expect(() =>
    a.evaluateVerification(state, {
      criteria: [{ ...observation(state, "criterion:1"), stateRevision: state.revision - 1 }],
      mandatoryChecks: [observation(state, "test")],
    }),
  ).toThrow(/stale/);
});

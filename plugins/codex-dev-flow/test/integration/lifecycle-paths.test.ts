// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { expect, test } from "bun:test";
import { toGate } from "../support/helpers-v6.ts";
const api = async () => sourceApi;

async function finish(profile) {
  const a = await api();
  let state = await toGate(a, profile, `lifecycle-${profile}`);
  state = a.transition(state, "executing", {
    gateDecision: a.createGateDecision(state, {
      decision: "approved",
    }),
  });
  state = a.transition(state, "assuring");
  const operation = state.shape.contract.assuranceContract.operations[0];
  state = a.recordAssuranceObservation(state, {
    evidenceId: `evidence:${operation.id}`,
    operationId: operation.id,
    result: "passed",
    verifierDigest: "verifier:bun-test",
    observedFingerprint: "workspace:verified",
    detailRef: "log:bun-test",
  });
  return a.completeAssurance(state, {
    verifiedSnapshotFingerprint: "workspace:verified",
    currentFingerprints: { [operation.id]: "workspace:verified" },
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
    expect(state.status).toBe("assuring");
    expect(state.assurance.receipt).toBeTruthy();
    expect(state.history.at(-1).type).toBe("assure.completed");
  }
});

test("BUILD is one native execution state and ASSURE owns operations, not status loops", async () => {
  const a = await api();
  let state = await toGate(a, "plan", "loops-v5");
  state = a.transition(state, "executing", {
    gateDecision: a.createGateDecision(state, {
      decision: "approved",
    }),
  });
  expect(a.deriveMacroPhase(state)).toBe("BUILD");
  expect(a.STATE_MACHINE.executing.capsule.produces).toEqual([]);
  state = a.transition(state, "assuring");
  expect(state.status).toBe("assuring");
  const operationId = state.shape.contract.assuranceContract.operations[0].id;
  state = a.recordTaskAssuranceIssue(state, {
    issueId: "issue:stable",
    operationId,
    evidenceRef: "evidence:finding",
  });
  state = a.recordTaskCorrectionAttempt(state, "issue:stable");
  state = a.recordTaskCorrectionAttempt(state, "issue:stable");
  expect(state.assurance.issues[0].rootCauseRequired).toBe(true);
  state = a.resolveTaskAssuranceIssue(state, "issue:stable");
  expect(state.assurance.issues[0].status).toBe("resolved");
  expect(a.TASK_STATUSES).not.toContain("reviewing");
  expect(a.TASK_STATUSES).not.toContain("verifying");
  expect(a.TASK_STATUSES).not.toContain("finished");
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

test("ASSURE rejects stale observations and incomplete coverage", async () => {
  const a = await api();
  let state = await toGate(a, "quick", "trusted-terminal");
  state = a.transition(state, "executing", {
    gateDecision: a.createGateDecision(state, {
      decision: "approved",
    }),
  });
  state = a.transition(state, "assuring");
  expect(() =>
    a.completeAssurance(state, {
      verifiedSnapshotFingerprint: "workspace:current",
      currentFingerprints: {},
    }),
  ).toThrow(/evidence|coverage/i);
});

// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { expect, test } from "bun:test";
import { attest, taskInput, toDiscovering, toGate, toPlanning } from "../support/helpers-v6.ts";
import { expectThrown } from "../support/expect-error.ts";
const api = async () => sourceApi;

test("V6 registry is frozen, mode-free, and covers canonical INTAKE/SHAPE statuses", async () => {
  const a = await api();
  expect(a.TASK_STATUSES).toEqual(Object.keys(a.STATE_MACHINE));
  for (const status of [
    "intaking",
    "discovering",
    "awaiting_shape_decision",
    "awaiting_profile_choice",
    "planning",
    "awaiting_intake_decision",
  ])
    expect(a.TASK_STATUSES.includes(status)).toBeTruthy();
  for (const removed of [
    "awaiting_mode_confirmation",
    "reviewing",
    "resolving_assure",
    "verifying",
    "finished",
  ])
    expect(a.TASK_STATUSES.includes(removed)).toBe(false);
  expect(a.GUARD_IDS.includes("mode_confirmed")).toBe(false);
  expect(a.GUARD_IDS.includes("profile_selected")).toBe(true);
  expect(JSON.stringify(a.buildStateMachineProjection()).includes("modes")).toBe(false);
  expect(Object.isFrozen(a.STATE_MACHINE)).toBe(true);
  expect(a.createState(taskInput()).schemaVersion).toBe(6);
});

test("every Intake enters Discovery; direct BUILD bypass is impossible", async () => {
  const a = await api();
  let state = a.createState(taskInput("no-bypass"));
  state = a.transition(state, "intaking", {
    guardEvidence: attest(a, state, "effective_constraints_valid"),
  });
  expect(() => a.transition(state, "executing")).toThrow(/Invalid state transition/);
  state = a.transition(state, "discovering", {
    guardEvidence: [
      a.attestIntakeComplete(state, "intake:complete"),
      ...attest(a, state, "routing_ready", "workspace_ready"),
    ],
  });
  expect(state.status).toBe("discovering");
  expect(state.shape).toBeTruthy();
});

test("Discovery, explicit profile choice, Planning, then generic GATE are enforced", async () => {
  const a = await api();
  const discovering = await toDiscovering(a, "ordered-shape");
  expect(() => a.transition(discovering, "planning")).toThrow(/Invalid state transition/);
  const planning = await toPlanning(a, "quick", "ordered-shape-2");
  expect(planning.status).toBe("planning");
  expect(planning.shape.preparationProfileChoice.selectedProfile).toBe("quick");
  const gate = await toGate(a, "plan", "ordered-shape-3");
  expect(gate.contractDigest).toBe(gate.shape.contract.digest);
  expect(gate.pendingGate).toBeUndefined();
  expect(gate.shape.contract.profile).toBe("plan");
});

test("trusted Discovery and Planning guards cannot be forged", async () => {
  const a = await api();
  const state = await toDiscovering(a, "trusted-shape");
  expect(() =>
    a.createGuardAttestation(state, "discovery_sufficient", {
      observedFingerprint: "fake",
      evidenceRefs: ["fake"],
      provenance: "deterministic-check",
    }),
  ).toThrow(/trusted evaluator/);
  expect(() =>
    a.createGuardAttestation(state, "contract_complete", {
      observedFingerprint: "fake",
      evidenceRefs: ["fake"],
      provenance: "deterministic-check",
    }),
  ).toThrow(/trusted evaluator/);
});

test("linked product decisions enter INTAKE while technical decisions remain SHAPE", async () => {
  const a = await api();
  const discovering = await toDiscovering(a, "escalation-state");
  const waiting = a.transition(discovering, "awaiting_intake_decision");
  expect(a.deriveMacroPhase(waiting)).toBe("INTAKE");
  expect(() => a.transition(waiting, "executing")).toThrow(/Invalid state transition/);
  const technical = a.transition(discovering, "awaiting_shape_decision");
  expect(a.deriveMacroPhase(technical)).toBe("SHAPE");
});

test("V1 through V5 are rejected explicitly; no migration API remains", async () => {
  const a = await api();
  for (const schemaVersion of [1, 2, 3, 4, 5])
    expectThrown(
      () => a.loadStateV6({ schemaVersion }),
      (error) =>
        error instanceof a.StateValidationError &&
        error.code === "state_schema_incompatible" &&
        /No migration/.test(error.message),
    );
  expect(a.migrateStateToV2).toBe(undefined);
  expect(() => a.loadStateV6({ ...a.createState(taskInput("strict")), mode: "quick" })).toThrow(
    /schema validation failed/,
  );
});

test("GATE decision and blocked resume remain state-bound", async () => {
  const a = await api();
  let state = await toGate(a, "quick", "gate-resume");
  const decision = a.createGateDecision(state, {
    decision: "approved",
  });
  state = a.transition(state, "executing", {
    gateDecision: decision,
  });
  expect(state.planApproval.contractDigest).toBe(state.contractDigest);
  state = a.transition(state, "blocked", {
    resumeTo: "executing",
    resumeReason: "Restore write access",
  });
  expect(() => a.transition(state, "planning")).toThrow(/exact resumeTo/);
  const resumed = a.transition(state, "executing", {
    guardEvidence: attest(a, state, "resume_reconciled", "approval_current"),
  });
  expect(resumed.status).toBe("executing");
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
  expect(() => a.loadStateV6(tampered)).toThrow(/evaluator receipt.*invalid/i);
});

test("Autonomous Gate Receipt requires low/medium eligibility and valid issueRef", async () => {
  const a = await api();
  let state = await toGate(a, "quick", "auto-receipt");
  expect(() =>
    a.createGateDecision(state, {
      decision: "approved",
      actor: "autonomous_policy",
    }),
  ).toThrow(/issueRef/);

  const receipt = a.createGateDecision(state, {
    decision: "approved",
    actor: "autonomous_policy",
    issueRef: "acrazie/forgix#42",
    at: "2026-11-13T10:00:00.000Z",
  });
  expect(receipt.actor).toBe("autonomous_policy");
  expect(receipt.issueRef).toBe("acrazie/forgix#42");

  state = a.transition(state, "executing", { gateDecision: receipt });
  expect(state.planApproval?.actor).toBe("autonomous_policy");
  expect(state.planApproval?.issueRef).toBe("acrazie/forgix#42");
  expect(() => a.loadStateV6(state)).not.toThrow();

  expect(() =>
    a.loadStateV6({
      ...state,
      planApproval: { ...receipt, actor: "autonomous_policy", issueRef: undefined },
    }),
  ).toThrow(/PlanApprovalReceipt/);
});

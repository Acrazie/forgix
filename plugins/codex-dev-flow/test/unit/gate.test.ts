// @ts-nocheck -- dynamic fixtures exercise persisted boundary validation.
import * as api from "../../src/cli.ts";
import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { attest, toGate } from "../support/helpers-v6.ts";

test("GATE preflight and card are deterministic, bounded, and profile-neutral", async () => {
  const states = await Promise.all(
    ["quick", "plan"].map((profile) => toGate(api, profile, `gate-card-${profile}`)),
  );
  for (const state of states) {
    expect(api.preflightGate(state)).toEqual({
      ready: true,
      contractDigest: state.contractDigest,
    });
    const first = api.renderGateCard(state);
    expect(api.renderGateCard(state)).toBe(first);
    expect(first.split("\n")).toHaveLength(5);
    expect(first).toContain(`Plan : 1 tâches · 1 critères · 1 validations`);
    expect(first).toContain(`Contrat : ${state.contractDigest.slice(0, 8)}…`);
    expect(first).toContain("[Voir]");
  }
});

test("GATE primitive has no model, network, discovery, or subprocess adapter", () => {
  const source = readFileSync(new URL("../../src/gate.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(/node:child_process|spawn|execFile|fetch\s*\(|app-server|modelCall/);
  expect(source).not.toMatch(/from\s+["']\.\/app-server|from\s+["']\.\/bridge/);
});

test("GATE accepts only explicit deterministic intents", () => {
  expect(api.parseGateIntent("approuver")).toEqual({ kind: "approved" });
  expect(api.parseGateIntent("APPROVE")).toEqual({ kind: "approved" });
  expect(api.parseGateIntent("modifier: utiliser une API locale")).toEqual({
    kind: "change_requested",
    instruction: "utiliser une API locale",
  });
  expect(api.parseGateIntent("rejeter")).toEqual({ kind: "rejected" });
  expect(api.parseGateIntent("voir")).toEqual({ kind: "view" });
  expect(api.parseGateIntent("modifier")).toEqual({
    kind: "invalid",
    reason: "instruction_required",
  });
  expect(api.parseGateIntent("continue")).toEqual({ kind: "invalid", reason: "ambiguous" });
  expect(api.parseGateIntent("")).toEqual({ kind: "invalid", reason: "empty" });
});

test("GATE view is read-only and renders canonical contract", async () => {
  const state = await toGate(api, "quick", "gate-view");
  const before = structuredClone(state);
  const output = api.renderGateContract(state);
  expect(JSON.parse(output).digest).toBe(state.contractDigest);
  expect(state).toEqual(before);
});

test("GATE decisions have exact distinct transitions and bounded history", async () => {
  let approved = await toGate(api, "quick", "gate-approved");
  const approvedDecision = api.createGateDecision(approved, {
    decision: "approved",
    at: "2026-08-02T00:00:00.000Z",
  });
  approved = api.transition(approved, "executing", {
    gateDecision: approvedDecision,
  });
  expect(approved.planApproval).toEqual(approvedDecision);
  expect(approved.planApproval.actor).toBe("user");
  expect(JSON.stringify(approved.planApproval)).not.toContain("conversation");

  let changed = await toGate(api, "plan", "gate-changed");
  expect(() => api.createGateDecision(changed, { decision: "change_requested" })).toThrow(
    /instruction reference/,
  );
  changed = api.transition(changed, "planning", {
    gateDecision: api.createGateDecision(changed, {
      decision: "change_requested",
      instructionRef: "decision:gate-change-1",
    }),
  });
  expect(changed.status).toBe("planning");
  expect(changed.planApproval).toBeUndefined();

  let rejected = await toGate(api, "quick", "gate-rejected");
  rejected = api.transition(rejected, "cancelled", {
    terminalSource: "awaiting_approval",
    gateDecision: api.createGateDecision(rejected, { decision: "rejected" }),
  });
  expect(rejected.status).toBe("cancelled");
});

test("approval reuse requires unchanged canonical digest", async () => {
  let state = await toGate(api, "quick", "gate-digest");
  state = api.transition(state, "executing", {
    gateDecision: api.createGateDecision(state, { decision: "approved" }),
  });
  expect(attest(api, state, "approval_current")).toHaveLength(1);
  expect(() => api.loadStateV6({ ...state, planApproval: undefined })).toThrow(
    /PlanApprovalReceipt/,
  );
  const changed = { ...state, contractDigest: "different" };
  expect(() => attest(api, changed, "approval_current")).toThrow(/PlanApprovalReceipt/);
});

test("GATE preflight returns targeted owner without mutating state", async () => {
  const state = await toGate(api, "quick", "gate-route");
  expect(api.preflightGate({ ...state, contractDigest: "different" })).toEqual({
    ready: false,
    route: "planning",
    reason: "contract_digest_mismatch",
  });
  expect(
    api.preflightGate({ ...state, shape: { ...state.shape, activeTechnicalDecisionId: "open" } }),
  ).toEqual({
    ready: false,
    route: "awaiting_shape_decision",
    reason: "technical_decision_open",
  });
  expect(api.preflightGate({ ...state, shape: undefined })).toEqual({
    ready: false,
    route: "blocked",
    reason: "gate_state_invalid",
  });
});

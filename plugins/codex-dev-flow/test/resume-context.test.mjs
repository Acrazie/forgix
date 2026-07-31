import assert from "node:assert/strict";
import { test } from "node:test";
import { attest, taskInput, toDiscovering, toPlanning } from "./helpers-v3.mjs";
const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const api = () => import(bundle);

test("new V3 state stores compact owners and no derived macroPhase", async () => {
  const a = await api(); const state = a.createState(taskInput("owners"));
  assert.equal("macroPhase" in state, false);
  assert.equal(state.contextCapsule.entries.every((item) => item.ownerRef && item.provenanceRef), true);
  assert.equal(a.deriveMacroPhase(state), "INTAKE");
});

test("Shape work survives resume unchanged; no reset-all API exists", async () => {
  const a = await api(); let state = await toPlanning(a, "quick", "shape-resume");
  const before = structuredClone(state.shape);
  state = a.transition(state, "blocked", { resumeTo: "planning", remainingActions: ["Continue Planning"] });
  state = a.transition(state, "planning", { guardEvidence: [a.evaluateDiscoveryGuard(state, state.shape.evaluatorReceipts.find((item) => item.evaluator === "discovery")), ...attest(a, state, "resume_reconciled", "profile_selected")] });
  assert.deepEqual(state.shape, before);
  assert.equal(a.resetShape, undefined);
});

test("history references remain bounded and reject payloads", async () => {
  const a = await api(); const state = a.createState(taskInput("bounded"));
  assert.throws(() => a.recordHistoryEvent(state, { type: "context.updated", refs: [] }), /requires 1-/);
  assert.throws(() => a.recordHistoryEvent(state, { type: "context.updated", refs: Array.from({ length: 17 }, (_, i) => ({ kind: "context", ref: `context:${i}` })) }), /requires 1-/);
  assert.throws(() => a.recordHistoryEvent(state, { type: "context.updated", refs: [{ kind: "unknown", ref: "x" }] }), /invalid reference/);
});

test("history compaction retains deterministic summary and remains valid", async () => {
  const a = await api(); let state = a.createState(taskInput("compact"));
  for (let i = 0; i < a.HISTORY_LIMIT + 5; i++) state = a.recordHistoryEvent(state, { type: "context.updated", refs: [{ kind: "context", ref: `context:${i}` }], at: new Date(Date.UTC(2026, 6, 29, 0, 0, i)).toISOString() });
  assert.equal(state.history.length, a.HISTORY_LIMIT);
  assert.ok(state.historySummary.removedCount > 0);
  assert.equal(a.loadStateV3(state).taskId, "compact");
});

test("guard evidence is bound to current Shape fingerprint", async () => {
  const a = await api(); const state = await toDiscovering(a, "fingerprint");
  const evidence = a.createGuardAttestation(state, "workspace_ready", { observedFingerprint: "workspace", evidenceRefs: ["workspace"], provenance: "deterministic-check" });
  const changed = a.updateShapeState(state, { ...state.shape, invalidations: [...state.shape.invalidations, { rootIds: [], invalidatedNodeIds: [], reason: "test" }] }, { type: "shape.checkpoint", refs: [{ kind: "shape", ref: "shape:checkpoint" }] });
  assert.notEqual(a.guardStateFingerprint(state), a.guardStateFingerprint(changed));
  assert.throws(() => a.transition(changed, "awaiting_intake_decision", { guardEvidence: [evidence] }), /not applicable|stale/);
});

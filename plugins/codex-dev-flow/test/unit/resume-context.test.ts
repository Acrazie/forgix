// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { expect, test } from "bun:test";
import { attest, taskInput, toDiscovering, toPlanning } from "../support/helpers-v5.ts";
const api = async () => sourceApi;

test("new V5 state stores compact owners and no derived macroPhase", async () => {
  const a = await api();
  const state = a.createState(taskInput("owners"));
  expect("macroPhase" in state).toBe(false);
  expect(state.contextCapsule.entries.every((item) => item.ownerRef && item.provenanceRef)).toBe(
    true,
  );
  expect(a.deriveMacroPhase(state)).toBe("INTAKE");
});

test("Shape work survives resume unchanged; no reset-all API exists", async () => {
  const a = await api();
  let state = await toPlanning(a, "quick", "shape-resume");
  const before = structuredClone(state.shape);
  state = a.transition(state, "blocked", {
    resumeTo: "planning",
    resumeReason: "Continue Planning",
  });
  state = a.transition(state, "planning", {
    guardEvidence: [
      a.evaluateDiscoveryGuard(
        state,
        state.shape.evaluatorReceipts.find((item) => item.evaluator === "discovery"),
      ),
      ...attest(a, state, "resume_reconciled", "profile_selected"),
    ],
  });
  expect(state.shape).toEqual(before);
  expect(a.resetShape).toBe(undefined);
});

test("history references remain bounded and reject payloads", async () => {
  const a = await api();
  const state = a.createState(taskInput("bounded"));
  expect(() => a.recordHistoryEvent(state, { type: "context.updated", refs: [] })).toThrow(
    /requires 1-/,
  );
  expect(() =>
    a.recordHistoryEvent(state, {
      type: "context.updated",
      refs: Array.from({ length: 17 }, (_, i) => ({ kind: "context", ref: `context:${i}` })),
    }),
  ).toThrow(/requires 1-/);
  expect(() =>
    a.recordHistoryEvent(state, {
      type: "context.updated",
      refs: [{ kind: "unknown", ref: "x" }],
    }),
  ).toThrow(/invalid reference/);
});

test("history compaction retains deterministic summary and remains valid", async () => {
  const a = await api();
  let state = a.createState(taskInput("compact"));
  for (let i = 0; i < a.HISTORY_LIMIT + 5; i++)
    state = a.recordHistoryEvent(state, {
      type: "context.updated",
      refs: [{ kind: "context", ref: `context:${i}` }],
      at: new Date(Date.UTC(2026, 6, 29, 0, 0, i)).toISOString(),
    });
  expect(state.history.length).toBe(a.HISTORY_LIMIT);
  expect(state.historySummary.removedCount > 0).toBeTruthy();
  expect(a.loadStateV5(state).taskId).toBe("compact");
});

test("guard evidence is bound to current Shape fingerprint", async () => {
  const a = await api();
  const state = await toDiscovering(a, "fingerprint");
  const evidence = a.createGuardAttestation(state, "workspace_ready", {
    observedFingerprint: "workspace",
    evidenceRefs: ["workspace"],
    provenance: "deterministic-check",
  });
  const changed = a.updateShapeState(
    state,
    {
      ...state.shape,
      invalidations: [
        ...state.shape.invalidations,
        { rootIds: [], invalidatedNodeIds: [], reason: "test" },
      ],
    },
    { type: "shape.checkpoint", refs: [{ kind: "shape", ref: "shape:checkpoint" }] },
  );
  expect(a.guardStateFingerprint(state)).not.toBe(a.guardStateFingerprint(changed));
  expect(() =>
    a.transition(changed, "awaiting_intake_decision", { guardEvidence: [evidence] }),
  ).toThrow(/not applicable|stale/);
});

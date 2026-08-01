import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { taskInput } from "./helpers-v3.mjs";
const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const stateSchemaUrl = new URL("../schemas/state.schema.json", import.meta.url);
const api = () => import(bundle);

test("state schema is strict V3 and contains no legacy mode contract", async () => {
  const schema = JSON.parse(await readFile(stateSchemaUrl, "utf8"));
  assert.equal(schema.title, "Codex Dev Flow task state V3");
  assert.equal(schema.properties.schemaVersion.const, 3);
  assert.equal(schema.additionalProperties, false);
  assert.equal("mode" in schema.properties, false);
  assert.equal("modeConfirmed" in schema.properties, false);
  for (const status of ["intaking", "awaiting_profile_choice", "awaiting_intake_decision"])
    assert.ok(schema.$defs.status.enum.includes(status));
});

test("runtime V3 validation rejects extras and old schemas", async () => {
  const a = await api();
  const state = a.createState(taskInput("schema-v3"));
  assert.equal(a.loadStateV3(state).schemaVersion, 3);
  assert.throws(() => a.loadStateV3({ ...state, unexpected: true }), /schema validation failed/);
  assert.throws(
    () => a.loadStateV3({ schemaVersion: 2 }),
    (error) => error.code === "state_schema_incompatible",
  );
});

test("registry projection has guards, capsules, events, and no mode arrays", async () => {
  const a = await api();
  const projection = a.buildStateMachineProjection();
  assert.deepEqual(projection.macroPhases, [
    "INTAKE",
    "SHAPE",
    "GATE",
    "BUILD",
    "ASSURE",
    "HANDOFF",
  ]);
  assert.equal(JSON.stringify(projection).includes('"modes"'), false);
  const discovering = projection.states.find((item) => item.status === "discovering");
  assert.ok(
    discovering.transitions.some(
      (item) =>
        item.target === "awaiting_profile_choice" && item.guards.includes("discovery_sufficient"),
    ),
  );
  assert.ok(discovering.events.includes("decision.escalated"));
});

test("Quick and Plan share one Planning state and generic GATE boundary", async () => {
  const a = await api();
  const planning = a.STATE_MACHINE.planning.transitions;
  assert.deepEqual(planning.awaiting_approval.guards, [
    "discovery_sufficient",
    "profile_selected",
    "contract_complete",
  ]);
  assert.equal("executing" in a.STATE_MACHINE.intaking.transitions, false);
  assert.equal("awaiting_mode_confirmation" in a.STATE_MACHINE, false);
});

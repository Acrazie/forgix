// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { readFile } from "node:fs/promises";
import { expect, test } from "bun:test";
import { taskInput } from "../support/helpers-v5.ts";
import { expectThrown } from "../support/expect-error.ts";
const stateSchemaUrl = new URL("../../schemas/state.schema.json", import.meta.url);
const lifecycleProjectionUrl = new URL(
  "../../docs/lifecycle-contract.projection.json",
  import.meta.url,
);
const api = async () => sourceApi;

test("state schema is strict V5 and contains no legacy mode contract", async () => {
  const schema = JSON.parse(await readFile(stateSchemaUrl, "utf8"));
  expect(schema.title).toBe("Codex Dev Flow task state V5");
  expect(schema.properties.schemaVersion.const).toBe(5);
  expect(schema.additionalProperties).toBe(false);
  expect("mode" in schema.properties).toBe(false);
  expect("modeConfirmed" in schema.properties).toBe(false);
  for (const status of ["intaking", "awaiting_profile_choice", "awaiting_intake_decision"])
    expect(schema.$defs.status.enum.includes(status)).toBeTruthy();
  for (const removed of [
    "validating",
    "resolving_build",
    "handing_off",
    "ready_for_handoff",
    "finished_local",
  ])
    expect(schema.$defs.status.enum.includes(removed)).toBe(false);
});

test("runtime V5 validation rejects extras and old schemas", async () => {
  const a = await api();
  const state = a.createState(taskInput("schema-v5"));
  expect(a.loadStateV5(state).schemaVersion).toBe(5);
  expect(() => a.loadStateV5({ ...state, unexpected: true })).toThrow(/schema validation failed/);
  expectThrown(
    () => a.loadStateV5({ schemaVersion: 4 }),
    (error) =>
      error instanceof Error && "code" in error && error.code === "state_schema_incompatible",
  );
});

test("registry projection has guards, capsules, events, and no mode arrays", async () => {
  const a = await api();
  const projection = a.buildStateMachineProjection();
  expect(JSON.parse(await readFile(lifecycleProjectionUrl, "utf8"))).toEqual(projection);
  expect(projection.macroPhases).toEqual(["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE"]);
  expect(JSON.stringify(projection).toLowerCase()).not.toContain("handoff");
  expect(JSON.stringify(projection).includes('"modes"')).toBe(false);
  const discovering = projection.states.find((item) => item.status === "discovering");
  expect(
    discovering.transitions.some(
      (item) =>
        item.target === "awaiting_profile_choice" && item.guards.includes("discovery_sufficient"),
    ),
  ).toBeTruthy();
  expect(discovering.events.includes("decision.escalated")).toBeTruthy();
});

test("Quick and Plan share one Planning state and generic GATE boundary", async () => {
  const a = await api();
  const planning = a.STATE_MACHINE.planning.transitions;
  expect(planning.awaiting_approval.guards).toEqual([
    "discovery_sufficient",
    "profile_selected",
    "contract_complete",
  ]);
  expect("executing" in a.STATE_MACHINE.intaking.transitions).toBe(false);
  expect("awaiting_mode_confirmation" in a.STATE_MACHINE).toBe(false);
  expect(a.STATE_MACHINE.executing.transitions.reviewing.guards).toEqual([]);
  expect(a.STATE_MACHINE.executing.transitions.verifying.guards).toEqual(["review_satisfied"]);
  expect(a.STATE_MACHINE.executing.capsule.produces).toEqual([]);
});

test("public config has no approval bypass or external delivery contract", async () => {
  const schema = JSON.parse(
    await readFile(new URL("../../schemas/config.schema.json", import.meta.url), "utf8"),
  );
  const serialized = JSON.stringify(schema).toLowerCase();
  expect(serialized).not.toMatch(/approval|bypass|handoff|pullrequest/);
});

test("project profile schemas separate portable shared and absolute local data", async () => {
  const a = await api();
  const shared = JSON.parse(
    await readFile(new URL("../../schemas/project-profile.schema.json", import.meta.url), "utf8"),
  );
  const local = JSON.parse(
    await readFile(
      new URL("../../schemas/project-profile-local.schema.json", import.meta.url),
      "utf8",
    ),
  );
  const session = JSON.parse(
    await readFile(
      new URL("../../schemas/project-init-state.schema.json", import.meta.url),
      "utf8",
    ),
  );
  expect(shared.additionalProperties).toBe(false);
  expect(shared.required).toContain("approval");
  expect(shared.properties.content.properties.decisions.maxItems).toBe(512);
  expect(shared.properties.approval.properties.actor.const).toBe("user");
  expect(local.additionalProperties).toBe(false);
  expect(local.properties.servicePaths.items.properties.path.type).toBe("string");
  expect(session.properties.activeQuestion.properties.options.maxItems).toBe(3);
  expect(session.properties).not.toHaveProperty("transcript");
  expect(a.validateSchema("project-profile", {}).valid).toBe(false);
  expect(a.validateSchema("project-profile-local", {}).valid).toBe(false);
  expect(a.validateSchema("project-init-state", {}).valid).toBe(false);
});

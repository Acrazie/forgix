import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { StateStoreError, validateSchema } from "../../src/core/schema.ts";
import { MACRO_PHASES, TASK_STATUSES, validateTaskState } from "../../src/task/index.ts";
import { expectThrown } from "../support/expect-error.ts";
import { makeTaskState } from "../support/helpers-v6.ts";

const stateSchemaUrl = new URL("../../schemas/state.schema.json", import.meta.url);

test("state schema is strict V6 and contains no legacy mode or retired fields", async () => {
  const schema = JSON.parse(await readFile(stateSchemaUrl, "utf8")) as {
    title: string;
    additionalProperties: boolean;
    properties: Record<string, { const?: number }>;
    $defs: { status: { enum: string[] } };
  };
  expect(schema.title).toBe("Forgix task state V6");
  expect(schema.properties.schemaVersion?.const).toBe(6);
  expect(schema.additionalProperties).toBe(false);
  for (const removedProp of [
    "mode",
    "modeConfirmed",
    "intake",
    "benchmarkEnabled",
    "evaluatorReceipts",
  ]) {
    expect(removedProp in schema.properties).toBe(false);
  }
  for (const status of [
    "intaking",
    "discovering",
    "awaiting_shape_decision",
    "awaiting_profile_choice",
    "planning",
    "awaiting_intake_decision",
    "assuring",
  ]) {
    expect(schema.$defs.status.enum.includes(status)).toBe(true);
  }
  for (const removedStatus of [
    "validating",
    "resolving_build",
    "handing_off",
    "ready_for_handoff",
    "finished_local",
    "reviewing",
    "resolving_assure",
    "verifying",
    "finished",
  ]) {
    expect(schema.$defs.status.enum.includes(removedStatus)).toBe(false);
  }
  expect([...TASK_STATUSES] as string[]).toEqual(schema.$defs.status.enum);
  expect([...MACRO_PHASES] as string[]).toEqual(["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE"]);
});

test("runtime V6 validation rejects extras, old schemas, and invalid approval receipts", () => {
  const state = makeTaskState({ taskId: "schema-v6" });
  expect(validateTaskState(state).schemaVersion).toBe(6);
  expect(() => validateTaskState({ ...state, unexpected: true })).toThrow(/schema validation/);
  expectThrown(
    () => validateTaskState({ schemaVersion: 5 }),
    (error) => error instanceof StateStoreError && error.code === "state_schema_incompatible",
  );
  const executing = makeTaskState({ taskId: "schema-exec", status: "executing" });
  expect(() => validateTaskState({ ...executing, planApproval: undefined })).toThrow(
    /planApproval/,
  );
});

test("public config schema has no approval bypass or external delivery contract", async () => {
  const serialized = (
    await readFile(new URL("../../schemas/config.schema.json", import.meta.url), "utf8")
  ).toLowerCase();
  expect(serialized).not.toMatch(/approval|bypass|handoff|pullrequest/);
});

test("project profile and roadmap schemas enforce strict boundaries", async () => {
  const shared = JSON.parse(
    await readFile(new URL("../../schemas/project-profile.schema.json", import.meta.url), "utf8"),
  ) as {
    additionalProperties: boolean;
    required: string[];
    properties: {
      content: { properties: { decisions: { maxItems: number } } };
      approval: { properties: { actor: { const: string } } };
    };
  };
  const local = JSON.parse(
    await readFile(
      new URL("../../schemas/project-profile-local.schema.json", import.meta.url),
      "utf8",
    ),
  ) as {
    additionalProperties: boolean;
    properties: { servicePaths: { items: { properties: { path: { type: string } } } } };
  };
  const session = JSON.parse(
    await readFile(
      new URL("../../schemas/project-init-state.schema.json", import.meta.url),
      "utf8",
    ),
  ) as {
    properties: Record<string, unknown> & {
      activeQuestion: { properties: { options: { maxItems: number } } };
    };
  };
  expect(shared.additionalProperties).toBe(false);
  expect(shared.required).toContain("approval");
  expect(shared.properties.content.properties.decisions.maxItems).toBe(512);
  expect(shared.properties.approval.properties.actor.const).toBe("user");
  expect(local.additionalProperties).toBe(false);
  expect(local.properties.servicePaths.items.properties.path.type).toBe("string");
  expect(session.properties.activeQuestion.properties.options.maxItems).toBe(3);
  expect(session.properties).not.toHaveProperty("transcript");
  expect(validateSchema("project-profile", {}).valid).toBe(false);
  expect(validateSchema("project-profile-local", {}).valid).toBe(false);
  expect(validateSchema("project-init-state", {}).valid).toBe(false);
  expect(validateSchema("roadmap-state", {}).valid).toBe(false);
});

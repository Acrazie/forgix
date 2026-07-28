import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("workflow schemas are strict and versioned", () => {
  for (const name of ["config", "policy", "state"]) {
    const path = new URL("../schemas/" + name + ".schema.json", import.meta.url);
    assert.equal(existsSync(path), true);
    const schema = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.schemaVersion.type, "integer");
  }
});

test("routing state schema accepts snapshot and decisions but rejects foreign models", async () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  const { validateSchema } = await import(bundle);
  const minimal = {
    schemaVersion: 2,
    taskId: "task-1",
    status: "new",
    revision: 0,
    mode: "quick",
    modeEvidenceRef: "request:mode",
    modeConfirmed: false,
    configSnapshot: {},
    policySnapshot: {},
    issues: [],
    reviewCycle: 0,
    remainingActions: [],
    history: [],
    routingSnapshot: {
      schemaVersion: 1,
      capturedAt: "2026-07-12T10:00:00.000Z",
      plan: "plus",
      account: { planType: "plus" },
      quota: { pressure: "unknown", source: "unknown" },
      models: [{ id: "gpt-5.6-luna", supportedReasoningEfforts: ["medium"] }],
      warnings: ["quota_unknown"],
      provenance: { plan: "account/read", quota: "unknown", models: "model/list" }
    },
    routingDecisions: [{ stage: "discover", model: "gpt-5.6-luna", effort: "medium", quotaPressure: "unknown", reason: "safe", warnings: [] }]
  };
  assert.equal(validateSchema("state", minimal).valid, true);
  assert.equal(validateSchema("state", { ...minimal, routingSnapshot: { ...minimal.routingSnapshot, models: [{ id: "gpt-5.5", supportedReasoningEfforts: [] }] } }).valid, false);
});

test("state schema V2 matches registry and enforces stable-state metadata", async () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  const { TASK_STATUSES, validateSchema } = await import(bundle);
  const schema = JSON.parse(readFileSync(new URL("../schemas/state.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.schemaVersion.const, 2);
  assert.deepEqual(schema.properties.status.enum, TASK_STATUSES);

  const minimal = {
    schemaVersion: 2,
    taskId: "task-v2",
    status: "blocked",
    revision: 0,
    mode: "standard",
    modeEvidenceRef: "request:mode",
    modeConfirmed: true,
    configSnapshot: {},
    policySnapshot: {},
    issues: [],
    reviewCycle: 0,
    remainingActions: [],
    history: []
  };
  assert.equal(validateSchema("state", minimal).valid, false);
  assert.equal(validateSchema("state", {
    ...minimal,
    resumeTo: "reviewing",
    remainingActions: ["Resume independent review."]
  }).valid, true);
  assert.equal(validateSchema("state", { ...minimal, resumeTo: "blocked", remainingActions: ["Loop."] }).valid, false);
});

test("lifecycle Markdown state projection matches registry", async () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  const { TASK_STATUSES } = await import(bundle);
  const markdown = readFileSync(new URL("../docs/lifecycle-contract.md", import.meta.url), "utf8");
  const section = markdown.slice(markdown.indexOf("## State-to-phase derivation"), markdown.indexOf("## State entry and exit contracts"));
  const projected = [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(projected, TASK_STATUSES);
});

test("registry projections cover schema, guards, phases, terminality, and documented transitions", async () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  const { GUARD_IDS, STATE_MACHINE, TASK_STATUSES } = await import(bundle);
  const schema = JSON.parse(readFileSync(new URL("../schemas/state.schema.json", import.meta.url), "utf8"));
  const markdown = readFileSync(new URL("../docs/lifecycle-contract.md", import.meta.url), "utf8");

  assert.deepEqual(schema.$defs.status.enum, TASK_STATUSES);
  assert.deepEqual(schema.$defs.nonTerminalStatus.enum, TASK_STATUSES.filter((status) => !STATE_MACHINE[status].terminal));
  assert.deepEqual(schema.$defs.resumeTarget.enum, TASK_STATUSES.filter((status) => status !== "new" && !STATE_MACHINE[status].stable && !STATE_MACHINE[status].terminal));
  assert.deepEqual(schema.$defs.guardId.enum, GUARD_IDS);

  const guardSection = markdown.slice(markdown.indexOf("### Guard identifiers"), markdown.indexOf("## State-to-phase derivation"));
  assert.deepEqual([...guardSection.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]), GUARD_IDS);

  const phaseSection = markdown.slice(markdown.indexOf("## State-to-phase derivation"), markdown.indexOf("## State entry and exit contracts"));
  const phaseRows = [...phaseSection.matchAll(/^\| `([^`]+)` \| `?([^|`]+)`? \| (yes|no) \| (yes|no) \|/gm)];
  assert.equal(phaseRows.length, TASK_STATUSES.length);
  for (const [, status, phase, stable, terminal] of phaseRows) {
    assert.equal(STATE_MACHINE[status].stable, stable === "yes", `${status} stable projection`);
    assert.equal(STATE_MACHINE[status].terminal, terminal === "yes", `${status} terminal projection`);
    if (["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE", "HANDOFF"].includes(phase.trim())) {
      assert.equal(STATE_MACHINE[status].macroPhase, phase.trim(), `${status} phase projection`);
    }
  }

  const transitionSection = markdown.slice(markdown.indexOf("## Canonical transitions"), markdown.indexOf("## Mode paths"));
  const rows = [...transitionSection.matchAll(/^\| `([^`]+)` \| ([^|]+) \|/gm)];
  const universal = new Set(["blocked", "cancelled", "failed"]);
  for (const [, status, targetsCell] of rows) {
    if (status === "blocked" || STATE_MACHINE[status].terminal) continue;
    const documented = [...targetsCell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    const registryNormal = Object.keys(STATE_MACHINE[status].transitions).filter((target) => !universal.has(target));
    assert.deepEqual(registryNormal, documented, `${status} transition projection`);
    assert.deepEqual(Object.keys(STATE_MACHINE[status].transitions).filter((target) => universal.has(target)), [...universal], `${status} universal transitions`);
  }

  for (const status of TASK_STATUSES) {
    const contract = STATE_MACHINE[status];
    assert.ok(contract.capsule.consumes.length > 0, `${status} capsule consumes`);
    assert.ok(contract.capsule.produces.length > 0, `${status} capsule produces`);
    for (const [target, transition] of Object.entries(contract.transitions)) {
      assert.ok(TASK_STATUSES.includes(target), `${status} target ${target}`);
      for (const guard of transition.guards) assert.ok(GUARD_IDS.includes(guard), `${status} guard ${guard}`);
      for (const conditional of transition.conditionalGuards) assert.ok(GUARD_IDS.includes(conditional.guard), `${status} conditional guard ${conditional.guard}`);
    }
    if (contract.terminal) assert.deepEqual(Object.keys(contract.transitions), [], `${status} terminal transitions`);
  }
});

test("normalized lifecycle projection exactly matches guards, capsule, events, and derivation rules", async () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  const { buildStateMachineProjection } = await import(bundle);
  const stored = JSON.parse(readFileSync(new URL("../docs/lifecycle-contract.projection.json", import.meta.url), "utf8"));
  assert.deepEqual(stored, buildStateMachineProjection());
});

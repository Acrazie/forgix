import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("distribution bundle exists", () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  assert.equal(existsSync(bundle), true);
});

test("distribution bundle imports as ESM", async () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  const module = await import(bundle);
  assert.equal(typeof module.main, "function");
});

test("public skill isolates external skills behind configured allowlists", () => {
  const skill = readFileSync(new URL("../skills/dev-flow/SKILL.md", import.meta.url), "utf8");
  assert.match(skill, /integrations\.plugins/);
  assert.match(skill, /integrations\.skills/);
  assert.match(skill, /Do not invoke skills from other plugins/);
  assert.match(skill, /foreground interactive terminal/);
});

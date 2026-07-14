import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";

test("distribution bundle exists", () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  assert.equal(existsSync(bundle), true);
  assert.equal(readFileSync(bundle, "utf8").startsWith("#!/usr/bin/env node\n"), true);
  if (process.platform !== "win32") assert.notEqual(statSync(bundle).mode & 0o111, 0);
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
  assert.match(skill, /standalone CLI command/);
  assert.match(skill, /codex-dev-flow init/);
});

test("package exposes the standalone codex-dev-flow binary", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.bin["codex-dev-flow"], "dist/dev-flow.mjs");
});

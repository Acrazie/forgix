import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

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

test("package binary executes through a package-manager symlink", { skip: process.platform === "win32" }, () => {
  const directory = mkdtempSync(join(tmpdir(), "codex-dev-flow-bin-"));
  const binary = join(directory, "codex-dev-flow");
  symlinkSync(fileURLToPath(new URL("../dist/dev-flow.mjs", import.meta.url)), binary);

  try {
    const result = spawnSync(binary, ["config", "validate", "--json"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.command, "config_validate");
    assert.equal(output.status, "valid");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("init rejects non-interactive invocation explicitly", () => {
  const bundle = fileURLToPath(new URL("../dist/dev-flow.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [bundle, "init"], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  assert.equal(result.status, 10);
  assert.match(result.stderr, /init requires an interactive terminal/);
});

test("public skill isolates external skills behind configured allowlists", () => {
  const skill = readFileSync(new URL("../skills/dev-flow/SKILL.md", import.meta.url), "utf8");
  assert.match(skill, /integrations\.plugins/);
  assert.match(skill, /integrations\.skills/);
  assert.match(skill, /Do not invoke skills from other plugins/);
  assert.match(skill, /standalone CLI command/);
  assert.match(skill, /codex-dev-flow init/);
  assert.match(skill, /Do not refresh account, quota, or model data between skills/);
  assert.match(skill, /Never substitute a fallback model or effort/);
});

test("package exposes the standalone codex-dev-flow binary", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.bin["codex-dev-flow"], "dist/dev-flow.mjs");
});

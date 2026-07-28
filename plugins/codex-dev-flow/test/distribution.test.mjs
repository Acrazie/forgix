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
  assert.match(skill, /routing_permission_required/);
  assert.match(skill, /explicit user approval/);
  assert.match(skill, /Retry the same invocation at most once/);
  assert.match(skill, /Never escalate silently/);
  assert.match(skill, /If approval is denied or the retry fails, block/);
});

test("package exposes the standalone codex-dev-flow binary", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.private, undefined);
  assert.equal(manifest.license, "MIT");
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.publishConfig.access, "public");
  assert.equal(manifest.bin["codex-dev-flow"], "dist/dev-flow.mjs");
  assert.deepEqual(manifest.files, [".codex-plugin/", "dist/", "docs/", "schemas/", "skills/", "LICENSE", "README.md"]);
  assert.equal(manifest.scripts.prepack, "bun run build");
  assert.equal(manifest.scripts.prepublishOnly, "bun run check");
  assert.equal(existsSync(new URL("../LICENSE", import.meta.url)), true);
});

test("npm package contains runtime assets and excludes development files", () => {
  const directory = mkdtempSync(join(tmpdir(), "codex-dev-flow-pack-"));
  const root = fileURLToPath(new URL("..", import.meta.url));

  try {
    const result = spawnSync("bun", ["pm", "pack", "--dry-run", "--ignore-scripts"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BUN_INSTALL_CACHE_DIR: directory }
    });
    assert.equal(result.status, 0, result.stderr);
    const paths = result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const required of [
      ".codex-plugin/plugin.json",
      "dist/dev-flow.mjs",
      "schemas/config.schema.json",
      "skills/dev-flow/SKILL.md",
      "LICENSE",
      "README.md"
    ]) {
      assert.equal(paths.some((path) => path.endsWith(required)), true, `${required} must be published`);
    }
    assert.equal(paths.some((path) => path.startsWith("src/")), false);
    assert.equal(paths.some((path) => path.startsWith("test/")), false);
    assert.equal(paths.some((path) => path.startsWith(".github/")), false);
    assert.equal(paths.includes(".codex/dev-flow.yaml"), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

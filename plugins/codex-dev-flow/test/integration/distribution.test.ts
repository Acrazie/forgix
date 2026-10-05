// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import { createDistributionBundle } from "../../scripts/build.mjs";
import { projectProfileInput } from "../support/project-profile.ts";

test("distribution bundle exists", () => {
  const bundle = new URL("../../dist/dev-flow.mjs", import.meta.url);
  expect(existsSync(bundle)).toBe(true);
  expect(readFileSync(bundle, "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
  expect(readFileSync(bundle, "utf8")).not.toContain("node_modules/.bun/");
  if (process.platform !== "win32") expect(statSync(bundle).mode & 0o111).not.toBe(0);
});

test("distribution bundle imports as ESM", async () => {
  const bundle = new URL("../../dist/dev-flow.mjs", import.meta.url);
  const module = await import(bundle);
  expect(typeof module.main).toBe("function");
});

test("distribution bundle matches the current source build", async () => {
  const bundle = new URL("../../dist/dev-flow.mjs", import.meta.url);
  expect(readFileSync(bundle)).toEqual(Buffer.from(await createDistributionBundle()));
});

for (const command of ["dev-flow", "codex-dev-flow"]) {
  test(
    `${command} executes through a package-manager symlink`,
    { skip: process.platform === "win32" },
    () => {
      const directory = mkdtempSync(join(tmpdir(), "dev-flow-bin-"));
      const binary = join(directory, command);
      const manifest = JSON.parse(
        readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
      );
      symlinkSync(
        fileURLToPath(new URL(`../../${manifest.bin[command]}`, import.meta.url)),
        binary,
      );

      try {
        const result = spawnSync(binary, ["config", "validate", "--json"], { encoding: "utf8" });
        expect(result.status, result.stderr).toBe(0);
        const output = JSON.parse(result.stdout);
        expect(output.command).toBe("config_validate");
        expect(output.status).toBe("valid");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
}

test("init rejects non-interactive invocation explicitly", () => {
  const bundle = fileURLToPath(new URL("../../dist/dev-flow.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [bundle, "init"], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  expect(result.status).toBe(10);
  expect(result.stderr).toMatch(/init requires an interactive terminal/);
});

test("built CLI validates project profile stdin without writing", () => {
  const directory = mkdtempSync(join(tmpdir(), "dev-flow-profile-bundle-"));
  const bundle = fileURLToPath(new URL("../../dist/dev-flow.mjs", import.meta.url));
  try {
    const result = spawnSync(process.execPath, [bundle, "project-profile", "validate"], {
      cwd: directory,
      encoding: "utf8",
      input: stringify(projectProfileInput()),
    });
    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.status).toBe("valid");
    expect(output.data.contentDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(join(directory, ".codex", "dev-flow.project.yaml"))).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("public skill isolates external skills behind configured allowlists", () => {
  const skill = readFileSync(new URL("../../skills/dev-flow/SKILL.md", import.meta.url), "utf8");
  expect(skill).toMatch(/integrations\.plugins/);
  expect(skill).toMatch(/integrations\.skills/);
  expect(skill).toMatch(/Do not invoke skills from other plugins/);
  expect(skill).toMatch(/standalone CLI command/);
  expect(skill).toMatch(/dev-flow init/);
  expect(skill).toMatch(/Exact `\$dev-flow init` is agentic/);
  expect(skill).toMatch(/project-profile validate/);
  expect(skill).toMatch(/project-profile session-save/);
  expect(skill).toMatch(/No hard question cap/);
  expect(skill).toMatch(/leaves shared profile byte-for-byte unchanged/);
  expect(skill).toMatch(/Do not refresh account, quota, or model data between skills/);
  expect(skill).toMatch(/Never substitute a fallback model or effort/);
  expect(skill).toMatch(/routing_permission_required/);
  expect(skill).toMatch(/explicit user approval/);
  expect(skill).toMatch(/Retry the same invocation at most once/);
  expect(skill).toMatch(/Never escalate silently/);
  expect(skill).toMatch(/If approval is denied or the retry fails, block/);
});

test("package exposes the standalone dev-flow binary", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  expect(manifest.private).toBe(undefined);
  expect(manifest.license).toBe("MIT");
  expect(manifest.dependencies).toBe(undefined);
  expect(manifest.publishConfig.access).toBe("public");
  expect(manifest.name).toBe("dev-flow");
  expect(manifest.bin).toEqual({
    "dev-flow": "dist/dev-flow.mjs",
    "codex-dev-flow": "dist/codex-dev-flow.mjs",
  });
  expect(manifest.files).toEqual([
    ".codex-plugin/",
    "dist/",
    "docs/",
    "schemas/",
    "skills/",
    "LICENSE",
    "README.md",
  ]);
  expect(manifest.scripts.prepack).toBe("bun run build");
  expect(manifest.scripts.prepublishOnly).toBe("bun run check");
  expect(existsSync(new URL("../../LICENSE", import.meta.url))).toBe(true);
});

test("npm package contains runtime assets and excludes development files", () => {
  const directory = mkdtempSync(join(tmpdir(), "dev-flow-pack-"));
  const root = fileURLToPath(new URL("../..", import.meta.url));

  try {
    const result = spawnSync("bun", ["pm", "pack", "--dry-run", "--ignore-scripts"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BUN_INSTALL_CACHE_DIR: directory },
    });
    expect(result.status, result.stderr).toBe(0);
    const paths = result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const required of [
      ".codex-plugin/plugin.json",
      "dist/dev-flow.mjs",
      "dist/codex-dev-flow.mjs",
      "schemas/config.schema.json",
      "schemas/project-profile.schema.json",
      "schemas/project-profile-local.schema.json",
      "schemas/project-init-state.schema.json",
      "skills/dev-flow/SKILL.md",
      "LICENSE",
      "README.md",
    ]) {
      expect(
        paths.some((path) => path.endsWith(required)),
        `${required} must be published`,
      ).toBe(true);
    }
    expect(paths.some((path) => path.startsWith("src/"))).toBe(false);
    expect(paths.some((path) => path.startsWith("test/"))).toBe(false);
    expect(paths.some((path) => path.startsWith(".github/"))).toBe(false);
    expect(paths.includes(".codex/dev-flow.yaml")).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("plugin identity matches its marketplace entry and release configuration", () => {
  const plugin = JSON.parse(
    readFileSync(new URL("../../.codex-plugin/plugin.json", import.meta.url), "utf8"),
  );
  const marketplace = JSON.parse(
    readFileSync(new URL("../../../../.agents/plugins/marketplace.json", import.meta.url), "utf8"),
  );
  const release = JSON.parse(
    readFileSync(new URL("../../../../release-please-config.json", import.meta.url), "utf8"),
  );
  expect(plugin.name).toBe("dev-flow");
  expect(plugin.interface.displayName).toBe("Dev Flow");
  expect(marketplace.plugins[0].name).toBe(plugin.name);
  expect(marketplace.plugins[0].source.path).toBe("./plugins/codex-dev-flow");
  expect(release.packages["plugins/codex-dev-flow"]["package-name"]).toBe(plugin.name);
});

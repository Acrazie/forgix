import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { expectRejected } from "../support/expect-error.ts";
import {
  allowedReleasePaths,
  captureFileSnapshots,
  compareVersions,
  createReleasePlan,
  formatCachebuster,
  incrementVersion,
  normalizeGitOutput,
  parsePorcelainPaths,
  parseStableVersion,
  recommendBump,
  replaceJsonVersion,
  replaceMarketplacePluginVersion,
  ReleaseError,
  restoreFileSnapshots,
  runCommand,
  semanticBase,
  unexpectedReleasePaths,
  validateClaudeMarketplaceManifest,
  validatePluginManifest,
} from "../../scripts/release-lib.ts";

describe("release versioning", () => {
  test("parses and compares stable versions only", () => {
    expect(parseStableVersion("12.3.4")).toEqual({ major: 12, minor: 3, patch: 4 });
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(() => parseStableVersion("1.2.3-beta.1")).toThrow(ReleaseError);
    expect(() => parseStableVersion("01.2.3")).toThrow(ReleaseError);
  });

  test("increments patch, minor, and major versions", () => {
    expect(incrementVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(incrementVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(incrementVersion("1.2.3", "major")).toBe("2.0.0");
  });

  test("extracts plugin semantic base and formats UTC cachebusters", () => {
    expect(semanticBase("1.2.3+codex.20260728140509")).toBe("1.2.3");
    expect(formatCachebuster(new Date("2026-07-28T14:05:09.000Z"))).toBe("20260728140509");
  });

  test("recommends highest Conventional Commits impact", () => {
    expect(recommendBump(["docs: explain release"])).toBe("patch");
    expect(recommendBump(["fix: repair sync"])).toBe("patch");
    expect(recommendBump(["fix: repair sync", "feat(release): add preview"])).toBe("minor");
    expect(recommendBump(["feat!: remove legacy tags"])).toBe("major");
    expect(recommendBump(["feat: change API\n\nBREAKING CHANGE: new contract"])).toBe("major");
  });
});

describe("release plans", () => {
  const now = new Date("2026-07-28T14:05:09.000Z");

  test("combined release aligns semantic versions", () => {
    expect(
      createReleasePlan({
        target: "both",
        currentPackageVersion: "0.1.0",
        currentPluginVersion: "0.1.0+codex.20260712195921",
        nextPackageVersion: "0.2.0",
        now,
      }),
    ).toEqual({
      target: "both",
      packageVersion: "0.2.0",
      pluginVersion: "0.2.0+codex.20260728140509",
      cachebuster: "20260728140509",
      identity: "v0.2.0",
      tag: "v0.2.0",
      commitMessage: "chore(release): v0.2.0",
    });
  });

  test("npm-only release leaves plugin version unchanged", () => {
    const plan = createReleasePlan({
      target: "npm",
      currentPackageVersion: "0.1.0",
      currentPluginVersion: "0.1.0+codex.20260712195921",
      nextPackageVersion: "0.1.1",
      now,
    });
    expect(plan.packageVersion).toBe("0.1.1");
    expect(plan.pluginVersion).toBe("0.1.0+codex.20260712195921");
    expect(plan.tag).toBe("npm-v0.1.1");
  });

  test("plugin-only release rotates cachebuster without semantic bump", () => {
    const plan = createReleasePlan({
      target: "plugin",
      currentPackageVersion: "0.1.0",
      currentPluginVersion: "0.1.0+codex.20260712195921",
      now,
    });
    expect(plan.packageVersion).toBe("0.1.0");
    expect(plan.pluginVersion).toBe("0.1.0+codex.20260728140509");
    expect(plan.tag).toBe("plugin-v0.1.0-codex.20260728140509");
  });

  test("rejects npm versions that do not advance", () => {
    expect(() =>
      createReleasePlan({
        target: "npm",
        currentPackageVersion: "1.0.0",
        currentPluginVersion: "1.0.0+codex.20260712195921",
        nextPackageVersion: "1.0.0",
        now,
      }),
    ).toThrow(/must be greater/);
  });
});

describe("release safety", () => {
  test("updates only JSON version bytes and preserves formatter-owned layout", () => {
    const manifest = `{
  "name": "forgix",
  "version": "0.2.1+codex.20260731175436",
  "keywords": ["codex", "workflow"]
}
`;
    expect(replaceJsonVersion(manifest, "0.3.0+codex.20260810120000")).toBe(
      manifest.replace("0.2.1+codex.20260731175436", "0.3.0+codex.20260810120000"),
    );
    expect(() => replaceJsonVersion('{"name":"missing"}\n', "0.3.0")).toThrow(
      /missing JSON "version"/,
    );
  });

  test("preserves porcelain status columns while trimming command output", () => {
    const output = normalizeGitOutput(" M .codex-plugin/plugin.json\n");
    expect(output).toBe(" M .codex-plugin/plugin.json");
    expect(parsePorcelainPaths(output)).toEqual([".codex-plugin/plugin.json"]);
  });

  test("parses porcelain output and rejects paths outside target allowlist", () => {
    const paths = parsePorcelainPaths(" M package.json\n M bun.lock\n M README.md\n");
    expect(paths).toEqual(["package.json", "bun.lock", "README.md"]);
    expect(unexpectedReleasePaths(paths, "npm")).toEqual(["README.md"]);
  });

  test("validates minimum plugin manifest contract", () => {
    const manifest = {
      name: "forgix",
      version: "0.2.0+codex.20260728140509",
      description: "Flow",
      license: "MIT",
      skills: "./skills/",
    };
    expect(() => validatePluginManifest(manifest)).not.toThrow();
    expect(() => validatePluginManifest({ ...manifest, name: "codex-dev-flow" })).toThrow(/name/);
    expect(() => validatePluginManifest({ ...manifest, skills: "./skills" })).toThrow(/must end/);
    expect(() => validatePluginManifest({ ...manifest, version: "0.2.0" }, "claude")).not.toThrow();
    expect(() => validatePluginManifest(manifest, "claude")).toThrow(ReleaseError);
    expect(() =>
      validatePluginManifest({ ...manifest, version: "0.2.0", interface: {} }, "claude"),
    ).toThrow(/interface/);
    const { skills: _omittedSkills, ...antigravity } = { ...manifest, version: "0.2.0" };
    expect(() => validatePluginManifest(antigravity, "antigravity")).not.toThrow();
  });

  test("validates and updates Claude marketplace manifest and release path allowlists", () => {
    const marketplaceJson = `{
  "name": "acrazie",
  "owner": { "name": "Acrazie" },
  "description": "Acrazie plugins marketplace.",
  "plugins": [
    {
      "name": "forgix",
      "source": "./",
      "description": "Flow",
      "version": "0.4.0"
    }
  ]
}
`;
    expect(() => validateClaudeMarketplaceManifest(JSON.parse(marketplaceJson))).not.toThrow();
    expect(replaceMarketplacePluginVersion(marketplaceJson, "forgix", "0.5.0")).toBe(
      marketplaceJson.replace("0.4.0", "0.5.0"),
    );
    expect(allowedReleasePaths("both").has(".claude-plugin/plugin.json")).toBe(true);
    expect(allowedReleasePaths("both").has("plugin.json")).toBe(true);
    expect(allowedReleasePaths("both").has(".claude-plugin/marketplace.json")).toBe(true);
    expect(allowedReleasePaths("both").has("CHANGELOG.md")).toBe(true);
    expect(allowedReleasePaths("npm").has("CHANGELOG.md")).toBe(true);
    expect(allowedReleasePaths("plugin").has("package.json")).toBe(false);
    expect(allowedReleasePaths("plugin").has(".release-please-manifest.json")).toBe(false);
    expect(allowedReleasePaths("npm").has(".claude-plugin/plugin.json")).toBe(false);
  });

  test("restores original bytes, mode, and absence after cancellation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "forgix-release-"));
    const existing = join(directory, "existing");
    const created = join(directory, "created");
    await writeFile(existing, Buffer.from([0, 1, 2, 255]));
    await chmod(existing, 0o744);
    const snapshots = await captureFileSnapshots([existing, created]);

    try {
      await writeFile(existing, "changed");
      await writeFile(created, "new");
      await restoreFileSnapshots(snapshots);
      expect(await readFile(existing)).toEqual(Buffer.from([0, 1, 2, 255]));
      expect((await stat(existing)).mode & 0o777).toBe(0o744);
      await expectRejected(
        () => readFile(created),
        (error) => error instanceof Error && "code" in error && error.code === "ENOENT",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("passes subprocess arguments without shell interpretation", () => {
    const marker = "value; echo unsafe";
    const result = runCommand(process.execPath, ["-e", "console.log(process.argv[1])", marker]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(marker);
  });
});

import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  captureFileSnapshots,
  compareVersions,
  createReleasePlan,
  formatCachebuster,
  incrementVersion,
  missingPublicationSteps,
  normalizeGitOutput,
  parsePorcelainPaths,
  parseReleaseCommit,
  parseStableVersion,
  recommendBump,
  ReleaseError,
  restoreFileSnapshots,
  runCommand,
  semanticBase,
  unexpectedReleasePaths,
  validatePluginManifest,
} from "../src/release.ts";

describe("release versioning", () => {
  test("parses and compares stable versions only", () => {
    assert.deepEqual(parseStableVersion("12.3.4"), { major: 12, minor: 3, patch: 4 });
    assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
    assert.throws(() => parseStableVersion("1.2.3-beta.1"), ReleaseError);
    assert.throws(() => parseStableVersion("01.2.3"), ReleaseError);
  });

  test("increments patch, minor, and major versions", () => {
    assert.equal(incrementVersion("1.2.3", "patch"), "1.2.4");
    assert.equal(incrementVersion("1.2.3", "minor"), "1.3.0");
    assert.equal(incrementVersion("1.2.3", "major"), "2.0.0");
  });

  test("extracts plugin semantic base and formats UTC cachebusters", () => {
    assert.equal(semanticBase("1.2.3+codex.20260728140509"), "1.2.3");
    assert.equal(formatCachebuster(new Date("2026-07-28T14:05:09.000Z")), "20260728140509");
  });

  test("recommends highest Conventional Commits impact", () => {
    assert.equal(recommendBump(["docs: explain release"]), "patch");
    assert.equal(recommendBump(["fix: repair sync"]), "patch");
    assert.equal(recommendBump(["fix: repair sync", "feat(release): add preview"]), "minor");
    assert.equal(recommendBump(["feat!: remove legacy tags"]), "major");
    assert.equal(recommendBump(["feat: change API\n\nBREAKING CHANGE: new contract"]), "major");
  });
});

describe("release plans", () => {
  const now = new Date("2026-07-28T14:05:09.000Z");

  test("combined release aligns semantic versions", () => {
    assert.deepEqual(
      createReleasePlan({
        target: "both",
        currentPackageVersion: "0.1.0",
        currentPluginVersion: "0.1.0+codex.20260712195921",
        nextPackageVersion: "0.2.0",
        now,
      }),
      {
        target: "both",
        packageVersion: "0.2.0",
        pluginVersion: "0.2.0+codex.20260728140509",
        cachebuster: "20260728140509",
        identity: "v0.2.0",
        tag: "v0.2.0",
        commitMessage: "chore(release): v0.2.0",
      },
    );
  });

  test("npm-only release leaves plugin version unchanged", () => {
    const plan = createReleasePlan({
      target: "npm",
      currentPackageVersion: "0.1.0",
      currentPluginVersion: "0.1.0+codex.20260712195921",
      nextPackageVersion: "0.1.1",
      now,
    });
    assert.equal(plan.packageVersion, "0.1.1");
    assert.equal(plan.pluginVersion, "0.1.0+codex.20260712195921");
    assert.equal(plan.tag, "npm-v0.1.1");
  });

  test("plugin-only release rotates cachebuster without semantic bump", () => {
    const plan = createReleasePlan({
      target: "plugin",
      currentPackageVersion: "0.1.0",
      currentPluginVersion: "0.1.0+codex.20260712195921",
      now,
    });
    assert.equal(plan.packageVersion, "0.1.0");
    assert.equal(plan.pluginVersion, "0.1.0+codex.20260728140509");
    assert.equal(plan.tag, "plugin-v0.1.0-codex.20260728140509");
  });

  test("rejects npm versions that do not advance", () => {
    assert.throws(
      () =>
        createReleasePlan({
          target: "npm",
          currentPackageVersion: "1.0.0",
          currentPluginVersion: "1.0.0+codex.20260712195921",
          nextPackageVersion: "1.0.0",
          now,
        }),
      /must be greater/,
    );
  });
});

describe("release safety", () => {
  test("preserves porcelain status columns while trimming command output", () => {
    const output = normalizeGitOutput(" M plugins/codex-dev-flow/.codex-plugin/plugin.json\n");
    assert.equal(output, " M plugins/codex-dev-flow/.codex-plugin/plugin.json");
    assert.deepEqual(parsePorcelainPaths(output), [
      "plugins/codex-dev-flow/.codex-plugin/plugin.json",
    ]);
  });

  test("parses porcelain output and rejects paths outside target allowlist", () => {
    const paths = parsePorcelainPaths(
      " M plugins/codex-dev-flow/package.json\n?? plugins/codex-dev-flow/bun.lock\n M README.md\n",
    );
    assert.deepEqual(paths, [
      "plugins/codex-dev-flow/package.json",
      "plugins/codex-dev-flow/bun.lock",
      "README.md",
    ]);
    assert.deepEqual(unexpectedReleasePaths(paths, "npm"), ["README.md"]);
  });

  test("validates minimum plugin manifest contract", () => {
    const manifest = {
      name: "codex-dev-flow",
      version: "0.2.0+codex.20260728140509",
      description: "Flow",
      license: "MIT",
      skills: "./skills/",
    };
    assert.doesNotThrow(() => validatePluginManifest(manifest));
    assert.throws(() => validatePluginManifest({ ...manifest, skills: "./skills" }), /must end/);
  });

  test("recognizes target-specific release commits", () => {
    assert.deepEqual(parseReleaseCommit("chore(release): v1.2.0"), {
      target: "both",
      identity: "v1.2.0",
      version: "1.2.0",
    });
    assert.deepEqual(parseReleaseCommit("chore(release): npm-v1.2.1"), {
      target: "npm",
      identity: "npm-v1.2.1",
      version: "1.2.1",
    });
    assert.deepEqual(parseReleaseCommit("chore(release): plugin-v1.2.1-codex.20260728140509"), {
      target: "plugin",
      identity: "plugin-v1.2.1-codex.20260728140509",
      version: "1.2.1",
    });
    assert.equal(parseReleaseCommit("feat: unrelated"), null);
  });

  test("derives target-aware idempotent recovery steps", () => {
    assert.deepEqual(
      missingPublicationSteps("both", {
        pushed: true,
        npmPublished: false,
        githubRelease: false,
      }),
      ["npm", "github-release"],
    );
    assert.deepEqual(
      missingPublicationSteps("plugin", {
        pushed: false,
        npmPublished: false,
        githubRelease: false,
      }),
      ["push", "github-release"],
    );
    assert.deepEqual(
      missingPublicationSteps("npm", {
        pushed: true,
        npmPublished: true,
        githubRelease: true,
      }),
      [],
    );
  });

  test("restores original bytes, mode, and absence after cancellation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-dev-flow-release-"));
    const existing = join(directory, "existing");
    const created = join(directory, "created");
    await writeFile(existing, Buffer.from([0, 1, 2, 255]));
    await chmod(existing, 0o744);
    const snapshots = await captureFileSnapshots([existing, created]);

    try {
      await writeFile(existing, "changed");
      await writeFile(created, "new");
      await restoreFileSnapshots(snapshots);
      assert.deepEqual(await readFile(existing), Buffer.from([0, 1, 2, 255]));
      assert.equal((await stat(existing)).mode & 0o777, 0o744);
      await assert.rejects(readFile(created), { code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("passes subprocess arguments without shell interpretation", () => {
    const marker = "value; echo unsafe";
    const result = runCommand(process.execPath, ["-e", "console.log(process.argv[1])", marker]);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), marker);
  });
});

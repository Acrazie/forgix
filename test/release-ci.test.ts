import { pinReleaseFixtureVersions } from "../test/support/release-fixtures.ts";
import { validateVersions } from "../scripts/release-lib.ts";
import { readFileSync, cpSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { parse } from "yaml";
import { assertContext, assertUniqueNpmTag } from "../scripts/release-ci.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const pipeline = parse(read(".buildkite/pipeline.yml")) as {
  env?: Record<string, string>;
  steps: {
    key: string;
    if?: string;
    soft_fail?: boolean;
    timeout_in_minutes?: number;
    depends_on?: string[];
    concurrency?: number;
    concurrency_group?: string;
    artifact_paths?: string[];
    commands: string[];
  }[];
};
const stepByKey = (key: string) => {
  const step = pipeline.steps.find((s) => s.key === key);
  if (!step) throw new Error(`Missing Buildkite step ${key}`);
  return step;
};
const sha = "a".repeat(40);
const env = {
  BUILDKITE: "true",
  BUILDKITE_REPO: "entire://aws-eu-central-1.entire.io/et/forgix/forgix",
  BUILDKITE_TAG: "v2.0.0",
  BUILDKITE_COMMIT: sha,
  BUILDKITE_PULL_REQUEST: "false",
};

describe("release trust and reconciliation contracts", () => {
  test("requires exact Buildkite source, repo, tag and non-PR context", () => {
    expect(() => assertContext("v2.0.0", sha, env)).not.toThrow();
    expect(() =>
      assertContext("v2.0.0", sha, {
        ...env,
        BUILDKITE_REPO: "https://entire.com/et/forgix/forgix.git",
        BUILDKITE_PULL_REQUEST: undefined,
      }),
    ).not.toThrow();
    const tagObjectSha = "c".repeat(40);
    expect(() =>
      assertContext("v2.0.0", sha, { ...env, BUILDKITE_COMMIT: tagObjectSha }, tagObjectSha),
    ).not.toThrow();
    for (const change of [
      { BUILDKITE: "false" },
      { BUILDKITE_REPO: "https://github.com/fork/forgix" },
      { BUILDKITE_REPO: "entire://aws-eu-central-1.entire.io/et/other/forgix" },
      { BUILDKITE_TAG: "" },
      { BUILDKITE_TAG: "v1.0.0" },
      { BUILDKITE_COMMIT: "b".repeat(40) },
      { BUILDKITE_PULL_REQUEST: "42" },
    ])
      expect(() => assertContext("v2.0.0", sha, { ...env, ...change })).toThrow();
  });

  test("refuses another family's ownership even if publication bytes would match", () => {
    expect(() => assertUniqueNpmTag("v2.0.0", ["v1.0.0", "v2.0.0"])).not.toThrow();
    expect(() => assertUniqueNpmTag("v2.0.0", ["npm-v2.0.0"])).toThrow(/owns/);
    expect(() => assertUniqueNpmTag("v2.0.0", ["forgix-v2.0.0"])).toThrow(/owns/);
    expect(() => assertUniqueNpmTag("npm-v2.0.0", [])).toThrow(/vX\.Y\.Z/);
  });

  test("validates all npm and plugin manifests together for vX.Y.Z tags", () => {
    const root = mkdtempSync(join(tmpdir(), "forgix-release-manifests-"));
    try {
      for (const path of [
        "package.json",
        ".codex-plugin/plugin.json",
        ".claude-plugin/plugin.json",
        "plugin.json",
        ".claude-plugin/marketplace.json",
      ]) {
        mkdirSync(join(root, path, ".."), { recursive: true });
        cpSync(new URL(`../${path}`, import.meta.url), join(root, path));
      }
      pinReleaseFixtureVersions(root);
      expect(validateVersions(root, "v1.0.1")).toMatch(/^1\.0\.1\+codex\.\d{14}$/);
      expect(() => validateVersions(root, "v2.0.0")).toThrow(/npm manifest/);
      expect(() => validateVersions(root, "npm-v1.0.1")).toThrow(/vX\.Y\.Z/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("Buildkite pipeline privilege and release boundaries", () => {
  test("runs TLC as an advisory job independent from required jobs and skips release commits", () => {
    const tla = stepByKey("formal-tla");
    const expectedFormalIf =
      'build.source != "schedule" && build.tag == null && build.branch !~ /^release\\/v(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$/ && build.message !~ /^chore\\(release\\): v(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(\\n|$)/';
    expect(tla.if).toBe(stepByKey("formal-lean").if);
    expect(tla.if).toBe(expectedFormalIf);

    const branchRe = /^release\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
    expect(branchRe.test("release/v4.5.0")).toBe(true);
    expect(branchRe.test("release/v0.0.1")).toBe(true);
    expect(branchRe.test("release/v4.5.0-beta.1")).toBe(false);
    expect(branchRe.test("release/v04.5.0")).toBe(false);
    expect(branchRe.test("feat/release/v4.5.0")).toBe(false);

    const messageRe = /^chore\(release\): v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(\n|$)/;
    expect(messageRe.test("chore(release): v4.5.0")).toBe(true);
    expect(messageRe.test("chore(release): v4.5.0\n\nBody")).toBe(true);
    expect(messageRe.test("chore(release): v4.5.0-rc.1")).toBe(false);
    expect(messageRe.test("chore(release): v4.5.0 extra")).toBe(false);
    expect(messageRe.test("feat: mention chore(release): v4.5.0")).toBe(false);

    expect(tla.soft_fail).toBe(true);
    expect(tla.timeout_in_minutes).toBe(5);
    expect(tla.commands).toHaveLength(1);
    const command = tla.commands.join("\n");
    expect(command).toContain("timeout --verbose --kill-after=10s 4m");
    expect(command).toContain('!= "v$${DAGGER_VERSION}"');
    expect(command).toContain("exec dagger call formal-tla --source=.");
    expect(tla.depends_on).toBeUndefined();
    expect(tla.artifact_paths).toBeUndefined();
    expect(pipeline.steps.some((step) => step.depends_on?.includes(tla.key))).toBe(false);
  });

  test("keeps npm publish credentials and commands out of Buildkite and Dagger", () => {
    expect(pipeline.steps.some((step) => step.key === "npm-publish")).toBe(false);
    expect(read(".buildkite/pipeline.yml")).not.toMatch(/NPM_TOKEN|npm-publish/);
    expect(read(".dagger/src/index.ts")).not.toMatch(/NPM_TOKEN|npmPublish/);
    expect(read("scripts/release-ci.ts")).not.toMatch(/NPM_TOKEN|"publish"/);
  });

  test("uploads the dead-code report separately from the known release artifacts", () => {
    const quality = stepByKey("quality-gate");
    expect(quality.artifact_paths).toEqual([
      ".fallow/dead-code.json",
      ".artifacts/forgix.tgz",
      ".artifacts/RELEASE_NOTES.md",
      ".artifacts/release.json",
    ]);
    expect(quality.commands.join("\n")).toContain(
      "dagger call dead-code-report --source=. --output=.fallow/dead-code.json",
    );
  });

  test("routes v* release tag builds through the smoke receipt producer", () => {
    const smoke = stepByKey("runtime-smoke");
    expect(smoke.depends_on).toEqual(["quality-gate"]);
    expect(smoke.commands.join("\n")).toContain("v*) bash scripts/release-smoke.sh ;;");
    expect(smoke.commands.join("\n")).toContain(
      "dagger call runtime-smoke --source=. --tarball=.artifacts/forgix.tgz",
    );
  });

  test("runs diff-gate on non-tag branch/PR builds after fetching origin/main", () => {
    const qualityCommands = stepByKey("quality-gate").commands.join("\n");
    expect(qualityCommands).toContain(
      'git fetch origin "+refs/heads/main:refs/remotes/origin/main"',
    );
    expect(qualityCommands).toContain("dagger call diff-gate --source=.");

    const daggerSource = read(".dagger/src/index.ts");
    expect(daggerSource).toContain("async diffGate(");
    expect(daggerSource).toContain("bun run check:diff");
  });

  test("pins tools and enforces immutable artifact checks", () => {
    const qualityCommands = stepByKey("quality-gate").commands.join("\n");
    expect(qualityCommands).toContain("dagger call release-candidate");
    expect(stepByKey("release-contract").commands.join("\n")).toContain(
      "dagger call release-contract --source=.",
    );

    const daggerSource = read(".dagger/src/index.ts");
    expect(daggerSource).toContain('GIT_CLIFF_VERSION = "2.14.1"');
    expect(daggerSource).toContain("git diff --exit-code -- dist/forgix.mjs");
    expect(daggerSource).toContain('["node", "scripts/release-ci.ts", "candidate"]');

    const releaseCi = read("scripts/release-ci.ts");
    expect(releaseCi).toContain('"--ignore-scripts"');
  });

  test("serializes renovate-sync, runs release-contract in parallel, and verifies pinned CLIs", () => {
    const renovate = stepByKey("renovate-sync");
    expect(renovate.concurrency).toBe(1);
    expect(renovate.concurrency_group).toBe("forgix-renovate");
    expect(renovate.commands.join("\n")).toContain('bun --version)" != "$${expected_bun}"');

    const releaseContract = stepByKey("release-contract");
    expect(releaseContract.depends_on).toBeUndefined();

    for (const key of ["quality-gate", "formal-lean", "runtime-smoke", "release-contract"]) {
      expect(stepByKey(key).commands.join("\n")).toContain(
        'dagger version | awk \'{print $$2}\')" != "v$${DAGGER_VERSION}"',
      );
    }

    const daggerSource = read(".dagger/src/index.ts");
    const depsIdx = daggerSource.indexOf("function withCiDependencies(");
    const workspaceIdx = daggerSource.indexOf("function withCiWorkspace(");
    expect(depsIdx).toBeGreaterThan(-1);
    expect(workspaceIdx).toBeGreaterThan(depsIdx);
    const depsBody = daggerSource.slice(depsIdx, workspaceIdx);
    expect(depsBody).toContain('["bun", "install", "--frozen-lockfile"]');
    expect(daggerSource).toContain('dag.cacheVolume("forgix-elan-cache")');
  });

  test("wires automated release phases with strict trigger anchors, dependencies, and credential isolation", () => {
    const releaseMain = stepByKey("release-main");
    expect(releaseMain.if).toBe(
      'build.branch == "main" && build.source != "schedule" && build.tag == null && build.pull_request.id == null',
    );
    expect(releaseMain.depends_on).toEqual(["quality-gate", "runtime-smoke", "release-contract"]);
    expect(releaseMain.concurrency).toBe(1);
    expect(releaseMain.concurrency_group).toBe("forgix-release-lifecycle");
    const mainCmd = releaseMain.commands.join("\n");
    expect(mainCmd).toContain("set -euo pipefail");
    expect(mainCmd).toContain("https://eu.auth.entire.io");
    expect(mainCmd).toContain("svc_01M8CHF4WWEXY2Z6R92SBEJSNC");
    expect(mainCmd).toContain("bun -e");
    expect(mainCmd).not.toContain("jq ");
    expect(mainCmd).not.toMatch(/export\s+ENTIRE_TOKEN=/);
    expect(mainCmd).toContain("export ENTIRE_TOKEN");
    expect(mainCmd).toContain('FORGIX_PREPARE_FILES_MODE="dagger"');
    expect(mainCmd).toContain("bun run release:auto main");
    expect(mainCmd).not.toContain("GITHUB_MIRROR_TOKEN");

    const releaseMerge = stepByKey("release-merge");
    expect(releaseMerge.if).toBe(
      'build.branch =~ /^release\\/v(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$/ && build.source != "schedule" && build.tag == null',
    );
    expect(releaseMerge.depends_on).toEqual(["quality-gate", "runtime-smoke", "release-contract"]);
    expect(releaseMerge.concurrency).toBe(1);
    expect(releaseMerge.concurrency_group).toBe("forgix-release-lifecycle");
    const mergeCmd = releaseMerge.commands.join("\n");
    expect(mergeCmd).toContain("set -euo pipefail");
    expect(mergeCmd).toContain("svc_01M8CHF4WWEXY2Z6R92SBEJSNC");
    expect(mergeCmd).toContain("bun -e");
    expect(mergeCmd).not.toContain("jq ");
    expect(mergeCmd).not.toMatch(/export\s+ENTIRE_TOKEN=/);
    expect(mergeCmd).toContain("export ENTIRE_TOKEN");
    expect(mergeCmd).toContain("bun run release:auto merge");
    expect(mergeCmd).not.toContain("GITHUB_MIRROR_TOKEN");

    const releaseMirror = stepByKey("release-mirror");
    expect(releaseMirror.if).toBe(
      'build.tag =~ /^v(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$/ && build.source != "schedule"',
    );
    expect(releaseMirror.depends_on).toEqual(["quality-gate", "runtime-smoke"]);
    expect(releaseMirror.concurrency).toBe(1);
    expect(releaseMirror.concurrency_group).toBe("forgix-release-mirror");
    const mirrorCmd = releaseMirror.commands.join("\n");
    expect(mirrorCmd).toContain("set -euo pipefail");
    expect(mirrorCmd).toContain("buildkite-agent secret get GITHUB_MIRROR_TOKEN");
    expect(mirrorCmd).not.toMatch(/export\s+GITHUB_MIRROR_TOKEN=/);
    expect(mirrorCmd).toContain("export GITHUB_MIRROR_TOKEN");
    expect(mirrorCmd).toContain("bun run release:auto mirror");
    expect(mirrorCmd).not.toContain("ENTIRE_TOKEN");
    expect(mirrorCmd).not.toContain("svc_01M8CHF4WWEXY2Z6R92SBEJSNC");

    const tagRe = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
    expect(tagRe.test("v4.5.0")).toBe(true);
    expect(tagRe.test("v4.5.0-beta.1")).toBe(false);
    expect(tagRe.test("npm-v4.5.0")).toBe(false);

    const daggerSource = read(".dagger/src/index.ts");
    expect(daggerSource).toContain("async prepareReleaseFiles(");
    expect(daggerSource).toContain(
      '["bun", "scripts/release-auto.ts", "prepare-files", "--version", version]',
    );
  });
});

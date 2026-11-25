import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkCoverageGapsMonotonic,
  checkDiffTestPairing,
  checkFileLinesMonotonic,
  hasExportLineChange,
  isRefactorOnlyBranch,
  runDiffGate,
} from "../scripts/check-diff.ts";
import { resolveFallowBin } from "../scripts/check-golden-rules.ts";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function commitAll(cwd: string, message: string): void {
  git(cwd, "add", "-A");
  git(cwd, "commit", "--no-gpg-sign", "--allow-empty", "-m", message);
}

function withTempGitRepo(run: (root: string, baselinesDir: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "forgix-diff-gate-"));
  const baselinesDir = join(root, "fallow-baselines");
  try {
    git(root, "init", "--quiet", "-b", "main");
    git(root, "config", "user.name", "Test User");
    git(root, "config", "user.email", "test@example.com");

    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "test"), { recursive: true });
    mkdirSync(baselinesDir, { recursive: true });

    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "diff-gate-fixture",
        private: true,
        type: "module",
        main: "src/index.ts",
        scripts: { test: "bun test" },
      }),
    );
    writeFileSync(join(root, "bunfig.toml"), "[test]\n");
    writeFileSync(
      join(root, "src/index.ts"),
      "function helper(n: number): number { return n + 1; }\nexport function compute(n: number): number { return helper(n); }\n",
    );
    writeFileSync(
      join(root, "test/index.test.ts"),
      "import { compute } from '../src/index.ts';\nvoid compute(1);\n",
    );
    writeFileSync(
      join(baselinesDir, "file-lines.json"),
      JSON.stringify({ schemaVersion: 1, files: { "src/legacy.ts": 350 } }, null, 2) + "\n",
    );
    writeFileSync(
      join(baselinesDir, "coverage-gaps.json"),
      JSON.stringify(
        { schemaVersion: 1, files: [], exports: ["src/index.ts::legacyGap"] },
        null,
        2,
      ) + "\n",
    );
    commitAll(root, "chore: initial commit");

    run(root, baselinesDir);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("Diff Gate: pure monotonic baseline checks (AC-5)", () => {
  test("checkFileLinesMonotonic rejects new keys and increased caps, allows unchanged or shrunk", () => {
    const base = { schemaVersion: 1 as const, files: { "src/a.ts": 350, "src/b.ts": 400 } };
    expect(checkFileLinesMonotonic(base, { schemaVersion: 1, files: { "src/a.ts": 350 } })).toEqual(
      [],
    );
    expect(checkFileLinesMonotonic(base, { schemaVersion: 1, files: { "src/a.ts": 320 } })).toEqual(
      [],
    );
    expect(checkFileLinesMonotonic(null, base)).toEqual([]);

    const growth = checkFileLinesMonotonic(base, {
      schemaVersion: 1,
      files: { "src/a.ts": 351, "src/new.ts": 310 },
    });
    expect(growth).toHaveLength(2);
    expect(growth.some((v) => v.includes("src/a.ts") && v.includes("351"))).toBe(true);
    expect(growth.some((v) => v.includes("src/new.ts"))).toBe(true);
  });

  test("checkCoverageGapsMonotonic rejects new untested files/exports, allows shrunk", () => {
    const base = {
      schemaVersion: 1 as const,
      files: ["src/old.ts"],
      exports: ["src/a.ts::oldGap"],
    };
    expect(checkCoverageGapsMonotonic(base, { schemaVersion: 1, files: [], exports: [] })).toEqual(
      [],
    );
    expect(checkCoverageGapsMonotonic(null, base)).toEqual([]);

    const growth = checkCoverageGapsMonotonic(base, {
      schemaVersion: 1,
      files: ["src/old.ts", "src/new-untested.ts"],
      exports: ["src/a.ts::oldGap", "src/a.ts::newGap"],
    });
    expect(growth).toHaveLength(2);
    expect(growth.some((v) => v.includes("src/new-untested.ts"))).toBe(true);
    expect(growth.some((v) => v.includes("src/a.ts::newGap"))).toBe(true);
  });
});

describe("Diff Gate: pure diff-to-test pairing rules (AC-5)", () => {
  test("detects export signature changes in unified diff", () => {
    expect(hasExportLineChange("@@ -1 +1 @@\n-const x = 1;\n+const x = 2;\n")).toBe(false);
    expect(hasExportLineChange("@@ -1 +1 @@\n+export function added() {}\n")).toBe(true);
    expect(hasExportLineChange("@@ -1 +1 @@\n-export const removed = 1;\n")).toBe(true);
    expect(hasExportLineChange("+++ b/src/index.ts\n--- a/src/index.ts\n")).toBe(false);
  });

  test("recognizes pure refactor commit subjects", () => {
    expect(isRefactorOnlyBranch(["refactor: simplify loop", "refactor(core): split helper"])).toBe(
      true,
    );
    expect(isRefactorOnlyBranch(["refactor!: rewrite internal state"])).toBe(true);
    expect(isRefactorOnlyBranch(["refactor: clean", "feat: add flag"])).toBe(false);
    expect(isRefactorOnlyBranch([])).toBe(false);
  });

  test("enforces test pairing on feat/fix and exempts pure internal refactor", () => {
    // feat without test -> fails
    expect(
      checkDiffTestPairing({
        changedFiles: ["src/index.ts"],
        commitSubjects: ["feat: add feature"],
        srcDiff: "+const x = 1;\n",
      }),
    ).toHaveLength(1);

    // feat on scripts/ without test -> fails
    expect(
      checkDiffTestPairing({
        changedFiles: ["scripts/tool.ts"],
        commitSubjects: ["feat: add script"],
        srcDiff: "",
      }),
    ).toHaveLength(1);

    // feat with test -> passes
    expect(
      checkDiffTestPairing({
        changedFiles: ["src/index.ts", "test/index.test.ts"],
        commitSubjects: ["feat: add feature"],
        srcDiff: "+export const x = 1;\n",
      }),
    ).toEqual([]);

    // pure refactor with no export change -> passes without test
    expect(
      checkDiffTestPairing({
        changedFiles: ["src/index.ts"],
        commitSubjects: ["refactor(core): simplify helper"],
        srcDiff: "-const a = 1;\n+const a = 2;\n",
      }),
    ).toEqual([]);

    // refactor that changes an export line -> fails without test
    expect(
      checkDiffTestPairing({
        changedFiles: ["src/index.ts"],
        commitSubjects: ["refactor: rename export"],
        srcDiff: "-export function a() {}\n+export function b() {}\n",
      }),
    ).toHaveLength(1);

    // docs-only diff -> passes without test
    expect(
      checkDiffTestPairing({
        changedFiles: ["docs/readme.md"],
        commitSubjects: ["docs: update readme"],
        srcDiff: "",
      }),
    ).toEqual([]);
  });
});

describe("Diff Gate: end-to-end Git integration (AC-5)", () => {
  test("clean no-op when HEAD equals base or diff has 0 files", () => {
    withTempGitRepo((root, baselinesDir) => {
      const sameRef = runDiffGate({ base: "main", root, baselinesDir, skipFallow: true });
      expect(sameRef.ok).toBe(true);
      expect(sameRef.noop).toBe(true);

      git(root, "checkout", "-q", "-b", "empty-branch");
      commitAll(root, "chore: empty commit");
      const emptyDiff = runDiffGate({ base: "main", root, baselinesDir, skipFallow: true });
      expect(emptyDiff.ok).toBe(true);
      expect(emptyDiff.noop).toBe(true);
    });
  });

  test("rejects file-lines.json and coverage-gaps.json baseline growth vs base", () => {
    withTempGitRepo((root, baselinesDir) => {
      git(root, "checkout", "-q", "-b", "grow-baselines");
      writeFileSync(
        join(baselinesDir, "file-lines.json"),
        JSON.stringify({ schemaVersion: 1, files: { "src/legacy.ts": 351 } }, null, 2) + "\n",
      );
      writeFileSync(
        join(baselinesDir, "coverage-gaps.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            files: [],
            exports: ["src/index.ts::legacyGap", "src/index.ts::newGap"],
          },
          null,
          2,
        ) + "\n",
      );
      commitAll(root, "chore: attempt to grow baselines");

      const report = runDiffGate({ base: "main", root, baselinesDir, skipFallow: true });
      expect(report.ok).toBe(false);
      expect(report.violations.some((v) => v.includes("file-lines.json"))).toBe(true);
      expect(report.violations.some((v) => v.includes("coverage-gaps.json"))).toBe(true);
    });
  });

  test("rejects feat: code diff without tests and exempts pure refactor: without export change", () => {
    withTempGitRepo((root, baselinesDir) => {
      // Pure refactor branch without export changes -> passes
      git(root, "checkout", "-q", "-b", "pure-refactor");
      writeFileSync(
        join(root, "src/index.ts"),
        "function helper(n: number): number { return n + 2 - 1; }\nexport function compute(n: number): number { return helper(n); }\n",
      );
      commitAll(root, "refactor(core): simplify internal helper");
      const refactorReport = runDiffGate({ base: "main", root, baselinesDir, skipFallow: true });
      expect(refactorReport.ok).toBe(true);

      // Feature branch without tests -> fails
      git(root, "checkout", "-q", "main");
      git(root, "checkout", "-q", "-b", "untested-feat");
      writeFileSync(
        join(root, "src/index.ts"),
        "function helper(n: number): number { return n + 2; }\nexport function compute(n: number): number { return helper(n); }\n",
      );
      commitAll(root, "feat: change compute behavior");
      const featReport = runDiffGate({ base: "main", root, baselinesDir, skipFallow: true });
      expect(featReport.ok).toBe(false);
      expect(featReport.violations[0]).toContain("Diff-to-test pairing violation");
    });
  });

  test("real fallow --fail-on-baseline-growth rejects dead-code baseline expansion", () => {
    withTempGitRepo((root, baselinesDir) => {
      const fallowBin = resolveFallowBin(root);
      const deadCodeBaseline = join(baselinesDir, "dead-code.json");
      const save1 = spawnSync(
        fallowBin,
        ["dead-code", "--save-baseline", deadCodeBaseline, "--no-cache", "--root", root],
        { cwd: root, encoding: "utf8" },
      );
      expect(save1.error).toBeUndefined();
      commitAll(root, "chore: add dead-code baseline");

      git(root, "checkout", "-q", "-b", "grow-dead-code-baseline");
      writeFileSync(join(root, "src/orphan.ts"), "export const unused = 1;\n");
      const save2 = spawnSync(
        fallowBin,
        ["dead-code", "--save-baseline", deadCodeBaseline, "--no-cache", "--root", root],
        { cwd: root, encoding: "utf8" },
      );
      expect(save2.error).toBeUndefined();
      writeFileSync(
        join(root, "test/index.test.ts"),
        "import { compute } from '../src/index.ts';\nvoid compute(2);\n",
      );
      commitAll(root, "feat: add orphan and grow dead-code baseline");

      const report = runDiffGate({ base: "main", root, baselinesDir });
      expect(report.ok).toBe(false);
      expect(report.violations.some((v) => v.includes("fallow dead-code baseline-growth"))).toBe(
        true,
      );
    });
  });
});

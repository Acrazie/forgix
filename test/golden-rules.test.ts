import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

import {
  checkCoverageGaps,
  checkFallowSuppressions,
  checkFileLines,
  checkInlineEscapeHatches,
  checkZeroRuntimeDeps,
  runGoldenRulesCheck,
  saveGoldenRulesBaselines,
  scanContentForEscapeHatches,
  type CoverageGapsBaseline,
  type FileLinesBaseline,
} from "../scripts/check-golden-rules.ts";
import { checkStagedEscapeHatches, runCheckStaged } from "../scripts/check-staged.ts";

function withTempProject(run: (root: string, baselinesDir: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "forgix-golden-rules-"));
  const baselinesDir = join(root, "fallow-baselines");
  try {
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "test"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "golden-fixture",
        private: true,
        type: "module",
        main: "src/index.ts",
        scripts: { test: "bun test" },
      }),
    );
    writeFileSync(join(root, "bunfig.toml"), "[test]\n");
    writeFileSync(join(root, "src/index.ts"), "export function greet(): string { return 'hi'; }\n");
    writeFileSync(
      join(root, "test/index.test.ts"),
      "import { greet } from '../src/index.ts';\nvoid greet();\n",
    );
    run(root, baselinesDir);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("Golden Rules: zero runtime dependencies (AC-4)", () => {
  test("passes when dependencies is absent or empty", () => {
    withTempProject((root) => {
      expect(checkZeroRuntimeDeps(root)).toEqual([]);
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ name: "fixture", private: true, dependencies: {} }),
      );
      expect(checkZeroRuntimeDeps(root)).toEqual([]);
    });
  });

  test("fails when package.json declares runtime dependencies", () => {
    withTempProject((root) => {
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ name: "fixture", private: true, dependencies: { lodash: "4.17.21" } }),
      );
      const violations = checkZeroRuntimeDeps(root);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("lodash");
    });
  });
});

describe("Golden Rules: per-file line-count ratchet (AC-1)", () => {
  test("passes within default 300/400 ceilings and fails when exceeded", () => {
    withTempProject((root, baselinesDir) => {
      writeFileSync(join(root, "src/ok.ts"), "export const a = 1;\n".repeat(300));
      writeFileSync(join(root, "scripts/ok.ts"), "const b = 1;\n".repeat(400));
      expect(checkFileLines(root, baselinesDir)).toEqual([]);

      writeFileSync(join(root, "src/too-big.ts"), "export const a = 1;\n".repeat(301));
      writeFileSync(join(root, "scripts/too-big.ts"), "const b = 1;\n".repeat(401));
      const violations = checkFileLines(root, baselinesDir);
      expect(violations).toHaveLength(2);
      expect(violations.some((v) => v.includes("src/too-big.ts") && v.includes("301"))).toBe(true);
      expect(violations.some((v) => v.includes("scripts/too-big.ts") && v.includes("401"))).toBe(
        true,
      );
    });
  });

  test("freezes baselined legacy files and fails on +1 line growth", () => {
    withTempProject((root, baselinesDir) => {
      const legacyPath = join(root, "src/legacy.ts");
      writeFileSync(legacyPath, "const line = 1;\n".repeat(350));
      expect(saveGoldenRulesBaselines(root, baselinesDir)).toEqual([]);

      const baseline = JSON.parse(
        readFileSync(join(baselinesDir, "file-lines.json"), "utf8"),
      ) as FileLinesBaseline;
      expect(baseline).toEqual({ schemaVersion: 1, files: { "src/legacy.ts": 350 } });
      expect(checkFileLines(root, baselinesDir)).toEqual([]);

      // Shrinking passes
      writeFileSync(legacyPath, "const line = 1;\n".repeat(349));
      expect(checkFileLines(root, baselinesDir)).toEqual([]);

      // Growing by +1 over baseline fails
      writeFileSync(legacyPath, "const line = 1;\n".repeat(351));
      const violations = checkFileLines(root, baselinesDir);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("src/legacy.ts");
      expect(violations[0]).toContain("351");
    });
  });

  test("rejects a new >60-LOC linear function in src/** via vp lint max-lines-per-function", () => {
    withTempProject((root) => {
      symlinkSync(join(REPO_ROOT, "node_modules"), join(root, "node_modules"), "dir");
      writeFileSync(join(root, "vite.config.ts"), readFileSync(join(REPO_ROOT, "vite.config.ts")));

      writeFileSync(
        join(root, "src/linear-ok.ts"),
        "export function shortFn(n: number): number {\n  return n + 1;\n}\n",
      );
      const bodyLines = Array.from({ length: 62 }, (_, i) => `  total += ${i + 1};`).join("\n");
      writeFileSync(
        join(root, "src/linear-long.ts"),
        `export function tooLongLinear(start: number): number {\n  let total = start;\n${bodyLines}\n  return total;\n}\n`,
      );

      const vpBin = join(REPO_ROOT, "node_modules", ".bin", "vp");
      const okResult = spawnSync(vpBin, ["lint", "src/linear-ok.ts"], {
        cwd: root,
        encoding: "utf8",
        shell: false,
      });
      expect(okResult.error).toBeUndefined();
      expect(okResult.status, `${okResult.stdout}\n${okResult.stderr}`).toBe(0);

      const failResult = spawnSync(vpBin, ["lint", "src/linear-long.ts"], {
        cwd: root,
        encoding: "utf8",
        shell: false,
      });
      expect(failResult.error).toBeUndefined();
      expect(failResult.status).not.toBe(0);
      expect(`${failResult.stdout}\n${failResult.stderr}`).toContain("max-lines-per-function");
    });
  }, 30_000);
});

describe("Golden Rules: inline Escape Hatches & Fallow suppressions (AC-4)", () => {
  const forbiddenSamples: ReadonlyArray<[string, string]> = [
    ["oxlint-disable", "// oxlint-disable-next-line\nexport const a = 1;\n"],
    ["eslint-disable", "/* eslint-disable */\nexport const a = 1;\n"],
    ["@ts-ignore", "// @ts-ignore\nexport const a = 1;\n"],
    ["@ts-expect-error", "// @ts-expect-error\nexport const a = 1;\n"],
    ["@ts-nocheck", "// @ts-nocheck\nexport const a = 1;\n"],
    ["fallow-ignore", "// fallow-ignore-next-line\nexport const a = 1;\n"],
    ["@expected-unused", "/** @expected-unused */\nexport const a = 1;\n"],
    ["as any", "export const a = (1 as any);\n"],
  ];

  test("detects every forbidden inline Escape Hatch in src/**", () => {
    for (const [rule, sample] of forbiddenSamples) {
      const matches = scanContentForEscapeHatches("src/example.ts", sample);
      expect(matches.length, `expected ${rule} to match`).toBeGreaterThan(0);
      expect(matches[0]?.rule).toBe(rule);
    }
  });

  test("full scan passes on clean src/** and fails when any Escape Hatch is present", () => {
    withTempProject((root) => {
      expect(checkInlineEscapeHatches(root)).toEqual([]);
      writeFileSync(join(root, "src/bad.ts"), "export const x = (1 as any);\n");
      const matches = checkInlineEscapeHatches(root);
      expect(matches).toHaveLength(1);
      expect(matches[0]?.path).toBe("src/bad.ts");
      expect(matches[0]?.rule).toBe("as any");
    });
  });

  test("fallow suppressions check passes on clean project and fails on fallow-ignore-file", () => {
    withTempProject((root) => {
      expect(checkFallowSuppressions(root)).toEqual([]);
      writeFileSync(
        join(root, "src/index.ts"),
        "// fallow-ignore-file\nexport function greet(): string { return 'hi'; }\n",
      );
      const violations = checkFallowSuppressions(root);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("Fallow suppressions are forbidden");
    });
  });

  test("staged check scans Git index blobs so clean working tree cannot mask staged Escape Hatch", () => {
    const repo = mkdtempSync(join(tmpdir(), "forgix-staged-escape-"));
    try {
      execFileSync("git", ["init", "--quiet", repo]);
      mkdirSync(join(repo, "src"), { recursive: true });
      const target = join(repo, "src/canary.ts");

      // Stage a forbidden Escape Hatch in the Git index
      writeFileSync(target, "// @ts-nocheck\nexport const canary = (1 as any);\n");
      execFileSync("git", ["-C", repo, "add", "--", "src/canary.ts"]);

      // Overwrite the working tree with clean code WITHOUT re-staging
      writeFileSync(target, "export const canary = 1;\n");

      // checkStagedEscapeHatches & runCheckStaged must still fail from index blob!
      expect(checkStagedEscapeHatches(["src/canary.ts"], repo)).toBe(1);
      expect(runCheckStaged({ cwd: repo })).toBe(1);

      // Re-stage the clean file -> escape hatch check passes
      execFileSync("git", ["-C", repo, "add", "--", "src/canary.ts"]);
      expect(checkStagedEscapeHatches(["src/canary.ts"], repo)).toBe(0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("Golden Rules: structural coverage-gaps ratchet (AC-3)", () => {
  test("passes when all exports are test-reachable, fails on new untested export, and respects baseline", () => {
    withTempProject((root, baselinesDir) => {
      expect(checkCoverageGaps(root, baselinesDir)).toEqual([]);

      // Add an untested export -> fails
      writeFileSync(
        join(root, "src/index.ts"),
        "export function greet(): string { return 'hi'; }\nexport function untested(): number { return 42; }\n",
      );
      const initialViolations = checkCoverageGaps(root, baselinesDir);
      expect(initialViolations).toHaveLength(1);
      expect(initialViolations[0]).toContain("src/index.ts::untested");

      // Save baseline -> passes
      expect(saveGoldenRulesBaselines(root, baselinesDir)).toEqual([]);
      const saved = JSON.parse(
        readFileSync(join(baselinesDir, "coverage-gaps.json"), "utf8"),
      ) as CoverageGapsBaseline;
      expect(saved.exports).toContain("src/index.ts::untested");
      expect(checkCoverageGaps(root, baselinesDir)).toEqual([]);

      // Add a second untested export -> fails even with baseline
      writeFileSync(
        join(root, "src/index.ts"),
        [
          "export function greet(): string { return 'hi'; }",
          "export function untested(): number { return 42; }",
          "export function anotherGap(): number { return 7; }",
        ].join("\n") + "\n",
      );
      const secondViolations = checkCoverageGaps(root, baselinesDir);
      expect(secondViolations).toHaveLength(1);
      expect(secondViolations[0]).toContain("src/index.ts::anotherGap");
    });
  });

  test("runGoldenRulesCheck aggregates checks end-to-end", () => {
    withTempProject((root, baselinesDir) => {
      const cleanReport = runGoldenRulesCheck({ root, baselinesDir });
      expect(cleanReport).toEqual({ ok: true, violations: [] });
    });
  });
});

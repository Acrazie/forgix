import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveFallowBin,
  type CoverageGapsBaseline,
  type FileLinesBaseline,
} from "./check-golden-rules.ts";

const REFACTOR_COMMIT_RE = /^refactor(\([^)]+\))?!?:/;
const EXPORT_LINE_RE = /^\s*export(?:\s|\{|\*)/;

export type DiffGateOptions = {
  base: string;
  root: string;
  baselinesDir: string;
  skipFallow?: boolean;
};

export type DiffGateReport = {
  ok: boolean;
  noop: boolean;
  notes: string[];
  violations: string[];
};

type ExecResult = {
  status: number;
  stdout: string;
  stderr: string;
};

function runCommand(command: string, args: string[], cwd: string): ExecResult {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false });
  if (result.error) {
    return { status: 1, stdout: "", stderr: result.error.message };
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function readJsonAtRef(root: string, ref: string, repoRelPath: string): unknown {
  const result = runCommand("git", ["show", `${ref}:${repoRelPath}`], root);
  if (result.status !== 0) return null;
  return JSON.parse(result.stdout) as unknown;
}

function readJsonOnDisk(filePath: string): unknown {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

export function checkFileLinesMonotonic(
  base: FileLinesBaseline | null,
  current: FileLinesBaseline | null,
): string[] {
  if (base === null || current === null) return [];
  const violations: string[] = [];
  for (const [file, cap] of Object.entries(current.files)) {
    const baseCap = base.files[file];
    if (baseCap === undefined) {
      violations.push(
        `file-lines.json baseline growth: new legacy entry "${file}" (${cap} lines) is forbidden`,
      );
    } else if (cap > baseCap) {
      violations.push(
        `file-lines.json baseline growth: "${file}" cap increased from ${baseCap} to ${cap}`,
      );
    }
  }
  return violations;
}

export function checkCoverageGapsMonotonic(
  base: CoverageGapsBaseline | null,
  current: CoverageGapsBaseline | null,
): string[] {
  if (base === null || current === null) return [];
  const baseFiles = new Set(base.files);
  const baseExports = new Set(base.exports);
  const violations: string[] = [];

  for (const file of current.files) {
    if (!baseFiles.has(file)) {
      violations.push(`coverage-gaps.json baseline growth: new untested file "${file}"`);
    }
  }
  for (const exp of current.exports) {
    if (!baseExports.has(exp)) {
      violations.push(`coverage-gaps.json baseline growth: new untested export "${exp}"`);
    }
  }
  return violations;
}

export function hasExportLineChange(unifiedDiff: string): boolean {
  for (const line of unifiedDiff.split(/\r?\n/)) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (!line.startsWith("+") && !line.startsWith("-")) continue;
    if (EXPORT_LINE_RE.test(line.slice(1))) return true;
  }
  return false;
}

export function isRefactorOnlyBranch(commitSubjects: readonly string[]): boolean {
  return (
    commitSubjects.length > 0 &&
    commitSubjects.every((subject) => REFACTOR_COMMIT_RE.test(subject.trim()))
  );
}

export function checkDiffTestPairing(input: {
  changedFiles: readonly string[];
  commitSubjects: readonly string[];
  srcDiff: string;
}): string[] {
  const normalized = input.changedFiles.map(normalizePath);
  const codeFiles = normalized.filter(
    (file) => file.startsWith("src/") || file.startsWith("scripts/"),
  );
  if (codeFiles.length === 0) return [];

  const hasTestChanges = normalized.some((file) => file.startsWith("test/"));
  if (hasTestChanges) return [];

  if (isRefactorOnlyBranch(input.commitSubjects) && !hasExportLineChange(input.srcDiff)) {
    return [];
  }

  const reason = !isRefactorOnlyBranch(input.commitSubjects)
    ? "non-refactor commits require paired test/** changes"
    : "refactor commits that change exported signatures in src/** require paired test/** changes";
  return [
    `Diff-to-test pairing violation (${reason}): changed ${codeFiles.join(", ")} without updating test/**`,
  ];
}

function checkFallowBaselineGrowth(
  root: string,
  baselinesDir: string,
  base: string,
): { violations: string[]; notes: string[] } {
  const fallowBin = resolveFallowBin(root);
  const checks: ReadonlyArray<{ subcommand: string; file: string; extraArgs: string[] }> = [
    { subcommand: "dead-code", file: "dead-code.json", extraArgs: [] },
    { subcommand: "health", file: "health.json", extraArgs: ["--baseline-mode", "identity"] },
    { subcommand: "dupes", file: "dupes.json", extraArgs: [] },
  ];

  const violations: string[] = [];
  const notes: string[] = [];
  for (const check of checks) {
    const absPath = join(baselinesDir, check.file);
    if (!existsSync(absPath)) {
      notes.push(
        `Skipping fallow ${check.subcommand} baseline-growth check (${check.file} absent).`,
      );
      continue;
    }
    const relPath = normalizePath(relative(root, absPath));
    const baselineArg = relPath.startsWith("..") ? absPath : relPath;
    const args = [
      check.subcommand,
      ...check.extraArgs,
      "--fail-on-baseline-growth",
      "--baseline-base",
      base,
      "--baseline",
      baselineArg,
      "--no-cache",
      "--root",
      root,
    ];
    const result = runCommand(fallowBin, args, root);
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout).trim();
      violations.push(
        `fallow ${check.subcommand} baseline-growth check failed (exit ${result.status}): ${detail}`,
      );
    }
  }
  return { violations, notes };
}

function gitChangedFiles(root: string, base: string): { files?: string[]; error?: string } {
  let result = runCommand("git", ["diff", "--name-only", `${base}...HEAD`], root);
  if (result.status !== 0) {
    result = runCommand("git", ["diff", "--name-only", `${base}..HEAD`], root);
  }
  if (result.status !== 0) {
    return { error: `Failed to compute git diff against ${base}: ${result.stderr.trim()}` };
  }
  const files = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return { files };
}

function gitSrcDiff(root: string, base: string): string {
  const triple = runCommand("git", ["diff", "-U0", `${base}...HEAD`, "--", "src/"], root);
  if (triple.status === 0) return triple.stdout;
  return runCommand("git", ["diff", "-U0", `${base}..HEAD`, "--", "src/"], root).stdout;
}

function gitCommitSubjects(root: string, base: string): string[] {
  const result = runCommand("git", ["log", "--format=%s", `${base}..HEAD`], root);
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function checkLocalBaselineGrowth(root: string, baselinesDir: string, base: string): string[] {
  const fileLinesAbs = join(baselinesDir, "file-lines.json");
  const fileLinesRel = normalizePath(relative(root, fileLinesAbs));
  const coverageGapsAbs = join(baselinesDir, "coverage-gaps.json");
  const coverageGapsRel = normalizePath(relative(root, coverageGapsAbs));

  return [
    ...checkFileLinesMonotonic(
      readJsonAtRef(root, base, fileLinesRel) as FileLinesBaseline | null,
      readJsonOnDisk(fileLinesAbs) as FileLinesBaseline | null,
    ),
    ...checkCoverageGapsMonotonic(
      readJsonAtRef(root, base, coverageGapsRel) as CoverageGapsBaseline | null,
      readJsonOnDisk(coverageGapsAbs) as CoverageGapsBaseline | null,
    ),
  ];
}

export function runDiffGate(options: DiffGateOptions): DiffGateReport {
  const head = runCommand("git", ["rev-parse", "--verify", "HEAD"], options.root);
  if (head.status !== 0) {
    return {
      ok: false,
      noop: false,
      notes: [],
      violations: [`Cannot resolve HEAD: ${head.stderr.trim()}`],
    };
  }
  const baseRev = runCommand("git", ["rev-parse", "--verify", options.base], options.root);
  if (baseRev.status !== 0) {
    return {
      ok: false,
      noop: false,
      notes: [],
      violations: [`Cannot resolve base ref "${options.base}": ${baseRev.stderr.trim()}`],
    };
  }
  if (head.stdout.trim() === baseRev.stdout.trim()) {
    return {
      ok: true,
      noop: true,
      notes: [`HEAD equals ${options.base}; skipping diff gate.`],
      violations: [],
    };
  }

  const diffFiles = gitChangedFiles(options.root, options.base);
  if (diffFiles.error !== undefined || diffFiles.files === undefined) {
    return { ok: false, noop: false, notes: [], violations: [diffFiles.error ?? "Diff failed"] };
  }
  if (diffFiles.files.length === 0) {
    return {
      ok: true,
      noop: true,
      notes: [`No changed files vs ${options.base}; skipping diff gate.`],
      violations: [],
    };
  }

  const fallowResult = options.skipFallow
    ? { violations: [], notes: [] }
    : checkFallowBaselineGrowth(options.root, options.baselinesDir, options.base);

  const violations = [
    ...fallowResult.violations,
    ...checkLocalBaselineGrowth(options.root, options.baselinesDir, options.base),
    ...checkDiffTestPairing({
      changedFiles: diffFiles.files,
      commitSubjects: gitCommitSubjects(options.root, options.base),
      srcDiff: gitSrcDiff(options.root, options.base),
    }),
  ];

  return { ok: violations.length === 0, noop: false, notes: fallowResult.notes, violations };
}

function parseCliArgs(argv: string[]): DiffGateOptions {
  let base = "origin/main";
  let root = process.cwd();
  let baselinesDir: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base" && argv[index + 1] !== undefined) {
      base = argv[index + 1] as string;
      index += 1;
    } else if (arg === "--root" && argv[index + 1] !== undefined) {
      root = resolve(argv[index + 1] as string);
      index += 1;
    } else if (arg === "--baselines-dir" && argv[index + 1] !== undefined) {
      baselinesDir = resolve(argv[index + 1] as string);
      index += 1;
    }
  }

  return { base, root, baselinesDir: baselinesDir ?? join(root, "fallow-baselines") };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const options = parseCliArgs(process.argv.slice(2));
  const report = runDiffGate(options);
  for (const note of report.notes) console.log(`[check:diff] ${note}`);
  if (!report.ok) {
    for (const violation of report.violations) console.error(`[check:diff] ${violation}`);
    process.exitCode = 1;
  } else if (!report.noop) {
    console.log(`[check:diff] Diff gate passed against ${options.base}.`);
  }
}

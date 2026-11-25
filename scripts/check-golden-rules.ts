import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SRC_MAX_LINES = 300;
export const SCRIPTS_MAX_LINES = 400;

const CODE_EXTENSIONS = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
const REPO_FALLOW_BIN = fileURLToPath(new URL("../node_modules/.bin/fallow", import.meta.url));
const LINE_SCOPES: ReadonlyArray<{ dir: string; ceiling: number }> = [
  { dir: "src", ceiling: SRC_MAX_LINES },
  { dir: "scripts", ceiling: SCRIPTS_MAX_LINES },
];

export const ESCAPE_HATCH_RULES: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: "oxlint-disable", pattern: /\boxlint-disable\b/ },
  { rule: "eslint-disable", pattern: /\beslint-disable\b/ },
  { rule: "@ts-ignore", pattern: /@ts-ignore\b/ },
  { rule: "@ts-expect-error", pattern: /@ts-expect-error\b/ },
  { rule: "@ts-nocheck", pattern: /@ts-nocheck\b/ },
  { rule: "fallow-ignore", pattern: /\bfallow-ignore\b/ },
  { rule: "@expected-unused", pattern: /@expected-unused\b/ },
  { rule: "as any", pattern: /\bas\s+any\b/ },
];

export type EscapeHatchMatch = {
  path: string;
  line: number;
  rule: string;
  snippet: string;
};

export type FileLinesBaseline = {
  schemaVersion: 1;
  files: Record<string, number>;
};

export type CoverageGapsBaseline = {
  schemaVersion: 1;
  files: string[];
  exports: string[];
};

export type GoldenRulesOptions = {
  root: string;
  baselinesDir: string;
  saveBaseline?: boolean;
};

export type GoldenRulesReport = {
  ok: boolean;
  violations: string[];
};

function normalizeRelPath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function hasCodeExtension(filePath: string): boolean {
  const slash = filePath.lastIndexOf("/");
  const dot = filePath.lastIndexOf(".");
  if (dot <= slash) return false;
  return CODE_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}

export function isSrcSourcePath(relativePath: string): boolean {
  const normalized = normalizeRelPath(relativePath);
  return normalized.startsWith("src/") && hasCodeExtension(normalized);
}

export function countPhysicalLines(content: string): number {
  if (content.length === 0) return 0;
  const parts = content.split("\n");
  return content.endsWith("\n") ? parts.length - 1 : parts.length;
}

export function scanContentForEscapeHatches(
  relativePath: string,
  content: string,
): EscapeHatchMatch[] {
  const normalized = normalizeRelPath(relativePath);
  const lines = content.split(/\r?\n/);
  const matches: EscapeHatchMatch[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index] ?? "";
    for (const { rule, pattern } of ESCAPE_HATCH_RULES) {
      if (pattern.test(lineText)) {
        matches.push({
          path: normalized,
          line: index + 1,
          rule,
          snippet: lineText.trim(),
        });
      }
    }
  }
  return matches;
}

function collectCodeFiles(root: string, dirName: string): string[] {
  const baseDir = join(root, dirName);
  if (!existsSync(baseDir)) return [];

  const collected: string[] = [];
  const stack: string[] = [baseDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        const rel = normalizeRelPath(relative(root, fullPath));
        if (hasCodeExtension(rel)) collected.push(rel);
      }
    }
  }
  return collected.toSorted();
}

export function resolveFallowBin(root: string): string {
  const localBin = join(root, "node_modules", ".bin", "fallow");
  if (existsSync(localBin)) return localBin;
  if (existsSync(REPO_FALLOW_BIN)) return REPO_FALLOW_BIN;
  return "fallow";
}

function runFallowJson(root: string, args: string[]): { data?: unknown; error?: string } {
  const bin = resolveFallowBin(root);
  const result = spawnSync(bin, [...args, "--root", root], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.error) return { error: `Failed to execute fallow: ${result.error.message}` };
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    return { error: `fallow ${args[0] ?? ""} exited ${result.status ?? 1}: ${detail}` };
  }
  try {
    return { data: JSON.parse(result.stdout) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Invalid JSON from fallow ${args[0] ?? ""}: ${message}` };
  }
}

export function checkZeroRuntimeDeps(root: string): string[] {
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) return ["package.json not found"];

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`Failed to parse package.json: ${message}`];
  }
  if (typeof parsed !== "object" || parsed === null) return ["package.json must be a JSON object"];

  const deps = (parsed as Record<string, unknown>).dependencies;
  if (deps === undefined) return [];
  if (typeof deps !== "object" || deps === null || Array.isArray(deps)) {
    return ["package.json dependencies must be absent or an empty object {}"];
  }
  const names = Object.keys(deps);
  if (names.length === 0) return [];
  return [`Runtime dependencies are forbidden in package.json: ${names.join(", ")}`];
}

export function checkInlineEscapeHatches(root: string): EscapeHatchMatch[] {
  const matches: EscapeHatchMatch[] = [];
  for (const relPath of collectCodeFiles(root, "src")) {
    const content = readFileSync(join(root, relPath), "utf8");
    matches.push(...scanContentForEscapeHatches(relPath, content));
  }
  return matches;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function checkFallowSuppressions(root: string): string[] {
  const { data, error } = runFallowJson(root, ["suppressions", "--format", "json", "--no-cache"]);
  if (error !== undefined) return [error];

  const payload = asRecord(data);
  const summary = asRecord(payload.summary);
  const total = typeof summary.total === "number" ? summary.total : 0;
  const files = Array.isArray(payload.files) ? payload.files : [];

  if (total === 0 && files.length === 0) return [];
  return [
    `Fallow suppressions are forbidden (found ${Math.max(total, files.length)} suppression entry(ies))`,
  ];
}

function readJsonFile(filePath: string): unknown {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

export function computeFileLinesBaseline(root: string): FileLinesBaseline {
  const files: Record<string, number> = {};
  for (const { dir, ceiling } of LINE_SCOPES) {
    for (const relPath of collectCodeFiles(root, dir)) {
      const lines = countPhysicalLines(readFileSync(join(root, relPath), "utf8"));
      if (lines > ceiling) files[relPath] = lines;
    }
  }
  return { schemaVersion: 1, files };
}

export function checkFileLines(root: string, baselinesDir: string): string[] {
  const baseline = readJsonFile(join(baselinesDir, "file-lines.json")) as FileLinesBaseline | null;
  const caps = baseline?.files ?? {};
  const violations: string[] = [];

  for (const { dir, ceiling } of LINE_SCOPES) {
    for (const relPath of collectCodeFiles(root, dir)) {
      const lines = countPhysicalLines(readFileSync(join(root, relPath), "utf8"));
      const baselinedCap = caps[relPath];
      const limit = baselinedCap ?? ceiling;
      if (lines > limit) {
        const label = baselinedCap === undefined ? `ceiling ${ceiling}` : `baseline cap ${limit}`;
        violations.push(`${relPath}: ${lines} lines exceeds ${label}`);
      }
    }
  }
  return violations;
}

function extractStringPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const paths: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      paths.push(normalizeRelPath(entry));
    } else if (typeof entry === "object" && entry !== null && "path" in entry) {
      const pathValue = (entry as Record<string, unknown>).path;
      if (typeof pathValue === "string") paths.push(normalizeRelPath(pathValue));
    }
  }
  return [...new Set(paths)].toSorted();
}

function extractExportKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const keys: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.path === "string" && typeof record.export_name === "string") {
      keys.push(`${normalizeRelPath(record.path)}::${record.export_name}`);
    }
  }
  return [...new Set(keys)].toSorted();
}

export function computeCoverageGaps(root: string): {
  gaps?: CoverageGapsBaseline;
  error?: string;
} {
  const args = ["health", "--coverage-gaps", "--format", "json", "--no-cache"];
  const { data, error } = runFallowJson(root, args);
  if (error !== undefined) return { error };

  const section = asRecord(asRecord(data).coverage_gaps);
  return {
    gaps: {
      schemaVersion: 1,
      files: extractStringPaths(section.files),
      exports: extractExportKeys(section.exports),
    },
  };
}

export function checkCoverageGaps(root: string, baselinesDir: string): string[] {
  const { gaps, error } = computeCoverageGaps(root);
  if (error !== undefined) return [error];
  if (gaps === undefined) return ["Coverage gaps analysis returned no data"];

  const baseline = readJsonFile(
    join(baselinesDir, "coverage-gaps.json"),
  ) as CoverageGapsBaseline | null;
  const allowedFiles = new Set(baseline?.files ?? []);
  const allowedExports = new Set(baseline?.exports ?? []);
  const violations: string[] = [];

  for (const file of gaps.files) {
    if (!allowedFiles.has(file)) {
      violations.push(`Untested file not in coverage-gaps baseline: ${file}`);
    }
  }
  for (const exp of gaps.exports) {
    if (!allowedExports.has(exp)) {
      violations.push(`Untested export not in coverage-gaps baseline: ${exp}`);
    }
  }
  return violations;
}

export function saveGoldenRulesBaselines(root: string, baselinesDir: string): string[] {
  const fileLines = computeFileLinesBaseline(root);
  const { gaps, error } = computeCoverageGaps(root);
  if (error !== undefined || gaps === undefined) {
    return [error ?? "Failed to compute coverage gaps baseline"];
  }
  mkdirSync(baselinesDir, { recursive: true });
  writeFileSync(
    join(baselinesDir, "file-lines.json"),
    `${JSON.stringify(fileLines, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(baselinesDir, "coverage-gaps.json"),
    `${JSON.stringify(gaps, null, 2)}\n`,
    "utf8",
  );
  return [];
}

export function runGoldenRulesCheck(options: GoldenRulesOptions): GoldenRulesReport {
  if (options.saveBaseline) {
    const errors = saveGoldenRulesBaselines(options.root, options.baselinesDir);
    return { ok: errors.length === 0, violations: errors };
  }

  const escapeHatchViolations = checkInlineEscapeHatches(options.root).map(
    (match) =>
      `Escape Hatch forbidden in ${match.path}:${match.line} [${match.rule}]: ${match.snippet}`,
  );
  const violations = [
    ...checkZeroRuntimeDeps(options.root),
    ...checkFallowSuppressions(options.root),
    ...escapeHatchViolations,
    ...checkFileLines(options.root, options.baselinesDir),
    ...checkCoverageGaps(options.root, options.baselinesDir),
  ];
  return { ok: violations.length === 0, violations };
}

function parseCliArgs(argv: string[]): GoldenRulesOptions {
  let root = process.cwd();
  let baselinesDir: string | undefined;
  let saveBaseline = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root" && argv[index + 1] !== undefined) {
      root = resolve(argv[index + 1] as string);
      index += 1;
    } else if (arg === "--baselines-dir" && argv[index + 1] !== undefined) {
      baselinesDir = resolve(argv[index + 1] as string);
      index += 1;
    } else if (arg === "--save-baseline") {
      saveBaseline = true;
    }
  }

  return {
    root,
    baselinesDir: baselinesDir ?? join(root, "fallow-baselines"),
    saveBaseline,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const options = parseCliArgs(process.argv.slice(2));
  const report = runGoldenRulesCheck(options);
  if (!report.ok) {
    for (const violation of report.violations) console.error(`[golden-rules] ${violation}`);
    process.exitCode = 1;
  } else if (options.saveBaseline) {
    console.log(`[golden-rules] Saved baselines in ${options.baselinesDir}`);
  } else {
    console.log("[golden-rules] All Golden Rules checks passed.");
  }
}

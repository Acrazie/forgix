import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const DEFAULT_ARGUMENT_LIMIT = 64 * 1024;

const FORMAT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".gql",
  ".graphql",
  ".graphqls",
  ".handlebars",
  ".hbs",
  ".htm",
  ".html",
  ".js",
  ".json",
  ".json5",
  ".jsonc",
  ".jsx",
  ".less",
  ".markdown",
  ".md",
  ".mdx",
  ".mjs",
  ".mjml",
  ".mts",
  ".pcss",
  ".postcss",
  ".scss",
  ".svelte",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
  ".yaml",
  ".yml",
]);

const LINT_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

const EXCLUDED_PREFIXES = [
  ".worktrees/",
  ".codex/tasks/",
  ".codex/benchmarks/",
  "plugins/codex-dev-flow/test/fixtures/",
  "plugins/codex-dev-flow/docs/baselines/",
];

const EXCLUDED_PATHS = new Set([
  "bun.lock",
  // Release Please owns this generated file's formatting.
  "plugins/codex-dev-flow/CHANGELOG.md",
  "plugins/codex-dev-flow/docs/lifecycle-contract.projection.json",
]);

export type CommandResult = {
  status: number | null;
  stdout?: Uint8Array | string;
  stderr?: Uint8Array | string;
  error?: Error;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string; capture: boolean },
) => CommandResult;

export type ClassifiedPaths = {
  formatPaths: string[];
  lintPaths: string[];
};

function defaultRunner(
  command: string,
  args: string[],
  options: { cwd: string; capture: boolean },
): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    shell: false,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  return {
    status: result.status,
    ...(result.stdout === null ? {} : { stdout: result.stdout }),
    ...(result.stderr === null ? {} : { stderr: result.stderr }),
    ...(result.error === undefined ? {} : { error: result.error }),
  };
}

function outputText(output: Uint8Array | string | undefined): string {
  if (output === undefined) return "";
  return typeof output === "string" ? output : Buffer.from(output).toString("utf8");
}

export function parseNulPaths(output: Uint8Array | string): string[] {
  const text = outputText(output);
  if (text.length === 0) return [];
  return text.split("\0").filter((path) => path.length > 0);
}

function extension(path: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? path.slice(dot).toLowerCase() : "";
}

function isExcluded(path: string): boolean {
  if (EXCLUDED_PATHS.has(path)) return true;
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  return path.includes("/dist/") || path.includes("/coverage/");
}

export function classifyStagedPaths(paths: string[]): ClassifiedPaths {
  const formatPaths: string[] = [];
  const lintPaths: string[] = [];
  const seenFormat = new Set<string>();
  const seenLint = new Set<string>();

  for (const path of paths) {
    if (isExcluded(path)) continue;
    const pathExtension = extension(path);
    if (FORMAT_EXTENSIONS.has(pathExtension) && !seenFormat.has(path)) {
      seenFormat.add(path);
      formatPaths.push(path);
    }
    if (LINT_EXTENSIONS.has(pathExtension) && !seenLint.has(path)) {
      seenLint.add(path);
      lintPaths.push(path);
    }
  }

  return { formatPaths, lintPaths };
}

function argumentBytes(value: string): number {
  return Buffer.byteLength(value) + 1;
}

export function chunkPaths(
  paths: string[],
  baseArgs: string[],
  limit = DEFAULT_ARGUMENT_LIMIT,
): string[][] {
  if (paths.length === 0) return [];
  const baseBytes = baseArgs.reduce((total, argument) => total + argumentBytes(argument), 0);
  const chunks: string[][] = [];
  let chunk: string[] = [];
  let bytes = baseBytes;

  for (const path of paths) {
    const pathBytes = argumentBytes(path);
    if (chunk.length > 0 && bytes + pathBytes > limit) {
      chunks.push(chunk);
      chunk = [];
      bytes = baseBytes;
    }
    chunk.push(path);
    bytes += pathBytes;
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

function reportCommandFailure(command: string, result: CommandResult): void {
  if (result.error) console.error(`${command}: ${result.error.message}`);
  const stderr = outputText(result.stderr).trim();
  if (stderr.length > 0) console.error(stderr);
}

function runToolBatches(options: {
  command: string;
  baseArgs: string[];
  paths: string[];
  cwd: string;
  run: CommandRunner;
  argumentLimit: number;
}): number {
  let status = 0;
  for (const paths of chunkPaths(options.paths, options.baseArgs, options.argumentLimit)) {
    const result = options.run(options.command, [...options.baseArgs, ...paths], {
      cwd: options.cwd,
      capture: false,
    });
    const resultStatus = result.status ?? 1;
    if (resultStatus !== 0) {
      if (status === 0) status = resultStatus;
      reportCommandFailure(options.command, result);
    }
  }
  return status;
}

export function executeFastGate(
  options: ClassifiedPaths & {
    cwd: string;
    run?: CommandRunner;
    argumentLimit?: number;
  },
): number {
  const run = options.run ?? defaultRunner;
  const argumentLimit = options.argumentLimit ?? DEFAULT_ARGUMENT_LIMIT;
  const formatStatus = runToolBatches({
    command: "oxfmt",
    baseArgs: ["--check", "--no-error-on-unmatched-pattern", "--disable-nested-config"],
    paths: options.formatPaths,
    cwd: options.cwd,
    run,
    argumentLimit,
  });
  const lintStatus = runToolBatches({
    command: "oxlint",
    baseArgs: ["--disable-nested-config", "--no-error-on-unmatched-pattern"],
    paths: options.lintPaths,
    cwd: options.cwd,
    run,
    argumentLimit,
  });
  return formatStatus === 0 ? lintStatus : formatStatus;
}

export function runCheckStaged(options: {
  cwd: string;
  run?: CommandRunner;
  argumentLimit?: number;
}): number {
  const run = options.run ?? defaultRunner;
  const gitResult = run("git", ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"], {
    cwd: options.cwd,
    capture: true,
  });
  if (gitResult.status !== 0) {
    reportCommandFailure("git", gitResult);
    return gitResult.status ?? 1;
  }
  const paths = parseNulPaths(gitResult.stdout ?? "");
  return executeFastGate({
    cwd: options.cwd,
    ...classifyStagedPaths(paths),
    run,
    ...(options.argumentLimit === undefined ? {} : { argumentLimit: options.argumentLimit }),
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = runCheckStaged({ cwd: process.cwd() });
}

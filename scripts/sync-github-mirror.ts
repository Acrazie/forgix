import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TARGET = "https://github.com/Acrazie/forgix.git";
const DEFAULT_BRANCH = "main";
const DEFAULT_SOURCE_REF = "HEAD";
const REQUIRED_ROOT_FILES = ["plugin.json", "dist/forgix.mjs"] as const;

export interface MirrorSyncOptions {
  sourceRepoDir: string;
  target: string;
  branch: string;
  pushBranch?: string;
  sourceRef: string;
  apply: boolean;
}

export interface MirrorSyncResult {
  status: "up_to_date" | "dry_run" | "pushed";
  target: string;
  branch: string;
  pushBranch: string;
  sourceSha: string;
  preservedGithub: boolean;
  changedFiles: number;
  pushed: boolean;
  mirrorCommit?: string;
}

function runCommand(program: string, args: readonly string[], cwd: string): string {
  const result = spawnSync(program, args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`${program} ${args.join(" ")} failed (${result.status}): ${detail}`);
  }
  return result.stdout.trim();
}

function exportSourceTree(sourceRepoDir: string, sourceRef: string, exportDir: string): string {
  const sourceSha = runCommand(
    "git",
    ["rev-parse", "--verify", `${sourceRef}^{commit}`],
    sourceRepoDir,
  );
  const archive = spawnSync("git", ["archive", "--format=tar", sourceSha], {
    cwd: sourceRepoDir,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (archive.error) throw archive.error;
  if (archive.status !== 0) {
    throw new Error(`git archive ${sourceSha} failed: ${archive.stderr.toString("utf8").trim()}`);
  }
  const extract = spawnSync("tar", ["-xf", "-", "-C", exportDir], { input: archive.stdout });
  if (extract.error) throw extract.error;
  if (extract.status !== 0) {
    throw new Error(`tar extract failed: ${extract.stderr.toString("utf8").trim()}`);
  }
  for (const relPath of REQUIRED_ROOT_FILES) {
    if (!existsSync(join(exportDir, relPath))) {
      throw new Error(`Source ref ${sourceRef} is missing required root plugin file: ${relPath}`);
    }
  }
  return sourceSha;
}

function replaceMirrorTree(mirrorDir: string, exportDir: string, githubBackupDir: string): boolean {
  const targetGithubDir = join(mirrorDir, ".github");
  const preservedGithub = existsSync(targetGithubDir);
  if (preservedGithub) {
    cpSync(targetGithubDir, githubBackupDir, { recursive: true, verbatimSymlinks: true });
  }
  for (const entry of readdirSync(mirrorDir)) {
    if (entry === ".git") continue;
    rmSync(join(mirrorDir, entry), { recursive: true, force: true });
  }
  for (const entry of readdirSync(exportDir)) {
    if (entry === ".github" && preservedGithub) continue;
    cpSync(join(exportDir, entry), join(mirrorDir, entry), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }
  if (preservedGithub) {
    cpSync(githubBackupDir, targetGithubDir, { recursive: true, verbatimSymlinks: true });
  }
  return preservedGithub;
}

function ensureCommitIdentity(mirrorDir: string, sourceRepoDir: string): void {
  const readConfig = (key: string): string => {
    const res = spawnSync("git", ["config", "--get", key], {
      cwd: sourceRepoDir,
      encoding: "utf8",
    });
    return res.status === 0 ? res.stdout.trim() : "";
  };
  const name = readConfig("user.name") || "Forgix Mirror";
  const email = readConfig("user.email") || "forgix-mirror@users.noreply.github.com";
  runCommand("git", ["config", "user.name", name], mirrorDir);
  runCommand("git", ["config", "user.email", email], mirrorDir);
}

function finalizeMirror(
  options: MirrorSyncOptions,
  mirrorDir: string,
  sourceSha: string,
  preservedGithub: boolean,
  changedFiles: number,
): MirrorSyncResult {
  const pushBranch = options.pushBranch ?? options.branch;
  const base = {
    target: options.target,
    branch: options.branch,
    pushBranch,
    sourceSha,
    preservedGithub,
  };
  if (changedFiles === 0) {
    return { status: "up_to_date", ...base, changedFiles: 0, pushed: false };
  }
  ensureCommitIdentity(mirrorDir, options.sourceRepoDir);
  const message = `chore(mirror): sync root layout from ${sourceSha.slice(0, 12)}`;
  runCommand("git", ["commit", "-m", message], mirrorDir);
  const mirrorCommit = runCommand("git", ["rev-parse", "HEAD"], mirrorDir);
  if (!options.apply) {
    return { status: "dry_run", ...base, changedFiles, pushed: false, mirrorCommit };
  }
  runCommand("git", ["push", "origin", `HEAD:refs/heads/${pushBranch}`], mirrorDir);
  return { status: "pushed", ...base, changedFiles, pushed: true, mirrorCommit };
}

export function syncGithubMirror(options: MirrorSyncOptions): MirrorSyncResult {
  const sandbox = mkdtempSync(join(tmpdir(), "forgix-github-mirror-"));
  const exportDir = join(sandbox, "export");
  const mirrorDir = join(sandbox, "mirror");
  const githubBackupDir = join(sandbox, "github-backup");
  try {
    runCommand("mkdir", ["-p", exportDir], sandbox);
    const sourceSha = exportSourceTree(options.sourceRepoDir, options.sourceRef, exportDir);
    runCommand(
      "git",
      ["clone", "--depth", "1", "--branch", options.branch, options.target, mirrorDir],
      sandbox,
    );
    const preservedGithub = replaceMirrorTree(mirrorDir, exportDir, githubBackupDir);
    runCommand("git", ["add", "-A"], mirrorDir);
    const changedFiles = runCommand("git", ["status", "--porcelain"], mirrorDir)
      .split("\n")
      .filter(Boolean).length;
    return finalizeMirror(options, mirrorDir, sourceSha, preservedGithub, changedFiles);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

const VALUE_FLAGS: Readonly<Record<string, "target" | "branch" | "pushBranch" | "sourceRef">> = {
  "--target": "target",
  "--branch": "branch",
  "--push-branch": "pushBranch",
  "--source-ref": "sourceRef",
};

export function parseMirrorArgs(argv: readonly string[], sourceRepoDir: string): MirrorSyncOptions {
  const values: { target: string; branch: string; pushBranch?: string; sourceRef: string } = {
    target: DEFAULT_TARGET,
    branch: DEFAULT_BRANCH,
    sourceRef: DEFAULT_SOURCE_REF,
  };
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--apply" || arg === "--dry-run") {
      apply = arg === "--apply";
      continue;
    }
    const field = VALUE_FLAGS[arg];
    const nextValue = argv[i + 1];
    if (field && nextValue) {
      values[field] = nextValue;
      i += 1;
      continue;
    }
    throw new Error(
      `Unknown argument "${arg}". Usage: bun scripts/sync-github-mirror.ts [--target <url>] [--branch <name>] [--push-branch <name>] [--source-ref <ref>] [--dry-run|--apply]`,
    );
  }
  return { sourceRepoDir, ...values, apply };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const options = parseMirrorArgs(process.argv.slice(2), repoRoot);
  const result = syncGithubMirror(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

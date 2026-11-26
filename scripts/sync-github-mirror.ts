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
  tag?: string;
  apply: boolean;
  token?: string;
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
  tag?: string;
  tagPushed?: boolean;
}

interface CommandContext {
  env?: NodeJS.ProcessEnv;
  secret?: string;
}

function encodeBasicToken(token: string): string {
  return Buffer.from(`x-access-token:${token}`, "utf8").toString("base64");
}

export function redactSecret(text: string, token?: string): string {
  const secret = token?.trim();
  if (!secret) return text;
  const encoded = encodeBasicToken(secret);
  return text.replaceAll(secret, "[REDACTED]").replaceAll(encoded, "[REDACTED]");
}

export function buildMirrorGitEnv(
  target: string,
  token?: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv | undefined {
  const secret = token?.trim();
  if (!secret || !target.startsWith("https://")) return undefined;
  const parsed = new URL(target);
  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
    throw new Error(`Refusing to send mirror token to non-GitHub host "${parsed.hostname}".`);
  }
  return {
    ...baseEnv,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `http.${parsed.origin}/.extraHeader`,
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${encodeBasicToken(secret)}`,
  };
}

function runCommand(
  program: string,
  args: readonly string[],
  cwd: string,
  context: CommandContext = {},
): string {
  const result = spawnSync(program, args, {
    cwd,
    encoding: "utf8",
    ...(context.env ? { env: context.env } : {}),
  });
  if (result.error) throw new Error(redactSecret(result.error.message, context.secret));
  if (result.status !== 0) {
    const detail = redactSecret((result.stderr || result.stdout || "").trim(), context.secret);
    const commandLabel = redactSecret(`${program} ${args.join(" ")}`, context.secret);
    throw new Error(`${commandLabel} failed (${result.status}): ${detail}`);
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

function hasRemoteTag(mirrorDir: string, tag: string, context: CommandContext): boolean {
  return Boolean(
    runCommand("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`], mirrorDir, context),
  );
}

function pushMirrorTag(mirrorDir: string, tag: string, context: CommandContext): boolean {
  if (hasRemoteTag(mirrorDir, tag, context)) return false;
  runCommand(
    "git",
    ["-c", "tag.gpgSign=false", "tag", "-a", tag, "-m", `chore(release): ${tag}`],
    mirrorDir,
  );
  runCommand("git", ["push", "origin", `refs/tags/${tag}`], mirrorDir, context);
  return true;
}

function finalizeUnchangedMirror(
  options: MirrorSyncOptions,
  mirrorDir: string,
  base: Omit<MirrorSyncResult, "status" | "changedFiles" | "pushed">,
  context: CommandContext,
): MirrorSyncResult {
  if (options.apply && options.tag) {
    ensureCommitIdentity(mirrorDir, options.sourceRepoDir);
    const tagPushed = pushMirrorTag(mirrorDir, options.tag, context);
    const mirrorCommit = runCommand("git", ["rev-parse", "HEAD"], mirrorDir);
    return {
      status: tagPushed ? "pushed" : "up_to_date",
      ...base,
      changedFiles: 0,
      pushed: tagPushed,
      tagPushed,
      mirrorCommit,
    };
  }
  return {
    status: "up_to_date",
    ...base,
    changedFiles: 0,
    pushed: false,
    ...(options.tag ? { tagPushed: false } : {}),
  };
}

function finalizeMirror(
  options: MirrorSyncOptions,
  mirrorDir: string,
  sourceSha: string,
  preservedGithub: boolean,
  changedFiles: number,
  context: CommandContext,
): MirrorSyncResult {
  const pushBranch = options.pushBranch ?? options.branch;
  const base = {
    target: options.target,
    branch: options.branch,
    pushBranch,
    sourceSha,
    preservedGithub,
    ...(options.tag ? { tag: options.tag } : {}),
  };
  if (options.apply && options.tag && hasRemoteTag(mirrorDir, options.tag, context)) {
    return { status: "up_to_date", ...base, changedFiles: 0, pushed: false, tagPushed: false };
  }
  if (changedFiles === 0) return finalizeUnchangedMirror(options, mirrorDir, base, context);
  ensureCommitIdentity(mirrorDir, options.sourceRepoDir);
  const message = options.tag
    ? `chore(release): ${options.tag}`
    : `chore(mirror): sync root layout from ${sourceSha.slice(0, 12)}`;
  runCommand("git", ["-c", "commit.gpgsign=false", "commit", "-m", message], mirrorDir);
  const mirrorCommit = runCommand("git", ["rev-parse", "HEAD"], mirrorDir);
  if (!options.apply) {
    return {
      status: "dry_run",
      ...base,
      changedFiles,
      pushed: false,
      mirrorCommit,
      ...(options.tag ? { tagPushed: false } : {}),
    };
  }
  runCommand("git", ["push", "origin", `HEAD:refs/heads/${pushBranch}`], mirrorDir, context);
  const tagPushed = options.tag ? pushMirrorTag(mirrorDir, options.tag, context) : undefined;
  return {
    status: "pushed",
    ...base,
    changedFiles,
    pushed: true,
    mirrorCommit,
    ...(tagPushed !== undefined ? { tagPushed } : {}),
  };
}

export function syncGithubMirror(options: MirrorSyncOptions): MirrorSyncResult {
  const token = (options.token ?? process.env.GITHUB_MIRROR_TOKEN ?? "").trim() || undefined;
  const env = buildMirrorGitEnv(options.target, token);
  const context: CommandContext = { ...(env ? { env } : {}), ...(token ? { secret: token } : {}) };
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
      context,
    );
    const preservedGithub = replaceMirrorTree(mirrorDir, exportDir, githubBackupDir);
    runCommand("git", ["add", "-A"], mirrorDir);
    runCommand("git", ["add", "-f", ...REQUIRED_ROOT_FILES], mirrorDir);
    const changedFiles = runCommand("git", ["status", "--porcelain"], mirrorDir)
      .split("\n")
      .filter(Boolean).length;
    return finalizeMirror(options, mirrorDir, sourceSha, preservedGithub, changedFiles, context);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

const VALUE_FLAGS: Readonly<
  Record<string, "target" | "branch" | "pushBranch" | "sourceRef" | "tag">
> = {
  "--target": "target",
  "--branch": "branch",
  "--push-branch": "pushBranch",
  "--source-ref": "sourceRef",
  "--tag": "tag",
};

export function parseMirrorArgs(argv: readonly string[], sourceRepoDir: string): MirrorSyncOptions {
  const values: {
    target: string;
    branch: string;
    pushBranch?: string;
    sourceRef: string;
    tag?: string;
  } = {
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
      `Unknown argument "${arg}". Usage: bun scripts/sync-github-mirror.ts [--target <url>] [--branch <name>] [--push-branch <name>] [--source-ref <ref>] [--tag <vX.Y.Z>] [--dry-run|--apply]`,
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

import { spawnSync } from "node:child_process";
import type {
  FactoryEvolutionCategory,
  FactoryEvolutionProposal,
  FactoryTelemetrySummary,
} from "../types.js";
import { proposeFactoryEvolution } from "./store.js";

export interface RetroCommitSignal {
  hash: string;
  at: string;
  subject: string;
  scope?: string;
}

export interface GitRetroSignals {
  available: boolean;
  windowDays: number;
  maxCommits: number;
  commitsAnalyzed: number;
  fixCommits: RetroCommitSignal[];
  revertCommits: RetroCommitSignal[];
  scopes: Record<string, number>;
}

export interface EntireRetroSignals {
  available: boolean;
  ref: string;
  checkpointCount: number;
  fixOrRevertCount: number;
  recentCheckpoints: RetroCommitSignal[];
}

export interface RetroPatternCluster {
  id: string;
  source: "telemetry" | "git" | "entire";
  count: number;
  targetCategory: FactoryEvolutionCategory;
  evidence: string[];
}

export interface RetroReport {
  signals: {
    telemetry: FactoryTelemetrySummary;
    git: GitRetroSignals;
    entire: EntireRetroSignals;
  };
  clusters: RetroPatternCluster[];
  proposals: FactoryEvolutionProposal[];
}

export interface RetroCollectOptions {
  maxCommits?: number;
  windowDays?: number;
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_MAX_COMMITS = 20;
const DEFAULT_WINDOW_DAYS = 7;
const GIT_TIMEOUT_MS = 10_000;
const ENTIRE_CHECKPOINT_REFS = [
  "refs/heads/entire/checkpoints/v1",
  "refs/remotes/origin/entire/checkpoints/v1",
] as const;
const FIX_SUBJECT_RE = /^fix(?:\(([^)]+)\))?!?:/i;
const REVERT_SUBJECT_RE = /^(?:revert(?:\(([^)]+)\))?:|revert\s+")/i;
const CHECKPOINT_FRICTION_RE = /\b(?:fix|revert|fail|error|retry|hotfix)\b/i;

function runGit(cwd: string, args: string[], env = process.env): string | undefined {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
    killSignal: "SIGKILL",
    env: { ...env, GIT_TERMINAL_PROMPT: "0" },
  });
  return result.error || result.status !== 0 ? undefined : result.stdout;
}

function parseGitLogLines(raw: string): RetroCommitSignal[] {
  const commits: RetroCommitSignal[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [hash, at, ...rest] = line.split("\x1f");
    const subject = rest.join("\x1f").trim();
    if (hash && at && subject) commits.push({ hash: hash.slice(0, 12), at, subject });
  }
  return commits;
}

function withScope(commit: RetroCommitSignal, raw: string | undefined): RetroCommitSignal {
  const scope = raw?.trim().toLowerCase();
  return scope ? { ...commit, scope } : commit;
}

function classifyGitCommits(commits: readonly RetroCommitSignal[]) {
  const fixCommits: RetroCommitSignal[] = [];
  const revertCommits: RetroCommitSignal[] = [];
  const scopes: Record<string, number> = {};
  for (const commit of commits) {
    const fixMatch = FIX_SUBJECT_RE.exec(commit.subject);
    if (fixMatch) {
      const entry = withScope(commit, fixMatch[1]);
      fixCommits.push(entry);
      if (entry.scope) scopes[entry.scope] = (scopes[entry.scope] ?? 0) + 1;
      continue;
    }
    const revertMatch = REVERT_SUBJECT_RE.exec(commit.subject);
    if (revertMatch) revertCommits.push(withScope(commit, revertMatch[1]));
  }
  return { fixCommits, revertCommits, scopes };
}

export function collectGitRetroSignals(
  workspaceRoot: string,
  options?: RetroCollectOptions,
): GitRetroSignals {
  const maxCommits = options?.maxCommits ?? DEFAULT_MAX_COMMITS;
  const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const env = options?.env ?? process.env;
  const empty: GitRetroSignals = {
    available: false,
    windowDays,
    maxCommits,
    commitsAnalyzed: 0,
    fixCommits: [],
    revertCommits: [],
    scopes: {},
  };
  if (runGit(workspaceRoot, ["rev-parse", "--is-inside-work-tree"], env)?.trim() !== "true") {
    return empty;
  }
  const rawLog = runGit(
    workspaceRoot,
    ["log", "-n", String(maxCommits), `--since=${windowDays} days ago`, "--format=%H%x1f%cI%x1f%s"],
    env,
  );
  if (rawLog === undefined) return { ...empty, available: true };
  const commits = parseGitLogLines(rawLog);
  const { fixCommits, revertCommits, scopes } = classifyGitCommits(commits);
  return {
    available: true,
    windowDays,
    maxCommits,
    commitsAnalyzed: commits.length,
    fixCommits,
    revertCommits,
    scopes,
  };
}

export function collectEntireRetroSignals(
  workspaceRoot: string,
  options?: RetroCollectOptions,
): EntireRetroSignals {
  const maxCommits = options?.maxCommits ?? DEFAULT_MAX_COMMITS;
  const env = options?.env ?? process.env;
  const empty: EntireRetroSignals = {
    available: false,
    ref: "entire/checkpoints/v1",
    checkpointCount: 0,
    fixOrRevertCount: 0,
    recentCheckpoints: [],
  };
  const resolvedRef = ENTIRE_CHECKPOINT_REFS.find(
    (ref) => runGit(workspaceRoot, ["rev-parse", "--verify", `${ref}^{commit}`], env) !== undefined,
  );
  if (!resolvedRef) return empty;
  const rawLog = runGit(
    workspaceRoot,
    ["log", "-n", String(maxCommits), "--format=%H%x1f%cI%x1f%s", resolvedRef],
    env,
  );
  if (rawLog === undefined) return empty;
  const recentCheckpoints = parseGitLogLines(rawLog);
  const fixOrRevertCount = recentCheckpoints.filter((e) =>
    CHECKPOINT_FRICTION_RE.test(e.subject),
  ).length;
  return {
    available: true,
    ref: resolvedRef,
    checkpointCount: recentCheckpoints.length,
    fixOrRevertCount,
    recentCheckpoints,
  };
}

function pushTelemetryClusters(
  summary: FactoryTelemetrySummary,
  clusters: RetroPatternCluster[],
): void {
  for (const issue of summary.recurringIssues) {
    if (issue.count >= 2) {
      clusters.push({
        id: `telemetry:issue:${issue.issueId}`,
        source: "telemetry",
        count: issue.count,
        targetCategory: "mechanical_guardrail",
        evidence: [issue.issueId],
      });
    }
  }
  const rules: ReadonlyArray<readonly [string, number, FactoryEvolutionCategory]> = [
    ["telemetry:escape-hatch-blocks", summary.escapeHatchBlocks, "mechanical_guardrail"],
    ["telemetry:debug-root-cause", summary.debugRootCauseActivations, "mechanical_guardrail"],
    ["telemetry:shared-contract-drift", summary.sharedContractDrifts, "surface_verification_rule"],
    ["telemetry:checkpoint-failures", summary.checkpointFailures, "surface_verification_rule"],
    ["telemetry:phase-bounces", summary.phaseBounces, "skill_budget_bounded_doc"],
  ];
  for (const [id, count, targetCategory] of rules) {
    if (count >= 2) {
      clusters.push({
        id,
        source: "telemetry",
        count,
        targetCategory,
        evidence: [`count:${count}`],
      });
    }
  }
}

export function clusterRetroPatterns(
  summary: FactoryTelemetrySummary,
  git: GitRetroSignals,
  entire: EntireRetroSignals,
): RetroPatternCluster[] {
  const clusters: RetroPatternCluster[] = [];
  pushTelemetryClusters(summary, clusters);
  for (const [scope, count] of Object.entries(git.scopes)) {
    if (count < 2) continue;
    clusters.push({
      id: `git:fix-scope:${scope}`,
      source: "git",
      count,
      targetCategory: "surface_verification_rule",
      evidence: git.fixCommits
        .filter((c) => c.scope === scope)
        .slice(0, 5)
        .map((c) => c.hash),
    });
  }
  if (git.fixCommits.length >= 2) {
    clusters.push({
      id: "git:fix-commits",
      source: "git",
      count: git.fixCommits.length,
      targetCategory: "mechanical_guardrail",
      evidence: git.fixCommits.slice(0, 5).map((c) => c.hash),
    });
  }
  if (git.revertCommits.length >= 2) {
    clusters.push({
      id: "git:revert-commits",
      source: "git",
      count: git.revertCommits.length,
      targetCategory: "surface_verification_rule",
      evidence: git.revertCommits.slice(0, 5).map((c) => c.hash),
    });
  }
  if (entire.fixOrRevertCount >= 2) {
    clusters.push({
      id: "entire:fix-checkpoints",
      source: "entire",
      count: entire.fixOrRevertCount,
      targetCategory: "surface_verification_rule",
      evidence: entire.recentCheckpoints
        .filter((e) => CHECKPOINT_FRICTION_RE.test(e.subject))
        .slice(0, 5)
        .map((e) => e.hash),
    });
  }
  return clusters.toSorted((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

function enrichProposalsWithClusters(
  proposals: readonly FactoryEvolutionProposal[],
  clusters: readonly RetroPatternCluster[],
): FactoryEvolutionProposal[] {
  return proposals.map((proposal) => {
    const matched = clusters.filter((c) => c.targetCategory === proposal.category);
    if (matched.length === 0) return proposal;
    const base = proposal.triggeredBy.filter((item) => !item.startsWith("baseline:"));
    const extra = matched.map((c) => `${c.id}:${c.count}`);
    return { ...proposal, triggeredBy: [...new Set([...base, ...extra])] };
  });
}

export function buildRetroReport(
  workspaceRoot: string,
  summary: FactoryTelemetrySummary,
  options?: RetroCollectOptions,
): RetroReport {
  const git = collectGitRetroSignals(workspaceRoot, options);
  const entire = collectEntireRetroSignals(workspaceRoot, options);
  const clusters = clusterRetroPatterns(summary, git, entire);
  const proposals = enrichProposalsWithClusters(proposeFactoryEvolution(summary), clusters);
  return { signals: { telemetry: summary, git, entire }, clusters, proposals };
}

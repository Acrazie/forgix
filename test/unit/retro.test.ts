import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildV2AssureCompletionPair,
  classifyAssureCompletion,
} from "../../src/core/assure-completion.ts";
import {
  buildRetroReport,
  clusterRetroPatterns,
  collectEntireRetroSignals,
  collectGitRetroSignals,
} from "../../src/core/retro.ts";
import { summarizeFactoryTelemetry } from "../../src/core/store.ts";
import { computeTaskNextActionEnvelope } from "../../src/task/next-action.ts";
import { makeTaskState } from "../support/helpers-v6.ts";

function makeVerifiedAssureState(taskId: string, profile: "quick" | "plan") {
  const state = makeTaskState({
    taskId,
    status: "assuring",
    profile,
    includeAssurance: true,
  });
  const evidenceRecord = {
    schemaVersion: 1 as const,
    evidenceId: "ev:check:1",
    operationId: "check:test",
    subjectIds: ["criterion.main"],
    verifierKind: "command" as const,
    result: "passed" as const,
    verifierDigest: "sha256:verifier-1",
    observedFingerprint: "sha256:worktree-v1",
    detailRef: "run:1",
    recordedAt: "2026-11-24T00:00:00.000Z",
    digest: "sha256:ev-1",
  };
  state.assurance = {
    schemaVersion: 1,
    evidenceIndex: [evidenceRecord],
  };
  state.history = state.history.filter((ev) => ev.type !== "assure.completed");
  const sealed = buildV2AssureCompletionPair(
    state,
    [evidenceRecord],
    "sha256:worktree-v1",
    undefined,
  );
  state.assurance = {
    ...state.assurance,
    completionIndex: sealed.completionIndex,
    receipt: sealed.receipt,
  };
  state.history = [...state.history, sealed.event];
  expect(classifyAssureCompletion(state)).toBe("verified");
  return state;
}

function git(cwd: string, args: string[]) {
  execFileSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
      GIT_TERMINAL_PROMPT: "0",
    },
    stdio: "ignore",
  });
}

describe("retro local signals, clustering, and proposals", () => {
  test("gracefully degrades outside a git repository and without entire checkpoints", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forgix-retro-nogit-"));
    try {
      const gitSignals = collectGitRetroSignals(dir);
      const entireSignals = collectEntireRetroSignals(dir);
      expect(gitSignals.available).toBe(false);
      expect(gitSignals.commitsAnalyzed).toBe(0);
      expect(entireSignals.available).toBe(false);
      expect(entireSignals.checkpointCount).toBe(0);

      const summary = summarizeFactoryTelemetry([]);
      const report = buildRetroReport(dir, summary);
      expect(report.clusters).toEqual([]);
      expect(report.proposals.map((p) => [p.priority, p.category])).toEqual([
        [1, "mechanical_guardrail"],
        [2, "surface_verification_rule"],
        [3, "skill_budget_bounded_doc"],
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("collects git fix/revert commits and entire checkpoints and clusters patterns >= 2", async () => {
    const dir = await mkdtemp(join(tmpdir(), "forgix-retro-git-"));
    try {
      git(dir, ["init", "-q", "-b", "main"]);
      await writeFile(join(dir, "a.txt"), "1\n");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-q", "-m", "feat(core): initial"]);

      await writeFile(join(dir, "a.txt"), "2\n");
      git(dir, ["commit", "-q", "-am", "fix(hooks): guard edge case"]);

      await writeFile(join(dir, "a.txt"), "3\n");
      git(dir, ["commit", "-q", "-am", "fix(hooks): prevent empty diff crash"]);

      await writeFile(join(dir, "a.txt"), "4\n");
      git(dir, ["commit", "-q", "-am", "revert: undo flaky change"]);

      // Create an entire/checkpoints/v1 branch with 2 friction checkpoints
      git(dir, ["checkout", "-q", "--orphan", "entire/checkpoints/v1"]);
      await writeFile(join(dir, "cp.txt"), "cp1\n");
      git(dir, ["add", "cp.txt"]);
      git(dir, ["commit", "-q", "-m", "checkpoint: fix lint failure"]);
      await writeFile(join(dir, "cp.txt"), "cp2\n");
      git(dir, ["commit", "-q", "-am", "checkpoint: retry after error"]);

      const gitSignals = collectGitRetroSignals(dir);
      const entireSignals = collectEntireRetroSignals(dir);
      expect(gitSignals.available).toBe(true);
      expect(entireSignals.available).toBe(true);
      expect(entireSignals.checkpointCount).toBe(2);
      expect(entireSignals.fixOrRevertCount).toBe(2);

      // Switch back to default branch to inspect main commit history
      git(dir, ["checkout", "-q", "-f", "main"]);
      const mainGit = collectGitRetroSignals(dir);
      expect(mainGit.fixCommits).toHaveLength(2);
      expect(mainGit.revertCommits).toHaveLength(1);
      expect(mainGit.scopes).toEqual({ hooks: 2 });

      const summary = summarizeFactoryTelemetry([
        { at: "2026-11-24T00:00:00Z", type: "escape_hatch.blocked", issueId: "EH-1" },
        { at: "2026-11-24T00:01:00Z", type: "escape_hatch.blocked", issueId: "EH-1" },
      ]);
      const clusters = clusterRetroPatterns(summary, mainGit, entireSignals);
      const ids = clusters.map((c) => c.id);
      expect(ids).toContain("telemetry:issue:EH-1");
      expect(ids).toContain("telemetry:escape-hatch-blocks");
      expect(ids).toContain("git:fix-scope:hooks");
      expect(ids).toContain("git:fix-commits");
      expect(ids).toContain("entire:fix-checkpoints");
      // Single revert (< 2) must NOT be clustered
      expect(ids).not.toContain("git:revert-commits");

      const report = buildRetroReport(dir, summary);
      expect(report.proposals.map((p) => [p.priority, p.category])).toEqual([
        [1, "mechanical_guardrail"],
        [2, "surface_verification_rule"],
        [3, "skill_budget_bounded_doc"],
      ]);
      expect(report.proposals[0]!.triggeredBy).toContain("git:fix-commits:2");
      expect(report.proposals[1]!.triggeredBy).toContain("git:fix-scope:hooks:2");
      expect(report.proposals[1]!.triggeredBy).toContain("entire:fix-checkpoints:2");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("ASSURE terminal non-blocking retro reminder", () => {
  test("stays silent on smooth Quick verified ASSURE tasks", () => {
    const state = makeVerifiedAssureState("quick-smooth", "quick");
    const env = computeTaskNextActionEnvelope(state);
    expect(env.role).toBe("terminal");
    expect(env.phase).toBe("ASSURE");
    expect(env.retroRecommended).toBeUndefined();
    expect(env.retroReason).toBeUndefined();
    expect(env.allowedCommands).not.toContain("forgix retro");
  });

  test("recommends forgix retro on Plan verified ASSURE tasks", () => {
    const state = makeVerifiedAssureState("plan-done", "plan");
    const env = computeTaskNextActionEnvelope(state);
    expect(env.role).toBe("terminal");
    expect(env.phase).toBe("ASSURE");
    expect(env.retroRecommended).toBe(true);
    expect(env.retroReason).toContain("plan_profile");
    expect(env.allowedCommands).toContain("forgix retro");
  });

  test("recommends forgix retro on Quick tasks with debug-root-cause friction", () => {
    const state = makeVerifiedAssureState("quick-friction", "quick");
    state.assurance!.issues = [
      {
        issueId: "issue:flaky",
        operationId: "check:test",
        status: "resolved",
        correctionAttempts: 2,
        rootCauseRequired: true,
        evidenceRef: "ev:1",
      },
    ];
    const env = computeTaskNextActionEnvelope(state);
    expect(env.role).toBe("terminal");
    expect(env.phase).toBe("ASSURE");
    expect(env.retroRecommended).toBe(true);
    expect(env.retroReason).toContain("debug_root_cause");
    expect(env.allowedCommands).toContain("forgix retro");
  });
});

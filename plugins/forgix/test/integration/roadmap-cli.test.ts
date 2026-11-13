import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { stringify as stringifyYaml } from "yaml";
import { HELP_TEXT, runInvocation, type RoadmapState } from "../../src/cli.ts";

const tempDirs: string[] = [];

function createWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "forgix-roadmap-cli-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, ".gitignore"), ".codex/roadmap/\n", "utf8");
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function buildDraftState(): RoadmapState {
  return {
    schemaVersion: 1,
    sessionId: "cli-roadmap",
    phase: "synthesis",
    codebaseKind: "greenfield",
    projectMode: "create",
    visualFormat: "tree",
    updatedAt: "2026-11-13T10:30:00.000Z",
    projectBinding: { owner: "acrazie", title: "CLI Roadmap" },
    themes: [{ id: "t1", title: "Core", summary: "Initial MVP" }],
    features: [
      {
        id: "f1",
        title: "Search",
        summary: "Full-text search",
        priority: "P0",
        risk: "low",
        wave: 1,
        scopeIn: ["Index endpoint"],
        scopeOut: ["Fuzzy typo"],
      },
    ],
    workItems: [
      {
        id: "w1",
        featureId: "f1",
        title: "Build search index",
        objective: "Index documents on save",
        scopeIn: ["Indexer service"],
        scopeOut: ["Sharding"],
        acceptanceCriteria: ["New document is searchable within 100ms"],
        risk: "low",
        priority: "P0",
        wave: 1,
        blockedBy: [],
      },
      {
        id: "w2",
        featureId: "f1",
        title: "Search query API",
        objective: "Expose GET /search",
        scopeIn: ["REST endpoint"],
        scopeOut: ["Faceted UI"],
        acceptanceCriteria: ["Returns matching results ordered by score"],
        risk: "medium",
        priority: "P1",
        wave: 1,
        blockedBy: ["w1"],
      },
    ],
  };
}

describe("roadmap CLI commands", () => {
  test("HELP_TEXT advertises roadmap subcommands", () => {
    expect(HELP_TEXT).toContain("roadmap session-view");
    expect(HELP_TEXT).toContain("roadmap publish-plan|publish-record");
    expect(HELP_TEXT).toContain("roadmap select-ready");
  });

  test("executes full session lifecycle: save, view, validate, publish-plan, publish-record, select-ready, clear", async () => {
    const workspaceRoot = createWorkspace();
    const draft = buildDraftState();

    const emptyView = await runInvocation(["roadmap", "session-view"], { workspaceRoot });
    expect(emptyView.status).toBe("ok");
    expect(emptyView.data).toEqual({ state: null, gitignored: true });

    const validated = await runInvocation(["roadmap", "validate"], {
      workspaceRoot,
      roadmap: { input: stringifyYaml(draft) },
    });
    expect(validated.status).toBe("valid");
    const validatedData = validated.data as { candidateDigest: string };
    expect(validatedData.candidateDigest).toMatch(/^sha256:/);

    const saved = await runInvocation(["roadmap", "session-save"], {
      workspaceRoot,
      roadmap: { input: stringifyYaml(draft) },
    });
    expect(saved.status).toBe("saved");
    const savedData = saved.data as { visual: string };
    expect(savedData.visual).toContain("Build search index");

    const mermaidView = await runInvocation(["roadmap", "session-view", "--format=mermaid"], {
      workspaceRoot,
    });
    const mermaidData = mermaidView.data as { visual: string };
    expect(mermaidData.visual).toContain("flowchart TD");
    expect(mermaidData.visual).toContain("wi_w1 --> wi_w2");

    const validateSession = await runInvocation(["roadmap", "validate", "--session"], {
      workspaceRoot,
    });
    expect(validateSession.status).toBe("valid");

    const plan = await runInvocation(["roadmap", "publish-plan"], { workspaceRoot });
    const planData = plan.data as { plan: { summary: Record<string, number> } };
    expect(planData.plan.summary).toEqual({
      createFeatures: 1,
      updateFeatures: 0,
      createWorkItems: 2,
      updateWorkItems: 0,
      dependencyEdges: 1,
    });

    const recorded = await runInvocation(["roadmap", "publish-record"], {
      workspaceRoot,
      roadmap: {
        input: JSON.stringify({
          batchId: "initial",
          projectBinding: { number: 5, url: "https://github.com/users/acrazie/projects/5" },
          features: [{ id: "f1", issueNumber: 1 }],
          workItems: [
            { id: "w1", issueNumber: 2 },
            { id: "w2", issueNumber: 3 },
          ],
        }),
      },
    });
    expect(recorded.status).toBe("saved");
    const recordedData = recorded.data as {
      publication: { status: string };
      state: { phase: string };
    };
    expect(recordedData.publication.status).toBe("completed");
    expect(recordedData.state.phase).toBe("published");

    const ready = await runInvocation(
      ["roadmap", "select-ready", "--limit=1", "--max-risk=medium", "--require-issue"],
      { workspaceRoot },
    );
    const readyData = ready.data as {
      eligible: Array<{
        workItem: { id: string };
        workspace: { branch: string; worktreePath: string; baseBranch: string };
        featureStatusAfterStart: string;
      }>;
      skipped: unknown[];
    };
    expect(readyData.eligible).toHaveLength(1);
    expect(readyData.eligible[0]?.workItem.id).toBe("w1");
    expect(readyData.eligible[0]?.workspace).toEqual({
      branch: "feat/issue-2-build-search-index",
      worktreePath: ".worktrees/issue-2-build-search-index",
      baseBranch: "main",
    });
    expect(readyData.eligible[0]?.featureStatusAfterStart).toBe("In Progress");
    expect(readyData.skipped).toHaveLength(1);

    const cleared = await runInvocation(["roadmap", "session-clear"], { workspaceRoot });
    expect(cleared.data).toEqual({ cleared: true });
  });
});

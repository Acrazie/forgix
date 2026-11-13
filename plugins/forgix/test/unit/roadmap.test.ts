import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import * as api from "../../src/cli.ts";
import { expectRejected, expectThrown } from "../support/expect-error.ts";

const tempDirs: string[] = [];

function makeWorkspace(gitignoreContent = ".codex/roadmap/\n"): string {
  const dir = mkdtempSync(join(tmpdir(), "forgix-roadmap-"));
  tempDirs.push(dir);
  if (gitignoreContent) {
    writeFileSync(join(dir, ".gitignore"), gitignoreContent, "utf8");
  }
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function sampleState(overrides: Partial<api.RoadmapState> = {}): api.RoadmapState {
  return {
    schemaVersion: 1,
    sessionId: "roadmap-v1",
    phase: "synthesis",
    codebaseKind: "existing",
    projectMode: "create",
    visualFormat: "tree",
    updatedAt: "2026-11-13T10:00:00.000Z",
    productVisionPath: "docs/product-vision.md",
    productVisionSummary: "Unified onboarding and billing workflows.",
    projectBinding: { owner: "acrazie", title: "Core Roadmap" },
    themes: [{ id: "theme-1", title: "Onboarding", summary: "Reduce signup friction." }],
    features: [
      {
        id: "feat-auth",
        title: "Authentication",
        summary: "Session and token verification",
        priority: "P0",
        risk: "medium",
        wave: 1,
        scopeIn: ["Session login"],
        scopeOut: ["SAML SSO"],
      },
      {
        id: "feat-billing",
        title: "Billing",
        summary: "Subscription lifecycle",
        priority: "P1",
        risk: "high",
        wave: 2,
        scopeIn: ["Checkout session"],
        scopeOut: ["Multi-currency"],
      },
    ],
    workItems: [
      {
        id: "wi-login",
        featureId: "feat-auth",
        title: "Email login endpoint",
        objective: "Add verified login endpoint",
        scopeIn: ["POST /login"],
        scopeOut: ["OAuth providers"],
        linkedRuleIds: ["AUTH-01"],
        acceptanceCriteria: ["Returns HTTP 200 with session cookie on valid credentials"],
        risk: "low",
        priority: "P0",
        wave: 1,
        blockedBy: [],
      },
      {
        id: "wi-refresh",
        featureId: "feat-auth",
        title: "Token refresh rotation",
        objective: "Rotate refresh tokens safely",
        scopeIn: ["POST /refresh"],
        scopeOut: ["Device revoke UI"],
        acceptanceCriteria: ["Invalidates reused refresh token"],
        risk: "medium",
        priority: "P0",
        wave: 1,
        blockedBy: ["wi-login"],
      },
      {
        id: "wi-checkout",
        featureId: "feat-billing",
        title: "Stripe checkout webhook",
        objective: "Handle subscription activation",
        scopeIn: ["Webhook handler"],
        scopeOut: ["Invoicing PDF"],
        acceptanceCriteria: ["Verifies signature and activates plan"],
        risk: "high",
        priority: "P1",
        wave: 2,
        blockedBy: ["wi-login"],
      },
    ],
    ...overrides,
  };
}

describe("roadmap core primitives", () => {
  test("roadmap module has zero network, subprocess, or app-server imports", () => {
    const source = readFileSync(new URL("../../src/roadmap.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/node:child_process|spawn|execFile|fetch\s*\(|https?:\/\/[^f]/);
    expect(source).not.toMatch(/from\s+["']\.\/app-server|from\s+["']\.\/bridge/);
  });

  test("computeRoadmapCandidateDigest ignores mutable publication fields", () => {
    const base = sampleState();
    const withPublishedMetadata = sampleState({
      updatedAt: "2026-11-14T00:00:00.000Z",
      features: base.features.map((f, index) => ({
        ...f,
        issueNumber: 100 + index,
        issueUrl: `https://example.invalid/issues/${100 + index}`,
      })),
      workItems: base.workItems.map((item, index) => ({
        ...item,
        issueNumber: 200 + index,
        status: "In Progress",
      })),
    });

    expect(api.computeRoadmapCandidateDigest(withPublishedMetadata)).toBe(
      api.computeRoadmapCandidateDigest(base),
    );
  });

  test("validateRoadmapState rejects cycles, missing references, secrets, and local paths", () => {
    const cycleState = sampleState({
      workItems: [
        { ...sampleState().workItems[0]!, blockedBy: ["wi-refresh"] },
        { ...sampleState().workItems[1]!, blockedBy: ["wi-login"] },
      ],
    });
    expectThrown(
      () => api.validateRoadmapState(cycleState),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_cycle_detected",
    );

    const selfDep = sampleState({
      workItems: [{ ...sampleState().workItems[0]!, blockedBy: ["wi-login"] }],
    });
    expect(() => api.validateRoadmapState(selfDep)).toThrow(/cannot depend on itself/);

    const unknownFeature = sampleState({
      workItems: [{ ...sampleState().workItems[0]!, featureId: "missing-feat" }],
    });
    expect(() => api.validateRoadmapState(unknownFeature)).toThrow(/unknown feature/);

    const secretState = sampleState({
      productVisionSummary: "Use token ghp_1234567890abcdefghij1234567890",
    });
    expectThrown(
      () => api.validateRoadmapState(secretState),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_secret_detected",
    );

    const localPathState = sampleState({
      productVisionSummary: "Stored at /Users/someone/private/plan.md",
    });
    expectThrown(
      () => api.validateRoadmapState(localPathState),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_path_invalid",
    );

    const staleDigest = sampleState({
      approval: {
        approved: true,
        approvedAt: "2026-11-13T10:05:00.000Z",
        digest: "sha256:stale000",
      },
    });
    expectThrown(
      () => api.validateRoadmapState(staleDigest),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_state_conflict",
    );
  });

  test("renderRoadmapVisualSummary supports ASCII tree and Mermaid DAG formats", () => {
    const state = sampleState();
    const tree = api.renderRoadmapVisualSummary(state, "tree");
    expect(tree).toContain("Wave 1");
    expect(tree).toContain("[Feature] feat-auth: Authentication");
    expect(tree).toContain("wi-login: Email login endpoint [P0, risk=low, status=Ready]");
    expect(tree).toContain("<- blocked by [wi-login]");

    const mermaid = api.renderRoadmapVisualSummary(state, "mermaid");
    expect(mermaid).toContain("```mermaid");
    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain("wi_wi_login --> wi_wi_refresh");

    const sessionText = api.renderRoadmapSessionState(state, { gitignored: false });
    expect(sessionText).toContain("Wave-1 Ready: 1");
    expect(sessionText).toContain(".codex/roadmap/ is not listed in .gitignore");
  });

  test("planIdempotentPublication & recordPublishedRoadmapBatch support resumable batches", () => {
    const initial = sampleState();
    initial.features[0]!.issueNumber = 10;
    const plan = api.planIdempotentPublication(initial);
    expect(plan.summary).toEqual({
      createFeatures: 1,
      updateFeatures: 1,
      createWorkItems: 3,
      updateWorkItems: 0,
      dependencyEdges: 2,
    });
    expect(plan.workItems.map((item) => [item.id, item.initialStatus])).toEqual([
      ["wi-login", "Ready"],
      ["wi-refresh", "Backlog"],
      ["wi-checkout", "Backlog"],
    ]);

    const partial = api.recordPublishedRoadmapBatch(initial, {
      batchId: "b1",
      recordedAt: "2026-11-13T11:00:00.000Z",
      projectBinding: {
        owner: "acrazie",
        number: 7,
        url: "https://github.com/users/acrazie/projects/7",
      },
      features: [{ id: "feat-billing", issueNumber: 11 }],
      workItems: [{ id: "wi-login", issueNumber: 12 }],
    });
    expect(partial.phase).toBe("synthesis");
    expect(partial.publication?.status).toBe("partial");
    expect(partial.workItems.find((item) => item.id === "wi-login")?.status).toBe("Ready");

    const completed = api.recordPublishedRoadmapBatch(partial, {
      batchId: "b2",
      recordedAt: "2026-11-13T11:02:00.000Z",
      workItems: [
        { id: "wi-refresh", issueNumber: 13 },
        { id: "wi-checkout", issueNumber: 14 },
      ],
    });
    expect(completed.phase).toBe("published");
    expect(completed.publication?.status).toBe("completed");
    expect(completed.publication?.batchHistory).toHaveLength(2);
  });

  test("deriveFeatureStatus, buildWorkItemBranchAndWorktree, and selectEligibleWorkItems", () => {
    expect(api.deriveFeatureStatus([])).toBe("Backlog");
    expect(api.deriveFeatureStatus([{ status: "Backlog" }, { status: "Ready" }])).toBe("Backlog");
    expect(api.deriveFeatureStatus([{ status: "Done" }, { status: "Ready" }])).toBe("In Progress");
    expect(api.deriveFeatureStatus([{ status: "In Review" }])).toBe("In Progress");
    expect(api.deriveFeatureStatus([{ status: "Done" }, { status: "Done" }])).toBe("Done");

    expect(
      api.buildWorkItemBranchAndWorktree({
        id: "wi-login",
        issueNumber: 42,
        title: "Email login endpoint!",
      }),
    ).toEqual({
      branch: "feat/issue-42-email-login-endpoint",
      worktreePath: ".worktrees/issue-42-email-login-endpoint",
      baseBranch: "main",
    });

    expect(() =>
      api.buildWorkItemBranchAndWorktree(
        { id: "wi-login", issueNumber: 42, title: "Login" },
        { worktreeRoot: "../escape" },
      ),
    ).toThrow(/safe relative repository references/);

    const items: api.RoadmapWorkItem[] = [
      {
        ...sampleState().workItems[0]!,
        issueNumber: 101,
        status: "In Review",
      },
      {
        ...sampleState().workItems[1]!,
        issueNumber: 102,
        status: "Ready",
        blockedBy: ["wi-login"],
      },
      {
        ...sampleState().workItems[2]!,
        issueNumber: 103,
        wave: 1,
        risk: "medium",
        status: "Ready",
        blockedBy: [],
      },
      {
        ...sampleState().workItems[2]!,
        id: "wi-critical",
        issueNumber: 104,
        wave: 1,
        risk: "high",
        priority: "P0",
        status: "Ready",
        blockedBy: [],
      },
    ];

    const selection = api.selectEligibleWorkItems(items, {
      maxRisk: "medium",
      requireIssueNumber: true,
    });
    expect(selection.eligible.map((item) => item.id)).toEqual(["wi-checkout"]);
    expect(selection.skipped).toEqual([
      { id: "wi-login", issueNumber: 101, reason: "status is In Review" },
      {
        id: "wi-refresh",
        issueNumber: 102,
        reason: "blocked by incomplete dependencies: wi-login",
      },
      { id: "wi-critical", issueNumber: 104, reason: "risk high exceeds maxRisk=medium" },
    ]);
  });

  test("RoadmapStore persists atomically and rejects symlink traversal", async () => {
    const workspace = makeWorkspace(".codex/roadmap/\n");
    const store = api.createRoadmapStore(workspace);
    expect(store.isGitignored()).toBe(true);
    expect(await store.exists()).toBe(false);

    await expectRejected(
      () => store.load(),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_not_found",
    );

    const saved = await store.save(sampleState());
    expect(saved.sessionId).toBe("roadmap-v1");
    expect(await store.exists()).toBe(true);

    const loaded = await store.load();
    expect(loaded.features).toHaveLength(2);
    expect(await store.clear()).toBe(true);
    expect(await store.clear()).toBe(false);

    const unignoredWorkspace = makeWorkspace("node_modules/\n");
    expect(api.createRoadmapStore(unignoredWorkspace).isGitignored()).toBe(false);

    const symlinkWorkspace = makeWorkspace();
    mkdirSync(join(symlinkWorkspace, ".codex"), { recursive: true });
    const targetDir = makeWorkspace();
    symlinkSync(targetDir, join(symlinkWorkspace, ".codex", "roadmap"));
    const symlinkStore = api.createRoadmapStore(symlinkWorkspace);
    await expectRejected(
      () => symlinkStore.save(sampleState()),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_path_invalid",
    );
  });
});

import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import * as api from "../../src/roadmap/index.ts";
import { expectRejected, expectThrown } from "../support/expect-error.ts";

const tempDirs: string[] = [];

function makeWorkspace(gitignoreContent = ".forgix/roadmap/\n"): string {
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

function withValidAudit(
  state: api.RoadmapState,
  auditOverrides: Partial<api.RoadmapPlanAudit> = {},
): api.RoadmapState {
  const candidateDigest = api.computeRoadmapCandidateDigest(state);
  return {
    ...state,
    candidateDigest,
    audit: {
      candidateDigest,
      auditedAt: "2026-11-13T10:02:00.000Z",
      auditorContext: "independent-auditor",
      findings: [],
      passed: true,
      ...auditOverrides,
    },
  };
}

function sampleState(overrides: Partial<api.RoadmapState> = {}): api.RoadmapState {
  const base: api.RoadmapState = {
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
  };
  const merged: api.RoadmapState = { ...base, ...overrides };
  if (
    overrides.audit === undefined &&
    (merged.phase === "synthesis" || merged.phase === "published")
  ) {
    return withValidAudit(merged);
  }
  return merged;
}

describe("roadmap core primitives", () => {
  test("roadmap module has zero network, subprocess, or app-server imports", () => {
    const source = readFileSync(new URL("../../src/roadmap/index.ts", import.meta.url), "utf8");
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
    expect(sessionText).toContain(".forgix/roadmap/ is not listed in .gitignore");
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
    expect(selection.eligible.map((entry) => entry.workItem.id)).toEqual(["wi-checkout"]);
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
    const workspace = makeWorkspace(".forgix/roadmap/\n");
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
    mkdirSync(join(symlinkWorkspace, ".forgix"), { recursive: true });
    const targetDir = makeWorkspace();
    symlinkSync(targetDir, join(symlinkWorkspace, ".forgix", "roadmap"));
    const symlinkStore = api.createRoadmapStore(symlinkWorkspace);
    await expectRejected(
      () => symlinkStore.save(sampleState()),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_path_invalid",
    );
  });

  test("4-phase session validation enforces audit receipt before synthesis and published", () => {
    const divergence = sampleState({
      phase: "divergence",
      features: [],
      workItems: [],
      activeQuestion: {
        id: "q-scope",
        phase: "divergence",
        prompt: "Which auth mode should launch first?",
        reason: "Determines wave-1 scope",
        options: [
          { id: "opt-email", label: "Email", impact: "Minimal dependencies" },
          { id: "opt-sso", label: "SSO", impact: "Requires SAML setup" },
        ],
        recommendedOptionId: "opt-email",
        consequences: ["Defers SSO to wave 2"],
      },
    });
    expect(api.validateRoadmapState(divergence).phase).toBe("divergence");

    const badQuestion = {
      ...divergence,
      activeQuestion: { ...divergence.activeQuestion!, recommendedOptionId: "opt-missing" },
    };
    expectThrown(
      () => api.validateRoadmapState(badQuestion),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_invalid",
    );

    const convergence = sampleState({ phase: "convergence" });
    expect(api.validateRoadmapState(convergence).phase).toBe("convergence");

    const auditPhase = sampleState({ phase: "audit" });
    expect(api.validateRoadmapState(auditPhase).phase).toBe("audit");

    const missingAudit = sampleState();
    delete missingAudit.audit;
    expectThrown(
      () => api.validateRoadmapState(missingAudit),
      (err) =>
        err instanceof api.RoadmapError &&
        err.code === "roadmap_invalid" &&
        /requires a completed audit receipt/.test(err.message),
    );

    const failedAudit = withValidAudit(sampleState({ phase: "synthesis" }), { passed: false });
    expectThrown(
      () => api.validateRoadmapState(failedAudit),
      (err) =>
        err instanceof api.RoadmapError &&
        err.code === "roadmap_invalid" &&
        /audit\.passed === true/.test(err.message),
    );

    const staleAudit = withValidAudit(sampleState({ phase: "synthesis" }), {
      candidateDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    });
    expectThrown(
      () => api.validateRoadmapState(staleAudit),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_state_conflict",
    );

    const openBlockingFinding = withValidAudit(sampleState({ phase: "published" }), {
      findings: [
        {
          id: "f-block",
          dimension: "slicing_atomicity",
          severity: "blocking",
          targetId: "wi-login",
          message: "Split endpoint and schema",
          status: "open",
        },
      ],
    });
    expectThrown(
      () => api.validateRoadmapState(openBlockingFinding),
      (err) =>
        err instanceof api.RoadmapError &&
        err.code === "roadmap_invalid" &&
        /open blocking audit finding/.test(err.message),
    );

    const waivedAndWarning = withValidAudit(sampleState({ phase: "synthesis" }), {
      findings: [
        {
          id: "f-waived",
          dimension: "slicing_atomicity",
          severity: "blocking",
          targetId: "wi-login",
          message: "Acceptable atomicity",
          status: "waived",
          waiverReason: "Single cohesive route",
        },
        {
          id: "f-warn",
          dimension: "verifiability",
          severity: "warning",
          targetId: "wi-refresh",
          message: "Add load test",
          status: "open",
        },
      ],
    });
    expect(api.validateRoadmapState(waivedAndWarning).phase).toBe("synthesis");
  });

  test("SharedContract invariants enforce existence, provider dependency, and wave ordering", () => {
    const authContract: api.RoadmapSharedContract = {
      id: "contract-session",
      title: "Session Token Schema",
      kind: "schema",
      status: "planned",
      summary: "JWT claims and expiry",
      invariants: ["sub is non-empty", "exp is UTC epoch"],
      verificationHint: "Validate token parser unit tests",
    };
    const existingContract: api.RoadmapSharedContract = {
      id: "contract-db",
      title: "Postgres Pool",
      kind: "module-boundary",
      status: "existing",
      summary: "Existing connection pool",
      invariants: ["Max 20 connections"],
      verificationHint: "Check pool health",
    };

    const base = sampleState({ phase: "audit" });
    const transitiveValid: api.RoadmapState = {
      ...base,
      sharedContracts: [authContract, existingContract],
      workItems: [
        {
          ...base.workItems[0]!,
          providesContractIds: ["contract-session"],
          consumesContractIds: ["contract-db"],
        },
        {
          ...base.workItems[1]!,
          blockedBy: ["wi-login"],
        },
        {
          ...base.workItems[2]!,
          blockedBy: ["wi-refresh"],
          consumesContractIds: ["contract-session"],
        },
      ],
    };
    expect(api.validateRoadmapState(transitiveValid).sharedContracts).toHaveLength(2);

    const unknownContract = {
      ...transitiveValid,
      workItems: [
        transitiveValid.workItems[0]!,
        transitiveValid.workItems[1]!,
        { ...transitiveValid.workItems[2]!, consumesContractIds: ["contract-missing"] },
      ],
    };
    expectThrown(
      () => api.validateRoadmapState(unknownContract),
      (err) =>
        err instanceof api.RoadmapError &&
        err.code === "roadmap_invalid" &&
        /unknown shared contract/.test(err.message),
    );

    const unprovidedPlanned = {
      ...transitiveValid,
      workItems: [
        { ...transitiveValid.workItems[0]!, providesContractIds: [] },
        transitiveValid.workItems[1]!,
        transitiveValid.workItems[2]!,
      ],
    };
    expectThrown(
      () => api.validateRoadmapState(unprovidedPlanned),
      (err) =>
        err instanceof api.RoadmapError &&
        err.code === "roadmap_invalid" &&
        /has no provider/.test(err.message),
    );

    const missingBlockedBy = {
      ...transitiveValid,
      workItems: [
        transitiveValid.workItems[0]!,
        transitiveValid.workItems[1]!,
        { ...transitiveValid.workItems[2]!, blockedBy: [] },
      ],
    };
    expectThrown(
      () => api.validateRoadmapState(missingBlockedBy),
      (err) =>
        err instanceof api.RoadmapError &&
        err.code === "roadmap_invalid" &&
        /without depending on provider/.test(err.message),
    );

    const earlierWaveConsumer = {
      ...transitiveValid,
      workItems: [
        { ...transitiveValid.workItems[0]!, wave: 2 },
        { ...transitiveValid.workItems[1]!, wave: 2 },
        { ...transitiveValid.workItems[2]!, wave: 1 },
      ],
    };
    expectThrown(
      () => api.validateRoadmapState(earlierWaveConsumer),
      (err) =>
        err instanceof api.RoadmapError &&
        err.code === "roadmap_invalid" &&
        /later-wave provider/.test(err.message),
    );
  });

  test("invalidateDependentsOnContractChange selectively invalidates unfinished consumers and checkpoints", () => {
    const state = sampleState({
      phase: "synthesis",
      sharedContracts: [
        {
          id: "c-auth",
          title: "Auth Contract",
          kind: "interface",
          status: "verified",
          summary: "VerifyAuth interface",
          invariants: ["Returns userId"],
          verificationHint: "Unit test VerifyAuth",
        },
      ],
      workItems: [
        {
          ...sampleState().workItems[0]!,
          status: "Done",
          providesContractIds: ["c-auth"],
        },
        {
          ...sampleState().workItems[1]!,
          status: "In Progress",
          blockedBy: ["wi-login"],
          consumesContractIds: ["c-auth"],
        },
        {
          ...sampleState().workItems[2]!,
          status: "Done",
          blockedBy: ["wi-login"],
          consumesContractIds: ["c-auth"],
        },
      ],
      verificationCheckpoints: [
        {
          id: "cp-auth",
          title: "Auth checkpoint",
          scopeType: "feature",
          targetIds: ["feat-auth"],
          dependsOnWorkItemIds: ["wi-login", "wi-refresh"],
          checks: ["bun test"],
          independentVerifierRequired: true,
          status: "passed",
        },
        {
          id: "cp-billing",
          title: "Billing checkpoint",
          scopeType: "feature",
          targetIds: ["feat-billing"],
          dependsOnWorkItemIds: ["wi-checkout"],
          checks: ["bun test"],
          independentVerifierRequired: false,
          status: "passed",
        },
      ],
    });
    const withApproval: api.RoadmapState = {
      ...state,
      approval: {
        approved: true,
        approvedAt: "2026-11-13T10:05:00.000Z",
        digest: api.computeRoadmapCandidateDigest(state),
      },
    };

    const runtime: api.RoadmapRuntimeState = {
      schemaVersion: 1,
      roadmapDigest: api.computeRoadmapCandidateDigest(state),
      updatedAt: "2026-11-13T10:05:00.000Z",
      workItemStates: [
        { id: "wi-login", status: "Done", updatedAt: "2026-11-13T10:05:00.000Z" },
        { id: "wi-refresh", status: "In Progress", updatedAt: "2026-11-13T10:05:00.000Z" },
        { id: "wi-checkout", status: "Done", updatedAt: "2026-11-13T10:05:00.000Z" },
      ],
      checkpointReceipts: [
        {
          checkpointId: "cp-auth",
          roadmapDigest: api.computeRoadmapCandidateDigest(state),
          status: "Passed",
          verifiedAt: "2026-11-13T10:05:00.000Z",
          verifierContext: "verifier",
          checksRun: ["bun test"],
          summary: "Passed",
        },
        {
          checkpointId: "cp-billing",
          roadmapDigest: api.computeRoadmapCandidateDigest(state),
          status: "Passed",
          verifiedAt: "2026-11-13T10:05:00.000Z",
          verifierContext: "verifier",
          checksRun: ["bun test"],
          summary: "Passed",
        },
      ],
    };

    const result = api.invalidateDependentsOnContractChange(withApproval, ["c-auth"], {
      now: "2026-11-13T12:00:00.000Z",
      runtimeState: runtime,
    });

    expect(result.updatedContractIds).toEqual(["c-auth"]);
    expect(result.state.sharedContracts?.[0]?.status).toBe("planned");
    expect(result.state.sharedContracts?.[0]?.digest).toMatch(/^sha256:/);
    expect(result.invalidatedWorkItemIds).toEqual(["wi-refresh"]);
    expect(result.state.workItems.find((w) => w.id === "wi-refresh")?.status).toBe("Backlog");
    expect(result.state.workItems.find((w) => w.id === "wi-checkout")?.status).toBe("Done");
    expect(result.invalidatedCheckpointIds).toEqual(["cp-auth"]);
    expect(result.state.verificationCheckpoints?.find((c) => c.id === "cp-auth")?.status).toBe(
      "pending",
    );
    expect(result.state.verificationCheckpoints?.find((c) => c.id === "cp-billing")?.status).toBe(
      "passed",
    );
    expect(result.state.phase).toBe("convergence");
    expect(result.state.audit).toBeUndefined();
    expect(result.state.approval).toBeUndefined();
    expect(result.runtimeState?.workItemStates.find((w) => w.id === "wi-refresh")?.status).toBe(
      "Backlog",
    );
    expect(result.runtimeState?.checkpointReceipts.map((r) => r.checkpointId)).toEqual([
      "cp-billing",
    ]);
  });

  test("publishRoadmap produces canonical roadmap, initial runtime, and Markdown projection", () => {
    const base = sampleState({
      sharedContracts: [
        {
          id: "c-login",
          title: "Login Session",
          kind: "api",
          status: "planned",
          summary: "Cookie session API",
          invariants: ["HttpOnly cookie"],
          verificationHint: "Check Set-Cookie header",
        },
      ],
      workItems: [
        { ...sampleState().workItems[0]!, providesContractIds: ["c-login"] },
        { ...sampleState().workItems[1]!, consumesContractIds: ["c-login"] },
        sampleState().workItems[2]!,
      ],
      verificationCheckpoints: [
        {
          id: "cp-wave-1",
          title: "Wave 1 gate",
          scopeType: "wave",
          targetIds: ["wave-1"],
          dependsOnWorkItemIds: ["wi-login", "wi-refresh"],
          checks: ["bun test"],
          independentVerifierRequired: true,
        },
      ],
    });
    const digest = api.computeRoadmapCandidateDigest(base);

    expectThrown(
      () => api.publishRoadmap(base),
      (err) =>
        err instanceof api.RoadmapError &&
        err.code === "roadmap_state_conflict" &&
        /explicitly approved/.test(err.message),
    );

    const approved: api.RoadmapState = {
      ...base,
      approval: {
        approved: true,
        approvedAt: "2026-11-13T10:10:00.000Z",
        digest,
        actor: "acrazie",
      },
    };
    const published = api.publishRoadmap(approved, {
      adapter: "local",
      publishedAt: "2026-11-13T10:15:00.000Z",
    });

    expect(published.roadmap.contentDigest).toBe(digest);
    expect(published.roadmap.adapter).toBe("local");
    expect(published.roadmap.approvalReceipt.actor).toBe("acrazie");
    expect(published.roadmap.sharedContracts[0]?.digest).toMatch(/^sha256:/);
    expect(published.runtime.roadmapDigest).toBe(digest);
    expect(published.runtime.workItemStates.map((s) => [s.id, s.status])).toEqual([
      ["wi-login", "Ready"],
      ["wi-refresh", "Backlog"],
      ["wi-checkout", "Backlog"],
    ]);
    expect(published.runtime.checkpointReceipts).toEqual([]);
    expect(published.session.phase).toBe("published");
    expect(published.markdown).toContain("# Roadmap: roadmap-v1");
    expect(published.markdown).toContain("## Shared Contracts");
    expect(published.markdown).toContain("## Verification Checkpoints");
    expect(published.markdown).toContain("```mermaid");
  });

  test("selectReadyWorkItems and recordCheckpointResult gate downstream waves", () => {
    const state = sampleState({
      verificationCheckpoints: [
        {
          id: "cp-wave-1",
          title: "Wave 1 verification",
          scopeType: "wave",
          targetIds: ["wave-1"],
          dependsOnWorkItemIds: ["wi-login", "wi-refresh"],
          checks: ["bun test"],
          independentVerifierRequired: true,
        },
      ],
    });
    const digest = api.computeRoadmapCandidateDigest(state);
    let runtime: api.RoadmapRuntimeState = {
      schemaVersion: 1,
      roadmapDigest: digest,
      updatedAt: "2026-11-13T10:20:00.000Z",
      workItemStates: [
        { id: "wi-login", status: "Done", updatedAt: "2026-11-13T10:20:00.000Z" },
        { id: "wi-refresh", status: "Done", updatedAt: "2026-11-13T10:20:00.000Z" },
        { id: "wi-checkout", status: "Ready", updatedAt: "2026-11-13T10:20:00.000Z" },
      ],
      checkpointReceipts: [],
    };

    const beforeCheckpoint = api.selectReadyWorkItems(state, { runtimeState: runtime });
    expect(beforeCheckpoint.eligible).toHaveLength(0);
    expect(beforeCheckpoint.readyCheckpoints.map((entry) => entry.checkpoint.id)).toEqual([
      "cp-wave-1",
    ]);
    expect(beforeCheckpoint.skipped).toContainEqual({
      id: "wi-checkout",
      reason: "blocked by pending verification checkpoint: cp-wave-1",
    });

    runtime = api.recordCheckpointResult(runtime, {
      observedRoadmapDigest: runtime.roadmapDigest,
      checkpointId: "cp-wave-1",
      status: "Failed",
      verifiedAt: "2026-11-13T10:25:00.000Z",
      verifierContext: "independent-verifier",
      checksRun: ["bun test"],
      summary: "Refresh token test failed",
      offendingIds: ["wi-refresh"],
    });
    const afterFailure = api.selectReadyWorkItems(state, { runtimeState: runtime });
    expect(afterFailure.eligible).toHaveLength(0);
    expect(afterFailure.readyCheckpoints.map((entry) => entry.checkpoint.id)).toEqual([
      "cp-wave-1",
    ]);

    runtime = api.recordCheckpointResult(runtime, {
      observedRoadmapDigest: runtime.roadmapDigest,
      checkpointId: "cp-wave-1",
      status: "Passed",
      verifiedAt: "2026-11-13T10:30:00.000Z",
      verifierContext: "independent-verifier",
      checksRun: ["bun test"],
      summary: "All wave-1 checks passed",
    });
    const afterPass = api.selectReadyWorkItems(state, { runtimeState: runtime });
    expect(afterPass.readyCheckpoints).toHaveLength(0);
    expect(afterPass.eligible.map((entry) => entry.workItem.id)).toEqual(["wi-checkout"]);
  });

  test("PublishedRoadmapStore and RoadmapRuntimeStore persist atomically and enforce hygiene", async () => {
    const workspace = makeWorkspace(".forgix/roadmap/\n");
    const publishedStore = api.createPublishedRoadmapStore(workspace);
    const runtimeStore = api.createRoadmapRuntimeStore(workspace);

    expect(await publishedStore.exists()).toBe(false);
    expect(await runtimeStore.exists()).toBe(false);
    expect(runtimeStore.isGitignored()).toBe(true);

    await expectRejected(
      () => publishedStore.load(),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_not_found",
    );
    await expectRejected(
      () => runtimeStore.load(),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_not_found",
    );

    const base = sampleState();
    const digest = api.computeRoadmapCandidateDigest(base);
    const { roadmap, runtime } = api.publishRoadmap({
      ...base,
      approval: { approved: true, approvedAt: "2026-11-13T10:10:00.000Z", digest },
    });

    await publishedStore.save(roadmap);
    await runtimeStore.save(runtime);
    expect(await publishedStore.exists()).toBe(true);
    expect(await runtimeStore.exists()).toBe(true);
    expect((await publishedStore.load()).contentDigest).toBe(digest);
    expect((await runtimeStore.load()).roadmapDigest).toBe(digest);

    await expectRejected(
      () =>
        publishedStore.save({
          ...roadmap,
          productVisionSummary: "Bearer sk-1234567890abcdefghijklmnop",
        }),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_secret_detected",
    );
    await expectRejected(
      () =>
        runtimeStore.save({
          ...runtime,
          workItemStates: [
            {
              id: "wi-login",
              status: "Blocked",
              updatedAt: "2026-11-13T10:15:00.000Z",
              blockerReason: "See /Users/someone/secret/log.txt",
            },
          ],
        }),
      (err) => err instanceof api.RoadmapError && err.code === "roadmap_path_invalid",
    );

    expect(await publishedStore.clear()).toBe(true);
    expect(await runtimeStore.clear()).toBe(true);
  });

  test("transitionRoadmapWorkItemStatus updates local work items without issueNumber and derives feature status", () => {
    const base = sampleState();
    const initialDigest = api.computeRoadmapCandidateDigest(base);
    const approved: api.RoadmapState = {
      ...base,
      phase: "synthesis",
      candidateDigest: initialDigest,
      approval: { approved: true, approvedAt: "2026-11-17T00:00:00.000Z", digest: initialDigest },
    };

    const inProgress = api.transitionRoadmapWorkItemStatus(approved, "wi-login", "In Progress", {
      updatedAt: "2026-11-17T01:00:00.000Z",
    });
    expect(inProgress.previousStatus).toBe("Ready");
    expect(inProgress.status).toBe("In Progress");
    expect(inProgress.featureId).toBe("feat-auth");
    expect(inProgress.featureStatus).toBe("In Progress");
    expect(inProgress.workItem.issueNumber).toBeUndefined();
    expect(inProgress.state.candidateDigest).toBe(initialDigest);
    expect(inProgress.state.approval).toEqual(approved.approval);

    const loginDone = api.transitionRoadmapWorkItemStatus(inProgress.state, "wi-login", "Done");
    expect(loginDone.featureStatus).toBe("In Progress");
    expect(loginDone.promotedIds).toEqual(["wi-checkout"]);

    const allDone = api.transitionRoadmapWorkItemStatus(loginDone.state, "wi-refresh", "Done");
    expect(allDone.featureStatus).toBe("Done");

    expect(() => api.transitionRoadmapWorkItemStatus(approved, "wi-missing", "Done")).toThrow(
      api.RoadmapError,
    );
    expect(() =>
      api.transitionRoadmapWorkItemStatus(
        approved,
        "wi-login",
        "Unknown" as api.RoadmapBoardStatus,
      ),
    ).toThrow(api.RoadmapError);
  });

  test("prepareLocalWorkItemRun, planLocalRoadmapRun, and resolveRoadmapMode support local-only execution", () => {
    const base = sampleState();
    const seed = api.prepareLocalWorkItemRun(base, "wi-login");
    expect(seed.issueRef).toBe("local:wi-login");
    expect(seed.workspace).toEqual({
      branch: "feat/wi-email-login-endpoint",
      worktreePath: ".worktrees/wi-email-login-endpoint",
      baseBranch: "main",
    });
    expect(seed.intakeSeed.objective).toBe(base.workItems[0]!.objective);

    const loopPlan = api.planLocalRoadmapRun(base, { limit: 1 });
    expect(loopPlan.eligible).toHaveLength(1);
    expect(loopPlan.eligible[0]?.issueRef).toBe("local:wi-login");

    expect(() => api.prepareLocalWorkItemRun(base, "wi-refresh")).toThrow(
      /Cannot run local work item/,
    );

    expect(api.resolveRoadmapMode({ configuredMode: "local" })).toBe("local");
    expect(api.resolveRoadmapMode({ configuredMode: "github" })).toBe("github");
    expect(
      api.resolveRoadmapMode({
        remoteUrl: "entire://aws-eu-central-1.entire.io/et/forgix/forgix",
      }),
    ).toBe("local");
    expect(api.resolveRoadmapMode({ remoteUrl: "https://github.com/Acrazie/forgix.git" })).toBe(
      "github",
    );
  });

  test("SharedContract supports formal-spec kind and Verification Checkpoints enforce formal/runtime checks", () => {
    const formalContract: api.RoadmapSharedContract = {
      id: "c-formal-dag",
      title: "DAG Closure Theorem",
      kind: "formal-spec",
      status: "planned",
      summary: "Lean 4 DAG invalidation closure proof",
      invariants: ["Closure is monotonic and idempotent"],
      verificationHint: "lean4: lake build ForgixKernel",
    };

    const base = sampleState({
      sharedContracts: [formalContract],
      workItems: [
        { ...sampleState().workItems[0]!, providesContractIds: ["c-formal-dag"] },
        { ...sampleState().workItems[1]!, consumesContractIds: ["c-formal-dag"] },
        sampleState().workItems[2]!,
      ],
      verificationCheckpoints: [
        {
          id: "cp-formal",
          title: "Formal kernel checkpoint",
          scopeType: "wave",
          targetIds: ["wave-1"],
          dependsOnWorkItemIds: ["wi-login", "wi-refresh"],
          checks: ["bun test", "lean4: lake build ForgixKernel"],
          independentVerifierRequired: true,
        },
      ],
    });

    const validated = api.validateRoadmapState(base);
    expect(validated.sharedContracts?.[0]?.kind).toBe("formal-spec");

    const digest = api.computeRoadmapCandidateDigest(validated);
    const runtime: api.RoadmapRuntimeState = {
      schemaVersion: 1,
      roadmapDigest: digest,
      updatedAt: "2026-11-18T10:00:00.000Z",
      workItemStates: [
        { id: "wi-login", status: "Done", updatedAt: "2026-11-18T10:00:00.000Z" },
        { id: "wi-refresh", status: "Done", updatedAt: "2026-11-18T10:00:00.000Z" },
      ],
      checkpointReceipts: [],
    };

    expect(() =>
      api.recordCheckpointResult(
        runtime,
        {
          checkpointId: "cp-formal",
          status: "Passed",
          verifierContext: "independent-verifier",
          checksRun: ["model-inspection"],
          summary: "Inspected only",
        },
        { roadmap: validated },
      ),
    ).toThrow(/cannot pass without executable formal or runtime verification/);

    expect(() =>
      api.recordCheckpointResult(
        runtime,
        {
          checkpointId: "cp-formal",
          status: "Passed",
          verifierContext: "independent-verifier",
          checksRun: ["bun test"],
          summary: "Missing lean4 check",
        },
        { roadmap: validated },
      ),
    ).toThrow(/missing required verification checks/);

    const passedRuntime = api.recordCheckpointResult(
      runtime,
      {
        checkpointId: "cp-formal",
        status: "Passed",
        verifierContext: "independent-verifier",
        checksRun: ["bun test", "lean4: lake build ForgixKernel"],
        summary: "Tests and Lean 4 kernel verified",
      },
      { roadmap: validated },
    );
    expect(passedRuntime.checkpointReceipts[0]?.status).toBe("Passed");

    const nextEnv = api.computeNextActionEnvelope(validated);
    expect(nextEnv.phase).toBe("synthesis");
    expect(nextEnv.allowedCommands).toContain("forgix roadmap publish");

    expect(
      api.evaluateAutonomousGateEligibility({
        risk: "low",
        openQuestions: 0,
        verifierKinds: ["model-inspection"],
      }).eligible,
    ).toBe(false);
    expect(
      api.evaluateAutonomousGateEligibility({
        risk: "medium",
        openQuestions: 0,
        verifierKinds: ["tla-tlc", "command"],
      }).eligible,
    ).toBe(true);
  });
});

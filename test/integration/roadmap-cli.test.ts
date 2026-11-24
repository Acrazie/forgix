import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { stringify as stringifyYaml } from "yaml";
import { HELP_TEXT, runInvocation } from "../../src/cli.ts";
import { expectRejected } from "../support/expect-error.ts";
import { createWorkspaceStore } from "../../src/core/store.ts";
import { createTaskStateStore } from "../../src/task/index.ts";
import type { CliResult } from "../../src/types.ts";
import {
  computeRoadmapCandidateDigest,
  createPublishedRoadmapStore,
  createRoadmapRuntimeStore,
  createRoadmapStore,
  publishRoadmap,
  type RoadmapState,
} from "../../src/roadmap/index.ts";

const tempDirs: string[] = [];

function createWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "forgix-roadmap-cli-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, ".gitignore"), ".forgix/roadmap/\n.forgix/tasks/\n.worktrees/\n", "utf8");
  return dir;
}

function git(root: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function initRepo(root: string) {
  git(root, "init", "-q", "-b", "main");
  git(root, "add", ".gitignore");
  git(
    root,
    "-c",
    "user.name=Forgix Test",
    "-c",
    "user.email=forgix@example.test",
    "commit",
    "-qm",
    "base",
  );
}

function addOrigin(root: string) {
  const origin = createWorkspace();
  git(origin, "init", "-q", "--bare");
  git(root, "remote", "add", "origin", origin);
  git(root, "push", "-q", "origin", "main");
}

function isLocalStatusConflict(error: unknown) {
  return error instanceof Error && /Local Work Item must be Ready/.test(error.message);
}

function prepareInProcess(root: string) {
  const source = JSON.stringify(join(import.meta.dir, "../../src/cli.ts"));
  return Bun.spawn(
    [
      process.execPath,
      "--eval",
      `import { runInvocation } from ${source};
       const result = await runInvocation(["roadmap", "prepare-local", "w1"], { workspaceRoot: process.argv.at(-1) });
       console.log(JSON.stringify(result));`,
      root,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
}

async function readPreparedResult(child: ReturnType<typeof prepareInProcess>) {
  const [code, output, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(code, stderr).toBe(0);
  return JSON.parse(output) as CliResult;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function buildDraftState(overrides: Partial<RoadmapState> = {}): RoadmapState {
  const base: RoadmapState = {
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
    ...overrides,
  };
  const candidateDigest = computeRoadmapCandidateDigest(base);
  return {
    ...base,
    candidateDigest,
    audit: base.audit ?? {
      candidateDigest,
      auditedAt: "2026-11-13T10:25:00.000Z",
      auditorContext: "independent-auditor",
      findings: [],
      passed: true,
    },
  };
}

describe("roadmap CLI commands", () => {
  test("HELP_TEXT advertises roadmap subcommands", () => {
    expect(HELP_TEXT).toContain("roadmap session-view");
    expect(HELP_TEXT).toContain("roadmap publish-plan|publish-record");
    expect(HELP_TEXT).toContain("roadmap select-ready");
    expect(HELP_TEXT).toContain("roadmap set-status");
    expect(HELP_TEXT).toContain("roadmap prepare-local");
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

  test("executes Repo-First workflow: publish, view, sync-plan, sync-record, select-ready, checkpoint-record", async () => {
    const workspaceRoot = createWorkspace();
    initRepo(workspaceRoot);
    addOrigin(workspaceRoot);
    const draft = buildDraftState({
      sharedContracts: [
        {
          id: "c-index",
          title: "Search Index Schema",
          kind: "schema",
          status: "planned",
          summary: "Document index payload",
          invariants: ["docId is UUID"],
          verificationHint: "Run indexer schema test",
        },
      ],
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
        {
          id: "f2",
          title: "Analytics",
          summary: "Search query analytics",
          priority: "P1",
          risk: "medium",
          wave: 2,
          scopeIn: ["Query metrics"],
          scopeOut: ["BI export"],
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
          providesContractIds: ["c-index"],
        },
        {
          id: "w2",
          featureId: "f2",
          title: "Search analytics collector",
          objective: "Record query latency",
          scopeIn: ["Metrics hook"],
          scopeOut: ["Dashboards"],
          acceptanceCriteria: ["Emits latency histogram"],
          risk: "medium",
          priority: "P1",
          wave: 2,
          blockedBy: ["w1"],
          consumesContractIds: ["c-index"],
        },
      ],
      verificationCheckpoints: [
        {
          id: "cp-wave-1",
          title: "Wave 1 verification",
          scopeType: "wave",
          targetIds: ["wave-1"],
          dependsOnWorkItemIds: ["w1"],
          checks: ["bun test"],
          independentVerifierRequired: true,
        },
      ],
    });
    const approvedDraft: RoadmapState = {
      ...draft,
      approval: {
        approved: true,
        approvedAt: "2026-11-13T10:35:00.000Z",
        digest: draft.candidateDigest!,
        actor: "acrazie",
      },
    };

    const saved = await runInvocation(["roadmap", "session-save"], {
      workspaceRoot,
      roadmap: { input: stringifyYaml(approvedDraft) },
    });
    expect(saved.status).toBe("saved");

    const published = await runInvocation(
      ["roadmap", "publish", "--adapter=local", "--actor=acrazie"],
      {
        workspaceRoot,
        roadmap: { now: "2026-11-13T11:00:00.000Z" },
      },
    );
    expect(published.status).toBe("published");
    const pubData = published.data as {
      roadmap: { contentDigest: string; adapter: string };
      runtime: { roadmapDigest: string; workItemStates: Array<{ id: string; status: string }> };
      markdownPath: string;
      contentDigest: string;
    };
    expect(pubData.contentDigest).toBe(draft.candidateDigest!);
    expect(pubData.roadmap.adapter).toBe("local");
    expect(pubData.runtime.roadmapDigest).toBe(pubData.contentDigest);
    expect(pubData.markdownPath).toBe("docs/roadmap.md");
    expect(existsSync(join(workspaceRoot, ".forgix", "roadmap.yaml"))).toBe(true);
    expect(existsSync(join(workspaceRoot, ".forgix", "roadmap", "runtime.yaml"))).toBe(true);
    expect(readFileSync(join(workspaceRoot, "docs", "roadmap.md"), "utf8")).toContain(
      "# Roadmap: cli-roadmap",
    );

    const viewed = await runInvocation(["roadmap", "view", "--format=mermaid"], { workspaceRoot });
    expect(viewed.status).toBe("ok");
    const viewData = viewed.data as {
      roadmap: { roadmapId: string };
      runtime: { roadmapDigest: string } | null;
      markdown: string;
      visual: string;
    };
    expect(viewData.roadmap.roadmapId).toBe("cli-roadmap");
    expect(viewData.runtime?.roadmapDigest).toBe(pubData.contentDigest);
    expect(viewData.markdown).toContain("## Shared Contracts");
    expect(viewData.visual).toContain("flowchart TD");

    const syncPlanRes = await runInvocation(["roadmap", "sync-plan", "--adapter=github"], {
      workspaceRoot,
    });
    expect(syncPlanRes.status).toBe("ok");
    const syncPlanData = syncPlanRes.data as {
      plan: { summary: { createWorkItems: number; updateWorkItems: number } };
    };
    expect(syncPlanData.plan.summary.createWorkItems).toBe(2);

    const syncRecordRes = await runInvocation(["roadmap", "sync-record"], {
      workspaceRoot,
      roadmap: {
        input: JSON.stringify({
          recordedAt: "2026-11-13T11:10:00.000Z",
          workItems: [
            { id: "w1", status: "Done", externalIssueNumber: 101 },
            { id: "w2", status: "Ready", externalIssueNumber: 102 },
          ],
        }),
      },
    });
    expect(syncRecordRes.status).toBe("saved");
    const syncRecordData = syncRecordRes.data as {
      runtime: { workItemStates: Array<{ id: string; status: string }> };
    };
    expect(syncRecordData.runtime.workItemStates.find((w) => w.id === "w1")?.status).toBe("Done");

    const readyBeforeGate = await runInvocation(["roadmap", "select-ready"], { workspaceRoot });
    expect(readyBeforeGate.status).toBe("ok");
    expect(readyBeforeGate.data).toMatchObject({ roadmapDigest: pubData.contentDigest });
    const beforeData = readyBeforeGate.data as {
      eligible: Array<{ workItem: { id: string } }>;
      readyCheckpoints: Array<{ checkpoint: { id: string } }>;
      skipped: Array<{ id: string; issueNumber?: number; reason: string }>;
    };
    expect(beforeData.eligible).toHaveLength(0);
    expect(beforeData.readyCheckpoints.map((c) => c.checkpoint.id)).toEqual(["cp-wave-1"]);
    expect(beforeData.skipped).toContainEqual({
      id: "w2",
      issueNumber: 102,
      reason: "blocked by pending verification checkpoint: cp-wave-1",
    });

    const runtimeStore = createRoadmapRuntimeStore(workspaceRoot);
    const legacy = await runtimeStore.load();
    legacy.checkpointReceipts.push({
      checkpointId: "cp-wave-1",
      roadmapDigest: pubData.contentDigest,
      status: "Passed",
      verifiedAt: "2026-11-13T11:10:00.000Z",
      verifierContext: "legacy",
      checksRun: ["bun test"],
      summary: "Historical, not bound by the verifier",
    });
    await runtimeStore.save(legacy);
    const afterLegacy = await runInvocation(["roadmap", "select-ready"], { workspaceRoot });
    expect(afterLegacy.data).toMatchObject({ eligible: [] });
    await expectRejected(
      () =>
        runInvocation(["roadmap", "checkpoint-record"], {
          workspaceRoot,
          roadmap: {
            input: JSON.stringify({
              checkpointId: "cp-wave-1",
              status: "Passed",
              observedRoadmapDigest: "old-roadmap-digest",
              checksRun: ["bun test"],
            }),
          },
        }),
      (error) => error instanceof Error && /current published Roadmap/.test(error.message),
    );
    const cpRes = await runInvocation(["roadmap", "checkpoint-record"], {
      workspaceRoot,
      roadmap: {
        input: JSON.stringify({
          checkpointId: "cp-wave-1",
          observedRoadmapDigest: pubData.contentDigest,
          status: "Passed",
          verifiedAt: "2026-11-13T11:20:00.000Z",
          verifierContext: "independent-verifier",
          checksRun: ["bun test"],
          summary: "Wave 1 verified",
        }),
      },
    });
    expect(cpRes.status).toBe("saved");
    const cpData = cpRes.data as {
      runtime: { checkpointReceipts: Array<{ checkpointId: string; status: string }> };
      receipt: { checkpointId: string; status: string };
    };
    expect(cpData.receipt.checkpointId).toBe("cp-wave-1");
    expect(cpData.receipt.status).toBe("Passed");
    expect(cpData.runtime.checkpointReceipts).toHaveLength(1);

    const readyAfterGate = await runInvocation(["roadmap", "select-ready"], { workspaceRoot });
    const afterData = readyAfterGate.data as {
      eligible: Array<{ workItem: { id: string } }>;
      readyCheckpoints: Array<{ checkpoint: { id: string } }>;
    };
    expect(afterData.readyCheckpoints).toHaveLength(0);
    expect(afterData.eligible.map((e) => e.workItem.id)).toEqual(["w2"]);
    const publishedStore = createPublishedRoadmapStore(workspaceRoot);
    const previousRoadmap = await publishedStore.load();
    const nextDraft = buildDraftState({
      features: draft.features,
      workItems: draft.workItems,
      sharedContracts: draft.sharedContracts!,
      verificationCheckpoints: draft.verificationCheckpoints!,
      productVisionSummary: "New revision",
    });
    const approvedNext = {
      ...nextDraft,
      approval: { ...approvedDraft.approval!, digest: nextDraft.candidateDigest! },
    };
    const nextRoadmap = publishRoadmap(approvedNext).roadmap;
    await runtimeStore.withLock(async () => {
      await publishedStore.save(nextRoadmap);
      await expectRejected(
        () => runInvocation(["roadmap", "select-ready"], { workspaceRoot }),
        (error) => error instanceof Error && "code" in error && error.code === "state_conflict",
      );
    });
    await expectRejected(
      () => runInvocation(["roadmap", "select-ready"], { workspaceRoot }),
      (error) =>
        error instanceof Error && /Roadmap and runtime revisions disagree/.test(error.message),
    );
    await runtimeStore.withLock(() => publishedStore.save(previousRoadmap));
    const reserved = await runInvocation(["roadmap", "prepare-local", "w2"], { workspaceRoot });
    expect(reserved.status).toBe("saved");
    const snapshot = await runtimeStore.load();
    const reservedItem = snapshot.workItemStates.find(({ id }) => id === "w2")!;
    expect(reservedItem.reservation?.roadmapDigest).toBe(pubData.contentDigest);
    const resumed = await runInvocation(["roadmap", "prepare-local", "w2"], { workspaceRoot });
    expect(resumed.status).toBe("ok");
    expect(resumed.data).toMatchObject({
      existing: true,
      phase: "resume",
      reservation: reservedItem,
    });
    await expectRejected(
      () =>
        runInvocation(["roadmap", "sync-record"], {
          workspaceRoot,
          roadmap: {
            input: JSON.stringify({ workItems: [{ id: "w2", branch: "feat/replacement" }] }),
          },
        }),
      (error) => error instanceof Error && /Active Roadmap reservations/.test(error.message),
    );
    expect(await runtimeStore.load()).toEqual(snapshot);
    await runInvocation(["roadmap", "sync-record"], {
      workspaceRoot,
      roadmap: { input: JSON.stringify({ workItems: [{ id: "w2", status: "Done" }] }) },
    });
    expect((await runtimeStore.load()).workItemStates.find(({ id }) => id === "w2")).toMatchObject({
      status: "In Progress",
      reservation: reservedItem.reservation!,
    });
    const issueUrl = "https://github.com/acrazie/example/issues/111";
    await runInvocation(["roadmap", "publish-record"], {
      workspaceRoot,
      roadmap: { input: JSON.stringify({ workItems: [{ id: "w1", issueNumber: 111, issueUrl }] }) },
    });
    await runInvocation(["roadmap", "publish"], { workspaceRoot });
    const republishedRuntime = await runtimeStore.load();
    expect(republishedRuntime.checkpointReceipts).toEqual(snapshot.checkpointReceipts);
    expect(republishedRuntime.workItemStates.find(({ id }) => id === "w1")).toMatchObject({
      status: "Done",
      externalIssueNumber: 111,
      externalIssueUrl: issueUrl,
    });
    expect(republishedRuntime.workItemStates.find(({ id }) => id === "w2")).toMatchObject({
      status: "In Progress",
      reservation: reservedItem.reservation!,
      externalIssueNumber: 102,
    });
    await runInvocation(["roadmap", "publish-record"], {
      workspaceRoot,
      roadmap: { input: JSON.stringify({ workItems: [{ id: "w1", issueNumber: 112 }] }) },
    });
    await runInvocation(["roadmap", "publish"], { workspaceRoot });
    const renumbered = (await runtimeStore.load()).workItemStates.find(({ id }) => id === "w1");
    expect(renumbered).toMatchObject({ status: "Done", externalIssueNumber: 112 });
    expect(renumbered?.externalIssueUrl).toBeUndefined();
    await expectRejected(
      () =>
        runInvocation(["roadmap", "publish"], {
          workspaceRoot,
          roadmap: { input: stringifyYaml(approvedNext) },
        }),
      (error) => error instanceof Error && /Active Roadmap reservations/.test(error.message),
    );
    expect((await publishedStore.load()).contentDigest).toBe(pubData.contentDigest);
  });

  test("roadmap set-status transitions local work items without issueNumber and derives feature status", async () => {
    const workspaceRoot = createWorkspace();
    const draft = buildDraftState();

    await runInvocation(["roadmap", "session-save"], {
      workspaceRoot,
      roadmap: { input: stringifyYaml(draft) },
    });

    const started = await runInvocation(["roadmap", "set-status", "w1", "In Progress"], {
      workspaceRoot,
      roadmap: { now: "2026-11-17T01:00:00.000Z" },
    });
    expect(started.status).toBe("saved");
    const startedData = started.data as {
      workItemId: string;
      featureId: string;
      previousStatus: string;
      status: string;
      featureStatus: string;
    };
    expect(startedData).toMatchObject({
      workItemId: "w1",
      featureId: "f1",
      previousStatus: "Ready",
      status: "In Progress",
      featureStatus: "In Progress",
    });

    await runInvocation(["roadmap", "set-status", "w1", "--status=Done"], { workspaceRoot });
    const completed = await runInvocation(["roadmap", "set-status", "w2", "Done"], {
      workspaceRoot,
    });
    const completedData = completed.data as { featureStatus: string; status: string };
    expect(completedData.status).toBe("Done");
    expect(completedData.featureStatus).toBe("Done");

    expect(
      runInvocation(["roadmap", "set-status", "w1", "InvalidStatus"], { workspaceRoot }),
    ).rejects.toThrow(/Invalid status/);
  });

  test("concurrent local preparation creates one worktree and one unapproved task", async () => {
    const root = createWorkspace();
    initRepo(root);
    addOrigin(root);
    const session = createRoadmapStore(root);
    await session.save(buildDraftState());
    const runtime = createRoadmapRuntimeStore(root);
    const prepare = (...flags: string[]) =>
      runInvocation(["roadmap", "prepare-local", "w1", ...flags], { workspaceRoot: root });
    const preview = await prepare("--dry-run");
    expect(preview.data).toMatchObject({ issueRef: "local:w1" });
    expect(await runtime.exists()).toBe(false);

    const contenders = await runtime.withLock(async () => {
      const children = [prepareInProcess(root), prepareInProcess(root)];
      await Bun.sleep(200);
      return children;
    });
    const results = await Promise.all(contenders.map(readPreparedResult));
    const started = results.find(({ status }) => status === "saved");
    expect(started).toBeDefined();
    const data = started!.data as {
      taskId: string;
      workspace: { branch: string; worktreePath: string };
    };
    expect(results.find(({ status }) => status === "ok")?.data).toMatchObject({
      existing: true,
      phase: "resume",
      taskId: data.taskId,
    });
    expect((await session.load()).workItems[0]?.status).toBe("In Progress");
    const expectedBase = git(root, "rev-parse", "origin/main").trim();
    const taskRoot = join(root, data.workspace.worktreePath);
    expect(git(taskRoot, "rev-parse", "HEAD").trim()).toBe(expectedBase);
    expect(git(root, "worktree", "list", "--porcelain").match(/^worktree /gm)).toHaveLength(2);
    const task = await createTaskStateStore(taskRoot).load(data.taskId);
    expect(task).toMatchObject({ status: "new", revision: 0, risk: "low" });
    expect(task.planApproval).toBeUndefined();
    expect(
      task.design.productBaseline.dimensions.find(({ key }) => key === "objective")?.value,
    ).toBe("Index documents on save");
    const taskPath = join(taskRoot, ".forgix", "tasks", `${data.taskId}.json`);
    const original = readFileSync(taskPath, "utf8");
    expect((await prepare("--dry-run")).data).toMatchObject({
      phase: "resume",
      taskId: data.taskId,
    });
    expect(readFileSync(taskPath, "utf8")).toBe(original);
    rmSync(taskPath);
    expect((await prepare()).data).toMatchObject({ phase: "reconcile", taskId: data.taskId });
    expect(existsSync(taskPath)).toBe(false);
  });

  test("legacy coordinates cannot resume a foreign checkout under a stale registration", async () => {
    const root = createWorkspace();
    initRepo(root);
    addOrigin(root);
    await createRoadmapStore(root).save(buildDraftState());
    const prepare = () =>
      runInvocation(["roadmap", "prepare-local", "w1"], { workspaceRoot: root });
    expect((await prepare()).status).toBe("saved");
    const runtime = createRoadmapRuntimeStore(root);
    const legacy = await runtime.load();
    const { branch, worktreePath, reservation } = legacy.workItemStates[0]!;
    delete reservation!.worktreeIdentity;
    writeFileSync(runtime.runtimePath, stringifyYaml(legacy));

    const path = join(root, worktreePath!);
    const moved = join(root, ".worktrees", "moved-fixture");
    const original = await createTaskStateStore(path).load(reservation!.taskId);
    renameSync(path, moved);
    const foreign = createWorkspace();
    initRepo(foreign);
    git(foreign, "worktree", "add", "-b", branch!, "--", path);
    await createTaskStateStore(path).save(original.taskId, original, {
      create: true,
      expectedRevision: 0,
    });

    expect((await prepare()).data).toMatchObject({
      phase: "reconcile",
      taskId: original.taskId,
    });
    expect(await createTaskStateStore(path).load(original.taskId)).toEqual(original);
  });

  test.each(["Backlog", "In Progress"] as const)(
    "local %s without a reservation refuses both preview and setup",
    async (status) => {
      const root = createWorkspace();
      const draft = buildDraftState();
      draft.workItems[0]!.status = status;
      await createRoadmapStore(root).save(draft);
      const runtime = createRoadmapRuntimeStore(root);
      const snapshot = await runtime.save({
        schemaVersion: 1,
        roadmapDigest: draft.candidateDigest,
        updatedAt: draft.updatedAt,
        workItemStates: [{ id: "w1", status: "Ready", updatedAt: draft.updatedAt }],
        checkpointReceipts: [],
      });
      const prepare = (...flags: string[]) =>
        runInvocation(["roadmap", "prepare-local", "w1", ...flags], { workspaceRoot: root });
      await expectRejected(() => prepare("--dry-run"), isLocalStatusConflict);
      await expectRejected(prepare, isLocalStatusConflict);
      expect(await runtime.load()).toEqual(snapshot);
    },
  );

  test("preparation retries a reservation and only completes a verified partial worktree", async () => {
    const root = createWorkspace();
    initRepo(root);
    await createRoadmapStore(root).save(buildDraftState());
    const runtime = createRoadmapRuntimeStore(root);
    const prepare = (...flags: string[]) =>
      runInvocation(["roadmap", "prepare-local", "w1", ...flags], { workspaceRoot: root });
    await expectRejected(
      prepare,
      (error) => error instanceof Error && /Remote origin/.test(error.message),
    );
    const before = await runtime.load();
    const entry = before.workItemStates[0]!;
    const { taskId } = entry.reservation!;
    expect(entry).toMatchObject({ status: "In Progress", reservation: { handoffPending: true } });
    const taskRoot = join(root, entry.worktreePath!);
    expect(existsSync(taskRoot)).toBe(false);
    const select = await runInvocation(["roadmap", "select-ready"], { workspaceRoot: root });
    expect(select.data).toMatchObject({ eligible: [] });
    expect((await prepare("--dry-run")).data).toMatchObject({ phase: "reserved", taskId });

    addOrigin(root);
    git(root, "branch", entry.branch!);
    expect((await prepare()).data).toMatchObject({ phase: "reconcile", taskId });
    git(root, "worktree", "add", taskRoot, entry.branch!);
    expect((await prepare()).data).toMatchObject({ phase: "reconcile", taskId });
    const identity = await createWorkspaceStore(taskRoot).fileIdentity(".git");
    entry.reservation!.worktreeIdentity = identity!;
    await runtime.withLock(() => runtime.save(before)); // Crash after recording worktree ownership.
    const recovered = await prepare();
    expect(recovered.status).toBe("saved");
    expect(recovered.data).toMatchObject({ phase: "resume", taskId });
    expect((await createTaskStateStore(taskRoot).load(taskId)).status).toBe("new");
    expect((await runtime.load()).workItemStates[0]?.reservation).toEqual({
      taskId,
      roadmapDigest: before.roadmapDigest,
      baseBranch: "main",
      worktreeIdentity: identity!,
    });
  });
});

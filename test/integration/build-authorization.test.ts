import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInvocation } from "../../src/cli.ts";
import { StateStoreError } from "../../src/core/schema.ts";
import { createTaskStateStore } from "../../src/task/index.ts";
import { expectRejected } from "../support/expect-error.ts";
import {
  computeContractDigest,
  makeAwaitingApprovalTaskState,
  makeTaskState,
  seedLegacyTask,
} from "../support/helpers-v6.ts";

const blocked = (error: unknown) =>
  error instanceof StateStoreError && error.code === "state_blocked";
const conflict = (error: unknown) =>
  error instanceof StateStoreError && error.code === "state_conflict";

async function gitWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "forgix-build-auth-"));
  execFileSync("git", ["init", "-q", root]);
  return root;
}

test("locked GATE binds historical approval to the shown digest and to the current worktree", async () => {
  const root = await gitWorkspace();
  const other = await gitWorkspace();
  try {
    const taskId = "legacy-approval";
    const state = makeAwaitingApprovalTaskState({ taskId });
    state.shape!.contract!.approvedProtectedPaths = ["test/artifact-budget.json"];
    state.shape!.contract!.approvedEscapeHatches = ["src/example.ts:@ts-ignore"];
    state.contractDigest = state.shape!.contract!.digest = computeContractDigest(
      state.shape!.contract!,
    );
    await seedLegacyTask(root, state);
    const path = join(".forgix", "tasks", `${taskId}.json`);
    const original = await readFile(join(root, path), "utf8");
    const store = createTaskStateStore(root);
    expect((await store.gate(taskId, { decision: "approve" })).refusal).toBe("stale_contract_view");
    expect((await store.gate(taskId, { decision: "autonomous", issueRef: "#1" })).refusal).toBe(
      "autonomous_authorization_unavailable",
    );
    expect(await readFile(join(root, path), "utf8")).toBe(original);

    const shown = await runInvocation(["task", "gate", taskId, "--view"], { workspaceRoot: root });
    const { contract } = shown.data as { contract: string };
    expect(contract).toContain('"test/artifact-budget.json"');
    expect(contract).toContain('"src/example.ts:@ts-ignore"');
    const changed = structuredClone(state);
    changed.revision++;
    changed.shape!.contract!.revision++;
    const saved = await store.save(taskId, changed, { expectedRevision: state.revision });
    expect(
      (await store.gate(taskId, { decision: "approve", expectedDigest: state.contractDigest }))
        .refusal,
    ).toBe("stale_contract_view");

    const executed = await store.gate(taskId, {
      decision: "approve",
      expectedDigest: saved.contractDigest!,
    });
    expect(executed.receipt?.schemaVersion).toBe(2);
    expect(executed.state.history.at(-1)).toMatchObject({ gateDecision: executed.receipt });
    const resume = (workspaceRoot: string) =>
      runInvocation(["--harness", "claude", "resume", taskId], { workspaceRoot });
    expect((await resume(root)).status).toBe("routed");
    const status = (workspaceRoot: string) => runInvocation(["status", taskId], { workspaceRoot });
    expect((await status(root)).data).toMatchObject({ buildAuthorization: "verified" });
    await mkdir(join(other, ".forgix", "tasks"), { recursive: true });
    await copyFile(join(root, path), join(other, path));
    expect((await status(other)).data).toMatchObject({ buildAuthorization: "fresh_gate_required" });
    await expectRejected(() => resume(other), blocked);
  } finally {
    await Promise.all([root, other].map((path) => rm(path, { recursive: true, force: true })));
  }
});

test("old receipt remains readable but neither resumes BUILD nor can be installed by save", async () => {
  const root = await gitWorkspace();
  try {
    const taskId = "legacy-build";
    const state = makeTaskState({ taskId, status: "executing" });
    const store = createTaskStateStore(root);
    await expectRejected(() => store.save(taskId, state, { expectedRevision: 0 }), conflict);
    await seedLegacyTask(root, state);
    expect((await store.load(taskId)).planApproval?.schemaVersion).toBe(1);
    const path = join(root, ".forgix", "tasks", `${taskId}.json`);
    const before = await readFile(path, "utf8");
    const status = await runInvocation(["status", taskId], { workspaceRoot: root });
    expect(status.status).toBe("executing");
    expect(status.data).toMatchObject({ buildAuthorization: "fresh_gate_required" });
    expect(await readFile(path, "utf8")).toBe(before);
    await expectRejected(
      () => runInvocation(["--harness", "claude", "resume", taskId], { workspaceRoot: root }),
      blocked,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

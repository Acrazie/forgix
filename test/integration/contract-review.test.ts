import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInvocation } from "../../src/cli.ts";
import { StateStoreError } from "../../src/core/schema.ts";
import { runHook } from "../../src/hooks/index.ts";
import { createTaskStateStore } from "../../src/task/index.ts";
import type { HarnessPreference, NextActionEnvelope } from "../../src/types.ts";
import { expectRejected } from "../support/expect-error.ts";
import { makeTaskState, seedLegacyTask } from "../support/helpers-v6.ts";

const blocked = (error: unknown) =>
  error instanceof StateStoreError && error.code === "state_blocked";
const conflict = (error: unknown) =>
  error instanceof StateStoreError && error.code === "state_conflict";
const invalid = (error: unknown) =>
  error instanceof StateStoreError && error.code === "state_invalid";

async function workspace(name: string, defaultHarness: HarnessPreference = "codex") {
  const root = await mkdtemp(join(tmpdir(), "forgix-contract-review-"));
  execFileSync("git", ["init", "-q", root]);
  const store = createTaskStateStore(root);
  const state = await store.save(
    name,
    makeTaskState({ taskId: name, status: "awaiting_approval" }),
    { expectedRevision: 0 },
  );
  const action = async (payload: object, harness: HarnessPreference = defaultHarness) => {
    const now = await store.load(name);
    return store.review(name, { expectedRevision: now.revision, ...payload }, harness);
  };
  const native = (
    capsule: NonNullable<NonNullable<typeof state.contractReview>["capsule"]>,
    permit: string,
    round: number,
    findings: object[] = [],
    role = "generalist",
    extra: object = {},
  ) => ({
    action: "record",
    round,
    permit,
    role,
    nativeId: `native:${round}:${role}`,
    completed: true,
    freshContext: true,
    capsule: capsule.digest,
    contractDigest: capsule.contractDigest,
    read: capsule.sources.filter(({ path }) =>
      capsule.roles.find((item) => item.id === role)?.sources.includes(path),
    ),
    findings,
    ...extra,
  });
  return { root, store, state, action, native };
}

async function fullReview(
  run: Awaited<ReturnType<typeof workspace>>,
  sources: string[],
  findings: object[] = [],
  extra: object = {},
) {
  const result = await run.action({ action: "prepare", sources });
  const capsule = result.state.contractReview!.capsule!;
  const reserve = await run.action({ action: "reserve" });
  const round = reserve.state.contractReview!.rounds.at(-1)!.id;
  const claim = await run.action({ action: "claim", round });
  const permit = claim.state.contractReview!.rounds.at(-1)!.permit!;
  const response = run.native(capsule, permit, round, findings, "generalist", extra);
  await run.action(response);
  return { capsule, response };
}

test("new Quick approval binds current review, requires human consent for a major, and saves no Markdown", async () => {
  const run = await workspace("quick-review");
  const { root, store, state, action } = run;
  try {
    const invoke = (args: string[]) =>
      runInvocation(["--harness", "codex", "task", "gate", state.taskId, ...args], {
        workspaceRoot: root,
      });
    expect(state.contractReview?.rounds).toHaveLength(0);
    expect(state.shape?.projection).toBeUndefined();
    expect((await invoke(["--view"])).status).toBe("blocked");
    await expectRejected(
      () =>
        store.review(
          state.taskId,
          { action: "prepare", expectedRevision: state.revision, sources: [] },
          "auto",
        ),
      blocked,
    );

    const { capsule } = await fullReview(
      run,
      [],
      [
        {
          id: "rollback",
          severity: "major",
          description: "Recovery trade-off needs an explicit decision.",
        },
      ],
      {
        paraphrase: {
          proposal: "Adds a bounded quick contract change with rollback ownership.",
          existingSystem: "Current system has no automated rollback handler for this task.",
        },
      },
    );
    const stale = (await invoke(["--view"])).data as {
      review: {
        digest: string;
        findings: { key: string }[];
        coverage: { role: string; paraphrase?: { proposal: string; existingSystem: string } }[];
      };
    };
    expect(stale.review.coverage[0]?.paraphrase?.proposal).toContain("rollback ownership");
    expect((await invoke(["--view"])).status).toBe("blocked");
    expect((await invoke(["--autonomous", "--issue=#1"])).status).toBe("blocked");
    const accept = {
      action: "accept",
      finding: stale.review.findings[0]!.key,
      contractDigest: capsule.contractDigest,
      capsule: capsule.digest,
      rationale: "The operator owns rollback.",
    };
    await expectRejected(() => action(accept), blocked);
    await action({ ...accept, confirmedByUser: true });
    const current = (await invoke(["--view"])).data as {
      review: { digest: string };
      nextAction: NextActionEnvelope;
    };
    expect(current.review.digest).not.toBe(stale.review.digest);
    expect(
      (
        await invoke([
          "--approve",
          `--digest=${capsule.contractDigest}`,
          `--review-digest=${stale.review.digest}`,
        ])
      ).status,
    ).toBe("blocked");
    expect(
      (
        await runInvocation(
          [
            "task",
            "gate",
            state.taskId,
            "--approve",
            `--digest=${capsule.contractDigest}`,
            `--review-digest=${current.review.digest}`,
          ],
          { workspaceRoot: root },
        )
      ).status,
    ).toBe("blocked");
    const approval = current.nextAction.allowedCommands.find((cmd) => cmd.includes("--approve"));
    expect(approval).toBeDefined();
    expect(
      (
        await runInvocation(
          approval!
            .replace("<codex|claude|antigravity>", "codex")
            .replace("<contract-digest>", capsule.contractDigest)
            .replace("<review-digest>", current.review.digest)
            .split(" ")
            .slice(1),
          { workspaceRoot: root },
        )
      ).status,
    ).toBe("approved");
    expect(await Bun.file(join(root, "docs", "forgix")).exists()).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Contract Review supports claude and antigravity hosts and validates optional paraphrase", async () => {
  await Promise.all(
    (["claude", "antigravity"] as const).map(async (harness) => {
      const run = await workspace(`host-${harness}`, harness);
      const { root, state, action } = run;
      try {
        const source = join(root, "source.txt");
        await writeFile(source, `source for ${harness}`);
        if (harness === "antigravity") {
          execFileSync("git", ["-C", root, "config", "user.email", "test@forgix.dev"]);
          execFileSync("git", ["-C", root, "config", "user.name", "Forgix Test"]);
          execFileSync("git", ["-C", root, "add", "source.txt"]);
          execFileSync("git", ["-C", root, "commit", "-q", "-m", "init"]);
        }
        const prep = await action({ action: "prepare", sources: ["source.txt"] });
        const capsule = prep.state.contractReview!.capsule!;
        await action({ action: "reserve" });
        const claimed = await action({ action: "claim", round: 1 });
        const permit = claimed.state.contractReview!.rounds[0]!.permit!;
        await expectRejected(
          () =>
            action(
              run.native(capsule, permit, 1, [], "generalist", {
                paraphrase: { proposal: "   ", existingSystem: "ok" },
              }),
            ),
          invalid,
        );
        await action(
          run.native(capsule, permit, 1, [], "generalist", {
            paraphrase: {
              proposal: `Update ${harness} workflow cleanly.`,
              existingSystem: "Baseline single-file contract.",
            },
          }),
        );
        const view = await runInvocation(
          ["--harness", harness, "task", "gate", state.taskId, "--view"],
          {
            workspaceRoot: root,
          },
        );
        const { review } = view.data as { review: { digest: string } };
        const approved = await runInvocation(
          [
            "--harness",
            harness,
            "task",
            "gate",
            state.taskId,
            "--approve",
            `--digest=${capsule.contractDigest}`,
            `--review-digest=${review.digest}`,
          ],
          { workspaceRoot: root },
        );
        expect(approved.status).toBe("approved");
        const receipt = (await run.store.load(state.taskId)).planApproval!.receiptDigest;
        await writeFile(source, `edited by ${harness}`);
        const post =
          harness === "antigravity"
            ? await runHook("antigravity", "post-invocation", {
                workspaceRoot: root,
                input: JSON.stringify({ cwd: root, tool_use_id: `edit:${harness}` }),
              })
            : await runHook("claude", "post-tool-use", {
                workspaceRoot: root,
                input: JSON.stringify({
                  cwd: root,
                  tool_use_id: `edit:${harness}`,
                  tool_name: "Write",
                  tool_input: { file_path: source, content: `edited by ${harness}` },
                }),
              });
        const parsed = JSON.parse(post.stdout) as {
          systemMessage?: string;
          injectSteps?: { systemMessage?: { systemMessage?: string } }[];
        };
        const postCheck =
          harness === "antigravity"
            ? parsed.injectSteps?.[0]?.systemMessage?.systemMessage
            : parsed.systemMessage;
        expect(postCheck).toContain("Forgix Contract Review post-check complete:");
        await action({
          action: "record-write",
          receipt,
          nativeWriteRef: `edit:${harness}`,
          completed: true,
          postCheck,
        });
        expect((await action({ action: "check-build", receipt })).detail).toEqual({ ready: true });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }),
  );
});

test("GATE and unstarted BUILD recheck source bytes even when no task save happened", async () => {
  const run = await workspace("freshness");
  const { root, store, state, action } = run;
  try {
    const source = join(root, "source.txt");
    await writeFile(source, "contract source A");
    const { capsule, response } = await fullReview(run, ["source.txt"]);
    const audited = await store.load(state.taskId);
    const duplicate = await action(response);
    expect(duplicate.state.revision).toBe(audited.revision);
    const before = await runInvocation(["task", "gate", state.taskId, "--view"], {
      workspaceRoot: root,
    });
    const { review } = before.data as { review: { digest: string } };
    const decide = () =>
      store.gate(state.taskId, {
        decision: "approve",
        harness: "codex",
        expectedDigest: capsule.contractDigest,
        expectedReview: review.digest,
      });
    await writeFile(source, "contract source B changed independently");
    expect((await decide()).refusal).toBe("contract_review_sources_changed");
    expect((await store.load(state.taskId)).planApproval).toBeUndefined();
    await writeFile(source, "contract source A");
    const approval = await decide();
    const receipt = approval.receipt!.receiptDigest;
    await action({ action: "check-build", receipt });
    await writeFile(source, "contract source C after the pre-write check");
    await expectRejected(() => action({ action: "check-build", receipt }), blocked);
    await expectRejected(
      () => action({ action: "record-write", receipt, nativeWriteRef: "edit:1" }),
      blocked,
    );
    const recordWrite = {
      action: "record-write",
      receipt,
      nativeWriteRef: "edit:1",
      completed: true,
    };
    await expectRejected(() => action({ ...recordWrite, postCheck: "{}" }), blocked);
    await writeFile(source, "contract source A");
    await action({ action: "check-build", receipt });
    await writeFile(source, "approved native edit");
    const post = await runHook("codex", "post-tool-use", {
      workspaceRoot: root,
      input: JSON.stringify({
        cwd: root,
        tool_use_id: "edit:1",
        tool_name: "Write",
        tool_input: { file_path: source, content: "approved native edit" },
      }),
    });
    const postCheck = (JSON.parse(post.stdout) as { systemMessage: string }).systemMessage;
    expect(postCheck).toContain("Forgix Contract Review post-check complete:");
    await action({ ...recordWrite, postCheck });
    expect((await action({ action: "check-build", receipt })).detail).toEqual({ ready: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("concurrent resumes cannot launch the same fifth round or erase the runtime-owned budget", async () => {
  const { root, store, state, action } = await workspace("five");
  try {
    await action({ action: "prepare", sources: [] });
    const interrupt = async () => {
      const reserve = await action({ action: "reserve" });
      return action({ action: "claim", round: reserve.state.contractReview!.rounds.at(-1)!.id });
    };
    await interrupt();
    await interrupt();
    await interrupt();
    await interrupt();
    const reserved = await action({ action: "reserve" });
    const claim = () =>
      store.review(
        state.taskId,
        { action: "claim", round: 5, expectedRevision: reserved.state.revision },
        "codex",
      );
    const races = await Promise.allSettled([claim(), claim()]);
    expect(races.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await expectRejected(() => action({ action: "claim", round: 5 }), blocked);
    await expectRejected(() => action({ action: "reserve" }), blocked);
    const current = await store.load(state.taskId);
    expect(current.contractReview?.rounds).toHaveLength(5);
    const tampered = { ...current, revision: current.revision + 1 };
    delete tampered.contractReview;
    await expectRejected(
      () => store.save(state.taskId, tampered, { expectedRevision: current.revision }),
      conflict,
    );
    expect((await store.load(state.taskId)).contractReview?.rounds).toHaveLength(5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("native result must match the exact capsule, reviewer and sources; blockers cannot be waived", async () => {
  const run = await workspace("attestation");
  const { root, store, state, action, native } = run;
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "source.txt"), "public source");
    await symlink("../source.txt", join(root, "src", "linked.txt"));
    await expectRejected(
      () => action({ action: "prepare", sources: ["src/linked.txt"] }),
      (error) => error instanceof StateStoreError && error.code === "state_path_invalid",
    );
    const prep = await action({ action: "prepare", sources: ["source.txt"] });
    const capsule = prep.state.contractReview!.capsule!;
    await action({ action: "reserve" });
    const claimed = await action({ action: "claim", round: 1 });
    const valid = native(capsule, claimed.state.contractReview!.rounds[0]!.permit!, 1, [
      {
        id: "auth",
        severity: "blocker",
        description: "Missing authorization requirement.",
        source: "source.txt",
      },
    ]);
    await expectRejected(() => action({ ...valid, freshContext: false }), blocked);
    await expectRejected(() => action({ ...valid, completed: false }), blocked);
    await expectRejected(() => action({ ...valid, read: [] }), blocked);
    await expectRejected(() => action({ ...valid, capsule: "other" }), blocked);
    await action(valid);
    const view = await runInvocation(["task", "gate", state.taskId, "--view"], {
      workspaceRoot: root,
    });
    const finding = (view.data as { review: { findings: { key: string }[] } }).review.findings[0]!;
    await expectRejected(
      () =>
        action({
          action: "accept",
          finding: finding.key,
          capsule: capsule.digest,
          contractDigest: capsule.contractDigest,
          confirmedByUser: true,
          rationale: "Try to waive.",
        }),
      blocked,
    );
    expect((await store.gate(state.taskId)).preflight.blockers).toContain(
      "contract_review_unresolved_blocker",
    );
    expect((await store.load(state.taskId)).planApproval).toBeUndefined();
    await action({ action: "reserve", recheck: ["generalist"] });
    expect((await store.gate(state.taskId)).preflight.blockers).toContain(
      "contract_review_incomplete",
    );
    const second = await action({ action: "claim", round: 2 });
    await action(native(capsule, second.state.contractReview!.rounds[1]!.permit!, 2));
    expect((await store.gate(state.taskId)).preflight.ready).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a historical contract stays exempt until it is remade in SHAPE", async () => {
  const { root, store, state } = await workspace("other");
  try {
    const id = "historical";
    await seedLegacyTask(root, makeTaskState({ taskId: id, status: "awaiting_approval" }));
    expect((await store.gate(id)).state.contractReview).toBeUndefined();
    const changed = (
      await store.gate(id, { decision: "change", instruction: "Revise scope in SHAPE." })
    ).state;
    const revised = structuredClone(changed);
    revised.revision++;
    revised.shape!.contract!.scope.push("New behavior");
    const protectedTask = await store.save(id, revised, { expectedRevision: changed.revision });
    expect(protectedTask.contractReview?.rounds).toHaveLength(0);
    const forged = makeTaskState({ taskId: state.taskId, status: "executing" });
    forged.contractReview = state.contractReview!;
    await expectRejected(
      () => store.save(state.taskId, forged, { expectedRevision: state.revision }),
      conflict,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Plan uses the canonical render and reuses a specialist only when its dependencies are unchanged", async () => {
  const run = await workspace("plan-review");
  const { root, store, action, native } = run;
  try {
    const id = run.state.taskId;
    const planId = `${id}-v2`;
    const planning = await store.save(
      planId,
      makeTaskState({ taskId: planId, status: "planning", profile: "plan" }),
    );
    const proposal = makeTaskState({
      taskId: planId,
      status: "awaiting_approval",
      profile: "plan",
    });
    const contract = proposal.shape!.contract!;
    const operation = contract.assuranceContract!.operations[0]!;
    Object.assign(contract, {
      schemaVersion: 2,
      planDesign: { objective: "Public design objective", choices: [] },
    });
    contract.acceptanceCriteria[0]!.validationIds = [operation.id];
    contract.validations = [
      {
        id: operation.id,
        description: operation.id,
        dependencyNodeId: operation.id,
        criterionIds: ["criterion.main"],
        verifierKind: operation.kind,
      },
    ];
    const plan = await store.save(planId, proposal, { expectedRevision: planning.revision });
    const shape = plan.shape!;
    const projection = join(root, shape.projection!.path);
    await mkdir(join(root, "docs", "forgix"), { recursive: true });
    await writeFile(projection, "Unrelated hand-edited Markdown");
    await writeFile(join(root, "scope.txt"), "initial scope source");
    await writeFile(join(root, "security.txt"), "bounded authentication source");
    const review = async (payload: object) => {
      const current = await store.load(planId);
      return store.review(planId, { expectedRevision: current.revision, ...payload }, "codex");
    };
    const prepared = {
      action: "prepare",
      sources: ["scope.txt", "security.txt"],
      specialists: [
        {
          id: "security",
          reason: "Authorization boundary",
          sections: ["risks"],
          sources: ["security.txt"],
        },
      ],
    };
    const first = await review(prepared);
    expect((first.detail as { document: string }).document).toContain("Public design objective");
    expect((first.detail as { document: string }).document).not.toContain("Unrelated hand-edited");
    const capsule = first.state.contractReview!.capsule!;
    await review({ action: "reserve" });
    const claim = await review({ action: "claim", round: 1 });
    const permit = claim.state.contractReview!.rounds[0]!.permit!;
    await review(native(capsule, permit, 1));
    await review(native(capsule, permit, 1, [], "security"));
    await writeFile(join(root, "scope.txt"), "changed scope source");
    await review(prepared);
    const next = await review({ action: "reserve" });
    expect(next.state.contractReview?.rounds[1]?.roles).toEqual(["generalist"]);
    await expectRejected(() => review({ ...prepared, specialists: [] }), blocked);
    await expectRejected(() => action({ ...prepared, sources: [] }), invalid);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

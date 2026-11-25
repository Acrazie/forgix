import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInvocation } from "../../src/cli.ts";
import { sha256Hex } from "../../src/core/digest.ts";
import { StateStoreError } from "../../src/core/schema.ts";
import { approveProjectProfile, prepareProjectProfile } from "../../src/profile/index.ts";
import { createTaskStateStore, validateTaskState } from "../../src/task/index.ts";
import { operationFingerprint } from "../../src/task/plan.ts";
import type { AssuranceEvidenceRecord, StateHistoryEvent } from "../../src/types.ts";
import { expectRejected } from "../support/expect-error.ts";
import { makeTaskState, seedLegacyTask } from "../support/helpers-v6.ts";
import { projectProfileInput } from "../support/project-profile.ts";

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "forgix-design-"));
  execFileSync("git", ["init", "-q", root]);
  return root;
}
const blocked = (error: unknown) =>
  error instanceof StateStoreError && error.code === "state_blocked";
const conflict = (error: unknown) =>
  error instanceof StateStoreError && error.code === "state_conflict";

function designState(taskId: string) {
  const proposal = makeTaskState({ taskId, status: "awaiting_approval", profile: "plan" });
  proposal.design.productBaseline.dimensions[0]!.value = "Local customer-specific context";
  const contract = proposal.shape!.contract!;
  const command = contract.assuranceContract!.operations[0]!;
  const manual = {
    ...command,
    id: "check:manual",
    kind: "user-observation" as const,
    successPredicate: { requiredOutputRefs: ["observation:behavior-confirmed"] },
  };
  const { checkIdentity: _command, ...observation } = manual;
  contract.schemaVersion = 2;
  contract.planDesign = { objective: "Keep the account settings visible.", choices: [] };
  contract.assuranceContract!.operations = [command, observation];
  contract.acceptanceCriteria[0]!.validationIds = [command.id, observation.id];
  contract.validations = [command, observation].map(({ id, kind }) => ({
    id,
    criterionIds: ["criterion.main"],
    description: id,
    verifierKind: kind,
    dependencyNodeId: id,
  }));
  return proposal;
}

async function prepare(
  root: string,
  taskId: string,
  options?: { path?: string; proposal?: ReturnType<typeof designState> },
) {
  const store = createTaskStateStore(root);
  const proposal = options?.proposal ?? designState(taskId);
  if (options?.path) proposal.shape!.projection!.path = options.path;
  // Exercise the Plan v2 protocol on tasks already in flight when Contract Review is introduced.
  await seedLegacyTask(root, validateTaskState(proposal));
  return store.load(taskId);
}

const authorize = (state: Awaited<ReturnType<typeof prepare>>, policy = "repo-policy") => ({
  path: state.shape!.projection!.path,
  digest: state.contractDigest!,
  checkPolicy: async () => policy,
});

test("only Plan projects a design and GATE approves the exact canonical snapshot, not disk edits", async () => {
  const root = await makeWorkspace();
  try {
    const taskId = "design-view";
    const store = createTaskStateStore(root);
    const quick = await store.save(
      "quick",
      makeTaskState({ taskId: "quick", status: "awaiting_approval" }),
      { expectedRevision: 0 },
    );
    expect(quick.shape?.projection).toBeUndefined();
    await expectRejected(
      () =>
        store.project("quick", {
          path: "ignored.md",
          digest: quick.contractDigest!,
          checkPolicy: async () => "unused",
        }),
      blocked,
    );

    const plan = await prepare(root, taskId);
    const auth = authorize(plan);
    const path = join(root, auth.path);
    const view = () => runInvocation(["task", "gate", taskId, "--view"], { workspaceRoot: root });
    expect((await view()).status).toBe("blocked");
    expect(await Bun.file(path).exists()).toBe(false);

    await writeFile(join(root, ".forgix", "policy.yaml"), "invalid: true\n");
    const command = [
      "task",
      "project",
      taskId,
      `--path=${auth.path}`,
      `--authorize=${auth.digest}`,
    ];
    await expectRejected(() => runInvocation(command, { workspaceRoot: root }), blocked);
    expect(await Bun.file(path).exists()).toBe(false);
    await rm(join(root, ".forgix", "policy.yaml"));

    const projected = await runInvocation(command, { workspaceRoot: root, configSources: [] });
    expect(projected.status).toBe("projected");
    const rendered = await readFile(path, "utf8");
    expect(rendered).toContain("## Definition of Done");
    expect(rendered).toContain("Keep the account settings visible.");
    expect(rendered).toContain("observation:behavior-confirmed");
    expect(rendered).not.toContain(plan.design.productBaseline.dimensions[0]!.value!);

    // The view always derives from the frozen contract, never from the file.
    await writeFile(path, "Manual local edit");
    const canonical = (await view()).data as { contract: string };
    expect(canonical.contract.startsWith(rendered)).toBe(true);
    expect(canonical.contract).toContain("## Protected Surface permissions");
    expect(canonical.contract).toContain("## Escape Hatch permissions");
    await expectRejected(() => store.project(taskId, auth), blocked);
    expect(await readFile(path, "utf8")).toBe("Manual local edit");

    const checkRefusal = async (...flags: string[]) => {
      const refused = await runInvocation(["task", "gate", taskId, "--approve", ...flags], {
        workspaceRoot: root,
      });
      expect(refused.status).toBe("blocked");
      expect(refused.data).toMatchObject({
        reason: "stale_contract_view",
        contract: canonical.contract,
      });
      expect((await store.load(taskId)).planApproval).toBeUndefined();
    };
    await checkRefusal();
    await checkRefusal(`--digest=${"0".repeat(64)}`);
    await writeFile(path, rendered);
    const approved = await runInvocation(
      ["task", "gate", taskId, "--approve", `--digest=${auth.digest}`],
      { workspaceRoot: root },
    );
    expect(approved.status).toBe("approved");
    expect((await store.load(taskId)).planApproval?.contractDigest).toBe(auth.digest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("projection preserves protected paths and third-party files, and fails closed if policy or destination changes", async () => {
  const root = await makeWorkspace();
  try {
    const store = createTaskStateStore(root);
    const protectedPlan = await prepare(root, "protected", { path: "docs/locked/design.md" });
    const profile = projectProfileInput();
    profile.content.protectedSurfaces = ["docs/locked/**"];
    await writeFile(
      join(root, ".forgix", "project.yaml"),
      JSON.stringify(approveProjectProfile(prepareProjectProfile(profile))),
    );
    const protectedAuth = authorize(protectedPlan);
    await expectRejected(
      () =>
        runInvocation(
          [
            "task",
            "project",
            protectedPlan.taskId,
            `--path=${protectedAuth.path}`,
            `--authorize=${protectedAuth.digest}`,
          ],
          { workspaceRoot: root, configSources: [] },
        ),
      blocked,
    );
    expect(await Bun.file(join(root, protectedAuth.path)).exists()).toBe(false);
    const plan = await prepare(root, "projection-collision");
    const auth = authorize(plan);
    const path = join(root, auth.path);
    let checks = 0;
    await expectRejected(
      () =>
        store.project(plan.taskId, {
          ...auth,
          checkPolicy: async () => `policy-${++checks}`,
        }),
      blocked,
    );
    expect(await Bun.file(path).exists()).toBe(false);

    // An identical third-party file cannot be adopted as Forgix's projection.
    const { contract } = (
      await runInvocation(["task", "gate", plan.taskId, "--view"], { workspaceRoot: root })
    ).data as { contract: string };
    await mkdir(join(root, "docs", "forgix"), { recursive: true });
    await writeFile(path, contract);
    await expectRejected(() => store.project(plan.taskId, auth), blocked);
    expect(await readFile(path, "utf8")).toBe(contract);

    await rm(path);
    const racing = createTaskStateStore(root, {
      fileSystem: {
        link: async (_from, destination) => {
          await writeFile(destination, "concurrent author", { flag: "wx" });
          throw Object.assign(new Error("occupied"), { code: "EEXIST" });
        },
      },
    });
    await expectRejected(() => racing.project(plan.taskId, auth), blocked);
    expect(await readFile(path, "utf8")).toBe("concurrent author");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("projection resumes after publication but before recording the Markdown fingerprint", async () => {
  const root = await makeWorkspace();
  try {
    const plan = await prepare(root, "projection-recovery");
    const auth = authorize(plan);
    const path = join(root, auth.path);
    let stateWrites = 0;
    const failing = createTaskStateStore(root, {
      fileSystem: {
        rename: async (source, destination) => {
          if (destination.endsWith(".json") && ++stateWrites === 2) {
            throw Object.assign(new Error("disk error"), { code: "EIO" });
          }
          await rename(source, destination);
        },
      },
    });
    await expectRejected(
      () => failing.project(plan.taskId, auth),
      (error) => error instanceof StateStoreError && error.code === "state_write_failed",
    );
    const store = createTaskStateStore(root);
    const pending = await store.load(plan.taskId);
    expect(pending.shape?.projection?.pending).toBeDefined();
    const before = await store.store.fileIdentity(auth.path);
    const applied = await readFile(path, "utf8");
    await writeFile(path, "Edited after publication");
    await expectRejected(() => store.project(plan.taskId, auth), blocked);
    expect(await readFile(path, "utf8")).toBe("Edited after publication");
    await writeFile(path, applied);
    const recovered = await store.project(plan.taskId, auth);
    expect(await store.store.fileIdentity(auth.path)).toBe(before);
    expect(recovered.shape?.projection?.pending).toBeUndefined();
    expect(recovered.shape?.projection?.written?.fingerprint).toBe(
      sha256Hex(await readFile(path, "utf8")),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("GATE and task save reject stale writes in both orders without dropping the artifact", async () => {
  const root = await makeWorkspace();
  try {
    const store = createTaskStateStore(root);
    await Promise.all(
      [false, true].map(async (gateFirst) => {
        const plan = await prepare(root, `order-${gateFirst}`);
        const auth = authorize(plan);
        const projected = await store.project(plan.taskId, auth);
        const revised = structuredClone(projected);
        revised.revision++;
        revised.shape!.contract!.revision++;
        revised.shape!.contract!.planDesign!.objective = "Keep account settings readable.";
        const approve = () =>
          store.gate(plan.taskId, { decision: "approve", expectedDigest: auth.digest });
        const save = () =>
          store.save(plan.taskId, revised, { expectedRevision: projected.revision });
        if (gateFirst) {
          const approved = await approve();
          expect(approved.receipt?.contractDigest).toBe(auth.digest);
          await expectRejected(save, conflict);
          expect((await store.load(plan.taskId)).planApproval).toEqual(approved.receipt);
        } else {
          const saved = await save();
          expect((await approve()).refusal).toBe("stale_contract_view");
          expect(saved.contractDigest).not.toBe(auth.digest);
          expect(saved.shape?.projection?.path).toBe(auth.path);
          expect(saved.shape?.contract?.artifactId).toBe(plan.shape?.contract?.artifactId);
          await expectRejected(() => store.project(plan.taskId, authorize(saved)), blocked);
          await rm(join(root, auth.path));
          const fresh = await store.project(plan.taskId, authorize(saved));
          expect(fresh.shape?.projection?.path).toBe(auth.path);
          expect(await readFile(join(root, auth.path), "utf8")).toContain(
            "Keep account settings readable.",
          );
        }
      }),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("new Plan ASSURE requires every applicable operation with current proof", async () => {
  const root = await makeWorkspace();
  try {
    const proposal = designState("proof-design");
    const proofContract = proposal.shape!.contract!;
    const conditional = {
      ...proofContract.assuranceContract!.operations[0]!,
      id: "check:conditional",
      conditional: true,
      activationPredicateRef: "condition:optional-surface-present",
    };
    proofContract.assuranceContract!.operations = [
      ...proofContract.assuranceContract!.operations,
      conditional,
    ];
    proofContract.acceptanceCriteria[0]!.validationIds.push(conditional.id);
    proofContract.validations.push({
      ...proofContract.validations[0]!,
      id: conditional.id,
      dependencyNodeId: conditional.id,
    });
    const plan = await prepare(root, proposal.taskId, { proposal });
    const store = createTaskStateStore(root);
    await store.project(plan.taskId, authorize(plan));
    const gated = await store.gate(plan.taskId, {
      decision: "approve",
      expectedDigest: plan.contractDigest!,
    });
    const state = gated.state;
    const operations = state.shape!.contract!.assuranceContract!.operations;
    const fingerprint = "worktree:current";
    state.status = "assuring";
    state.revision++;
    state.activeWorktree = { worktreeRef: "worktree:local", gitFingerprint: fingerprint };
    state.history.push({
      type: "state.transition",
      from: "executing",
      to: "assuring",
      sequence: state.history.at(-1)!.sequence + 1,
      revision: state.revision,
      at: "2026-11-20T12:00:00.000Z",
      sourceFingerprint: fingerprint,
    });
    const evidence = (
      op: (typeof operations)[number],
      verifierDigest = operationFingerprint(op),
    ): AssuranceEvidenceRecord => ({
      schemaVersion: 1,
      evidenceId: `proof:${op.id}`,
      operationId: op.id,
      verifierKind: op.kind,
      verifierDigest,
      subjectIds: [...op.covers],
      observedFingerprint: fingerprint,
      recordedAt: "2026-11-20T12:00:00.000Z",
      result: "passed",
      detailRef: `results:${op.id}`,
      digest: "",
    });
    state.assurance = { schemaVersion: 1, evidenceIndex: [evidence(operations[0]!)] };
    const partial = await store.save(state.taskId, state, { expectedRevision: state.revision - 1 });
    expect(partial.assurance?.receipt).toBeUndefined();

    const oldOperation = { ...operations[1]!, successPredicate: { thresholdRef: "pred:obsolete" } };
    partial.revision++;
    partial.assurance!.evidenceIndex = [
      ...partial.assurance!.evidenceIndex,
      evidence(operations[1]!, operationFingerprint(oldOperation)),
    ];
    const stale = await store.save(partial.taskId, partial, {
      expectedRevision: partial.revision - 1,
    });
    expect(stale.assurance?.receipt).toBeUndefined();
    stale.revision++;
    stale.assurance!.evidenceIndex = [stale.assurance!.evidenceIndex[0]!, evidence(operations[1]!)];
    const manual = await store.save(stale.taskId, stale, {
      expectedRevision: stale.revision - 1,
    });
    expect(manual.assurance?.receipt).toBeUndefined();
    manual.revision++;
    const inactive = { ...evidence(operations[2]!), result: "not_applicable" as const };
    const evidenceIndex = manual.assurance!.evidenceIndex;
    manual.assurance!.evidenceIndex = [...evidenceIndex, inactive];
    await expectRejected(
      () => store.save(manual.taskId, manual, { expectedRevision: manual.revision - 1 }),
      (error) =>
        error instanceof StateStoreError && /does not prove its operation/.test(error.message),
    );
    manual.assurance!.evidenceIndex = [
      ...evidenceIndex,
      { ...inactive, activationEvidenceRef: "result:optional-surface-absent" },
    ];
    const task = (args: string[], input?: string) =>
      runInvocation(args, { workspaceRoot: root, ...(input ? { task: { input } } : {}) });
    const incomplete = (await task(["task", "validate", manual.taskId])).data as {
      nextAction: import("../../src/types.ts").NextActionEnvelope;
    };
    const save = incomplete.nextAction.allowedCommands.find((cmd) => cmd.includes("task save"));
    expect(save).toBeDefined();
    const result = await task(
      save!
        .replace("<last-read-revision>", String(manual.revision - 1))
        .split(" ")
        .slice(1),
      JSON.stringify(manual),
    );
    expect(result.status).toBe("saved");
    const { state: complete, nextAction } = result.data as typeof incomplete & {
      state: typeof manual;
    };
    expect(complete.assurance?.receipt?.contractDigest).toBe(plan.contractDigest);
    expect(complete.assurance?.completionIndex).toHaveLength(3);
    expect(complete.status).toBe("assuring");
    expect(nextAction).toMatchObject({
      role: "terminal",
      phase: "ASSURE",
      allowedCommands: [
        `forgix status ${manual.taskId}`,
        "forgix telemetry summary",
        "forgix retro",
      ],
      retroRecommended: true,
    });
    const resumed = await task(["--harness", "claude", "resume", manual.taskId]);
    expect(resumed.data).toMatchObject({ taskStatus: "assuring", nextAction });
    expect((await store.load(manual.taskId)).revision).toBe(complete.revision);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy Plan is not silently converted; rollback writes target a distinct workspace", async () => {
  const root = await makeWorkspace();
  const rollback = await makeWorkspace();
  try {
    const store = createTaskStateStore(root);
    const id = "legacy-adopt";
    const legacy = makeTaskState({ taskId: id, status: "awaiting_approval", profile: "plan" });
    await seedLegacyTask(root, legacy);
    await Promise.all(
      (["executing", "assuring", "blocked"] as const).map(async (status) => {
        const historical = makeTaskState({
          taskId: status,
          profile: "plan",
          status,
          blockedFrom: "assuring",
        });
        await seedLegacyTask(root, historical);
        expect((await store.load(historical.taskId)).contractDigest).toBe(
          historical.contractDigest,
        );
      }),
    );
    const reopened = await store.gate(id, {
      decision: "change",
      instruction: "Prepare the new design.",
    });
    const proposal = designState(id);
    const current = reopened.state;
    proposal.revision = current.revision + 1;
    proposal.history = [
      ...current.history,
      {
        ...(proposal.history.at(-1) as StateHistoryEvent),
        sequence: current.history.at(-1)!.sequence + 1,
        revision: proposal.revision,
      },
    ];
    await expectRejected(
      () => store.save(id, proposal, { expectedRevision: current.revision }),
      conflict,
    );
    await store.save(id, proposal, { expectedRevision: current.revision, adoptDesign: true });
    await seedLegacyTask(rollback, legacy);
    expect((await createTaskStateStore(rollback).load(id)).shape?.contract?.schemaVersion).toBe(1);
    expect((await store.load(id)).shape?.contract?.schemaVersion).toBe(2);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(rollback, { recursive: true, force: true });
  }
});

test("the state write lock covers the gap between checking a revision and publishing it", async () => {
  const root = await makeWorkspace();
  try {
    const plan = await prepare(root, "locked-writer");
    const store = createTaskStateStore(root);
    const projected = await store.project(plan.taskId, authorize(plan));
    const atPublication = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const slow = createTaskStateStore(root, {
      fileSystem: {
        rename: async (source, destination) => {
          atPublication.resolve();
          await release.promise;
          await rename(source, destination);
        },
      },
    });
    const revised = structuredClone(projected);
    revised.revision++;
    revised.shape!.contract!.revision++;
    const gate = slow.gate(plan.taskId, {
      decision: "approve",
      expectedDigest: plan.contractDigest!,
    });
    await atPublication.promise;
    try {
      await expectRejected(
        () => store.save(plan.taskId, revised, { expectedRevision: projected.revision }),
        conflict,
      );
      expect((await store.load(plan.taskId)).status).toBe("awaiting_approval");
    } finally {
      release.resolve();
      expect((await gate).state.status).toBe("executing");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a fresh design validates its choices and ASSURE references and blocks stale source", async () => {
  const root = await makeWorkspace();
  try {
    const id = "choice-proof";
    const store = createTaskStateStore(root);
    const planning = await store.save(
      id,
      makeTaskState({ taskId: id, status: "planning", profile: "plan" }),
    );
    const proposal = designState(id);
    proposal.shape!.technicalDecisions = [
      {
        schemaVersion: 1,
        id: "decision.storage",
        decisionKey: "storage",
        targetId: "target.main",
        materialityReason: "Compatibility boundary",
        evidenceIds: ["evidence.main"],
        options: [
          { id: "suggested", label: "Recommended", impact: "Implementation effort" },
          { id: "accepted", label: "Selected", impact: "Compatibility" },
        ],
        recommendedOptionId: "suggested",
        recommendationBasis: "Recommendation does not justify the chosen option.",
        confidence: "high",
        adrQualified: false,
        affectedDependencyRootIds: [],
        priorRole: "planning",
        status: "resolved",
        selectedOptionId: "accepted",
        answerEvidenceRef: "answer:1",
      },
    ];
    const contract = proposal.shape!.contract!;
    contract.planDesign!.choices = [
      {
        decisionId: "decision.storage",
        optionId: "suggested",
        summary: "Use the selected storage.",
      },
    ];
    const save = () => store.save(id, proposal, { expectedRevision: planning.revision });
    await expectRejected(
      save,
      (error) => error instanceof StateStoreError && /resolved SHAPE decisions/.test(error.message),
    );
    contract.planDesign!.choices[0]!.optionId = "accepted";

    const validation = contract.validations[0]!;
    validation.criterionIds = ["criterion.other"];
    await expectRejected(
      save,
      (error) => error instanceof StateStoreError && /ASSURE operation/.test(error.message),
    );
    validation.criterionIds = ["criterion.main"];
    const ready = await save();
    const output = (await runInvocation(["task", "gate", id, "--view"], { workspaceRoot: root }))
      .data as { contract: string };
    expect(output.contract).toContain("Use the selected storage.");
    expect(output.contract).not.toContain("Recommendation does not justify");

    const changed = structuredClone(ready);
    changed.revision++;
    changed.design.productBaseline.dimensions[0]!.value = "Base product intent changed.";
    const stale = await store.save(id, changed, { expectedRevision: ready.revision });
    expect((await store.gate(id)).preflight.blockers).toContain("stale_design_source");
    await expectRejected(() => store.project(id, authorize(stale)), blocked);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { StateStoreError } from "../src/core/schema.ts";
import { contractReviewView } from "../src/task/contract-review.ts";
import { applyTaskGateDecision, createTaskStateStore, preflightGate } from "../src/task/index.ts";
import { makeTaskState } from "../test/support/helpers-v6.ts";
import { loadLeanVectors, seedAndProjectPlanV2 } from "./lean-vectors.ts";

type Digest = "current" | "stale" | null;

interface GateVector {
  context:
    | "plan-v2"
    | "contract-review-ready"
    | "contract-review-open-major"
    | "contract-review-unreviewed";
  contract: Digest;
  review: Digest;
  receiptContract: "current" | null;
}

const missingDigest = "0".repeat(64);

async function preparePlanV2(root: string) {
  const taskId = "lean-gate-plan";
  const proposal = makeTaskState({ taskId, status: "awaiting_approval", profile: "plan" });
  const contract = proposal.shape!.contract!;
  const operation = contract.assuranceContract!.operations[0]!;
  contract.schemaVersion = 2;
  contract.planDesign = { objective: "Check the approval boundary.", choices: [] };
  contract.acceptanceCriteria[0]!.validationIds = [operation.id];
  contract.validations = [
    {
      id: operation.id,
      criterionIds: [...operation.covers],
      description: "Verify approved operation.",
      verifierKind: operation.kind,
      dependencyNodeId: operation.id,
    },
  ];
  const { store } = await seedAndProjectPlanV2(root, taskId, proposal);
  return store.load(taskId);
}

async function prepareContractReview(root: string) {
  const taskId = "lean-gate-contract-review";
  const store = createTaskStateStore(root);
  const unreviewed = await store.save(
    taskId,
    makeTaskState({ taskId, status: "awaiting_approval" }),
    { expectedRevision: 0 },
  );
  async function review(payload: object) {
    const { revision } = await store.load(taskId);
    return (await store.review(taskId, { expectedRevision: revision, ...payload }, "codex")).state;
  }
  const prepared = await review({ action: "prepare", sources: [] });
  const capsule = prepared.contractReview!.capsule!;
  const reserved = await review({ action: "reserve" });
  const round = reserved.contractReview!.rounds.at(-1)!.id;
  const claimed = await review({ action: "claim", round });
  const openMajor = await review({
    action: "record",
    role: "generalist",
    round,
    permit: claimed.contractReview!.rounds.at(-1)!.permit!,
    nativeId: "native:lean-gate",
    completed: true,
    freshContext: true,
    capsule: capsule.digest,
    contractDigest: capsule.contractDigest,
    read: [],
    findings: [{ id: "recovery", severity: "major", description: "Confirm recovery ownership." }],
  });
  const previousView = contractReviewView(openMajor)!;
  const ready = await review({
    action: "accept",
    capsule: capsule.digest,
    contractDigest: capsule.contractDigest,
    finding: previousView.findings[0]!.key,
    rationale: "Operator owns recovery.",
    confirmedByUser: true,
  });
  const currentView = contractReviewView(ready)!;
  assert.equal(currentView.contractDigest, previousView.contractDigest);
  assert.notEqual(currentView.digest, previousView.digest);
  return { unreviewed, openMajor, ready, previousView, currentView };
}

function resolveDigest(alias: Digest, current?: string, stale = missingDigest): string | undefined {
  if (alias === "current") return current;
  if (alias === "stale") return stale;
  return undefined;
}

function assertGateVector(
  vector: GateVector,
  entry: {
    state: Awaited<ReturnType<typeof preparePlanV2>>;
    review: string | undefined;
    staleReview: string | undefined;
  },
) {
  const { state, review, staleReview } = entry;
  const expectedDigest = resolveDigest(vector.contract, state.contractDigest);
  const expectedReview = resolveDigest(vector.review, review ?? "unused-review", staleReview);
  const label = `${vector.context}: contract=${vector.contract}, review=${vector.review}`;
  const decide = () =>
    applyTaskGateDecision(state, {
      decision: "approve",
      ...(expectedDigest !== undefined ? { expectedDigest } : {}),
      ...(expectedReview !== undefined ? { expectedReview } : {}),
    });
  if (vector.receiptContract === null) {
    assert.throws(
      decide,
      (error: unknown) => error instanceof StateStoreError && error.code === "state_blocked",
      label,
    );
    assert.equal(state.status, "awaiting_approval", label);
    assert.equal(state.planApproval, undefined, label);
    return;
  }
  const approval = decide();
  assert.equal(approval.state.status, "executing", label);
  assert.equal(approval.receipt?.actor, "user", label);
  assert.equal(approval.receipt?.contractDigest, state.contractDigest, label);
  assert.deepEqual(approval.state.planApproval, approval.receipt, label);
}

async function main() {
  const vectors = loadLeanVectors("GateVectors.lean") as GateVector[];
  assert.ok(vectors.length > 0, "Lean produced no GATE cases");
  const root = await mkdtemp(`${tmpdir()}/forgix-lean-gate-`);
  try {
    const plan = await preparePlanV2(root);
    const { ready, openMajor, unreviewed, previousView, currentView } =
      await prepareContractReview(root);
    assert.equal(preflightGate(plan).ready, true);
    assert.equal(preflightGate(ready).ready, true);
    assert.equal(preflightGate(openMajor).ready, false);
    assert.equal(preflightGate(unreviewed).ready, false);
    const contexts = {
      "plan-v2": { state: plan, review: undefined, staleReview: undefined },
      "contract-review-ready": {
        state: ready,
        review: currentView.digest,
        staleReview: previousView.digest,
      },
      "contract-review-open-major": {
        state: openMajor,
        review: previousView.digest,
        staleReview: currentView.digest,
      },
      "contract-review-unreviewed": {
        state: unreviewed,
        review: undefined,
        staleReview: undefined,
      },
    };
    for (const vector of vectors) assertGateVector(vector, contexts[vector.context]);
    console.log(`GATE: all ${vectors.length} Lean cases match TypeScript.`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();

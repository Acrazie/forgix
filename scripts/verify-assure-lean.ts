import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskStateStore, validateTaskState } from "../src/task/index.ts";
import { operationFingerprint } from "../src/task/plan.ts";
import type { AssuranceEvidenceRecord, AssuranceOperation } from "../src/types.ts";
import { makeTaskState, seedLegacyTask } from "../test/support/helpers-v6.ts";
import { loadLeanVectors, seedAndProjectPlanV2 } from "./lean-vectors.ts";

interface VectorOperation {
  id: string;
  verifierDigest: string;
  covers: string[];
  conditional: boolean;
}

interface VectorRecord {
  operationId: string;
  verifierDigest: string;
  snapshot: string;
  recordedAt: number;
  result: AssuranceEvidenceRecord["result"];
  subjectIds: string[];
  activationEvidence: boolean;
}

interface Vectors {
  snapshot: string;
  operations: VectorOperation[];
  cases: { name: string; history: VectorRecord[]; valid: boolean; ready: boolean }[];
}

function buildProposal(taskId: string, operations: readonly VectorOperation[]) {
  const proposal = makeTaskState({ taskId, status: "awaiting_approval", profile: "plan" });
  const contract = proposal.shape!.contract!;
  const assurance = contract.assuranceContract!;
  const template = assurance.operations[0]!;
  const criterion = contract.acceptanceCriteria[0]!;
  contract.schemaVersion = 2;
  contract.planDesign = { objective: "Verify the approved operations.", choices: [] };
  const subjectIds = new Set(operations.flatMap(({ covers }) => covers));
  assurance.subjects = [...subjectIds].map((id) => ({
    id,
    kind: id === criterion.id ? "criterion" : "mandatory_check",
  }));
  assurance.operations = operations.map(({ id, covers, conditional }) => ({
    ...template,
    id,
    covers,
    conditional,
    ...(conditional ? { activationPredicateRef: "condition:surface-present" } : {}),
  }));
  assurance.evidencePreference = operations.map(({ id }) => id);
  criterion.validationIds = operations.map(({ id }) => id);
  contract.validations = operations.map(({ id }) => ({
    id,
    criterionIds: [criterion.id],
    description: id,
    verifierKind: template.kind,
    dependencyNodeId: id,
  }));
  return proposal;
}

async function prepareAssure(root: string, { operations, snapshot }: Vectors) {
  const taskId = "lean-assure";
  const proposal = buildProposal(taskId, operations);

  // Seed an in-flight Plan v2, then obtain its real projection and approval.
  const { store, plan } = await seedAndProjectPlanV2(root, taskId, proposal);
  const { state } = await store.gate(taskId, {
    decision: "approve",
    expectedDigest: plan.contractDigest!,
  });
  assert.equal(state.status, "executing");
  state.status = "assuring";
  state.assurance = { schemaVersion: 1, evidenceIndex: [] };
  state.revision++;
  state.activeWorktree = {
    worktreeRef: state.activeWorktree?.worktreeRef ?? "worktree:local",
    gitFingerprint: snapshot,
  };
  state.history.push({
    type: "state.transition",
    from: "executing",
    to: "assuring",
    sequence: state.history.at(-1)!.sequence + 1,
    revision: state.revision,
    at: "2026-11-20T12:00:00.000Z",
    sourceFingerprint: snapshot,
  });
  return state;
}

function toEvidence(
  record: VectorRecord,
  index: number,
  operation: AssuranceOperation,
  verifierAlias: string,
): AssuranceEvidenceRecord {
  return {
    schemaVersion: 1,
    evidenceId: `proof:${index}`,
    operationId: record.operationId,
    verifierKind: operation.kind,
    verifierDigest:
      record.verifierDigest === verifierAlias
        ? operationFingerprint(operation)
        : record.verifierDigest,
    observedFingerprint: record.snapshot,
    recordedAt: new Date(Date.UTC(2026, 10, 20, 12) + record.recordedAt).toISOString(),
    subjectIds: record.subjectIds,
    result: record.result,
    detailRef: `result:${index}`,
    ...(record.activationEvidence ? { activationEvidenceRef: `activation:${index}` } : {}),
    digest: "",
  };
}

async function main() {
  const vectors = loadLeanVectors("AssureVectors.lean") as Vectors;
  assert.ok(vectors.cases.length > 0, "Lean produced no ASSURE cases");
  const root = await mkdtemp(join(tmpdir(), "forgix-lean-assure-"));
  execFileSync("git", ["init", "-q", root]);
  try {
    const store = createTaskStateStore(root);
    const base = await prepareAssure(root, vectors);
    const operations = base.shape!.contract!.assuranceContract!.operations;
    await vectors.cases.reduce(async (chain, vector) => {
      await chain;
      const state = structuredClone(base);
      state.assurance = {
        schemaVersion: 1,
        evidenceIndex: vector.history.map((record, index) => {
          const operation = operations.find(({ id }) => id === record.operationId)!;
          const alias = vectors.operations.find(
            ({ id }) => id === record.operationId,
          )!.verifierDigest;
          return toEvidence(record, index, operation, alias);
        }),
      };
      if (!vector.valid) {
        assert.throws(
          () => validateTaskState(state),
          /does not prove its operation or applicability/,
          vector.name,
        );
      } else {
        await seedLegacyTask(root, base);
        state.revision = base.revision + 1;
        const saved = await store.save(base.taskId, state, { expectedRevision: base.revision });
        assert.equal(saved.assurance?.receipt !== undefined, vector.ready, vector.name);
      }
    }, Promise.resolve());
    console.log(`ASSURE v2: all ${vectors.cases.length} Lean cases match TypeScript.`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();

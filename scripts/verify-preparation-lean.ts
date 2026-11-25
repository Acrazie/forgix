import assert from "node:assert/strict";
import { sha256Prefixed } from "../src/core/digest.ts";
import { StateStoreError } from "../src/core/schema.ts";
import { prepareProjectProfile, reconcileProjectProfile } from "../src/profile/index.ts";
import { preflightGate, validateTaskState } from "../src/task/index.ts";
import { makeTaskState } from "../test/support/helpers-v6.ts";
import { projectProfileInput } from "../test/support/project-profile.ts";
import { loadLeanVectors } from "./lean-vectors.ts";

interface ShapeVector {
  name: string;
  evidence: { expected: string | null; observed: string | null; sources: (string | null)[] };
  fresh: boolean;
}

interface InitVector {
  name: string;
  observations: [string, string][];
  staleDecisionKeys: string[];
  invalidatedDecisionKeys: string[];
  missingSourceRefs: string[];
  current: boolean;
}

interface Vectors {
  shape: ShapeVector[];
  decisions: { key: string; dependsOn: string[]; sources: { ref: string; expected: string }[] }[];
  init: InitVector[];
}

function verifyShape({ name, evidence, fresh }: ShapeVector): void {
  const state = makeTaskState({ taskId: "lean-shape", status: "awaiting_approval" });
  const shape = state.shape!;
  const record = shape.evidence[0]!;
  const source = shape.sourceFingerprints![0]!;
  delete record.expectedValue;
  delete record.observedValue;
  if (evidence.expected !== null) record.expectedValue = evidence.expected;
  if (evidence.observed !== null) record.observedValue = evidence.observed;
  record.sourceFingerprintIds = evidence.sources.map((_, index) => `fp:${index}`);
  shape.sourceFingerprints = evidence.sources.flatMap((value, index) =>
    value === null ? [] : [{ ...source, id: `fp:${index}`, value }],
  );

  const label = `SHAPE: ${name}`;
  assert.equal(preflightGate(state).blockers.includes("stale_evidence"), !fresh, label);
  const validate = () => validateTaskState(state);
  if (fresh) {
    assert.doesNotThrow(validate, label);
  } else {
    assert.throws(
      validate,
      (error: unknown) =>
        error instanceof StateStoreError &&
        error.code === "state_invalid" &&
        /Stale shape evidence/.test(error.message),
      label,
    );
  }
}

function verifyInit({ decisions, init }: Vectors): void {
  const profile = projectProfileInput();
  const byKey = new Map(profile.content.decisions.map((decision) => [decision.key, decision]));
  profile.content.decisions = decisions.map(({ key, dependsOn, sources }) => {
    const template = byKey.get(key)!;
    return {
      ...template,
      dependsOn,
      provenance:
        sources.length > 0
          ? { ...template.provenance, sourceRefs: sources.map(({ ref }) => ref) }
          : template.provenance,
      sourceFingerprints: sources.map(({ ref, expected }) => ({
        sourceRef: ref,
        value: sha256Prefixed(expected),
      })),
    };
  });
  const proposal = prepareProjectProfile(profile);
  for (const { name, observations, ...expected } of init) {
    const observed = Object.fromEntries(
      observations.map(([ref, fingerprint]) => [ref, sha256Prefixed(fingerprint)]),
    );
    assert.deepEqual(
      reconcileProjectProfile(proposal, observed),
      {
        ...expected,
        staleDecisionKeys: expected.staleDecisionKeys.toSorted(),
        invalidatedDecisionKeys: expected.invalidatedDecisionKeys.toSorted(),
        missingSourceRefs: expected.missingSourceRefs.toSorted(),
      },
      `INIT: ${name}`,
    );
  }
}

function main() {
  const vectors = loadLeanVectors("PreparationVectors.lean") as Vectors;
  assert.ok(vectors.shape.length > 0 && vectors.init.length > 0, "Missing preparation cases");
  for (const vector of vectors.shape) verifyShape(vector);
  verifyInit(vectors);
  console.log(`SHAPE: all ${vectors.shape.length} Lean cases match TypeScript.`);
  console.log(`INIT: all ${vectors.init.length} Lean cases match TypeScript.`);
}

if (import.meta.main) main();

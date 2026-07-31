import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

async function api() {
  return import(bundle);
}

test("freshness reconciliation preserves unrelated evidence", async () => {
  const { reconcileShapeFreshness } = await api();
  const graph = {
    schemaVersion: 1,
    nodes: [
      { id: "source.auth", kind: "source", dependsOn: [] },
      { id: "evidence.auth", kind: "evidence", dependsOn: ["source.auth"] },
      { id: "criterion.auth", kind: "criterion", dependsOn: ["evidence.auth"] },
      { id: "source.docs", kind: "source", dependsOn: [] },
      { id: "evidence.docs", kind: "evidence", dependsOn: ["source.docs"] },
    ],
  };
  const fingerprints = [
    {
      id: "auth-file",
      kind: "git_blob",
      value: "blob:old",
      provenanceRef: "repo:auth",
      dependencyNodeId: "source.auth",
    },
    {
      id: "docs-file",
      kind: "content",
      value: "sha256:same",
      provenanceRef: "repo:docs",
      dependencyNodeId: "source.docs",
    },
  ];
  const evidence = [
    {
      id: "auth",
      fact: "Auth uses sessions.",
      provenanceRefs: ["repo:auth"],
      sourceFingerprintIds: ["auth-file"],
      dependencyNodeId: "evidence.auth",
    },
    {
      id: "docs",
      fact: "Docs use Markdown.",
      provenanceRefs: ["repo:docs"],
      sourceFingerprintIds: ["docs-file"],
      dependencyNodeId: "evidence.docs",
    },
  ];

  const result = reconcileShapeFreshness({
    graph,
    fingerprints,
    evidence,
    observedValues: {
      "auth-file": "blob:new",
      "docs-file": "sha256:same",
    },
  });

  assert.deepEqual(result.staleEvidenceIds, ["auth"]);
  assert.deepEqual(result.invalidatedNodeIds, ["criterion.auth", "evidence.auth", "source.auth"]);
  assert.deepEqual(result.refreshTargetIds, ["refresh:auth"]);
  assert.deepEqual(result.reusedEvidenceIds, ["docs"]);
});

test("external TTL and command input changes become stale deterministically", async () => {
  const { isSourceFingerprintFresh } = await api();
  assert.equal(
    isSourceFingerprintFresh(
      {
        id: "external",
        kind: "external",
        value: "etag:1",
        provenanceRef: "external:api",
        dependencyNodeId: "source.external",
        observedAt: "2026-07-29T00:00:00.000Z",
        expiresAt: "2026-07-29T01:00:00.000Z",
      },
      "etag:1",
      "2026-07-29T00:30:00.000Z",
    ),
    true,
  );
  assert.equal(
    isSourceFingerprintFresh(
      {
        id: "external",
        kind: "external",
        value: "etag:1",
        provenanceRef: "external:api",
        dependencyNodeId: "source.external",
        observedAt: "2026-07-29T00:00:00.000Z",
        expiresAt: "2026-07-29T01:00:00.000Z",
      },
      "etag:1",
      "2026-07-29T02:00:00.000Z",
    ),
    false,
  );
  assert.equal(
    isSourceFingerprintFresh(
      {
        id: "command",
        kind: "command",
        value: "sha256:result",
        inputDigest: "sha256:inputs-a",
        provenanceRef: "command:test",
        dependencyNodeId: "source.command",
      },
      { value: "sha256:result", inputDigest: "sha256:inputs-b" },
    ),
    false,
  );
});

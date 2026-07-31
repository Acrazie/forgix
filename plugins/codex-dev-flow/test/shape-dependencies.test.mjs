import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

async function api() {
  return import(bundle);
}

test("dependency graph validates and invalidates only transitive dependants", async () => {
  const { dependencyClosure, validateDependencyGraph } = await api();
  const graph = {
    schemaVersion: 1,
    nodes: [
      { id: "decision.auth", kind: "decision", dependsOn: [] },
      { id: "source.auth", kind: "source", dependsOn: [] },
      { id: "evidence.auth", kind: "evidence", dependsOn: ["source.auth"] },
      { id: "criterion.auth", kind: "criterion", dependsOn: ["decision.auth", "evidence.auth"] },
      { id: "task.auth", kind: "task", dependsOn: ["criterion.auth"] },
      { id: "source.docs", kind: "source", dependsOn: [] },
      { id: "evidence.docs", kind: "evidence", dependsOn: ["source.docs"] }
    ]
  };

  assert.deepEqual(
    validateDependencyGraph(graph).nodes.map((node) => node.id),
    ["criterion.auth", "decision.auth", "evidence.auth", "evidence.docs", "source.auth", "source.docs", "task.auth"]
  );
  assert.deepEqual(
    dependencyClosure(graph, ["decision.auth"]),
    ["criterion.auth", "decision.auth", "task.auth"]
  );
  assert.deepEqual(
    dependencyClosure(graph, ["source.auth"]),
    ["criterion.auth", "evidence.auth", "source.auth", "task.auth"]
  );
});

test("dependency graph rejects missing references, duplicates, self edges, and cycles", async () => {
  const { validateDependencyGraph } = await api();
  const node = (id, dependsOn = []) => ({ id, kind: "evidence", dependsOn });

  assert.throws(
    () => validateDependencyGraph({ schemaVersion: 1, nodes: [node("a", ["missing"])] }),
    /unknown dependency/
  );
  assert.throws(
    () => validateDependencyGraph({ schemaVersion: 1, nodes: [node("a"), node("a")] }),
    /Duplicate dependency node/
  );
  assert.throws(
    () => validateDependencyGraph({ schemaVersion: 1, nodes: [node("a", ["a"])] }),
    /cannot depend on itself/
  );
  assert.throws(
    () => validateDependencyGraph({
      schemaVersion: 1,
      nodes: [node("a", ["b"]), node("b", ["a"])]
    }),
    /cycle/
  );
});

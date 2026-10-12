// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/shape-dependencies.ts";
import { expect, test } from "bun:test";

async function api() {
  return sourceApi;
}

const evidenceNode = (id, dependsOn = []) => ({ id, kind: "evidence", dependsOn });

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
      { id: "evidence.docs", kind: "evidence", dependsOn: ["source.docs"] },
    ],
  };

  expect(validateDependencyGraph(graph).nodes.map((node) => node.id)).toEqual([
    "criterion.auth",
    "decision.auth",
    "evidence.auth",
    "evidence.docs",
    "source.auth",
    "source.docs",
    "task.auth",
  ]);
  expect(dependencyClosure(graph, ["decision.auth"])).toEqual([
    "criterion.auth",
    "decision.auth",
    "task.auth",
  ]);
  expect(dependencyClosure(graph, ["source.auth"])).toEqual([
    "criterion.auth",
    "evidence.auth",
    "source.auth",
    "task.auth",
  ]);
});

test("dependency graph rejects missing references, duplicates, self edges, and cycles", async () => {
  const { validateDependencyGraph } = await api();

  expect(() =>
    validateDependencyGraph({ schemaVersion: 1, nodes: [evidenceNode("a", ["missing"])] }),
  ).toThrow(/unknown dependency/);
  expect(() =>
    validateDependencyGraph({ schemaVersion: 1, nodes: [evidenceNode("a"), evidenceNode("a")] }),
  ).toThrow(/Duplicate dependency node/);
  expect(() =>
    validateDependencyGraph({ schemaVersion: 1, nodes: [evidenceNode("a", ["a"])] }),
  ).toThrow(/cannot depend on itself/);
  expect(() =>
    validateDependencyGraph({
      schemaVersion: 1,
      nodes: [evidenceNode("a", ["b"]), evidenceNode("b", ["a"])],
    }),
  ).toThrow(/cycle/);
});

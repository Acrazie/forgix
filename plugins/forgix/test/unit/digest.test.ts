import { describe, expect, test } from "bun:test";
import {
  DEPENDENCY_NODE_KINDS,
  assertCleanHygiene,
  canonicalJson,
  canonicalize,
  dependencyClosure,
  scanHygieneViolations,
  sha256Hex,
  sha256Prefixed,
  validateDependencyGraph,
} from "../../src/core/digest.ts";
import { expectThrown } from "../support/expect-error.ts";

describe("core/digest", () => {
  test("canonicalize and canonicalJson normalize object key ordering and drop undefined", () => {
    const a = { z: 1, a: { c: true, b: undefined, d: [3, { y: 1, x: 2 }] } };
    const b = { a: { d: [3, { x: 2, y: 1 }], c: true }, z: 1 };
    expect(canonicalize(a) as unknown).toEqual(canonicalize(b));
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(sha256Hex(canonicalJson(a))).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Prefixed(canonicalJson(a))).toBe(`sha256:${sha256Hex(canonicalJson(a))}`);
  });

  test("scanHygieneViolations and assertCleanHygiene detect local paths and secrets", () => {
    expect(scanHygieneViolations({ ok: "relative/path.ts", nested: ["value"] })).toEqual([]);
    expect(() => assertCleanHygiene({ ok: "relative/path.ts" })).not.toThrow();

    const violations = scanHygieneViolations({
      localMac: "/Users/alice/repo/file.ts",
      localWin: "C:\\Users\\alice\\file.ts",
      secretToken: "ghp_1234567890abcdefghij1234567890",
      privateKey: "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
    });
    expect(violations.length).toBeGreaterThanOrEqual(4);
    expectThrown(
      () => assertCleanHygiene({ local: "/home/dev/workspace" }),
      (error) =>
        error instanceof Error &&
        /Hygiene violations detected: local_absolute_path/.test(error.message),
    );
  });

  test("validateDependencyGraph sorts nodes, validates DAG invariants, and computes closures", () => {
    expect(DEPENDENCY_NODE_KINDS).toContain("technical_decision");
    const graph = validateDependencyGraph({
      schemaVersion: 1,
      nodes: [
        { id: "task.1", kind: "task", dependsOn: ["criterion.1"] },
        { id: "criterion.1", kind: "criterion", dependsOn: ["decision.1", "evidence.1"] },
        { id: "decision.1", kind: "decision", dependsOn: [] },
        { id: "evidence.1", kind: "evidence", dependsOn: ["source.1"] },
        { id: "source.1", kind: "source", dependsOn: [] },
        { id: "evidence.2", kind: "evidence", dependsOn: ["source.2"] },
        { id: "source.2", kind: "source", dependsOn: [] },
      ],
    });
    expect(graph.nodes.map((node) => node.id)).toEqual([
      "criterion.1",
      "decision.1",
      "evidence.1",
      "evidence.2",
      "source.1",
      "source.2",
      "task.1",
    ]);
    expect(dependencyClosure(graph, ["decision.1"])).toEqual([
      "criterion.1",
      "decision.1",
      "task.1",
    ]);
    expect(dependencyClosure(graph, ["source.1"])).toEqual([
      "criterion.1",
      "evidence.1",
      "source.1",
      "task.1",
    ]);

    expect(() =>
      validateDependencyGraph({
        schemaVersion: 1,
        nodes: [{ id: "a", kind: "evidence", dependsOn: ["missing"] }],
      }),
    ).toThrow(/unknown dependency/);
    expect(() =>
      validateDependencyGraph({
        schemaVersion: 1,
        nodes: [
          { id: "a", kind: "evidence", dependsOn: [] },
          { id: "a", kind: "evidence", dependsOn: [] },
        ],
      }),
    ).toThrow(/Duplicate dependency node/);
    expect(() =>
      validateDependencyGraph({
        schemaVersion: 1,
        nodes: [{ id: "a", kind: "evidence", dependsOn: ["a"] }],
      }),
    ).toThrow(/cannot depend on itself/);
    expect(() =>
      validateDependencyGraph({
        schemaVersion: 1,
        nodes: [
          { id: "a", kind: "evidence", dependsOn: ["b"] },
          { id: "b", kind: "evidence", dependsOn: ["a"] },
        ],
      }),
    ).toThrow(/cycle/);
  });
});

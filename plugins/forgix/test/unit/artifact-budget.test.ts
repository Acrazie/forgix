import { describe, expect, test } from "bun:test";
import {
  compareManifest,
  evaluateSizeBudget,
  type ArtifactBudget,
  type ArtifactSizes,
} from "../../scripts/check-size-budget.ts";

const budget: ArtifactBudget = {
  schemaVersion: 1,
  baselineRationale: "Test fixture baseline.",
  baseline: { bundleBytes: 100, packedBytes: 80, unpackedBytes: 200 },
  headroom: { bundleBytes: 10, packedBytes: 8, unpackedBytes: 20 },
  maximum: { bundleBytes: 110, packedBytes: 88, unpackedBytes: 220 },
  manifest: ["dist/forgix.mjs", "package.json"],
};

describe("artifact size budgets", () => {
  test("accepts every metric at its exact maximum", () => {
    expect(evaluateSizeBudget(budget.maximum, budget)).toEqual([]);
  });

  for (const metric of ["bundleBytes", "packedBytes", "unpackedBytes"] as const) {
    test(`rejects ${metric} one byte over its maximum`, () => {
      const observed: ArtifactSizes = { ...budget.maximum, [metric]: budget.maximum[metric] + 1 };
      expect(evaluateSizeBudget(observed, budget)).toEqual([
        `${metric}: observed ${budget.maximum[metric] + 1} bytes, allowed ${budget.maximum[metric]} bytes (1 byte over)`,
      ]);
    });
  }

  test("rejects inconsistent baseline arithmetic", () => {
    const inconsistent: ArtifactBudget = {
      ...budget,
      maximum: { ...budget.maximum, packedBytes: 89 },
    };
    expect(evaluateSizeBudget(budget.maximum, inconsistent)).toContain(
      "packedBytes: maximum 89 must equal baseline 80 + headroom 8",
    );
  });

  test("rejects unexplained baseline", () => {
    expect(evaluateSizeBudget(budget.maximum, { ...budget, baselineRationale: "" })).toContain(
      "baselineRationale must explain size growth",
    );
  });
});

test("pack manifest comparison explains missing and unexpected files", () => {
  expect(compareManifest(["dist/forgix.mjs", "extra"], budget.manifest)).toEqual([
    "pack manifest missing: package.json",
    "pack manifest unexpected: extra",
  ]);
});

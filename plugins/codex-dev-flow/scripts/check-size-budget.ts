import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createPackedArtifact } from "./package-artifact.ts";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BUDGET_PATH = join(PACKAGE_ROOT, "test", "artifact-budget.json");
const SIZE_KEYS = ["bundleBytes", "packedBytes", "unpackedBytes"] as const;

export interface ArtifactSizes {
  bundleBytes: number;
  packedBytes: number;
  unpackedBytes: number;
}

export interface ArtifactBudget {
  schemaVersion: 1;
  baseline: ArtifactSizes;
  headroom: ArtifactSizes;
  maximum: ArtifactSizes;
  manifest: string[];
}

export function evaluateSizeBudget(observed: ArtifactSizes, budget: ArtifactBudget): string[] {
  const errors: string[] = [];
  for (const key of SIZE_KEYS) {
    const computedMaximum = budget.baseline[key] + budget.headroom[key];
    if (budget.maximum[key] !== computedMaximum) {
      errors.push(
        `${key}: maximum ${budget.maximum[key]} must equal baseline ${budget.baseline[key]} + headroom ${budget.headroom[key]}`,
      );
    }
    if (observed[key] > budget.maximum[key]) {
      const excess = observed[key] - budget.maximum[key];
      errors.push(
        `${key}: observed ${observed[key]} bytes, allowed ${budget.maximum[key]} bytes (${excess} ${excess === 1 ? "byte" : "bytes"} over)`,
      );
    }
  }
  return errors;
}

export function compareManifest(observed: string[], expected: string[]): string[] {
  const observedSet = new Set(observed);
  const expectedSet = new Set(expected);
  return [
    ...expected
      .filter((path) => !observedSet.has(path))
      .map((path) => `pack manifest missing: ${path}`),
    ...observed
      .filter((path) => !expectedSet.has(path))
      .map((path) => `pack manifest unexpected: ${path}`),
  ];
}

function collectFiles(root: string): { manifest: string[]; bytes: number } {
  const manifest: string[] = [];
  let bytes = 0;
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) {
        manifest.push(relative(root, path).split(sep).join("/"));
        bytes += lstatSync(path).size;
      }
    }
  };
  visit(root);
  return { manifest: manifest.toSorted(), bytes };
}

function digest(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

export function measureArtifacts(): { sizes: ArtifactSizes; manifest: string[]; digest: string } {
  const directory = mkdtempSync(join(tmpdir(), "codex-dev-flow-size-"));
  try {
    const firstPath = createPackedArtifact(join(directory, "first.tgz"));
    const secondPath = createPackedArtifact(join(directory, "second.tgz"));
    const first = readFileSync(firstPath);
    const second = readFileSync(secondPath);
    if (!first.equals(second)) {
      throw new Error(
        `repeated packs differ: first sha256=${digest(first)}, second sha256=${digest(second)}`,
      );
    }

    const extracted = spawnSync("tar", ["-xzf", firstPath, "-C", directory], {
      encoding: "utf8",
      env: { ...process.env, LANG: "C", LC_ALL: "C" },
      shell: false,
    });
    if (extracted.error) throw extracted.error;
    if (extracted.status !== 0) {
      throw new Error(
        `tar extraction failed (${extracted.status ?? "unknown"}): ${extracted.stderr}`,
      );
    }
    const publishedRoot = join(directory, "package");
    const unpacked = collectFiles(publishedRoot);
    return {
      sizes: {
        bundleBytes: statSync(join(PACKAGE_ROOT, "dist", "dev-flow.mjs")).size,
        packedBytes: first.length,
        unpackedBytes: unpacked.bytes,
      },
      manifest: unpacked.manifest,
      digest: digest(first),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function main(): void {
  const budget = JSON.parse(readFileSync(BUDGET_PATH, "utf8")) as ArtifactBudget;
  const measured = measureArtifacts();
  const errors = [
    ...evaluateSizeBudget(measured.sizes, budget),
    ...compareManifest(measured.manifest, budget.manifest),
  ];
  for (const key of SIZE_KEYS) {
    console.log(
      `${key}: observed ${measured.sizes[key]} bytes, baseline ${budget.baseline[key]} bytes, allowed ${budget.maximum[key]} bytes`,
    );
  }
  console.log(`packedSha256: ${measured.digest}`);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

if (import.meta.main) main();

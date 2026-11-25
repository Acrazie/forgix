import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
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

export interface PromptSizeBudget {
  maxAgentsMdLines: number;
  maxSkillLines: number;
  maxPromptBytes: number;
}

export interface ObservedPromptSizes {
  agentsMdLines: number;
  maxObservedSkillLines: number;
  skillLinesByPath: Record<string, number>;
  promptBytes: number;
}

export interface ArtifactBudget {
  schemaVersion: 1;
  baselineRationale: string;
  baseline: ArtifactSizes;
  headroom: ArtifactSizes;
  maximum: ArtifactSizes;
  promptBudget?: PromptSizeBudget;
  manifest: string[];
}

function countLines(text: string): number {
  const trimmed = text.replace(/\r?\n$/, "");
  return trimmed.length === 0 ? 0 : trimmed.split(/\r?\n/).length;
}

export function evaluatePromptBudget(
  observed: ObservedPromptSizes,
  budget: PromptSizeBudget,
): string[] {
  const errors: string[] = [];
  if (observed.agentsMdLines > budget.maxAgentsMdLines) {
    const excess = observed.agentsMdLines - budget.maxAgentsMdLines;
    errors.push(
      `AGENTS.md: observed ${observed.agentsMdLines} lines, allowed ${budget.maxAgentsMdLines} lines (${excess} ${excess === 1 ? "line" : "lines"} over)`,
    );
  }
  const skillEntries = Object.entries(observed.skillLinesByPath).toSorted(([a], [b]) =>
    a.localeCompare(b),
  );
  if (skillEntries.length > 0) {
    for (const [skillPath, lines] of skillEntries) {
      if (lines > budget.maxSkillLines) {
        const excess = lines - budget.maxSkillLines;
        errors.push(
          `${skillPath}: observed ${lines} lines, allowed ${budget.maxSkillLines} lines (${excess} ${excess === 1 ? "line" : "lines"} over)`,
        );
      }
    }
  } else if (observed.maxObservedSkillLines > budget.maxSkillLines) {
    const excess = observed.maxObservedSkillLines - budget.maxSkillLines;
    errors.push(
      `maxSkillLines: observed ${observed.maxObservedSkillLines} lines, allowed ${budget.maxSkillLines} lines (${excess} ${excess === 1 ? "line" : "lines"} over)`,
    );
  }
  if (observed.promptBytes > budget.maxPromptBytes) {
    const excess = observed.promptBytes - budget.maxPromptBytes;
    errors.push(
      `promptBytes: observed ${observed.promptBytes} bytes, allowed ${budget.maxPromptBytes} bytes (${excess} ${excess === 1 ? "byte" : "bytes"} over)`,
    );
  }
  return errors;
}

export function evaluateSizeBudget(
  observed: ArtifactSizes & Partial<ObservedPromptSizes>,
  budget: ArtifactBudget,
): string[] {
  const errors: string[] = [];
  if (!budget.baselineRationale.trim()) errors.push("baselineRationale must explain size growth");
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
  if (
    budget.promptBudget &&
    (observed.agentsMdLines !== undefined ||
      observed.maxObservedSkillLines !== undefined ||
      observed.promptBytes !== undefined)
  ) {
    errors.push(
      ...evaluatePromptBudget(
        {
          agentsMdLines: observed.agentsMdLines ?? 0,
          maxObservedSkillLines: observed.maxObservedSkillLines ?? 0,
          skillLinesByPath: observed.skillLinesByPath ?? {},
          promptBytes: observed.promptBytes ?? 0,
        },
        budget.promptBudget,
      ),
    );
  }
  return errors;
}

export function measurePromptSizes(root = PACKAGE_ROOT): ObservedPromptSizes {
  let promptBytes = 0;
  let agentsMdLines = 0;
  const agentsPath = join(root, "AGENTS.md");
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf8");
    agentsMdLines = countLines(content);
    promptBytes += Buffer.byteLength(content, "utf8");
  }

  const skillLinesByPath: Record<string, number> = {};
  let maxObservedSkillLines = 0;
  const skillsRoot = join(root, "skills");
  const visitSkills = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visitSkills(fullPath);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        const rel = relative(root, fullPath).split(sep).join("/");
        const content = readFileSync(fullPath, "utf8");
        const lines = countLines(content);
        skillLinesByPath[rel] = lines;
        if (lines > maxObservedSkillLines) maxObservedSkillLines = lines;
        promptBytes += Buffer.byteLength(content, "utf8");
      }
    }
  };
  visitSkills(skillsRoot);

  return {
    agentsMdLines,
    maxObservedSkillLines,
    skillLinesByPath,
    promptBytes,
  };
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
  const directory = mkdtempSync(join(tmpdir(), "forgix-size-"));
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
        bundleBytes: statSync(join(PACKAGE_ROOT, "dist", "forgix.mjs")).size,
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
  const promptMeasured = measurePromptSizes(PACKAGE_ROOT);
  const errors = [
    ...evaluateSizeBudget({ ...measured.sizes, ...promptMeasured }, budget),
    ...compareManifest(measured.manifest, budget.manifest),
  ];
  for (const key of SIZE_KEYS) {
    console.log(
      `${key}: observed ${measured.sizes[key]} bytes, baseline ${budget.baseline[key]} bytes, allowed ${budget.maximum[key]} bytes`,
    );
  }
  if (budget.promptBudget) {
    console.log(
      `promptBudget: AGENTS.md=${promptMeasured.agentsMdLines}/${budget.promptBudget.maxAgentsMdLines} lines, maxSkillLines=${promptMeasured.maxObservedSkillLines}/${budget.promptBudget.maxSkillLines} lines, promptBytes=${promptMeasured.promptBytes}/${budget.promptBudget.maxPromptBytes} bytes`,
    );
  }
  console.log(`packedSha256: ${measured.digest}`);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

if (import.meta.main) main();

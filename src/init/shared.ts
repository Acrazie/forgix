import { lstat } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { StateStoreError } from "../core/schema.js";
import type { WorkspaceStore } from "../core/store.js";
import type { HarnessId } from "../types.js";

export const MAX_RULES_CONTENT_BYTES = 24_000;
export const INIT_APPLY_LOCK_PATH = ".forgix/init/apply.lock.sqlite";
export const CONFIG_RELATIVE_PATH = ".forgix/config.yaml";
export const PROJECT_PROFILE_RELATIVE_PATH = ".forgix/project.yaml";
export const CODEX_AGENTS_PATH = "AGENTS.md";
export const GITIGNORE_PATH = ".gitignore";
export const WORKTREE_INCLUDE_PATH = ".worktreeinclude";

const VERSIONED_FILE_MODE = 0o644;
export const VERSIONED_DIR_MODE = 0o755;

export const MANDATORY_GITIGNORE_ENTRIES: readonly string[] = [
  ".forgix/init/",
  ".forgix/tasks/",
  ".forgix/project.local.yaml",
  ".forgix/config.local.yaml",
  ".forgix/cache/",
  ".forgix/telemetry/",
  ".forgix/roadmap/session.yaml",
  ".forgix/roadmap/runtime.yaml",
];

export const DEFAULT_WORKTREE_INCLUDE_ENTRIES: readonly string[] = [
  ".forgix/project.local.yaml",
  ".forgix/config.local.yaml",
];

export const ALL_HARNESSES: readonly HarnessId[] = ["codex", "claude", "antigravity"];

export const BOOTSTRAP_CAPABILITY_DEFAULTS = {
  rules: true,
  agents: false,
  skills: false,
  hooks: true,
  gitignore: true,
  worktreeInclude: true,
} as const;

export type BootstrapCapabilityKey = keyof typeof BOOTSTRAP_CAPABILITY_DEFAULTS;

export const BOOTSTRAP_CAPABILITY_KEYS = Object.keys(
  BOOTSTRAP_CAPABILITY_DEFAULTS,
) as BootstrapCapabilityKey[];

export type InitPlanActionKind = "create" | "update" | "remove" | "unchanged";

export interface InitPlanAction {
  path: string;
  kind: InitPlanActionKind;
  preview?: string;
}

export interface InitConflict {
  path: string;
  code: string;
  message: string;
  preview?: string;
}

export interface InitCheckFinding {
  path: string;
  code: string;
  message: string;
}

export interface PlannedFileOperation {
  path: string;
  kind: InitPlanActionKind;
  existingContent: string | undefined;
  existingMode: number | undefined;
  nextContent: string | undefined;
  preview?: string;
}

export interface FileReadProbe {
  ok: true;
  content: string | undefined;
  mode: number | undefined;
}

export type SafeReadResult = FileReadProbe | { ok: false; conflict: InitConflict };

interface AppliedSnapshot {
  path: string;
  existed: boolean;
  previousContent: string | undefined;
  previousMode: number | undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function runSequentially<T>(items: readonly T[], fn: (item: T) => Promise<void>): Promise<void> {
  return items.reduce((chain, item) => chain.then(() => fn(item)), Promise.resolve());
}

export function dedupeStrings(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    if (!seen.has(entry)) {
      seen.add(entry);
      result.push(entry);
    }
  }
  return result;
}

export function readPreviousManagedPaths(existingConfigYaml: string | undefined): string[] {
  if (!existingConfigYaml) return [];
  try {
    const parsed: unknown = parseYaml(existingConfigYaml);
    if (!isRecord(parsed) || !isRecord(parsed.bootstrap)) return [];
    if (!Array.isArray(parsed.bootstrap.managedPaths)) return [];
    return parsed.bootstrap.managedPaths.filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    );
  } catch {
    return [];
  }
}

function appendPreviewSection(
  target: string[],
  sourceLines: readonly string[],
  prefix: "-" | "+",
  maxSectionLines: number,
): void {
  const limit = Math.min(sourceLines.length, maxSectionLines);
  for (let i = 0; i < limit; i += 1) {
    target.push(`${prefix}${sourceLines[i]}`);
  }
  if (sourceLines.length > maxSectionLines) {
    target.push("... (truncated)");
  }
}

export function renderDiffPreview(
  path: string,
  previous: string | undefined,
  next: string | undefined,
): string {
  const prevLines = previous === undefined ? [] : previous.replace(/\n$/, "").split("\n");
  const nextLines = next === undefined ? [] : next.replace(/\n$/, "").split("\n");
  const lines: string[] = [
    `--- ${previous === undefined ? "/dev/null" : `a/${path}`}`,
    `+++ ${next === undefined ? "/dev/null" : `b/${path}`}`,
  ];
  const totalBudget = 76;
  const halfBudget = 38;
  const prevLimit = Math.min(
    prevLines.length,
    Math.max(halfBudget, totalBudget - nextLines.length),
  );
  const nextLimit = Math.min(nextLines.length, totalBudget - prevLimit);
  appendPreviewSection(lines, prevLines, "-", prevLimit);
  appendPreviewSection(lines, nextLines, "+", nextLimit);
  return lines.join("\n");
}

export function classifyOperation(
  path: string,
  existingContent: string | undefined,
  existingMode: number | undefined,
  nextContent: string | undefined,
): PlannedFileOperation {
  if (existingContent === nextContent) {
    return { path, kind: "unchanged", existingContent, existingMode, nextContent };
  }
  const kind: InitPlanActionKind =
    existingContent === undefined ? "create" : nextContent === undefined ? "remove" : "update";
  return {
    path,
    kind,
    existingContent,
    existingMode,
    nextContent,
    preview: renderDiffPreview(path, existingContent, nextContent),
  };
}

export async function safeReadTarget(
  store: WorkspaceStore,
  relativePath: string,
): Promise<SafeReadResult> {
  try {
    const content = await store.readText(relativePath, true);
    if (content === undefined) {
      return { ok: true, content: undefined, mode: undefined };
    }
    let mode: number | undefined;
    try {
      const metadata = await lstat(store.resolvePath(relativePath));
      mode = metadata.mode & 0o777;
    } catch {
      mode = undefined;
    }
    return { ok: true, content, mode };
  } catch (error) {
    if (error instanceof StateStoreError && error.code === "state_path_invalid") {
      return {
        ok: false,
        conflict: { path: relativePath, code: "symlink_or_non_file", message: error.message },
      };
    }
    throw error;
  }
}

export async function applyPlanOperations(
  store: WorkspaceStore,
  operations: readonly PlannedFileOperation[],
): Promise<void> {
  const pending = operations.filter((op) => op.kind !== "unchanged");
  const secondary = pending.filter((op) => op.path !== CONFIG_RELATIVE_PATH);
  const configOps = pending.filter((op) => op.path === CONFIG_RELATIVE_PATH);
  const ordered = [...secondary, ...configOps];
  const applied: AppliedSnapshot[] = [];

  try {
    await runSequentially(ordered, async (op) => {
      const snapshot: AppliedSnapshot = {
        path: op.path,
        existed: op.existingContent !== undefined,
        previousContent: op.existingContent,
        previousMode: op.existingMode,
      };
      if (op.kind === "remove") {
        await store.removeFile(op.path);
      } else if (op.nextContent !== undefined) {
        await store.writeTextAtomically(op.path, op.nextContent, {
          mode: op.existingMode ?? VERSIONED_FILE_MODE,
          dirMode: VERSIONED_DIR_MODE,
        });
      }
      applied.push(snapshot);
    });
  } catch (error) {
    await rollbackAppliedSnapshots(store, applied);
    const detail = error instanceof Error ? error.message : "Unexpected I/O failure.";
    throw new StateStoreError(
      "state_write_failed",
      `Failed to apply init bootstrap changes (best-effort rollback attempted): ${detail}`,
    );
  }
}

async function rollbackAppliedSnapshots(
  store: WorkspaceStore,
  applied: readonly AppliedSnapshot[],
): Promise<void> {
  await runSequentially(applied.toReversed(), async (entry) => {
    try {
      if (entry.existed && entry.previousContent !== undefined) {
        await store.writeTextAtomically(entry.path, entry.previousContent, {
          mode: entry.previousMode ?? VERSIONED_FILE_MODE,
          dirMode: VERSIONED_DIR_MODE,
        });
      } else {
        await store.removeFile(entry.path);
      }
    } catch {
      // Best-effort rollback: continue restoring remaining files.
    }
  });
}

export function toPlanActions(operations: readonly PlannedFileOperation[]): InitPlanAction[] {
  return operations.map((op) =>
    op.preview !== undefined
      ? { path: op.path, kind: op.kind, preview: op.preview }
      : { path: op.path, kind: op.kind },
  );
}

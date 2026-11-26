import { InvocationError } from "../core/schema.js";
import { HARNESS_IDS, type HarnessId, type HarnessPreference } from "../types.js";

export type ParsedInitInvocation =
  | { command: "init_plan"; adopt?: boolean; harness?: HarnessPreference }
  | { command: "init_apply"; adopt?: boolean; harness?: HarnessPreference }
  | { command: "init_check"; strict?: boolean; harness?: HarnessPreference }
  | {
      command: "init_sync_plan";
      adopt?: boolean;
      adoptPaths?: string[];
      harness?: HarnessPreference;
    }
  | {
      command: "init_sync_apply";
      adopt?: boolean;
      adoptPaths?: string[];
      harness?: HarnessPreference;
    }
  | { command: "init_check_build"; targetHarness: HarnessId; harness?: HarnessPreference };

const USAGE_MESSAGE =
  "Usage: forgix init plan|apply [--adopt] | init check [--strict] | init sync --plan|--apply [--adopt | --adopt-path=<path>] | init check-build <codex|claude|antigravity>";

interface SyncFlagState {
  mode: "plan" | "apply" | undefined;
  adopt: boolean;
  adoptPaths: string[];
}

function applySyncFlag(flag: string, state: SyncFlagState): void {
  if (flag === "--plan" && state.mode === undefined) {
    state.mode = "plan";
    return;
  }
  if (flag === "--apply" && state.mode === undefined) {
    state.mode = "apply";
    return;
  }
  if (flag === "--adopt" && !state.adopt) {
    state.adopt = true;
    return;
  }
  if (flag.startsWith("--adopt-path=")) {
    const value = flag.slice("--adopt-path=".length).trim();
    if (value) {
      state.adoptPaths.push(value);
      return;
    }
  }
  throw new InvocationError(USAGE_MESSAGE);
}

function parseInitSyncInvocation(
  flags: readonly string[],
  harnessField: { harness?: HarnessPreference },
): ParsedInitInvocation {
  const state: SyncFlagState = { mode: undefined, adopt: false, adoptPaths: [] };
  for (const flag of flags) applySyncFlag(flag, state);
  if (!state.mode) {
    throw new InvocationError(
      "forgix init sync requires --plan or --apply. Run $forgix sync (Codex), /forgix:forgix sync (Claude Code), or /forgix sync (Antigravity) inside your AI agent.",
    );
  }
  return {
    command: state.mode === "plan" ? "init_sync_plan" : "init_sync_apply",
    ...(state.adopt ? { adopt: true } : {}),
    ...(state.adoptPaths.length > 0 ? { adoptPaths: state.adoptPaths } : {}),
    ...harnessField,
  };
}

function parsePlanOrApply(
  subcommand: "plan" | "apply",
  flags: readonly string[],
  harnessField: { harness?: HarnessPreference },
): ParsedInitInvocation {
  if (flags.length === 0) return { command: `init_${subcommand}`, ...harnessField };
  if (flags.length === 1 && flags[0] === "--adopt") {
    return { command: `init_${subcommand}`, adopt: true, ...harnessField };
  }
  throw new InvocationError(USAGE_MESSAGE);
}

function parseCheckBuild(
  flags: readonly string[],
  harnessField: { harness?: HarnessPreference },
): ParsedInitInvocation {
  const target = flags[0];
  if (flags.length === 1 && target && (HARNESS_IDS as readonly string[]).includes(target)) {
    return { command: "init_check_build", targetHarness: target as HarnessId, ...harnessField };
  }
  throw new InvocationError(USAGE_MESSAGE);
}

export function parseInitInvocation(
  rest: string[],
  harnessField: { harness?: HarnessPreference },
): ParsedInitInvocation {
  const [subcommand, ...flags] = rest;
  if (!subcommand) {
    throw new InvocationError(
      "Forgix is an agent-first plugin and does not provide an interactive terminal wizard. Run $forgix init (Codex), /forgix:forgix init (Claude Code), or /forgix init (Antigravity) inside your AI agent. For deterministic backend operations, use: forgix init plan|apply|check|sync.",
    );
  }
  if (subcommand === "check") {
    if (flags.length === 0) return { command: "init_check", ...harnessField };
    if (flags.length === 1 && flags[0] === "--strict") {
      return { command: "init_check", strict: true, ...harnessField };
    }
    throw new InvocationError(USAGE_MESSAGE);
  }
  if (subcommand === "sync") return parseInitSyncInvocation(flags, harnessField);
  if (subcommand === "plan" || subcommand === "apply") {
    return parsePlanOrApply(subcommand, flags, harnessField);
  }
  if (subcommand === "check-build") return parseCheckBuild(flags, harnessField);
  throw new InvocationError(USAGE_MESSAGE);
}

import {
  HARNESS_HOOK_EVENTS,
  buildHookCommand,
  type HarnessHookEventSpec,
} from "../hooks/command.js";
import type { HarnessId } from "../types.js";
import {
  hasFlatHookCommand,
  hasGroupedHookCommand,
  isForgixHookCommand,
  isRecord,
} from "./registered-hooks.js";

export const HOOK_CONFIG_PATHS: Readonly<Record<HarnessId, string>> = {
  antigravity: ".agents/hooks.json",
  codex: ".codex/hooks.json",
  claude: ".claude/settings.json",
};

const HOOK_TIMEOUT_SECONDS = 5;

export interface HookConfigConflict {
  code: "invalid_json";
  message: string;
}

export type HookConfigMergeResult =
  | { ok: true; content: string | undefined }
  | { ok: false; conflict: HookConfigConflict };

export interface HookCheckFinding {
  path: string;
  code: "hooks_missing" | "hooks_json_invalid" | "hooks_drift";
  message: string;
}

interface FlatHookEntry {
  type: "command";
  command: string;
  timeout: number;
}

interface GroupedHookEntry {
  matcher?: string;
  hooks: FlatHookEntry[];
}

function parseJsonObject(
  content: string,
  path: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; conflict: HookConfigConflict } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "malformed JSON";
    return {
      ok: false,
      conflict: {
        code: "invalid_json",
        message: `${path} contains malformed JSON: ${detail}`,
      },
    };
  }
  if (!isRecord(parsed)) {
    return {
      ok: false,
      conflict: {
        code: "invalid_json",
        message: `${path} root must be a JSON object.`,
      },
    };
  }
  return { ok: true, value: parsed };
}

function buildAntigravityForgixSection(): Record<string, unknown> {
  const section: Record<string, unknown> = {};
  for (const spec of HARNESS_HOOK_EVENTS.antigravity) {
    const entry: FlatHookEntry = {
      type: "command",
      command: buildHookCommand("antigravity", spec.event),
      timeout: HOOK_TIMEOUT_SECONDS,
    };
    if (spec.nativeName === "PreToolUse") {
      section[spec.nativeName] = [{ matcher: "*", hooks: [entry] }];
    } else {
      section[spec.nativeName] = [entry];
    }
  }
  return section;
}

function buildGroupedEntry(harness: HarnessId, spec: HarnessHookEventSpec): GroupedHookEntry {
  const entry: FlatHookEntry = {
    type: "command",
    command: buildHookCommand(harness, spec.event),
    timeout: HOOK_TIMEOUT_SECONDS,
  };
  if (harness === "claude" && spec.nativeName === "SessionStart") {
    return { hooks: [entry] };
  }
  return { matcher: "*", hooks: [entry] };
}

function stripForgixFromGroupedArray(
  entries: unknown[],
  harness: HarnessId,
): { filtered: unknown[]; removedAny: boolean } {
  let removedAny = false;
  const filtered: unknown[] = [];

  for (const group of entries) {
    if (!isRecord(group) || !Array.isArray(group.hooks)) {
      filtered.push(group);
      continue;
    }
    const remainingHooks = group.hooks.filter((hook) => {
      if (isRecord(hook) && typeof hook.command === "string") {
        if (isForgixHookCommand(hook.command, harness)) {
          removedAny = true;
          return false;
        }
      }
      return true;
    });
    if (remainingHooks.length === 0) {
      if (group.hooks.length === 0) {
        filtered.push(group);
      }
      continue;
    }
    if (remainingHooks.length === group.hooks.length) {
      filtered.push(group);
    } else {
      filtered.push({ ...group, hooks: remainingHooks });
    }
  }

  return { filtered, removedAny };
}

function mergeAntigravityHooks(
  existingContent: string | undefined,
  enabled: boolean,
): HookConfigMergeResult {
  const path = HOOK_CONFIG_PATHS.antigravity;
  if (existingContent === undefined) {
    if (!enabled) return { ok: true, content: undefined };
    const root = { forgix: buildAntigravityForgixSection() };
    return { ok: true, content: `${JSON.stringify(root, null, 2)}\n` };
  }

  const parsed = parseJsonObject(existingContent, path);
  if (!parsed.ok) return parsed;

  if (!enabled) {
    if (!("forgix" in parsed.value)) {
      return { ok: true, content: existingContent };
    }
    const nextRoot: Record<string, unknown> = { ...parsed.value };
    delete nextRoot.forgix;
    if (Object.keys(nextRoot).length === 0) {
      return { ok: true, content: undefined };
    }
    return { ok: true, content: `${JSON.stringify(nextRoot, null, 2)}\n` };
  }

  const nextRoot: Record<string, unknown> = {
    ...parsed.value,
    forgix: buildAntigravityForgixSection(),
  };
  return { ok: true, content: `${JSON.stringify(nextRoot, null, 2)}\n` };
}

function mergeGroupedHarnessHooks(
  harness: "codex" | "claude",
  existingContent: string | undefined,
  enabled: boolean,
): HookConfigMergeResult {
  const path = HOOK_CONFIG_PATHS[harness];
  const specs = HARNESS_HOOK_EVENTS[harness];

  if (existingContent === undefined) {
    if (!enabled) return { ok: true, content: undefined };
    const hooksObj: Record<string, unknown> = {};
    for (const spec of specs) {
      hooksObj[spec.nativeName] = [buildGroupedEntry(harness, spec)];
    }
    return { ok: true, content: `${JSON.stringify({ hooks: hooksObj }, null, 2)}\n` };
  }

  const parsed = parseJsonObject(existingContent, path);
  if (!parsed.ok) return parsed;

  const root = parsed.value;
  if (root.hooks !== undefined && !isRecord(root.hooks)) {
    return {
      ok: false,
      conflict: {
        code: "invalid_json",
        message: `${path} "hooks" field must be a JSON object.`,
      },
    };
  }

  const existingHooks: Record<string, unknown> = isRecord(root.hooks) ? { ...root.hooks } : {};

  if (!enabled) {
    if (!isRecord(root.hooks)) {
      return { ok: true, content: existingContent };
    }
    let removedAny = false;
    const nextHooks: Record<string, unknown> = {};
    for (const [eventKey, eventValue] of Object.entries(existingHooks)) {
      if (!Array.isArray(eventValue)) {
        nextHooks[eventKey] = eventValue;
        continue;
      }
      const { filtered, removedAny: eventRemoved } = stripForgixFromGroupedArray(
        eventValue,
        harness,
      );
      if (eventRemoved) removedAny = true;
      if (filtered.length > 0) {
        nextHooks[eventKey] = filtered;
      }
    }
    if (!removedAny) {
      return { ok: true, content: existingContent };
    }
    const nextRoot: Record<string, unknown> = { ...root };
    if (Object.keys(nextHooks).length === 0) {
      delete nextRoot.hooks;
    } else {
      nextRoot.hooks = nextHooks;
    }
    if (Object.keys(nextRoot).length === 0) {
      return { ok: true, content: undefined };
    }
    return { ok: true, content: `${JSON.stringify(nextRoot, null, 2)}\n` };
  }

  for (const spec of specs) {
    const existingEvent = existingHooks[spec.nativeName];
    if (existingEvent !== undefined && !Array.isArray(existingEvent)) {
      return {
        ok: false,
        conflict: {
          code: "invalid_json",
          message: `${path} "hooks.${spec.nativeName}" must be an array.`,
        },
      };
    }
    const baseEntries = Array.isArray(existingEvent) ? existingEvent : [];
    const { filtered } = stripForgixFromGroupedArray(baseEntries, harness);
    existingHooks[spec.nativeName] = [...filtered, buildGroupedEntry(harness, spec)];
  }

  const nextRoot: Record<string, unknown> = {
    ...root,
    hooks: existingHooks,
  };
  return { ok: true, content: `${JSON.stringify(nextRoot, null, 2)}\n` };
}

export function mergeHarnessHooksConfig(
  harness: HarnessId,
  existingContent: string | undefined,
  enabled: boolean,
): HookConfigMergeResult {
  if (harness === "antigravity") {
    return mergeAntigravityHooks(existingContent, enabled);
  }
  return mergeGroupedHarnessHooks(harness, existingContent, enabled);
}

export function checkHarnessHooksConfig(
  harness: HarnessId,
  existingContent: string | undefined,
): HookCheckFinding[] {
  const path = HOOK_CONFIG_PATHS[harness];
  if (existingContent === undefined) {
    return [
      {
        path,
        code: "hooks_missing",
        message: `Expected Forgix hooks configuration at ${path} for harness "${harness}".`,
      },
    ];
  }

  const parsed = parseJsonObject(existingContent, path);
  if (!parsed.ok) {
    return [
      {
        path,
        code: "hooks_json_invalid",
        message: parsed.conflict.message,
      },
    ];
  }

  const findings: HookCheckFinding[] = [];
  if (harness === "antigravity") {
    const forgixSection = parsed.value.forgix;
    if (!isRecord(forgixSection)) {
      return [
        {
          path,
          code: "hooks_drift",
          message: `${path} is missing the top-level "forgix" hook configuration.`,
        },
      ];
    }
    for (const spec of HARNESS_HOOK_EVENTS.antigravity) {
      const expectedCommand = buildHookCommand("antigravity", spec.event);
      const eventEntries = forgixSection[spec.nativeName];
      const matched =
        spec.nativeName === "PreToolUse"
          ? hasGroupedHookCommand(eventEntries, harness, buildGroupedEntry(harness, spec))
          : hasFlatHookCommand(eventEntries, expectedCommand);
      if (!matched) {
        findings.push({
          path,
          code: "hooks_drift",
          message: `${path} is missing or has stale Forgix hook for antigravity:${spec.nativeName}.`,
        });
      }
    }
    return findings;
  }

  const hooksSection = parsed.value.hooks;
  if (!isRecord(hooksSection)) {
    return [
      {
        path,
        code: "hooks_drift",
        message: `${path} is missing the "hooks" object for harness "${harness}".`,
      },
    ];
  }

  for (const spec of HARNESS_HOOK_EVENTS[harness]) {
    const eventEntries = hooksSection[spec.nativeName];
    if (!hasGroupedHookCommand(eventEntries, harness, buildGroupedEntry(harness, spec))) {
      findings.push({
        path,
        code: "hooks_drift",
        message: `${path} is missing or has stale Forgix hook for ${harness}:${spec.nativeName}.`,
      });
    }
  }
  return findings;
}

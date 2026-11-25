import { isAbsolute } from "node:path";
import type { HarnessId, HookEvent, HookRunResult } from "../types.js";

export interface NormalizedToolCall {
  name: string;
  normalizedName: string;
  command?: string;
  filePaths: string[];
  addedDiffText?: string;
}

export interface NormalizedHookInput {
  cwd?: string;
  nativeWriteRef?: string;
  toolCall?: NormalizedToolCall;
  parseError?: string;
}

const SHELL_TOOL_NAMES = new Set([
  "bash",
  "shell",
  "exec_command",
  "run_command",
  "terminal",
  "command",
  "shell_command",
]);

const FILE_WRITE_TOOL_NAMES = new Set([
  "write",
  "edit",
  "multiedit",
  "notebookedit",
  "write_file",
  "edit_file",
  "write_to_file",
  "replace_file_content",
  "multi_replace_file_content",
  "apply_patch",
  "create_file",
  "delete_file",
  "patch_file",
  "str_replace_editor",
  "str_replace_based_edit_tool",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function extractPatchFilePaths(patchText: string): string[] {
  const paths = new Set<string>();
  for (const line of patchText.split(/\r?\n/)) {
    const codexMatch = /^\*\*\* (?:Update|Add|Delete) File:\s*(.+)$/.exec(line);
    if (codexMatch?.[1]) {
      paths.add(codexMatch[1].trim());
      continue;
    }
    const moveMatch = /^\*\*\* Move to:\s*(.+)$/.exec(line);
    if (moveMatch?.[1]) {
      paths.add(moveMatch[1].trim());
      continue;
    }
    const unifiedMatch = /^\+\+\+\s+(?:b\/)?(.+)$/.exec(line);
    if (unifiedMatch?.[1] && unifiedMatch[1].trim() !== "/dev/null") {
      paths.add(unifiedMatch[1].trim());
    }
  }
  return [...paths];
}

function normalizePatchForEscapeScan(patchText: string): string {
  return patchText
    .split(/\r?\n/)
    .map((line) => {
      const codexFile = /^\*\*\* (?:Update|Add) File:\s*(.+)$/.exec(line);
      if (codexFile?.[1]) return `+++ b/${codexFile[1].trim()}`;
      return line;
    })
    .join("\n");
}

function synthesizeAddedDiff(filePath: string | undefined, content: string): string {
  const header = `+++ b/${filePath ?? "unknown"}`;
  const addedLines = content.split(/\r?\n/).map((line) => `+${line}`);
  return [header, ...addedLines].join("\n");
}

function extractToolCall(
  harness: HarnessId,
  payload: Record<string, unknown>,
): NormalizedToolCall | undefined {
  let rawName: string | undefined;
  let args: Record<string, unknown> | undefined;

  if (harness === "antigravity") {
    if (isRecord(payload.toolCall)) {
      rawName = firstString(payload.toolCall, ["name"]);
      if (isRecord(payload.toolCall.args)) args = payload.toolCall.args;
    }
  } else {
    rawName = firstString(payload, ["tool_name", "toolName"]);
    if (isRecord(payload.tool_input)) {
      args = payload.tool_input;
    } else if (isRecord(payload.toolInput)) {
      args = payload.toolInput;
    }
  }

  if (!rawName && !args) return undefined;
  const name = rawName ?? "";
  const normalizedName = name.trim().toLowerCase();
  const safeArgs = args ?? {};

  const command = SHELL_TOOL_NAMES.has(normalizedName)
    ? firstString(safeArgs, ["command", "CommandLine", "cmd"])
    : undefined;

  const filePaths: string[] = [];
  let addedDiffText: string | undefined;

  if (FILE_WRITE_TOOL_NAMES.has(normalizedName)) {
    const directPath = firstString(safeArgs, [
      "file_path",
      "filePath",
      "Path",
      "TargetFile",
      "path",
      "target_path",
      "notebook_path",
    ]);
    if (directPath) filePaths.push(directPath);

    const patchText =
      normalizedName === "apply_patch"
        ? firstString(safeArgs, ["patch", "input", "raw_input", "content"])
        : firstString(safeArgs, ["patch"]);

    if (patchText) {
      for (const patchPath of extractPatchFilePaths(patchText)) {
        if (!filePaths.includes(patchPath)) filePaths.push(patchPath);
      }
      addedDiffText = normalizePatchForEscapeScan(patchText);
    } else {
      const addedParts: string[] = [];
      const singleContent = firstString(safeArgs, [
        "content",
        "Content",
        "CodeContent",
        "new_string",
        "new_source",
        "Replacement",
        "ReplacementContent",
      ]);
      if (singleContent) addedParts.push(singleContent);

      if (Array.isArray(safeArgs.edits)) {
        for (const edit of safeArgs.edits) {
          if (isRecord(edit)) {
            const replacement = firstString(edit, ["new_string", "content", "ReplacementContent"]);
            if (replacement) addedParts.push(replacement);
          }
        }
      }
      if (Array.isArray(safeArgs.ReplacementChunks)) {
        for (const chunk of safeArgs.ReplacementChunks) {
          if (isRecord(chunk)) {
            const replacement = firstString(chunk, ["ReplacementContent"]);
            if (replacement) addedParts.push(replacement);
          }
        }
      }

      if (addedParts.length > 0) {
        addedDiffText = synthesizeAddedDiff(directPath, addedParts.join("\n"));
      }
    }
  }

  return {
    name,
    normalizedName,
    ...(command !== undefined ? { command } : {}),
    filePaths,
    ...(addedDiffText !== undefined ? { addedDiffText } : {}),
  };
}

export function parseHookInput(harness: HarnessId, rawInput: string): NormalizedHookInput {
  const trimmed = rawInput.trim();
  if (!trimmed) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { parseError: "Malformed JSON hook payload on stdin." };
  }

  if (!isRecord(parsed)) {
    return { parseError: "Hook payload on stdin must be a JSON object." };
  }

  const cwd = firstString(parsed, ["cwd"]);

  const toolCall = extractToolCall(harness, parsed);
  return {
    ...(cwd !== undefined && isAbsolute(cwd) ? { cwd } : {}),
    ...(typeof parsed.tool_use_id === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9.:_-]{0,127}$/.test(parsed.tool_use_id)
      ? { nativeWriteRef: parsed.tool_use_id }
      : {}),
    ...(toolCall !== undefined ? { toolCall } : {}),
  };
}

export function formatSessionStartResult(harness: HarnessId, message: string): HookRunResult {
  if (!message) {
    return { stdout: "{}", exitCode: 0 };
  }
  if (harness === "antigravity") {
    return {
      stdout: JSON.stringify({
        injectSteps: [{ systemMessage: { systemMessage: message } }],
      }),
      exitCode: 0,
    };
  }
  return {
    stdout: JSON.stringify({ systemMessage: message }),
    exitCode: 0,
  };
}

export function formatPreToolUseResult(
  harness: HarnessId,
  outcome: { decision: "allow" | "warn" | "deny"; reason?: string },
): HookRunResult {
  if (harness === "antigravity") {
    if (outcome.decision === "deny") {
      return {
        stdout: JSON.stringify({
          decision: "deny",
          reason: outcome.reason ?? "Blocked by Forgix hook guardrail.",
        }),
        exitCode: 0,
      };
    }
    if (outcome.decision === "warn" && outcome.reason) {
      return {
        stdout: JSON.stringify({
          decision: "allow",
          reason: outcome.reason,
        }),
        exitCode: 0,
      };
    }
    return {
      stdout: JSON.stringify({ decision: "allow" }),
      exitCode: 0,
    };
  }

  if (outcome.decision === "deny") {
    return {
      stdout: "",
      stderr: outcome.reason ?? "Blocked by Forgix hook guardrail.",
      exitCode: 2,
    };
  }
  if (outcome.decision === "warn" && outcome.reason) {
    return {
      stdout: JSON.stringify({ systemMessage: outcome.reason }),
      exitCode: 0,
    };
  }
  return { stdout: "{}", exitCode: 0 };
}

export function formatPostCheckResult(
  harness: HarnessId,
  outcome: { status: "clean" | "warn" | "block"; message?: string },
): HookRunResult {
  if (outcome.status === "clean" || !outcome.message) {
    return { stdout: "{}", exitCode: 0 };
  }

  if (harness === "antigravity") {
    if (outcome.status === "block") {
      return {
        stdout: JSON.stringify({
          injectSteps: [{ errorMessage: { userMessage: outcome.message } }],
          terminationBehavior: "terminate",
        }),
        exitCode: 0,
      };
    }
    return {
      stdout: JSON.stringify({
        injectSteps: [{ systemMessage: { systemMessage: outcome.message } }],
      }),
      exitCode: 0,
    };
  }

  if (outcome.status === "block") {
    return {
      stdout: "",
      stderr: outcome.message,
      exitCode: 2,
    };
  }
  return {
    stdout: JSON.stringify({ systemMessage: outcome.message }),
    exitCode: 0,
  };
}

export function formatFailOpenResult(
  harness: HarnessId,
  event: HookEvent,
  warning?: string,
): HookRunResult {
  if (event === "session-start" && warning) {
    return formatSessionStartResult(harness, `Forgix hook warning (fail-open): ${warning}`);
  }
  return { stdout: "{}", exitCode: 0 };
}

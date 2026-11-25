import type { HarnessId } from "../types.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isForgixHookCommand(command: string, harness: HarnessId): boolean {
  const pattern = new RegExp(
    `\\b(?:forgix|FORGIX_CLI_PATH)\\b[^\\n]*\\bhook\\s+${harness}\\s+(session-start|pre-tool-use|post-tool-use|post-invocation)\\b`,
  );
  return pattern.test(command);
}

export function hasFlatHookCommand(entries: unknown, expectedCommand: string): boolean {
  if (!Array.isArray(entries) || entries.length !== 1) return false;
  const [entry]: unknown[] = entries;
  return isRecord(entry) && entry.type === "command" && entry.command === expectedCommand;
}

export function hasGroupedHookCommand(
  entries: unknown,
  harness: HarnessId,
  expected: { matcher?: string; hooks: readonly { command: string }[] },
): boolean {
  if (!Array.isArray(entries)) return false;
  const owned = entries.flatMap((group: unknown) => {
    if (!isRecord(group) || !Array.isArray(group.hooks)) return [];
    return group.hooks
      .filter(
        (hook: unknown) =>
          isRecord(hook) &&
          typeof hook.command === "string" &&
          isForgixHookCommand(hook.command, harness),
      )
      .map((hook: unknown) => ({ hook, matcher: group.matcher }));
  });
  const [entry] = owned;
  return (
    owned.length === 1 &&
    entry !== undefined &&
    entry.matcher === expected.matcher &&
    isRecord(entry.hook) &&
    entry.hook.type === "command" &&
    entry.hook.command === expected.hooks[0]?.command
  );
}

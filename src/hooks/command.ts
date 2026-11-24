import type { HarnessId, HookEvent } from "../types.js";

export type NativeHookEventName = "SessionStart" | "PreToolUse" | "PostToolUse" | "PostInvocation";

export interface HarnessHookEventSpec {
  readonly event: HookEvent;
  readonly nativeName: NativeHookEventName;
}

export const HOOK_EVENT_NATIVE_NAMES: Readonly<Record<HookEvent, NativeHookEventName>> = {
  "session-start": "SessionStart",
  "pre-tool-use": "PreToolUse",
  "post-tool-use": "PostToolUse",
  "post-invocation": "PostInvocation",
};

export const HARNESS_HOOK_EVENTS: Readonly<Record<HarnessId, readonly HarnessHookEventSpec[]>> = {
  codex: [
    { event: "session-start", nativeName: "SessionStart" },
    { event: "pre-tool-use", nativeName: "PreToolUse" },
    { event: "post-tool-use", nativeName: "PostToolUse" },
  ],
  claude: [
    { event: "session-start", nativeName: "SessionStart" },
    { event: "pre-tool-use", nativeName: "PreToolUse" },
    { event: "post-tool-use", nativeName: "PostToolUse" },
  ],
  antigravity: [
    { event: "session-start", nativeName: "SessionStart" },
    { event: "pre-tool-use", nativeName: "PreToolUse" },
    { event: "post-invocation", nativeName: "PostInvocation" },
  ],
};

const FALLBACK_INSTALL_WARNING =
  "Forgix lifecycle hooks require Node and a pinned installed skill bundle (v2). Run Forgix init (or set FORGIX_CLI_PATH) and reload before BUILD.";

export function isSupportedHarnessHookEvent(harness: HarnessId, event: HookEvent): boolean {
  const specs = HARNESS_HOOK_EVENTS[harness];
  return Array.isArray(specs) && specs.some((spec) => spec.event === event);
}

function buildFallbackPayload(harness: HarnessId, event: HookEvent): string {
  if (event !== "session-start") return "{}";
  if (harness === "antigravity") {
    return JSON.stringify({
      injectSteps: [
        {
          systemMessage: {
            systemMessage: FALLBACK_INSTALL_WARNING,
          },
        },
      ],
    });
  }
  return JSON.stringify({ systemMessage: FALLBACK_INSTALL_WARNING });
}

function escapePosixDoubleQuoted(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("$", "\\$")
    .replaceAll("`", "\\`");
}

export function buildHookCommand(harness: HarnessId, event: HookEvent): string {
  if (!isSupportedHarnessHookEvent(harness, event)) {
    throw new RangeError(`Unsupported hook event "${event}" for harness "${harness}".`);
  }

  const invocation = `hook ${harness} ${event}`;
  const fallbackJson = escapePosixDoubleQuoted(buildFallbackPayload(harness, event));

  const pinLookup = [
    '_p="${FORGIX_CLI_PATH:-}"',
    `if [ -z "$_p" ]; then _d="\${XDG_CONFIG_HOME:-\${HOME:+$HOME/.config}}"; case "$_d" in /*) [ -f "$_d/forgix/cli-path.${harness}" ] && IFS= read -r _p < "$_d/forgix/cli-path.${harness}" ;; esac; fi`,
    ...(harness === "antigravity"
      ? [
          'if [ -z "$_p" ]; then case "${HOME:-}" in /*) _p="$HOME/.gemini/config/plugins/forgix/dist/forgix.mjs" ;; esac; fi',
        ]
      : []),
    `case "$_p" in /*) if [ -f "$_p" ] && command -v node >/dev/null 2>&1; then exec node "$_p" ${invocation}; fi ;; esac`,
    `printf "%s\\n" "${fallbackJson}"`,
    "exit 0",
  ].join("; ");

  return `sh -c '${pinLookup}'`;
}

import { InvocationError } from "../core/schema.js";
import { HARNESS_IDS, type HarnessId, type HarnessPreference } from "../types.js";

export type ParsedInitInvocation =
  | { command: "init_plan"; adopt?: boolean; harness?: HarnessPreference }
  | { command: "init_apply"; adopt?: boolean; harness?: HarnessPreference }
  | { command: "init_check"; harness?: HarnessPreference }
  | { command: "init_check_build"; targetHarness: HarnessId; harness?: HarnessPreference };

export function parseInitInvocation(
  rest: string[],
  harnessField: { harness?: HarnessPreference },
): ParsedInitInvocation {
  if (rest.length === 0) {
    throw new InvocationError(
      "Forgix is an agent-first plugin and does not provide an interactive terminal wizard. Run $forgix init (Codex), /forgix:forgix init (Claude Code), or /forgix init (Antigravity) inside your AI agent. For deterministic backend operations, use: forgix init plan|apply|check.",
    );
  }
  if (rest[0] === "check" && rest.length === 1) {
    return { command: "init_check", ...harnessField };
  }
  if (
    (rest[0] === "plan" || rest[0] === "apply") &&
    (rest.length === 1 || (rest.length === 2 && rest[1] === "--adopt"))
  ) {
    return {
      command: `init_${rest[0]}`,
      ...(rest[1] === "--adopt" ? { adopt: true } : {}),
      ...harnessField,
    };
  }
  const targetHarness = rest[1];
  if (
    rest[0] === "check-build" &&
    rest.length === 2 &&
    targetHarness &&
    (HARNESS_IDS as readonly string[]).includes(targetHarness)
  ) {
    return {
      command: "init_check_build",
      targetHarness: targetHarness as HarnessId,
      ...harnessField,
    };
  }
  throw new InvocationError(
    "Usage: forgix init plan|apply [--adopt] | init check | init check-build <codex|claude|antigravity>",
  );
}

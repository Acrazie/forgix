import { EXIT_CODES } from "./exit-codes.js";
import { HARNESS_IDS, type HarnessPreference } from "./types.js";

const VALID_HARNESS_VALUES = new Set<string>(["auto", ...HARNESS_IDS]);

export type ParsedInvocation =
  | { command: "help"; harness?: HarnessPreference }
  | { command: "init"; harness?: HarnessPreference }
  | {
      command: "run";
      objective: string;
      flags: { benchmark?: true };
      harness?: HarnessPreference;
    }
  | { command: "resume"; taskId: string; harness?: HarnessPreference }
  | { command: "status"; taskId: string | undefined; harness?: HarnessPreference }
  | { command: "benchmark_summary"; harness?: HarnessPreference }
  | { command: "config_show"; explain: boolean; harness?: HarnessPreference }
  | { command: "config_validate"; json: boolean; harness?: HarnessPreference }
  | {
      command:
        | "project_profile_inspect"
        | "project_profile_view"
        | "project_profile_validate"
        | "project_profile_publish";
      local: boolean;
      harness?: HarnessPreference;
    }
  | { command: "project_profile_session_view"; harness?: HarnessPreference }
  | { command: "project_profile_session_save"; harness?: HarnessPreference }
  | { command: "project_profile_session_clear"; harness?: HarnessPreference }
  | { command: "roadmap_session_view"; format?: "tree" | "mermaid"; harness?: HarnessPreference }
  | { command: "roadmap_session_save"; harness?: HarnessPreference }
  | { command: "roadmap_session_clear"; harness?: HarnessPreference }
  | { command: "roadmap_validate"; session: boolean; harness?: HarnessPreference }
  | { command: "roadmap_publish_plan"; harness?: HarnessPreference }
  | { command: "roadmap_publish_record"; harness?: HarnessPreference }
  | {
      command: "roadmap_select_ready";
      limit?: number;
      maxRisk?: "low" | "medium" | "all";
      requireIssueNumber: boolean;
      harness?: HarnessPreference;
    };

export class InvocationError extends Error {
  readonly exitCode = EXIT_CODES.INVALID_INVOCATION;
}

function invalid(message: string): never {
  throw new InvocationError(message);
}

function parseHarnessValue(value: string | undefined): HarnessPreference {
  if (!value || !VALID_HARNESS_VALUES.has(value)) {
    invalid(`Invalid --harness value. Expected one of: auto, ${HARNESS_IDS.join(", ")}.`);
  }
  return value as HarnessPreference;
}

function extractLeadingRunOptions(argv: string[]): {
  benchmark: boolean;
  harness?: HarnessPreference;
  remaining: string[];
} {
  let benchmark = false;
  let harness: HarnessPreference | undefined;
  let index = 0;

  while (index < argv.length) {
    const token = argv[index]!;
    if (token === "--benchmark") {
      if (benchmark) {
        invalid("Duplicate --benchmark flag.");
      }
      benchmark = true;
      index += 1;
      continue;
    }
    if (token === "--harness") {
      if (harness !== undefined) {
        invalid("Duplicate --harness flag.");
      }
      harness = parseHarnessValue(argv[index + 1]);
      index += 2;
      continue;
    }
    if (token.startsWith("--harness=")) {
      if (harness !== undefined) {
        invalid("Duplicate --harness flag.");
      }
      harness = parseHarnessValue(token.slice("--harness=".length));
      index += 1;
      continue;
    }
    break;
  }

  return {
    benchmark,
    ...(harness ? { harness } : {}),
    remaining: argv.slice(index),
  };
}

function extractTrailingHarness(
  args: string[],
  existingHarness: HarnessPreference | undefined,
): { harness?: HarnessPreference; remaining: string[] } {
  let harness = existingHarness;
  const remaining: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (token === "--harness") {
      if (harness !== undefined) {
        invalid("Duplicate --harness flag.");
      }
      harness = parseHarnessValue(args[index + 1]);
      index += 1;
      continue;
    }
    if (token.startsWith("--harness=")) {
      if (harness !== undefined) {
        invalid("Duplicate --harness flag.");
      }
      harness = parseHarnessValue(token.slice("--harness=".length));
      continue;
    }
    remaining.push(token);
  }

  return {
    ...(harness ? { harness } : {}),
    remaining,
  };
}

export function parseInvocation(argv: string[]): ParsedInvocation {
  if (argv.length === 0) {
    invalid("An objective or subcommand is required.");
  }

  const leading = extractLeadingRunOptions(argv);
  const tokens = leading.remaining;
  if (tokens.length === 0) {
    invalid("An objective or subcommand is required.");
  }

  const [first, ...rawRest] = tokens;
  if (!first) {
    invalid("An objective or subcommand is required.");
  }

  const isKnownSubcommand =
    first === "--help" ||
    first === "init" ||
    first === "resume" ||
    first === "status" ||
    first === "benchmark" ||
    first === "config" ||
    first === "project-profile" ||
    first === "roadmap";

  if (isKnownSubcommand && leading.benchmark) {
    invalid("--benchmark is only supported when starting a run.");
  }

  if (isKnownSubcommand) {
    const extracted = extractTrailingHarness(rawRest, leading.harness);
    const rest = extracted.remaining;
    const harnessField = extracted.harness ? { harness: extracted.harness } : {};

    if (first === "--help") {
      if (rest.length !== 0) invalid("help accepts no arguments.");
      return { command: "help", ...harnessField };
    }

    if (first === "init") {
      if (rest.length !== 0) invalid("init accepts no arguments.");
      return { command: "init", ...harnessField };
    }

    if (first === "resume") {
      if (rest.length !== 1 || !rest[0]) invalid("resume requires exactly one task id.");
      return { command: "resume", taskId: rest[0], ...harnessField };
    }

    if (first === "status") {
      if (rest.length > 1) invalid("status accepts at most one task id.");
      return { command: "status", taskId: rest[0], ...harnessField };
    }

    if (first === "benchmark") {
      if (rest.length === 1 && rest[0] === "summary") {
        return { command: "benchmark_summary", ...harnessField };
      }
      invalid("benchmark requires exactly the summary subcommand.");
    }

    if (first === "config") {
      const [subcommand, ...flags] = rest;
      if (
        subcommand === "show" &&
        (flags.length === 0 || (flags.length === 1 && flags[0] === "--explain"))
      ) {
        return { command: "config_show", explain: flags[0] === "--explain", ...harnessField };
      }
      if (
        subcommand === "validate" &&
        (flags.length === 0 || (flags.length === 1 && flags[0] === "--json"))
      ) {
        return { command: "config_validate", json: flags[0] === "--json", ...harnessField };
      }
      invalid("Invalid config invocation.");
    }

    if (first === "project-profile") {
      const [subcommand, ...flags] = rest;
      const local = flags.length === 1 && flags[0] === "--local";
      if (flags.length !== 0 && !local) invalid("Invalid project-profile invocation.");
      if (subcommand === "inspect" && flags.length === 0) {
        return { command: "project_profile_inspect", local: false, ...harnessField };
      }
      if (subcommand === "view") return { command: "project_profile_view", local, ...harnessField };
      if (subcommand === "validate")
        return { command: "project_profile_validate", local, ...harnessField };
      if (subcommand === "publish")
        return { command: "project_profile_publish", local, ...harnessField };
      if (subcommand === "session-view" && flags.length === 0) {
        return { command: "project_profile_session_view", ...harnessField };
      }
      if (subcommand === "session-save" && flags.length === 0) {
        return { command: "project_profile_session_save", ...harnessField };
      }
      if (subcommand === "session-clear" && flags.length === 0) {
        return { command: "project_profile_session_clear", ...harnessField };
      }
      invalid("Invalid project-profile invocation.");
    }

    if (first === "roadmap") {
      const [subcommand, ...flags] = rest;
      if (subcommand === "session-view") {
        let format: "tree" | "mermaid" | undefined;
        for (const flag of flags) {
          if (flag === "--format=tree" || flag === "--tree") format = "tree";
          else if (flag === "--format=mermaid" || flag === "--mermaid") format = "mermaid";
          else invalid("Invalid roadmap session-view flag.");
        }
        return format
          ? { command: "roadmap_session_view", format, ...harnessField }
          : { command: "roadmap_session_view", ...harnessField };
      }
      if (subcommand === "session-save" && flags.length === 0) {
        return { command: "roadmap_session_save", ...harnessField };
      }
      if (subcommand === "session-clear" && flags.length === 0) {
        return { command: "roadmap_session_clear", ...harnessField };
      }
      if (subcommand === "validate") {
        if (flags.length === 0) {
          return { command: "roadmap_validate", session: false, ...harnessField };
        }
        if (flags.length === 1 && flags[0] === "--session") {
          return { command: "roadmap_validate", session: true, ...harnessField };
        }
        invalid("Invalid roadmap validate flag.");
      }
      if (subcommand === "publish-plan" && flags.length === 0) {
        return { command: "roadmap_publish_plan", ...harnessField };
      }
      if (subcommand === "publish-record" && flags.length === 0) {
        return { command: "roadmap_publish_record", ...harnessField };
      }
      if (subcommand === "select-ready") {
        let limit: number | undefined;
        let maxRisk: "low" | "medium" | "all" | undefined;
        let requireIssueNumber = false;
        for (const flag of flags) {
          if (flag.startsWith("--limit=")) {
            const parsed = Number(flag.slice("--limit=".length));
            if (!Number.isInteger(parsed) || parsed < 1) {
              invalid("Invalid --limit value.");
            }
            limit = parsed;
          } else if (
            flag === "--max-risk=low" ||
            flag === "--max-risk=medium" ||
            flag === "--max-risk=all"
          ) {
            maxRisk = flag.slice("--max-risk=".length) as "low" | "medium" | "all";
          } else if (flag === "--require-issue") {
            requireIssueNumber = true;
          } else {
            invalid("Invalid roadmap select-ready flag.");
          }
        }
        return {
          command: "roadmap_select_ready",
          ...(limit !== undefined ? { limit } : {}),
          ...(maxRisk !== undefined ? { maxRisk } : {}),
          requireIssueNumber,
          ...harnessField,
        };
      }
      invalid("Invalid roadmap invocation.");
    }
  }

  if (tokens.length === 0 || tokens.some((part) => part.startsWith("--"))) {
    invalid("A run requires an objective and no unsupported flags.");
  }
  return {
    command: "run",
    objective: tokens.join(" "),
    flags: leading.benchmark ? { benchmark: true } : {},
    ...(leading.harness ? { harness: leading.harness } : {}),
  };
}

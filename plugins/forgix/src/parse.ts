import { EXIT_CODES } from "./exit-codes.js";

export type ParsedInvocation =
  | { command: "help" }
  | { command: "init" }
  | { command: "run"; objective: string; flags: { benchmark?: true } }
  | { command: "resume"; taskId: string }
  | { command: "status"; taskId: string | undefined }
  | { command: "benchmark_summary" }
  | { command: "config_show"; explain: boolean }
  | { command: "config_validate"; json: boolean }
  | {
      command:
        | "project_profile_inspect"
        | "project_profile_view"
        | "project_profile_validate"
        | "project_profile_publish";
      local: boolean;
    }
  | { command: "project_profile_session_view" }
  | { command: "project_profile_session_save" }
  | { command: "project_profile_session_clear" }
  | { command: "roadmap_session_view"; format?: "tree" | "mermaid" }
  | { command: "roadmap_session_save" }
  | { command: "roadmap_session_clear" }
  | { command: "roadmap_validate"; session: boolean }
  | { command: "roadmap_publish_plan" }
  | { command: "roadmap_publish_record" }
  | {
      command: "roadmap_select_ready";
      limit?: number;
      maxRisk?: "low" | "medium" | "all";
      requireIssueNumber: boolean;
    };

export class InvocationError extends Error {
  readonly exitCode = EXIT_CODES.INVALID_INVOCATION;
}

function invalid(message: string): never {
  throw new InvocationError(message);
}

export function parseInvocation(argv: string[]): ParsedInvocation {
  if (argv.length === 0) {
    invalid("An objective or subcommand is required.");
  }

  const [first, ...rest] = argv;
  if (!first) {
    invalid("An objective or subcommand is required.");
  }

  if (first === "--help") {
    if (rest.length !== 0) invalid("help accepts no arguments.");
    return { command: "help" };
  }

  if (first === "init") {
    if (rest.length !== 0) invalid("init accepts no arguments.");
    return { command: "init" };
  }

  if (first === "resume") {
    if (rest.length !== 1 || !rest[0]) invalid("resume requires exactly one task id.");
    return { command: "resume", taskId: rest[0] };
  }

  if (first === "status") {
    if (rest.length > 1) invalid("status accepts at most one task id.");
    return { command: "status", taskId: rest[0] };
  }

  if (first === "benchmark") {
    if (rest.length === 1 && rest[0] === "summary") return { command: "benchmark_summary" };
    invalid("benchmark requires exactly the summary subcommand.");
  }

  if (first === "config") {
    const [subcommand, ...flags] = rest;
    if (
      subcommand === "show" &&
      (flags.length === 0 || (flags.length === 1 && flags[0] === "--explain"))
    ) {
      return { command: "config_show", explain: flags[0] === "--explain" };
    }
    if (
      subcommand === "validate" &&
      (flags.length === 0 || (flags.length === 1 && flags[0] === "--json"))
    ) {
      return { command: "config_validate", json: flags[0] === "--json" };
    }
    invalid("Invalid config invocation.");
  }

  if (first === "project-profile") {
    const [subcommand, ...flags] = rest;
    const local = flags.length === 1 && flags[0] === "--local";
    if (flags.length !== 0 && !local) invalid("Invalid project-profile invocation.");
    if (subcommand === "inspect" && flags.length === 0) {
      return { command: "project_profile_inspect", local: false };
    }
    if (subcommand === "view") return { command: "project_profile_view", local };
    if (subcommand === "validate") return { command: "project_profile_validate", local };
    if (subcommand === "publish") return { command: "project_profile_publish", local };
    if (subcommand === "session-view" && flags.length === 0) {
      return { command: "project_profile_session_view" };
    }
    if (subcommand === "session-save" && flags.length === 0) {
      return { command: "project_profile_session_save" };
    }
    if (subcommand === "session-clear" && flags.length === 0) {
      return { command: "project_profile_session_clear" };
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
        ? { command: "roadmap_session_view", format }
        : { command: "roadmap_session_view" };
    }
    if (subcommand === "session-save" && flags.length === 0) {
      return { command: "roadmap_session_save" };
    }
    if (subcommand === "session-clear" && flags.length === 0) {
      return { command: "roadmap_session_clear" };
    }
    if (subcommand === "validate") {
      if (flags.length === 0) return { command: "roadmap_validate", session: false };
      if (flags.length === 1 && flags[0] === "--session") {
        return { command: "roadmap_validate", session: true };
      }
      invalid("Invalid roadmap validate flag.");
    }
    if (subcommand === "publish-plan" && flags.length === 0) {
      return { command: "roadmap_publish_plan" };
    }
    if (subcommand === "publish-record" && flags.length === 0) {
      return { command: "roadmap_publish_record" };
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
      };
    }
    invalid("Invalid roadmap invocation.");
  }

  const benchmark = first === "--benchmark";
  const runArgs = benchmark ? rest : argv;
  if (runArgs.length === 0 || runArgs.some((part) => part.startsWith("--"))) {
    invalid("A run requires an objective and no unsupported flags.");
  }
  return {
    command: "run",
    objective: runArgs.join(" "),
    flags: benchmark ? { benchmark: true } : {},
  };
}

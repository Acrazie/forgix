import { EXIT_CODES } from "./exit-codes.js";
import type { TaskMode } from "./types.js";

export type ParsedInvocation =
  | { command: "init" }
  | { command: "run"; mode: TaskMode | undefined; objective: string; flags: { benchmark?: true } }
  | { command: "resume"; taskId: string }
  | { command: "status"; taskId: string | undefined }
  | { command: "benchmark_summary" }
  | { command: "config_show"; explain: boolean }
  | { command: "config_validate"; json: boolean };

export class InvocationError extends Error {
  readonly exitCode = EXIT_CODES.INVALID_INVOCATION;
}

const MODES = new Set<TaskMode>(["quick", "standard", "critical"]);

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
    if (subcommand === "show" && (flags.length === 0 || (flags.length === 1 && flags[0] === "--explain"))) {
      return { command: "config_show", explain: flags[0] === "--explain" };
    }
    if (subcommand === "validate" && (flags.length === 0 || (flags.length === 1 && flags[0] === "--json"))) {
      return { command: "config_validate", json: flags[0] === "--json" };
    }
    invalid("Invalid config invocation.");
  }

  const benchmark = first === "--benchmark";
  const runArgs = benchmark ? rest : argv;
  const runFirst = runArgs[0];
  const mode = MODES.has(runFirst as TaskMode) ? (runFirst as TaskMode) : undefined;
  const objectiveParts = mode ? runArgs.slice(1) : runArgs;
  if (objectiveParts.length === 0 || objectiveParts.some((part) => part.startsWith("--"))) {
    invalid("A run requires an objective and no unsupported flags.");
  }
  return { command: "run", mode, objective: objectiveParts.join(" "), flags: benchmark ? { benchmark: true } : {} };
}

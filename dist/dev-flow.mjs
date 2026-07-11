// src/cli.ts
import { pathToFileURL } from "node:url";

// src/exit-codes.ts
var EXIT_CODES = {
  SUCCESS: 0,
  INVALID_INVOCATION: 2,
  INVALID_CONFIGURATION: 3,
  POLICY_CONTRADICTION: 4,
  STATE_CONFLICT: 5,
  BLOCKED: 6,
  HANDOFF_REQUIRED: 7,
  INTERNAL_ERROR: 10
};

// src/parse.ts
var InvocationError = class extends Error {
  exitCode = EXIT_CODES.INVALID_INVOCATION;
};
var MODES = /* @__PURE__ */ new Set(["quick", "standard", "critical"]);
function invalid(message) {
  throw new InvocationError(message);
}
function parseInvocation(argv) {
  if (argv.length === 0) {
    invalid("An objective or subcommand is required.");
  }
  const [first, ...rest] = argv;
  if (!first) {
    invalid("An objective or subcommand is required.");
  }
  if (first === "resume") {
    if (rest.length !== 1 || !rest[0]) invalid("resume requires exactly one task id.");
    return { command: "resume", taskId: rest[0] };
  }
  if (first === "status") {
    if (rest.length > 1) invalid("status accepts at most one task id.");
    return { command: "status", taskId: rest[0] };
  }
  if (first === "config") {
    const [subcommand, ...flags] = rest;
    if (subcommand === "show" && (flags.length === 0 || flags.length === 1 && flags[0] === "--explain")) {
      return { command: "config_show", explain: flags[0] === "--explain" };
    }
    if (subcommand === "validate" && (flags.length === 0 || flags.length === 1 && flags[0] === "--json")) {
      return { command: "config_validate", json: flags[0] === "--json" };
    }
    invalid("Invalid config invocation.");
  }
  const mode = MODES.has(first) ? first : void 0;
  const objectiveParts = mode ? rest : argv;
  if (objectiveParts.length === 0 || objectiveParts.some((part) => part.startsWith("--"))) {
    invalid("A run requires an objective and no unsupported flags.");
  }
  return { command: "run", mode, objective: objectiveParts.join(" "), flags: {} };
}

// src/cli.ts
function main(argv = process.argv.slice(2)) {
  try {
    process.stdout.write(JSON.stringify({ command: "dev-flow", status: "parsed", data: parseInvocation(argv) }) + "\n");
  } catch (error) {
    const exitCode = error instanceof InvocationError ? error.exitCode : EXIT_CODES.INTERNAL_ERROR;
    process.stderr.write((error instanceof Error ? error.message : "Unexpected error.") + "\n");
    process.exitCode = exitCode;
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
export {
  EXIT_CODES,
  InvocationError,
  main,
  parseInvocation
};

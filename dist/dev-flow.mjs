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

// src/config.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function copy(value) {
  if (Array.isArray(value)) return value.map(copy);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry)]));
  return value;
}
function merge(target, incoming, source, provenance, prefix = "") {
  for (const [key, incomingValue] of Object.entries(incoming)) {
    const path = prefix ? prefix + "." + key : key;
    const targetValue = target[key];
    if (isRecord(targetValue) && isRecord(incomingValue)) {
      merge(targetValue, incomingValue, source, provenance, path);
      continue;
    }
    target[key] = copy(incomingValue);
    if (isRecord(incomingValue)) {
      for (const nested of Object.keys(incomingValue)) {
        provenance[path + "." + nested] = source;
      }
    } else {
      provenance[path] = source;
    }
  }
}
function resolveConfig(sources) {
  const value = {};
  const provenance = {};
  for (const source of sources) merge(value, source.value, source.source, provenance);
  return { value, provenance };
}

// src/policy.ts
var PolicyError = class extends Error {
  constructor(message, path, source) {
    super(message);
    this.path = path;
    this.source = source;
  }
  path;
  source;
  exitCode = EXIT_CODES.POLICY_CONTRADICTION;
};
function readPath(value, path) {
  return path.split(".").reduce((current, segment) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return void 0;
    return current[segment];
  }, value);
}
function applyPolicy(config, policy) {
  for (const [path, required] of Object.entries(policy.requirements)) {
    if (readPath(config.value, path) !== required) {
      throw new PolicyError(
        "Policy requires " + path + " to be " + JSON.stringify(required) + ".",
        path,
        config.provenance[path]
      );
    }
  }
  for (const [path, forbidden] of Object.entries(policy.prohibitions)) {
    if (readPath(config.value, path) === forbidden) {
      throw new PolicyError(
        "Policy prohibits " + path + " from being " + JSON.stringify(forbidden) + ".",
        path,
        config.provenance[path]
      );
    }
  }
  return config;
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
  PolicyError,
  applyPolicy,
  main,
  parseInvocation,
  resolveConfig
};

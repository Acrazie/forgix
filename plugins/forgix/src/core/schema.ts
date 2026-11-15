import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const EXIT_CODES = {
  SUCCESS: 0,
  INVALID_INVOCATION: 2,
  INVALID_CONFIGURATION: 3,
  POLICY_CONTRADICTION: 4,
  STATE_CONFLICT: 5,
  BLOCKED: 6,
  INTERNAL_ERROR: 10,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export type SchemaName =
  | "config"
  | "policy"
  | "state"
  | "project-init-state"
  | "project-profile"
  | "project-profile-local"
  | "roadmap-state";

export interface SchemaValidationResult {
  valid: boolean;
  errors: unknown[];
}

const SCHEMA_VALIDATORS = new Map<SchemaName, ValidateFunction>();
const AJV = new Ajv2020({ allErrors: true, strict: true });

function resolveSchemaPath(name: SchemaName): string {
  const filename = `${name}.schema.json`;
  for (const relative of [`../schemas/${filename}`, `../../schemas/${filename}`]) {
    const candidate = fileURLToPath(new URL(relative, import.meta.url));
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Schema file not found for ${name}.`);
}

export function validateSchema(name: SchemaName, value: unknown): SchemaValidationResult {
  let validate = SCHEMA_VALIDATORS.get(name);
  if (!validate) {
    const schema = JSON.parse(readFileSync(resolveSchemaPath(name), "utf8")) as object;
    validate = AJV.compile(schema);
    SCHEMA_VALIDATORS.set(name, validate);
  }
  const valid = validate(value);
  return { valid, errors: validate.errors ? [...validate.errors] : [] };
}

export class InvocationError extends Error {
  readonly exitCode = EXIT_CODES.INVALID_INVOCATION;

  constructor(message: string) {
    super(message);
    this.name = "InvocationError";
  }
}

export class ConfigValidationError extends Error {
  readonly exitCode = EXIT_CODES.INVALID_CONFIGURATION;

  constructor(
    message: string,
    readonly source = "config",
    readonly errors: unknown[] = [],
  ) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

export class PolicyError extends Error {
  readonly exitCode = EXIT_CODES.POLICY_CONTRADICTION;

  constructor(
    message: string,
    readonly path = "",
    readonly source?: string,
  ) {
    super(message);
    this.name = "PolicyError";
  }
}

export type StateStoreErrorCode =
  | "state_path_invalid"
  | "state_not_found"
  | "state_yaml_invalid"
  | "state_task_mismatch"
  | "state_schema_incompatible"
  | "state_invalid"
  | "state_conflict"
  | "state_blocked"
  | "state_read_failed"
  | "state_write_failed";

function defaultStateExitCode(code: StateStoreErrorCode): ExitCode {
  switch (code) {
    case "state_blocked":
    case "state_not_found":
      return EXIT_CODES.BLOCKED;
    case "state_conflict":
    case "state_task_mismatch":
      return EXIT_CODES.STATE_CONFLICT;
    case "state_path_invalid":
    case "state_yaml_invalid":
    case "state_schema_incompatible":
    case "state_invalid":
      return EXIT_CODES.INVALID_CONFIGURATION;
    case "state_read_failed":
    case "state_write_failed":
    default:
      return EXIT_CODES.INTERNAL_ERROR;
  }
}

export class StateStoreError extends Error {
  readonly exitCode: ExitCode;

  constructor(
    readonly code: StateStoreErrorCode,
    message: string,
    exitCode?: ExitCode,
  ) {
    super(message);
    this.name = "StateStoreError";
    this.exitCode = exitCode ?? defaultStateExitCode(code);
  }
}

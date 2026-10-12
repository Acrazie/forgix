import { EXIT_CODES } from "./exit-codes.js";
import type { ResolvedConfig } from "./config.js";

export interface PolicyInput {
  schemaVersion: number;
  requirements: Record<string, unknown>;
  prohibitions: Record<string, unknown>;
  bounds: Record<string, unknown>;
  locks: string[];
}

export class PolicyError extends Error {
  readonly exitCode = EXIT_CODES.POLICY_CONTRADICTION;

  constructor(
    message: string,
    readonly path: string,
    readonly source: string | undefined,
  ) {
    super(message);
  }
}

function readPath(value: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

export function applyPolicy(config: ResolvedConfig, policy: PolicyInput): ResolvedConfig {
  for (const [path, required] of Object.entries(policy.requirements)) {
    if (readPath(config.value, path) !== required) {
      throw new PolicyError(
        "Policy requires " + path + " to be " + JSON.stringify(required) + ".",
        path,
        config.provenance[path],
      );
    }
  }
  for (const [path, forbidden] of Object.entries(policy.prohibitions)) {
    if (readPath(config.value, path) === forbidden) {
      throw new PolicyError(
        "Policy prohibits " + path + " from being " + JSON.stringify(forbidden) + ".",
        path,
        config.provenance[path],
      );
    }
  }
  return config;
}

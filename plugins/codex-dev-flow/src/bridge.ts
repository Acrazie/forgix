import type { RoutingDecision, RoutingStage } from "./types.js";

export const ROUTED_STAGES: RoutingStage[] = ["discover", "plan", "debug", "review", "verify"];
const MUTATING_STAGES = new Set(["execute", "validate"]);

export function isDelegableStage(stage: string): stage is RoutingStage {
  return ROUTED_STAGES.includes(stage as RoutingStage);
}

export async function delegateStage<T>(
  stage: string,
  runner: (decision?: RoutingDecision) => Promise<T>,
  decision?: RoutingDecision,
): Promise<T> {
  if (!isDelegableStage(stage) || MUTATING_STAGES.has(stage)) {
    throw new Error(
      "Mutation and validation stages stay with the parent workflow; no delegation permitted.",
    );
  }
  return runner(decision);
}

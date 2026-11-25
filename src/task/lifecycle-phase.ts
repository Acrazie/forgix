import { StateStoreError } from "../core/schema.js";
import type { MacroPhase, TaskState, TaskStatus } from "../types.js";
import { contractReviewBlockers } from "./contract-review.js";

const ACTIVE_PHASE: Partial<Record<TaskStatus, MacroPhase>> = {
  new: "INTAKE",
  intaking: "INTAKE",
  discovering: "SHAPE",
  awaiting_shape_decision: "SHAPE",
  awaiting_profile_choice: "SHAPE",
  planning: "SHAPE",
  awaiting_intake_decision: "INTAKE",
  awaiting_approval: "GATE",
  executing: "BUILD",
  assuring: "ASSURE",
};

function invalidPhase(message: string): never {
  throw new StateStoreError("state_invalid", message);
}

export function deriveMacroPhase(state: TaskState): MacroPhase {
  if (state.status === "awaiting_approval" && contractReviewBlockers(state).length) return "SHAPE";
  const direct = ACTIVE_PHASE[state.status];
  if (direct) return direct;
  if (state.status === "blocked") {
    const target = state.resumeTo ? ACTIVE_PHASE[state.resumeTo] : undefined;
    return target ?? invalidPhase(`Blocked task '${state.taskId}' requires valid resumeTo`);
  }
  return terminalPhase(state);
}

function terminalPhase(state: TaskState): MacroPhase {
  for (let i = state.history.length - 1; i >= 0; i -= 1) {
    const event = state.history[i];
    if (!event || event.type !== "state.transition" || event.to !== state.status) continue;
    const source =
      event.terminalSource === "blocked" ? event.terminalResumeTo : event.terminalSource;
    const derived = source ? ACTIVE_PHASE[source] : undefined;
    return derived ?? invalidPhase(`Terminal task '${state.taskId}' missing valid terminalSource`);
  }
  return invalidPhase(`Terminal task '${state.taskId}' missing terminal transition event`);
}

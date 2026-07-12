import type { Policy, TaskState, TaskStatus } from "./types.js";

export interface CreateTaskInput {
  taskId: string;
  configSnapshot: Record<string, unknown>;
  policySnapshot: Policy;
}

export interface TransitionOptions {
  resumeTo?: TaskStatus;
  remainingActions?: string[];
}

const TERMINAL = new Set<TaskStatus>(["cancelled", "failed", "finished_local", "finished"]);
const RESUMABLE = new Set<TaskStatus>(["blocked", "ready_for_handoff"]);

const ALLOWED: Partial<Record<TaskStatus, TaskStatus[]>> = {
  new: ["awaiting_mode_confirmation"],
  awaiting_mode_confirmation: ["executing", "discovering", "cancelled"],
  executing: ["validating", "blocked"],
  validating: ["reviewing", "verifying", "resolving"],
  reviewing: ["resolving", "verifying"],
  resolving: ["validating", "blocked"],
  verifying: ["handing_off", "finished_local", "ready_for_handoff", "resolving"],
  handing_off: ["finished", "ready_for_handoff"]
};

export function createState(input: CreateTaskInput): TaskState {
  return {
    schemaVersion: 1,
    taskId: input.taskId,
    status: "new",
    configSnapshot: input.configSnapshot,
    policySnapshot: input.policySnapshot,
    issues: [],
    reviewCycle: 0,
    remainingActions: [],
    history: []
  };
}

export function transition(state: TaskState, next: TaskStatus, options: TransitionOptions = {}): TaskState {
  if (TERMINAL.has(state.status) || !ALLOWED[state.status]?.includes(next)) {
    throw new Error("Invalid state transition from " + state.status + " to " + next + ".");
  }
  if (RESUMABLE.has(next) && (!options.resumeTo || !options.remainingActions?.length)) {
    throw new Error(next + " requires resumeTo and remainingActions.");
  }
  const resumable = options.resumeTo
    ? { resumeTo: options.resumeTo, remainingActions: options.remainingActions ?? [] }
    : { remainingActions: [] };
  return {
    ...state,
    status: next,
    ...resumable,
    history: [...state.history, { from: state.status, to: next }]
  };
}

function stable(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

export function compareSnapshot(
  state: Pick<TaskState, "configSnapshot" | "policySnapshot">,
  current: { config: Record<string, unknown>; policy: Policy }
): { changed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (stable(state.configSnapshot) !== stable(current.config)) reasons.push("Effective configuration changed.");
  if (stable(state.policySnapshot) !== stable(current.policy)) reasons.push("Effective policy changed.");
  return { changed: reasons.length > 0, reasons };
}

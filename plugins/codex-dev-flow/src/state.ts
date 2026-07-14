import type { Policy, RoutingDecision, RoutingSnapshot, TaskState, TaskStatus } from "./types.js";
import { ROUTING_POLICY_VERSION } from "./routing.js";

export interface CreateTaskInput {
  taskId: string;
  configSnapshot: Record<string, unknown>;
  policySnapshot: Policy;
  routingSnapshot?: RoutingSnapshot;
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
    history: [],
    ...(input.routingSnapshot ? { routingSnapshot: input.routingSnapshot } : {}),
    routingPolicyVersion: ROUTING_POLICY_VERSION,
    routingDecisions: []
  };
}

export function addRoutingDecision(state: TaskState, decision: RoutingDecision): TaskState {
  return {
    ...state,
    routingDecisions: [...(state.routingDecisions ?? []), decision]
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
  return JSON.stringify(canonicalize(value));
}

export function compareSnapshot(
  state: Pick<TaskState, "configSnapshot" | "policySnapshot" | "routingSnapshot">,
  current: { config: Record<string, unknown>; policy: Policy; routingSnapshot?: RoutingSnapshot }
): { changed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (stable(state.configSnapshot) !== stable(current.config)) reasons.push("Effective configuration changed.");
  if (stable(state.policySnapshot) !== stable(current.policy)) reasons.push("Effective policy changed.");
  if (state.routingSnapshot && current.routingSnapshot && stableRoutingSnapshot(state.routingSnapshot) !== stableRoutingSnapshot(current.routingSnapshot)) {
    reasons.push("Routing snapshot changed.");
  }
  return { changed: reasons.length > 0, reasons };
}

function stableRoutingSnapshot(snapshot: RoutingSnapshot): string {
  const { capturedAt: _capturedAt, ...behavior } = snapshot;
  return stable(behavior);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return value;
}

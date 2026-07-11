export type TaskMode = "quick" | "standard" | "critical";

export type TaskStatus =
  | "new"
  | "awaiting_mode_confirmation"
  | "discovering"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "validating"
  | "reviewing"
  | "resolving"
  | "verifying"
  | "handing_off"
  | "ready_for_handoff"
  | "blocked"
  | "cancelled"
  | "failed"
  | "finished_local"
  | "finished";

export interface EffectiveConfig {
  schemaVersion: number;
}

export interface Policy {
  schemaVersion: number;
  requirements: Record<string, unknown>;
  prohibitions: Record<string, unknown>;
  bounds: Record<string, unknown>;
  locks: string[];
}

export interface TaskState {
  schemaVersion: number;
  taskId: string;
  status: TaskStatus;
  resumeTo?: TaskStatus;
  configSnapshot: Record<string, unknown>;
  policySnapshot: Policy;
  issues: unknown[];
  reviewCycle: number;
  remainingActions: string[];
  history: unknown[];
}

export interface IssueIdentity {
  issueId: string;
  occurrenceId: string;
  rootCauseId?: string;
}

export interface CliResult {
  command: string;
  status: string;
  data: unknown;
}

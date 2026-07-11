import type { TaskMode } from "./types.js";

export interface WorktreeContext {
  mode: TaskMode;
  requested: boolean;
  concurrent: boolean;
  checkoutSafe: boolean;
}

export interface WorktreeDecision {
  required: boolean;
  reason: "critical" | "requested" | "concurrent" | "unsafe" | "none";
}

export function decideWorktree(context: WorktreeContext): WorktreeDecision {
  if (context.mode === "critical") return { required: true, reason: "critical" };
  if (context.requested) return { required: true, reason: "requested" };
  if (context.concurrent) return { required: true, reason: "concurrent" };
  if (!context.checkoutSafe) return { required: true, reason: "unsafe" };
  return { required: false, reason: "none" };
}

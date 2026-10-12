import type { RiskLevel } from "./types.js";

export interface WorktreeContext {
  risk: RiskLevel;
  policyRequired?: boolean;
  requested: boolean;
  concurrent: boolean;
  checkoutSafe: boolean;
}

export interface WorktreeDecision {
  required: boolean;
  reason: "policy" | "critical_risk" | "requested" | "concurrent" | "unsafe" | "none";
}

export function decideWorktree(context: WorktreeContext): WorktreeDecision {
  if (context.policyRequired) return { required: true, reason: "policy" };
  if (context.risk === "critical") return { required: true, reason: "critical_risk" };
  if (context.requested) return { required: true, reason: "requested" };
  if (context.concurrent) return { required: true, reason: "concurrent" };
  if (!context.checkoutSafe) return { required: true, reason: "unsafe" };
  return { required: false, reason: "none" };
}

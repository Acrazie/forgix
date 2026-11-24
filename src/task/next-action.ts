import { classifyAssureCompletion } from "../core/assure-completion.js";
import type { MacroPhase, NextActionEnvelope, TaskState } from "../types.js";
import { preflightGate } from "./gate-preflight.js";
import { contractReviewBlockers } from "./contract-review.js";
import { deriveMacroPhase } from "./lifecycle-phase.js";
import { designSourceFingerprint, isDesignContract } from "./plan.js";

function projectCommands(state: TaskState): string[] {
  const shape = state.shape;
  const contract = shape?.contract;
  if (
    !shape?.projection ||
    !isDesignContract(contract) ||
    contract.planDesign.sourceFingerprint !== designSourceFingerprint(state, shape)
  )
    return [];
  return [`forgix task project ${state.taskId} --path=<path> --authorize=<contract-digest>`];
}

function gateCommands(state: TaskState): string[] {
  const command = `forgix task gate ${state.taskId}`;
  const commands = [
    `${command} --view`,
    `${command} --change=<instruction>`,
    `${command} --reject`,
  ];
  if (!preflightGate(state).ready) return [...commands, ...projectCommands(state)];

  const hostCommand = state.contractReview
    ? `forgix --harness <codex|claude|antigravity> task gate ${state.taskId}`
    : command;
  const review = state.contractReview ? " --review-digest=<review-digest>" : "";
  commands.push(`${hostCommand} --approve --digest=<contract-digest>${review}`);
  return commands;
}

function planningEnvelope(state: TaskState, phase: MacroPhase, save: string): NextActionEnvelope {
  const id = state.taskId;
  return {
    role: "plan",
    phase,
    allowedCommands: [
      save,
      `forgix task gate ${id} --view`,
      `forgix task validate ${id}`,
      ...projectCommands(state),
    ],
    activeInvariants: [
      "no_repository_reads_in_planning",
      "contract_complete",
      "acyclic_task_dag",
      "autonomous_proof_floor",
    ],
  };
}

function preparationEnvelope(
  state: TaskState,
  phase: MacroPhase,
  save: string,
): NextActionEnvelope | undefined {
  const id = state.taskId;
  const validate = `forgix task validate ${id}`;
  switch (state.status) {
    case "new":
    case "intaking":
    case "awaiting_intake_decision":
      return {
        role: "intake",
        phase,
        allowedCommands: [save, validate, `forgix status ${id}`],
        activeInvariants: [
          "product_baseline_5_dimensions",
          "single_active_question",
          "clean_hygiene_no_secrets",
        ],
      };
    case "discovering":
    case "awaiting_shape_decision":
      return {
        role: "discover",
        phase,
        allowedCommands: [save, validate, `forgix status ${id}`],
        activeInvariants: [
          "read_only_repository_discovery",
          "fresh_source_fingerprints",
          "acyclic_dependency_graph",
        ],
      };
    case "awaiting_profile_choice":
      return {
        role: "profile-choice",
        phase,
        allowedCommands: [save, validate],
        activeInvariants: ["discovery_sufficient", "explicit_profile_selection"],
      };
    default:
      return undefined;
  }
}

function hasTaskPhaseBounce(history: TaskState["history"]): boolean {
  return history.some((ev) => {
    if (ev.type !== "state.transition") return false;
    const decision = ev.gateDecision?.decision;
    return (
      decision === "rejected" ||
      decision === "change_requested" ||
      (ev.from === "assuring" && ev.to !== "assuring") ||
      ev.to === "blocked"
    );
  });
}

function isPlanProfile(state: TaskState): boolean {
  const shape = state.shape;
  if (!shape) return false;
  return (
    shape.contract?.profile === "plan" || shape.preparationProfileChoice?.selectedProfile === "plan"
  );
}

function collectAssuranceFrictionReasons(state: TaskState): string[] {
  const assurance = state.assurance;
  if (!assurance) return [];
  const reasons: string[] = [];
  const issues = assurance.issues ?? [];
  if (issues.some((issue) => issue.rootCauseRequired || issue.correctionAttempts >= 2)) {
    reasons.push("debug_root_cause");
  }
  if (issues.length > 0 || assurance.evidenceIndex.some((ev) => ev.result === "failed")) {
    reasons.push("assure_friction");
  }
  return reasons;
}

function evaluateRetroRecommendation(state: TaskState): {
  recommended: boolean;
  reason?: string;
} {
  const reasons: string[] = [];
  if (isPlanProfile(state)) reasons.push("plan_profile");
  reasons.push(...collectAssuranceFrictionReasons(state));
  const escapeHatches = state.shape?.contract?.approvedEscapeHatches?.length ?? 0;
  if (escapeHatches > 0 || state.issues.length > 0) reasons.push("escape_hatch_or_issue");
  if (hasTaskPhaseBounce(state.history)) reasons.push("phase_bounce");
  if (reasons.length === 0) return { recommended: false };
  return { recommended: true, reason: reasons.join(",") };
}

function assuranceEnvelope(state: TaskState, phase: MacroPhase, save: string): NextActionEnvelope {
  const id = state.taskId;
  const status = `forgix status ${id}`;
  const completion = classifyAssureCompletion(state);
  if (completion === "verified") {
    const retro = evaluateRetroRecommendation(state);
    return {
      role: "terminal",
      phase,
      allowedCommands: retro.recommended
        ? [status, "forgix telemetry summary", "forgix retro"]
        : [status, "forgix telemetry summary"],
      activeInvariants: ["assurance_receipt_valid", "immutable_terminal_state"],
      ...(retro.recommended ? { retroRecommended: true, retroReason: retro.reason } : {}),
    };
  }
  if (completion === "incomplete") {
    return {
      role: "assure",
      phase,
      allowedCommands: [status, "forgix telemetry summary"],
      activeInvariants: ["assure_completion_incomplete"],
    };
  }
  if (completion === "historical") {
    return {
      role: "assure",
      phase,
      allowedCommands: [status, "forgix telemetry summary"],
      activeInvariants: ["assure_completion_historical"],
    };
  }
  return {
    role: "assure",
    phase,
    allowedCommands: [
      "forgix guardrails check",
      save,
      `forgix task validate ${id}`,
      "forgix telemetry record",
      status,
    ],
    activeInvariants: [
      "fresh_assurance_evidence",
      "surface_verification_rules",
      "no_unapproved_escape_hatches",
      "two_strike_root_cause_escalation",
    ],
  };
}

function executionEnvelope(state: TaskState, phase: MacroPhase, save: string): NextActionEnvelope {
  const id = state.taskId;
  const validate = `forgix task validate ${id}`;
  const status = `forgix status ${id}`;
  switch (state.status) {
    case "awaiting_approval":
      return {
        role: "gate",
        phase,
        allowedCommands: gateCommands(state),
        activeInvariants: [
          "preflight_ready",
          "contract_digest_bound",
          "explicit_gate_intent",
          "autonomous_proof_floor",
        ],
      };
    case "executing":
      return {
        role: "build",
        phase,
        allowedCommands: [
          save,
          validate,
          status,
          ...(state.contractReview
            ? [`forgix --harness <codex|claude|antigravity> task review ${id}`]
            : []),
        ],
        activeInvariants: [
          "plan_approval_receipt_valid",
          "protected_surface_write_deny",
          "no_unapproved_escape_hatches",
        ],
      };
    case "assuring":
      return assuranceEnvelope(state, phase, save);
    case "blocked":
      return {
        role: "blocked",
        phase,
        allowedCommands: [`forgix resume ${id}`, save, status],
        activeInvariants: ["resume_to_required", "selective_dependency_invalidation"],
      };
  }
  return {
    role: "terminal",
    phase,
    allowedCommands: [status, "forgix telemetry summary"],
    activeInvariants: ["terminal_source_recorded", "immutable_terminal_state"],
  };
}

export function computeTaskNextActionEnvelope(state: TaskState): NextActionEnvelope {
  const phase = deriveMacroPhase(state);
  const id = state.taskId;
  if (
    state.contractReview &&
    (state.status === "planning" || state.status === "awaiting_approval") &&
    contractReviewBlockers(state).length
  ) {
    return {
      role: "review-contract",
      phase: "SHAPE",
      allowedCommands: [
        `forgix --harness <codex|claude|antigravity> task review ${id}`,
        `forgix task validate ${id}`,
        ...projectCommands(state),
      ],
      activeInvariants: ["native_fresh_context", "review_bound_to_contract", "five_rounds_maximum"],
    };
  }
  const save = `forgix task save ${id} --expected-revision=<last-read-revision>`;
  if (state.status === "planning") return planningEnvelope(state, phase, save);
  return preparationEnvelope(state, phase, save) ?? executionEnvelope(state, phase, save);
}

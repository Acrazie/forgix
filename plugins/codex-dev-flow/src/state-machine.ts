export const MACRO_PHASES = Object.freeze(["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE", "HANDOFF"] as const);
export type MacroPhase = (typeof MACRO_PHASES)[number];

export const GUARD_IDS = Object.freeze([
  "task_initialized",
  "effective_constraints_valid",
  "mode_confirmed",
  "intake_complete",
  "intake_reopened",
  "routing_ready",
  "quick_scope_bounded",
  "critical_workspace_ready",
  "discovery_sufficient",
  "contract_complete",
  "approval_current",
  "task_authorized",
  "validation_fresh",
  "review_satisfied",
  "verification_complete",
  "correction_budget_available",
  "resume_metadata_valid",
  "resume_reconciled",
  "terminal_source_recorded",
  "gate_context_valid",
  "handoff_intent_resolved",
  "handoff_reconciled",
  "critical_completion_approved"
] as const);
export type GuardId = (typeof GUARD_IDS)[number];

type PhaseRule = MacroPhase | "resumeTo" | "terminalSource";

export interface ConditionalGuard {
  readonly guard: GuardId;
  readonly when: { readonly mode: "critical" };
}

export interface TransitionContract {
  readonly guards: readonly GuardId[];
  readonly conditionalGuards: readonly ConditionalGuard[];
  readonly modes: readonly ("quick" | "standard" | "critical")[];
}

interface CapsuleContract {
  readonly consumes: readonly string[];
  readonly produces: readonly string[];
  readonly invalidates: readonly string[];
}

interface StateContractDefinition {
  readonly macroPhase: PhaseRule;
  readonly stable: boolean;
  readonly terminal: boolean;
  readonly transitions: Readonly<Record<string, TransitionContract>>;
  readonly capsule: CapsuleContract;
  readonly events: readonly string[];
}

const CAPSULE = {
  INTAKE: {
    consumes: ["request", "constraints"],
    produces: ["intake.brief", "intake.decisions", "intake.question", "classification", "routing", "workspace", "freshness.config", "freshness.policy"],
    invalidates: ["intake.dependent-decisions", "classification", "routing", "workspace", "approvals"]
  },
  SHAPE: {
    consumes: ["intake.brief", "intake.decisions", "intake.technical-unknowns", "constraints", "classification", "routing", "workspace"],
    produces: ["discovery", "contract", "freshness.git", "freshness.artifact"],
    invalidates: ["discovery", "contract", "approvals", "build", "assurance", "handoff"]
  },
  GATE: {
    consumes: ["contract", "classification", "assurance.verificationEvidence"],
    produces: ["approvals"],
    invalidates: ["approvals"]
  },
  BUILD: {
    consumes: ["contract", "approvals", "discovery", "workspace", "freshness"],
    produces: ["build", "issues.active", "freshness.git", "freshness.commands"],
    invalidates: ["build.validationEvidence", "assurance", "handoff.receipts", "approvals"]
  },
  ASSURE: {
    consumes: ["contract", "build", "issues.active", "freshness"],
    produces: ["assurance", "issues.active", "freshness.commands"],
    invalidates: ["assurance.findings", "assurance.verificationEvidence", "handoff.receipts", "approvals"]
  },
  HANDOFF: {
    consumes: ["contract", "assurance.verificationEvidence", "workspace", "handoff"],
    produces: ["handoff.identities", "handoff.receipts"],
    invalidates: ["handoff.receipts"]
  }
} as const satisfies Record<MacroPhase, CapsuleContract>;

const EVENTS = {
  INTAKE: ["task.initialized", "intake.question_recorded", "intake.answer_recorded", "intake.checkpoint", "advance.rejected", "intake.reopened", "mode.proposed", "mode.confirmed", "routing.captured", "state.transition"],
  SHAPE: ["discovery.updated", "contract.projected", "evidence.invalidated", "state.transition"],
  GATE: ["approval.requested", "approval.recorded", "approval.invalidated", "state.transition"],
  BUILD: ["task.started", "checkpoint.recorded", "validation.completed", "finding.observed", "state.transition"],
  ASSURE: ["review.completed", "finding.observed", "finding.resolved", "verification.completed", "state.transition"],
  HANDOFF: ["handoff.reconciled", "handoff.attempted", "handoff.receipt_recorded", "task.finished", "state.transition"]
} as const satisfies Record<MacroPhase, readonly string[]>;

const ALL_MODES = ["quick", "standard", "critical"] as const;
const G = (...guards: GuardId[]): TransitionContract => ({ guards, conditionalGuards: [], modes: ALL_MODES });
const GM = (modes: TransitionContract["modes"], ...guards: GuardId[]): TransitionContract => ({ guards, conditionalGuards: [], modes });
const GC = (guards: readonly GuardId[], conditionalGuards: readonly ConditionalGuard[], modes: TransitionContract["modes"] = ALL_MODES): TransitionContract => ({ guards, conditionalGuards, modes });
const CRITICAL_WORKSPACE: ConditionalGuard = { guard: "critical_workspace_ready", when: { mode: "critical" } };

const STATE_MACHINE_DEFINITION = {
  new: {
    macroPhase: "INTAKE", stable: false, terminal: false, capsule: CAPSULE.INTAKE, events: EVENTS.INTAKE,
    transitions: {
      awaiting_mode_confirmation: G("task_initialized", "effective_constraints_valid"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  awaiting_mode_confirmation: {
    macroPhase: "INTAKE", stable: false, terminal: false, capsule: CAPSULE.INTAKE, events: EVENTS.INTAKE,
    transitions: {
      executing: GM(["quick"], "intake_complete", "mode_confirmed", "routing_ready", "quick_scope_bounded"),
      discovering: GC(["intake_complete", "mode_confirmed", "routing_ready"], [CRITICAL_WORKSPACE], ["standard", "critical"]),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  discovering: {
    macroPhase: "SHAPE", stable: false, terminal: false, capsule: CAPSULE.SHAPE, events: EVENTS.SHAPE,
    transitions: {
      planning: G("discovery_sufficient"), awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  planning: {
    macroPhase: "SHAPE", stable: false, terminal: false, capsule: CAPSULE.SHAPE, events: EVENTS.SHAPE,
    transitions: {
      discovering: G(), awaiting_approval: G("discovery_sufficient", "contract_complete"), awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  awaiting_approval: {
    macroPhase: "GATE", stable: false, terminal: false, capsule: CAPSULE.GATE, events: EVENTS.GATE,
    transitions: {
      planning: G("gate_context_valid"), resolving_assure: G("gate_context_valid", "correction_budget_available"),
      verifying: G("gate_context_valid"),
      executing: G("gate_context_valid", "approval_current", "task_authorized"),
      handing_off: G("gate_context_valid", "verification_complete", "critical_completion_approved", "handoff_intent_resolved"),
      ready_for_handoff: G("gate_context_valid", "verification_complete", "critical_completion_approved", "handoff_intent_resolved"),
      finished_local: G("gate_context_valid", "verification_complete", "critical_completion_approved", "handoff_intent_resolved"),
      awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  executing: {
    macroPhase: "BUILD", stable: false, terminal: false, capsule: CAPSULE.BUILD, events: EVENTS.BUILD,
    transitions: {
      validating: G("task_authorized"), planning: G(), awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  validating: {
    macroPhase: "BUILD", stable: false, terminal: false, capsule: CAPSULE.BUILD, events: EVENTS.BUILD,
    transitions: {
      executing: G("validation_fresh", "task_authorized"), resolving_build: G("correction_budget_available"),
      reviewing: G("validation_fresh"), verifying: G("validation_fresh", "review_satisfied"), planning: G(),
      awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  resolving_build: {
    macroPhase: "BUILD", stable: false, terminal: false, capsule: CAPSULE.BUILD, events: EVENTS.BUILD,
    transitions: {
      validating: G("correction_budget_available"), planning: G(), awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  reviewing: {
    macroPhase: "ASSURE", stable: false, terminal: false, capsule: CAPSULE.ASSURE, events: EVENTS.ASSURE,
    transitions: {
      resolving_assure: G("correction_budget_available"), verifying: G("review_satisfied"), planning: G(), awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  resolving_assure: {
    macroPhase: "ASSURE", stable: false, terminal: false, capsule: CAPSULE.ASSURE, events: EVENTS.ASSURE,
    transitions: {
      validating: G("correction_budget_available"), reviewing: G("correction_budget_available"),
      verifying: G("correction_budget_available"), planning: G(),
      awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  verifying: {
    macroPhase: "ASSURE", stable: false, terminal: false, capsule: CAPSULE.ASSURE, events: EVENTS.ASSURE,
    transitions: {
      resolving_assure: G("correction_budget_available"), planning: G(),
      awaiting_approval: G("verification_complete"),
      handing_off: G("verification_complete", "handoff_intent_resolved"),
      ready_for_handoff: G("verification_complete", "handoff_intent_resolved"),
      finished_local: G("verification_complete", "handoff_intent_resolved"),
      awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  handing_off: {
    macroPhase: "HANDOFF", stable: false, terminal: false, capsule: CAPSULE.HANDOFF, events: EVENTS.HANDOFF,
    transitions: {
      ready_for_handoff: G("handoff_intent_resolved", "handoff_reconciled"),
      finished: G("handoff_intent_resolved", "handoff_reconciled"), awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  ready_for_handoff: {
    macroPhase: "HANDOFF", stable: true, terminal: false, capsule: CAPSULE.HANDOFF, events: EVENTS.HANDOFF,
    transitions: {
      handing_off: G("handoff_intent_resolved", "handoff_reconciled"), finished: G("handoff_intent_resolved", "handoff_reconciled"),
      awaiting_mode_confirmation: G("intake_reopened"),
      blocked: G("resume_metadata_valid"), cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  blocked: {
    macroPhase: "resumeTo", stable: true, terminal: false,
    capsule: { consumes: ["resumeTo", "remainingActions", "freshness"], produces: ["issues.active"], invalidates: ["source-phase-dependent"] },
    events: ["task.blocked", "task.resumed", "state.transition"],
    transitions: {
      awaiting_mode_confirmation: G("resume_metadata_valid", "resume_reconciled", "task_initialized", "effective_constraints_valid"),
      discovering: GC(["resume_metadata_valid", "resume_reconciled", "mode_confirmed", "routing_ready"], [CRITICAL_WORKSPACE]),
      planning: G("resume_metadata_valid", "resume_reconciled", "discovery_sufficient"),
      awaiting_approval: G("resume_metadata_valid", "resume_reconciled", "contract_complete"),
      executing: G("resume_metadata_valid", "resume_reconciled", "approval_current", "task_authorized"),
      validating: G("resume_metadata_valid", "resume_reconciled", "task_authorized"),
      resolving_build: G("resume_metadata_valid", "resume_reconciled", "correction_budget_available"),
      reviewing: G("resume_metadata_valid", "resume_reconciled", "validation_fresh"),
      resolving_assure: G("resume_metadata_valid", "resume_reconciled", "correction_budget_available"),
      verifying: G("resume_metadata_valid", "resume_reconciled", "review_satisfied"),
      handing_off: G("resume_metadata_valid", "resume_reconciled", "handoff_intent_resolved", "handoff_reconciled"),
      cancelled: G("terminal_source_recorded"), failed: G("terminal_source_recorded")
    }
  },
  cancelled: {
    macroPhase: "terminalSource", stable: true, terminal: true, transitions: {},
    capsule: { consumes: ["terminal.source", "freshness"], produces: ["terminal.summary"], invalidates: [] }, events: ["task.cancelled"]
  },
  failed: {
    macroPhase: "terminalSource", stable: true, terminal: true, transitions: {},
    capsule: { consumes: ["terminal.source", "issues.active", "freshness"], produces: ["terminal.summary"], invalidates: [] }, events: ["task.failed"]
  },
  finished_local: {
    macroPhase: "HANDOFF", stable: true, terminal: true, transitions: {}, capsule: CAPSULE.HANDOFF, events: ["task.finished_local"]
  },
  finished: {
    macroPhase: "HANDOFF", stable: true, terminal: true, transitions: {}, capsule: CAPSULE.HANDOFF, events: ["task.finished"]
  }
} as const satisfies Record<string, StateContractDefinition>;

export type TaskStatus = keyof typeof STATE_MACHINE_DEFINITION;
export const STATE_MACHINE = deepFreeze(STATE_MACHINE_DEFINITION);
export const TASK_STATUSES = Object.freeze(Object.keys(STATE_MACHINE) as TaskStatus[]);

export function buildStateMachineProjection(): unknown {
  return {
    macroPhases: [...MACRO_PHASES],
    guards: [...GUARD_IDS],
    states: TASK_STATUSES.map((status) => {
      const state = STATE_MACHINE[status];
      return {
        status,
        macroPhase: state.macroPhase,
        stable: state.stable,
        terminal: state.terminal,
        transitions: Object.entries(state.transitions).map(([target, transition]) => ({
          target,
          guards: [...transition.guards],
          modes: [...transition.modes],
          conditionalGuards: transition.conditionalGuards.map((conditional) => ({
            guard: conditional.guard,
            when: { ...conditional.when }
          }))
        })),
        capsule: {
          consumes: [...state.capsule.consumes],
          produces: [...state.capsule.produces],
          invalidates: [...state.capsule.invalidates]
        },
        events: [...state.events]
      };
    })
  };
}

export interface MacroPhaseState {
  status: TaskStatus;
  resumeTo?: TaskStatus;
  history: readonly unknown[];
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && Object.hasOwn(STATE_MACHINE, value);
}

export function deriveMacroPhase(state: MacroPhaseState): MacroPhase {
  return derive(state.status, state, new Set<TaskStatus>());
}

function derive(status: TaskStatus, state: MacroPhaseState, seen: Set<TaskStatus>): MacroPhase {
  if (seen.has(status)) throw new Error(`Cannot derive macro-phase: recursive source at ${status}.`);
  seen.add(status);
  const rule: PhaseRule = STATE_MACHINE[status].macroPhase;
  if (rule !== "resumeTo" && rule !== "terminalSource") return rule;

  if (rule === "resumeTo") {
    if (!state.resumeTo || !isOperationalResumeTarget(state.resumeTo)) {
      throw new Error(`Cannot derive macro-phase for blocked: invalid resumeTo ${String(state.resumeTo)}.`);
    }
    return derive(state.resumeTo, state, seen);
  }

  const event = [...state.history].reverse().find((candidate): candidate is Record<string, unknown> =>
    isRecord(candidate) && candidate.type === "state.transition"
  );
  const source = event?.terminalSource;
  if (event?.to !== status || !isTaskStatus(source) || event.from !== source || STATE_MACHINE[source].terminal) {
    throw new Error(`Cannot derive macro-phase for ${status}: valid terminal source event missing.`);
  }
  if (source === "blocked") {
    const terminalResumeTo = event.terminalResumeTo;
    if (!isTaskStatus(terminalResumeTo) || !isOperationalResumeTarget(terminalResumeTo)) throw new Error(`Cannot derive macro-phase for ${status}: blocked terminal source lacks operational resumeTo.`);
    return derive(terminalResumeTo, { ...state, status: terminalResumeTo }, seen);
  }
  return derive(source, { ...state, status: source }, seen);
}

export function isOperationalResumeTarget(status: TaskStatus): boolean {
  return status !== "new" && !STATE_MACHINE[status].stable && !STATE_MACHINE[status].terminal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
}

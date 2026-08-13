export const MACRO_PHASES = Object.freeze(["INTAKE", "SHAPE", "GATE", "BUILD", "ASSURE"] as const);
export type MacroPhase = (typeof MACRO_PHASES)[number];

export const GUARD_IDS = Object.freeze([
  "task_initialized",
  "effective_constraints_valid",
  "intake_complete",
  "intake_reopened",
  "routing_ready",
  "workspace_ready",
  "discovery_sufficient",
  "profile_selected",
  "contract_complete",
  "approval_current",
  "resume_metadata_valid",
  "resume_reconciled",
  "terminal_source_recorded",
  "gate_decision_valid",
] as const);
export type GuardId = (typeof GUARD_IDS)[number];

type PhaseRule = MacroPhase | "resumeTo" | "terminalSource";
export interface TransitionContract {
  readonly guards: readonly GuardId[];
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
    consumes: ["request", "constraints", "design.product-reopen"],
    produces: [
      "design.product-baseline",
      "design.glossary-deltas",
      "design.domain-rules",
      "design.question",
      "risk",
      "routing",
      "workspace",
      "freshness.config",
      "freshness.policy",
    ],
    invalidates: ["intake.dependent-decisions", "shape.dependency-closure", "approvals"],
  },
  SHAPE: {
    consumes: [
      "design.product-baseline",
      "design.glossary-deltas",
      "design.domain-rules",
      "risk",
      "constraints",
      "routing",
      "workspace",
      "shape.state",
    ],
    produces: [
      "shape.targets",
      "shape.evidence",
      "shape.profile-choice",
      "design.technical-decisions",
      "design.question",
      "shape.contract",
      "shape.projection",
      "freshness.sources",
    ],
    invalidates: ["shape.dependency-closure", "approvals", "build", "assurance"],
  },
  GATE: {
    consumes: ["shape.contract", "shape.evidence", "risk"],
    produces: ["planApproval"],
    invalidates: ["approvals"],
  },
  BUILD: {
    consumes: ["shape.contract", "approvals", "workspace"],
    produces: [],
    invalidates: ["assurance"],
  },
  ASSURE: {
    consumes: ["shape.contract", "workspace", "issues.active", "freshness"],
    produces: ["assurance", "issues.active", "freshness.commands"],
    invalidates: ["assurance.findings", "assurance.evidence", "approvals"],
  },
} as const satisfies Record<MacroPhase, CapsuleContract>;

const EVENTS = {
  INTAKE: [
    "task.initialized",
    "intake.checkpoint",
    "advance.rejected",
    "intake.reopened",
    "design.question_recorded",
    "design.answer_recorded",
    "design.invalidated",
    "routing.captured",
    "state.transition",
  ],
  SHAPE: [
    "discovery.target_recorded",
    "discovery.evidence_recorded",
    "discovery.completed",
    "profile.choice_requested",
    "profile.choice_recorded",
    "design.question_recorded",
    "design.answer_recorded",
    "design.invalidated",
    "contract.projected",
    "projection.reconciliation_requested",
    "evidence.invalidated",
    "shape.checkpoint",
    "state.transition",
  ],
  GATE: ["approval.requested", "approval.recorded", "approval.invalidated", "state.transition"],
  BUILD: ["state.transition"],
  ASSURE: [
    "issue.recorded",
    "correction.recorded",
    "assurance.issue_resolved",
    "assurance.evidence_recorded",
    "assurance.evidence_invalidated",
    "assurance.human_observation_requested",
    "assure.completed",
    "state.transition",
  ],
} as const satisfies Record<MacroPhase, readonly string[]>;

const G = (...guards: GuardId[]): TransitionContract => ({ guards });
const TERMINALS = {
  blocked: G("resume_metadata_valid"),
  cancelled: G("terminal_source_recorded"),
  failed: G("terminal_source_recorded"),
} as const;

const STATE_MACHINE_DEFINITION = {
  new: {
    macroPhase: "INTAKE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.INTAKE,
    events: EVENTS.INTAKE,
    transitions: { intaking: G("task_initialized", "effective_constraints_valid"), ...TERMINALS },
  },
  intaking: {
    macroPhase: "INTAKE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.INTAKE,
    events: EVENTS.INTAKE,
    transitions: {
      awaiting_intake_decision: G(),
      discovering: G("intake_complete", "routing_ready", "workspace_ready"),
      ...TERMINALS,
    },
  },
  discovering: {
    macroPhase: "SHAPE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.SHAPE,
    events: EVENTS.SHAPE,
    transitions: {
      awaiting_profile_choice: G("discovery_sufficient"),
      awaiting_shape_decision: G(),
      awaiting_intake_decision: G(),
      intaking: G("intake_reopened"),
      ...TERMINALS,
    },
  },
  awaiting_shape_decision: {
    macroPhase: "SHAPE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.SHAPE,
    events: EVENTS.SHAPE,
    transitions: {
      discovering: G(),
      planning: G("discovery_sufficient", "profile_selected"),
      awaiting_intake_decision: G(),
      intaking: G("intake_reopened"),
      ...TERMINALS,
    },
  },
  awaiting_profile_choice: {
    macroPhase: "SHAPE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.SHAPE,
    events: EVENTS.SHAPE,
    transitions: {
      planning: G("profile_selected"),
      discovering: G(),
      intaking: G("intake_reopened"),
      ...TERMINALS,
    },
  },
  planning: {
    macroPhase: "SHAPE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.SHAPE,
    events: EVENTS.SHAPE,
    transitions: {
      discovering: G(),
      awaiting_intake_decision: G(),
      awaiting_approval: G("discovery_sufficient", "profile_selected", "contract_complete"),
      intaking: G("intake_reopened"),
      ...TERMINALS,
    },
  },
  awaiting_intake_decision: {
    macroPhase: "INTAKE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.INTAKE,
    events: EVENTS.INTAKE,
    transitions: {
      intaking: G("intake_reopened"),
      discovering: G("intake_complete"),
      planning: G("intake_complete", "discovery_sufficient", "profile_selected"),
      ...TERMINALS,
    },
  },
  awaiting_approval: {
    macroPhase: "GATE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.GATE,
    events: EVENTS.GATE,
    transitions: {
      planning: G("gate_decision_valid"),
      executing: G("gate_decision_valid"),
      cancelled: G("gate_decision_valid", "terminal_source_recorded"),
      intaking: G("intake_reopened"),
      blocked: TERMINALS.blocked,
      failed: TERMINALS.failed,
    },
  },
  executing: {
    macroPhase: "BUILD",
    stable: false,
    terminal: false,
    capsule: CAPSULE.BUILD,
    events: EVENTS.BUILD,
    transitions: {
      assuring: G(),
      planning: G(),
      intaking: G("intake_reopened"),
      ...TERMINALS,
    },
  },
  assuring: {
    macroPhase: "ASSURE",
    stable: false,
    terminal: false,
    capsule: CAPSULE.ASSURE,
    events: EVENTS.ASSURE,
    transitions: {
      planning: G(),
      intaking: G("intake_reopened"),
      ...TERMINALS,
    },
  },
  blocked: {
    macroPhase: "resumeTo",
    stable: true,
    terminal: false,
    capsule: {
      consumes: ["resume.metadata", "freshness"],
      produces: ["resume.reconciliation"],
      invalidates: [],
    },
    events: ["task.resumed", "state.transition"],
    transitions: {
      intaking: G(
        "resume_metadata_valid",
        "resume_reconciled",
        "task_initialized",
        "effective_constraints_valid",
      ),
      discovering: G(
        "resume_metadata_valid",
        "resume_reconciled",
        "intake_complete",
        "routing_ready",
        "workspace_ready",
      ),
      awaiting_shape_decision: G("resume_metadata_valid", "resume_reconciled"),
      awaiting_profile_choice: G(
        "resume_metadata_valid",
        "resume_reconciled",
        "discovery_sufficient",
      ),
      planning: G(
        "resume_metadata_valid",
        "resume_reconciled",
        "discovery_sufficient",
        "profile_selected",
      ),
      awaiting_intake_decision: G("resume_metadata_valid", "resume_reconciled"),
      awaiting_approval: G("resume_metadata_valid", "resume_reconciled", "contract_complete"),
      executing: G("resume_metadata_valid", "resume_reconciled", "approval_current"),
      assuring: G("resume_metadata_valid", "resume_reconciled"),
      cancelled: G("terminal_source_recorded"),
      failed: G("terminal_source_recorded"),
    },
  },
  cancelled: {
    macroPhase: "terminalSource",
    stable: true,
    terminal: true,
    transitions: {},
    capsule: {
      consumes: ["terminal.source", "freshness"],
      produces: ["terminal.summary"],
      invalidates: [],
    },
    events: ["task.cancelled"],
  },
  failed: {
    macroPhase: "terminalSource",
    stable: true,
    terminal: true,
    transitions: {},
    capsule: {
      consumes: ["terminal.source", "issues.active", "freshness"],
      produces: ["terminal.summary"],
      invalidates: [],
    },
    events: ["task.failed"],
  },
} as const satisfies Record<string, StateContractDefinition>;

export type TaskStatus = keyof typeof STATE_MACHINE_DEFINITION;
export const STATE_MACHINE = deepFreeze(STATE_MACHINE_DEFINITION);
export const TASK_STATUSES = Object.freeze(Object.keys(STATE_MACHINE) as TaskStatus[]);

export function isTerminalStatus(status: TaskStatus, assuranceCompleted: boolean): boolean {
  return (
    status === "cancelled" || status === "failed" || (status === "assuring" && assuranceCompleted)
  );
}

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
        })),
        capsule: {
          consumes: [...state.capsule.consumes],
          produces: [...state.capsule.produces],
          invalidates: [...state.capsule.invalidates],
        },
        events: [...state.events],
      };
    }),
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
  if (seen.has(status))
    throw new Error(`Cannot derive macro-phase: recursive source at ${status}.`);
  seen.add(status);
  const rule: PhaseRule = STATE_MACHINE[status].macroPhase;
  if (rule !== "resumeTo" && rule !== "terminalSource") return rule;
  if (rule === "resumeTo") {
    if (!state.resumeTo || !isOperationalResumeTarget(state.resumeTo))
      throw new Error(
        `Cannot derive macro-phase for blocked: invalid resumeTo ${String(state.resumeTo)}.`,
      );
    return derive(state.resumeTo, state, seen);
  }
  const event = [...state.history]
    .toReversed()
    .find(
      (candidate): candidate is Record<string, unknown> =>
        isRecord(candidate) && candidate.type === "state.transition",
    );
  const source = event?.terminalSource;
  if (
    event?.to !== status ||
    !isTaskStatus(source) ||
    event.from !== source ||
    STATE_MACHINE[source].terminal
  )
    throw new Error(
      `Cannot derive macro-phase for ${status}: valid terminal source event missing.`,
    );
  if (source === "blocked") {
    const terminalResumeTo = event.terminalResumeTo;
    if (!isTaskStatus(terminalResumeTo) || !isOperationalResumeTarget(terminalResumeTo))
      throw new Error(
        `Cannot derive macro-phase for ${status}: blocked terminal source lacks operational resumeTo.`,
      );
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

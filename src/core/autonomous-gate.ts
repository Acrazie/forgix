import {
  EXECUTABLE_VERIFIER_KINDS,
  type AssuranceOperation,
  type CanonicalChangeContract,
  type RiskLevel,
  type TaskState,
} from "../types.js";

export const GATE_ISSUE_REF =
  /^(([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)?#[1-9][0-9]*|local:[a-z0-9][a-z0-9._-]{0,63})$/;

const EXEC_SET = new Set<string>(EXECUTABLE_VERIFIER_KINDS);
const NON_EXEC_SET = new Set<string>(["model-inspection", "user-observation"]);
const PROOF_FLOOR = "autonomous_proof_floor_violated";
const NON_AUTO_GATE = "human_gate_required_for_non_automatable";
const ACTIVE_Q = "active_design_question";
const TECH_GATE = "technical_decision_requires_human_gate";
const AUTONOMOUS_ISSUE_REQUIRED = "invalid_or_missing_issue_ref";

export interface AutonomousGateEligibility {
  eligible: boolean;
  reasons: string[];
}

export interface AutonomousGateCriterionInput {
  id?: string;
  description?: string;
  validationIds?: readonly string[];
  verifierKind?: string;
  kind?: string;
  command?: string;
  nonAutomatable?: boolean;
  requiresHumanGate?: boolean;
  humanGateRequired?: boolean;
}

export interface AutonomousGatePredicateInput {
  risk: RiskLevel;
  openQuestions?: number;
  activeQuestion?: unknown;
  unresolvedDecisions?: number;
  adrQualified?: boolean;
  hasExecutableProof?: boolean;
  proofFloorSatisfied?: boolean;
  verifiers?: readonly string[];
  verifierKinds?: readonly string[];
  acceptanceCriteria?: readonly (string | AutonomousGateCriterionInput)[];
}

export interface AutonomousGateOptions {
  issueRef?: string;
  allowNonAutomatable?: boolean;
  preflightGate?: (state: TaskState) => { ready: boolean; blockers: string[] };
}

const strField = (target: object, key: string): string | undefined => {
  const val: unknown = Reflect.get(target, key);
  return typeof val === "string" ? val : undefined;
};

const kindOf = (target: object): string | undefined =>
  strField(target, "verifierKind") ?? strField(target, "kind");

const isNonAuto = (target: object): boolean =>
  Reflect.get(target, "nonAutomatable") === true &&
  (Reflect.get(target, "requiresHumanGate") === true ||
    Reflect.get(target, "humanGateRequired") === true);

function isValidationExecutable(v: CanonicalChangeContract["validations"][number]): boolean {
  const kind = kindOf(v);
  if (kind !== undefined && NON_EXEC_SET.has(kind)) return false;
  if (kind !== undefined && EXEC_SET.has(kind)) return true;
  return typeof v.command === "string" && v.command.trim().length > 0;
}

function evaluateContractCriterion(
  criterion: CanonicalChangeContract["acceptanceCriteria"][number],
  contract: CanonicalChangeContract,
  operations: readonly AssuranceOperation[],
  allowNonAutomatable: boolean,
): string[] {
  if (isNonAuto(criterion)) return allowNonAutomatable ? [] : [NON_AUTO_GATE, PROOF_FLOOR];
  const directKind = kindOf(criterion);
  if (directKind !== undefined && NON_EXEC_SET.has(directKind)) return [PROOF_FLOOR];

  const linked = contract.validations.filter(
    (v) => criterion.validationIds.includes(v.id) || v.criterionIds.includes(criterion.id),
  );
  const coveringOps = operations.filter((op) => op.covers.includes(criterion.id));
  const hasExecOp = coveringOps.some((op) => EXEC_SET.has(op.kind));
  const onlyNonExecOps =
    coveringOps.length > 0 && coveringOps.every((op) => NON_EXEC_SET.has(op.kind));

  if (onlyNonExecOps || (!linked.some(isValidationExecutable) && !hasExecOp)) {
    return [PROOF_FLOOR];
  }
  return [];
}

function checkContractAutonomousProofFloor(
  contract: CanonicalChangeContract | undefined,
  allowNonAutomatable: boolean,
): string[] {
  if (!contract || contract.acceptanceCriteria.length === 0) return [PROOF_FLOOR];
  const ops = contract.assuranceContract?.operations ?? [];
  return contract.acceptanceCriteria.flatMap((c) =>
    evaluateContractCriterion(c, contract, ops, allowNonAutomatable),
  );
}

function evaluateTaskStateGate(state: TaskState, options?: AutonomousGateOptions): string[] {
  const reasons: string[] = [];
  if (state.design.activeQuestion !== undefined) reasons.push(ACTIVE_Q);
  if (state.shape?.technicalDecisions?.some((d) => d.status !== "resolved" || d.adrQualified)) {
    reasons.push(TECH_GATE);
  }
  if (!GATE_ISSUE_REF.test(options?.issueRef ?? "")) reasons.push(AUTONOMOUS_ISSUE_REQUIRED);
  if (options?.preflightGate) {
    const preflight = options.preflightGate(state);
    if (!preflight.ready) reasons.push("preflight_blocked", ...preflight.blockers);
  }
  reasons.push(
    ...checkContractAutonomousProofFloor(
      state.shape?.contract,
      options?.allowNonAutomatable === true,
    ),
  );
  return reasons;
}

function evaluatePredicateCriterion(
  item: string | AutonomousGateCriterionInput,
  allowNonAutomatable: boolean,
): string[] {
  if (typeof item === "string") {
    return /\b(?:model-inspection|user-observation)\b/i.test(item) &&
      !/\b(?:command|runtime-evidence|tla-tlc|lean4)\b/i.test(item)
      ? [PROOF_FLOOR]
      : [];
  }
  if (isNonAuto(item)) return allowNonAutomatable ? [] : [NON_AUTO_GATE, PROOF_FLOOR];
  const kind = kindOf(item);
  if (
    (kind !== undefined && NON_EXEC_SET.has(kind)) ||
    (kind === undefined && item.command !== undefined && !item.command.trim())
  ) {
    return [PROOF_FLOOR];
  }
  return [];
}

function evaluatePredicateGate(
  predicate: AutonomousGatePredicateInput,
  options?: AutonomousGateOptions,
): string[] {
  const reasons: string[] = [];
  if (
    predicate.activeQuestion !== undefined ||
    (predicate.openQuestions ?? 0) > 0 ||
    (predicate.unresolvedDecisions ?? 0) > 0
  ) {
    reasons.push(ACTIVE_Q);
  }
  if (predicate.adrQualified === true) reasons.push(TECH_GATE);
  if (options?.issueRef !== undefined && !GATE_ISSUE_REF.test(options.issueRef)) {
    reasons.push(AUTONOMOUS_ISSUE_REQUIRED);
  }
  if (predicate.hasExecutableProof === false || predicate.proofFloorSatisfied === false) {
    reasons.push(PROOF_FLOOR);
  }
  const verifiers = predicate.verifierKinds ?? predicate.verifiers;
  if (
    verifiers !== undefined &&
    (verifiers.length === 0 ||
      !verifiers.some((k) => EXEC_SET.has(k)) ||
      verifiers.every((k) => NON_EXEC_SET.has(k)))
  ) {
    reasons.push(PROOF_FLOOR);
  }
  if (predicate.acceptanceCriteria !== undefined) {
    if (predicate.acceptanceCriteria.length === 0) {
      reasons.push("empty_acceptance_criteria", PROOF_FLOOR);
    }
    const allowNonAuto = options?.allowNonAutomatable === true;
    for (const item of predicate.acceptanceCriteria) {
      reasons.push(...evaluatePredicateCriterion(item, allowNonAuto));
    }
  }
  return reasons;
}

export function evaluateAutonomousGateEligibility(
  state: TaskState | AutonomousGatePredicateInput,
  options?: AutonomousGateOptions,
): AutonomousGateEligibility {
  const reasons: string[] = [];
  if (state.risk !== "low" && state.risk !== "medium") reasons.push("risk_requires_human_gate");
  reasons.push(
    ...("schemaVersion" in state && state.schemaVersion === 6
      ? evaluateTaskStateGate(state, options)
      : evaluatePredicateGate(state, options)),
  );
  return { eligible: reasons.length === 0, reasons: Array.from(new Set(reasons)) };
}

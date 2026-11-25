import {
  evaluateAutonomousGateEligibility as evaluateCoreAutonomousGateEligibility,
  type AutonomousGateEligibility,
  type AutonomousGatePredicateInput,
} from "../core/autonomous-gate.js";
import { canonicalContractDigest } from "../core/build-authorization.js";
import type { CanonicalChangeContract, EvidenceRecord, RiskLevel, TaskState } from "../types.js";
import { contractReviewBlockers } from "./contract-review.js";
import { designSourceFingerprint, isDesignContract } from "./plan.js";

interface GatePreflightSummary {
  objective: string;
  taskCount: number;
  criterionCount: number;
  validationCount: number;
  riskLevel: RiskLevel;
  riskControlCount: number;
}

export interface GatePreflightResult {
  ready: boolean;
  blockers: string[];
  contractDigest: string | null;
  summary: GatePreflightSummary | null;
}

export function isEvidenceFresh(
  evidence: EvidenceRecord,
  fingerprintsById: ReadonlyMap<string, string>,
): boolean {
  if (evidence.expectedValue !== undefined && evidence.observedValue !== undefined) {
    return evidence.observedValue === evidence.expectedValue;
  }
  if (evidence.expectedValue !== undefined) {
    return !evidence.sourceFingerprintIds.some((id) => {
      const value = fingerprintsById.get(id);
      return value !== undefined && value !== evidence.expectedValue;
    });
  }
  return true;
}

export function resolveObjective(state: TaskState): string {
  const contract = state.shape?.contract;
  if (isDesignContract(contract)) return contract.planDesign.objective;
  const resolved = state.design.productBaseline.dimensions.find(
    (dim) => dim.key === "objective" && dim.status === "resolved" && dim.value,
  )?.value;
  return (
    resolved ?? state.shape?.contract?.scope.find((item) => item.trim().length > 0) ?? state.taskId
  );
}

function contractBlockers(state: TaskState, contract: CanonicalChangeContract): string[] {
  const blockers: string[] = [];
  if (contract.tasks.length === 0) blockers.push("empty_tasks");
  if (contract.acceptanceCriteria.length === 0) blockers.push("empty_acceptance_criteria");
  if (contract.validations.length === 0) blockers.push("empty_validations");
  if (isDesignContract(contract) && state.shape) {
    if (contract.planDesign.sourceFingerprint !== designSourceFingerprint(state, state.shape)) {
      blockers.push("stale_design_source");
    }
    const projection = state.shape.projection;
    if (
      !projection?.written ||
      projection.pending ||
      projection.written.fingerprint !== projection.contentFingerprint
    ) {
      blockers.push("design_projection_pending");
    }
  }

  return blockers;
}

export function preflightGate(state: TaskState): GatePreflightResult {
  const blockers = contractReviewBlockers(state);
  if (state.status !== "awaiting_approval") blockers.push("status_not_awaiting_approval");
  if (state.design.activeQuestion !== undefined) blockers.push("active_design_question");
  if (state.shape?.technicalDecisions?.some((d) => d.status !== "resolved"))
    blockers.push("unresolved_technical_decision");

  const fingerprints = new Map(
    (state.shape?.sourceFingerprints ?? []).map((fp) => [fp.id, fp.value]),
  );
  if (state.shape?.evidence.some((item) => !isEvidenceFresh(item, fingerprints)))
    blockers.push("stale_evidence");

  const contract = state.shape?.contract;
  if (!contract) {
    blockers.push("missing_contract");
    return { ready: false, blockers, contractDigest: null, summary: null };
  }

  const contractDigest = canonicalContractDigest(contract);
  if (!state.contractDigest || state.contractDigest !== contractDigest)
    blockers.push("contract_digest_mismatch");
  blockers.push(...contractBlockers(state, contract));

  return {
    ready: blockers.length === 0,
    blockers,
    contractDigest,
    summary: {
      objective: resolveObjective(state),
      taskCount: contract.tasks.length,
      criterionCount: contract.acceptanceCriteria.length,
      validationCount: contract.validations.length,
      riskLevel: contract.risk,
      riskControlCount: contract.risks.length,
    },
  };
}

export function evaluateTaskAutonomousGateEligibility(
  state: TaskState | AutonomousGatePredicateInput,
  options?: { issueRef?: string; allowNonAutomatable?: boolean },
): AutonomousGateEligibility {
  return evaluateCoreAutonomousGateEligibility(state, { ...options, preflightGate });
}

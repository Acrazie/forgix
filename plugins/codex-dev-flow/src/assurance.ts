import { createHash } from "node:crypto";
import type {
  AssuranceContract,
  AssuranceEvidenceRecord,
  AssuranceIssue,
  AssuranceOperation,
  AssuranceReceipt,
  AssuranceState,
  AssuranceSubject,
  PendingHumanObservation,
  ConsolidatedReviewResult,
} from "./types.js";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]{0,255}$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]{0,511}$/;
const MAX_SUBJECTS = 1_024;
const MAX_OPERATIONS = 1_024;
const MAX_EVIDENCE = 2_048;

export interface EvidenceObservation {
  evidenceId: string;
  operationId: string;
  result: AssuranceEvidenceRecord["result"];
  verifierDigest: string;
  observedFingerprint: string;
  detailRef: string;
  recordedAt?: string;
}

export interface AssuranceCompletionInput {
  taskId: string;
  contractDigest: string;
  verifiedSnapshotFingerprint: string;
  completedAt?: string;
  currentFingerprints: Readonly<Record<string, string>>;
}

export interface AssuranceExecutionPlan {
  reusedOperationIds: readonly string[];
  notApplicableOperationIds: readonly string[];
  skippedOperationIds: readonly string[];
  batches: readonly (readonly string[])[];
}

export interface AssuranceExecutionInput {
  currentFingerprints: Readonly<Record<string, string>>;
  activationPredicates: Readonly<Record<string, boolean>>;
  maxConcurrency?: number;
}

export function createAssuranceState(): AssuranceState {
  return { schemaVersion: 1, evidenceIndex: [], issues: [] };
}

export function compileAssuranceContract(
  input: Omit<AssuranceContract, "digest">,
): AssuranceContract {
  const candidate = { ...structuredClone(input), digest: digest(input) };
  validateAssuranceContract(candidate);
  return candidate;
}

export function validateAssuranceContract(input: AssuranceContract): AssuranceContract {
  if (!input || input.schemaVersion !== 1)
    throw new Error("AssuranceContract schemaVersion must be 1.");
  assertRef(input.sourceDigest, "AssuranceContract source digest");
  assertRef(input.policyDigest, "AssuranceContract policy digest");
  if (!Array.isArray(input.subjects) || input.subjects.length > MAX_SUBJECTS)
    throw new Error("AssuranceContract subjects are invalid.");
  if (!Array.isArray(input.operations) || input.operations.length > MAX_OPERATIONS)
    throw new Error("AssuranceContract operations are invalid.");
  const subjects = validateSubjects(input.subjects);
  const operations = validateOperations(input.operations, subjects);
  const covered = new Set(operations.flatMap((item) => item.covers));
  const uncovered = [...subjects].filter((id) => !covered.has(id));
  if (uncovered.length)
    throw new Error(`AssuranceContract subjects lack operations: ${uncovered.join(", ")}.`);
  const operationIds = new Set(operations.map((item) => item.id));
  if (
    !Array.isArray(input.evidencePreference) ||
    new Set(input.evidencePreference).size !== input.evidencePreference.length ||
    input.evidencePreference.some((id) => !operationIds.has(id))
  ) {
    throw new Error("AssuranceContract evidence preference is invalid.");
  }
  if (input.evidencePreference.length !== operationIds.size)
    throw new Error("AssuranceContract evidence preference must order every operation.");
  const budget = input.reviewBudget;
  if (
    !budget ||
    !positive(budget.maxInputTokens) ||
    !positive(budget.maxOutputTokens) ||
    ![0, 1, 2].includes(budget.maxCalls) ||
    !positive(budget.maxConcurrency) ||
    budget.maxConcurrency > 32
  ) {
    throw new Error("AssuranceContract review budget is invalid.");
  }
  const modelOperations = operations.filter((item) => item.kind === "model-inspection");
  if (!modelOperations.length && budget.maxCalls !== 0)
    throw new Error("Review budget must allow zero calls when no review operation exists.");
  if (modelOperations.length && budget.maxCalls < 1)
    throw new Error("Review operation requires at least one allowed model call.");
  if (input.digest !== digest({ ...input, digest: undefined }))
    throw new Error("AssuranceContract digest is stale.");
  return structuredClone(input);
}

export function recordAssuranceEvidence(
  contract: AssuranceContract,
  state: AssuranceState | undefined,
  observation: EvidenceObservation,
): AssuranceState {
  validateAssuranceContract(contract);
  const current = state ?? createAssuranceState();
  validateAssuranceState(contract, current);
  if (current.receipt) throw new Error("Completed ASSURE is immutable.");
  assertId(observation.evidenceId, "Evidence");
  const operation = operationById(contract, observation.operationId);
  assertRef(observation.verifierDigest, "Evidence verifier digest");
  assertRef(observation.observedFingerprint, "Evidence fingerprint");
  assertRef(observation.detailRef, "Evidence detail reference");
  if (observation.result === "not_applicable") {
    if (!operation.conditional)
      throw new Error("Only a conditional operation may be not_applicable.");
    const criterionIds = new Set(
      contract.subjects.filter((item) => item.kind === "criterion").map((item) => item.id),
    );
    if (operation.covers.some((id) => criterionIds.has(id)))
      throw new Error("Acceptance criteria cannot become not_applicable in ASSURE.");
  }
  const base = {
    schemaVersion: 1 as const,
    evidenceId: observation.evidenceId,
    operationId: operation.id,
    subjectIds: [...operation.covers].toSorted(),
    verifierKind: operation.kind,
    result: observation.result,
    verifierDigest: observation.verifierDigest,
    observedFingerprint: observation.observedFingerprint,
    detailRef: observation.detailRef,
    recordedAt: normalizeAt(observation.recordedAt),
  };
  const record: AssuranceEvidenceRecord = { ...base, digest: digest(base) };
  const evidenceIndex = [
    ...current.evidenceIndex.filter(
      (item) => item.evidenceId !== record.evidenceId && item.operationId !== record.operationId,
    ),
    record,
  ].toSorted((left, right) => left.operationId.localeCompare(right.operationId));
  if (evidenceIndex.length > MAX_EVIDENCE) throw new Error("Assurance evidence budget exceeded.");
  const {
    completionIndex: _completionIndex,
    receipt: _receipt,
    pendingHumanObservation: pending,
    ...open
  } = current;
  const pendingComplete = pending?.operationIds.every((id) =>
    evidenceIndex.some((item) => item.operationId === id),
  );
  return {
    ...open,
    schemaVersion: 1,
    evidenceIndex,
    ...(pending && !pendingComplete ? { pendingHumanObservation: pending } : {}),
  };
}

export function invalidateAssuranceEvidence(
  contract: AssuranceContract,
  state: AssuranceState,
  changedScopeRefs: readonly string[],
): AssuranceState {
  validateAssuranceState(contract, state);
  if (state.receipt) throw new Error("Completed ASSURE is immutable.");
  const changed = new Set(changedScopeRefs);
  const operationMap = new Map(contract.operations.map((item) => [item.id, item]));
  const evidenceIndex = state.evidenceIndex.filter((record) => {
    const operation = operationMap.get(record.operationId) as AssuranceOperation;
    return (
      operation.fingerprintMode === "scoped" &&
      !operation.scopeRefs.some((scope) => changed.has(scope))
    );
  });
  return {
    schemaVersion: 1,
    evidenceIndex,
    ...(state.issues?.length ? { issues: [...state.issues] } : {}),
    ...(state.pendingHumanObservation
      ? { pendingHumanObservation: structuredClone(state.pendingHumanObservation) }
      : {}),
  };
}

export function setPendingHumanObservation(
  contract: AssuranceContract,
  state: AssuranceState | undefined,
  pending: PendingHumanObservation,
): AssuranceState {
  const current = state ?? createAssuranceState();
  validateAssuranceState(contract, current);
  if (current.receipt) throw new Error("Completed ASSURE is immutable.");
  assertId(pending.requestId, "Human observation request");
  assertRef(pending.promptRef, "Human observation prompt");
  if (
    !pending.operationIds.length ||
    new Set(pending.operationIds).size !== pending.operationIds.length
  )
    throw new Error("Human observation request operations are invalid.");
  for (const id of pending.operationIds) {
    const operation = operationById(contract, id);
    if (operation.kind !== "user-observation")
      throw new Error("Human observation request may contain only user operations.");
  }
  return {
    ...current,
    schemaVersion: 1,
    evidenceIndex: [...current.evidenceIndex],
    pendingHumanObservation: {
      ...structuredClone(pending),
      requestedAt: normalizeAt(pending.requestedAt),
    },
  };
}

export function completeAssurance(
  contract: AssuranceContract,
  state: AssuranceState,
  input: AssuranceCompletionInput,
): AssuranceState {
  validateAssuranceState(contract, state);
  if (state.pendingHumanObservation) throw new Error("ASSURE has pending human observation.");
  if (state.issues?.some((item) => item.status === "active"))
    throw new Error("ASSURE has active issues.");
  assertRef(input.contractDigest, "Completion contract digest");
  assertRef(input.verifiedSnapshotFingerprint, "Verified snapshot fingerprint");
  const passing = new Map(
    state.evidenceIndex
      .filter((item) => item.result === "passed" || item.result === "not_applicable")
      .map((item) => [item.operationId, item]),
  );
  for (const [operationId, record] of passing) {
    const operation = operationById(contract, operationId);
    if (
      input.currentFingerprints[operationId] !== record.observedFingerprint ||
      (operation.fingerprintMode === "global" &&
        record.observedFingerprint !== input.verifiedSnapshotFingerprint)
    )
      passing.delete(operationId);
  }
  const covered = new Set<string>();
  const completionIndex: string[] = [];
  for (const operationId of contract.evidencePreference) {
    const evidence = passing.get(operationId);
    if (!evidence || evidence.subjectIds.every((id) => covered.has(id))) continue;
    completionIndex.push(evidence.evidenceId);
    for (const id of evidence.subjectIds) covered.add(id);
  }
  const missing = contract.subjects.map((item) => item.id).filter((id) => !covered.has(id));
  if (missing.length) throw new Error(`ASSURE coverage incomplete: ${missing.join(", ")}.`);
  const evidenceIndexDigest = digest(completionIndex);
  const completedAt = normalizeAt(input.completedAt);
  const base = {
    schemaVersion: 1 as const,
    taskId: input.taskId,
    contractDigest: input.contractDigest,
    verifiedSnapshotFingerprint: input.verifiedSnapshotFingerprint,
    evidenceIndexDigest,
    completedAt,
  };
  const receipt: AssuranceReceipt = { ...base, receiptDigest: digest(base) };
  return {
    ...state,
    schemaVersion: 1,
    evidenceIndex: [...state.evidenceIndex],
    completionIndex,
    receipt,
  };
}

export function planAssuranceExecution(
  contract: AssuranceContract,
  state: AssuranceState | undefined,
  input: AssuranceExecutionInput,
): AssuranceExecutionPlan {
  validateAssuranceContract(contract);
  const current = state ?? createAssuranceState();
  validateAssuranceState(contract, current);
  const evidence = new Map(current.evidenceIndex.map((item) => [item.operationId, item]));
  const reused = new Set<string>();
  const failed = new Set<string>();
  const inactive = new Set<string>();
  for (const operation of contract.operations) {
    const record = evidence.get(operation.id);
    if (
      record &&
      record.observedFingerprint === input.currentFingerprints[operation.id] &&
      (record.result === "passed" || record.result === "not_applicable")
    )
      reused.add(operation.id);
    else if (
      record?.result === "failed" &&
      record.observedFingerprint === input.currentFingerprints[operation.id]
    )
      failed.add(operation.id);
    if (
      operation.conditional &&
      input.activationPredicates[operation.activationPredicateRef as string] !== true
    )
      inactive.add(operation.id);
  }
  const done = new Set([...reused, ...inactive]);
  const pending = new Map(
    contract.operations.filter((item) => !done.has(item.id)).map((item) => [item.id, item]),
  );
  const skipped = new Set<string>();
  const batches: string[][] = [];
  const cap = Math.max(
    1,
    Math.min(
      input.maxConcurrency ?? contract.reviewBudget.maxConcurrency,
      contract.reviewBudget.maxConcurrency,
    ),
  );
  while (pending.size) {
    let changed = false;
    for (const operation of pending.values()) {
      if (operation.dependsOn.some((id) => failed.has(id) || skipped.has(id))) {
        skipped.add(operation.id);
        pending.delete(operation.id);
        changed = true;
      }
    }
    const ready = [...pending.values()]
      .filter((item) => item.dependsOn.every((id) => done.has(id)))
      .toSorted(
        (left, right) =>
          costRank(left.cost) - costRank(right.cost) || left.id.localeCompare(right.id),
      );
    if (!ready.length) {
      if (!changed) throw new Error("Assurance execution graph cannot make progress.");
      continue;
    }
    const first = ready[0] as AssuranceOperation;
    const batch =
      first.readOnly && first.concurrencySafe
        ? ready
            .filter((item) => item.readOnly && item.concurrencySafe && item.cost === first.cost)
            .slice(0, cap)
        : [first];
    batches.push(batch.map((item) => item.id));
    for (const item of batch) {
      pending.delete(item.id);
      done.add(item.id);
    }
  }
  return {
    reusedOperationIds: [...reused].toSorted(),
    notApplicableOperationIds: [...inactive].toSorted(),
    skippedOperationIds: [...skipped].toSorted(),
    batches,
  };
}

export function validateConsolidatedReviewResult(
  value: ConsolidatedReviewResult,
  expectedSubjectIds: readonly string[],
): ConsolidatedReviewResult {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.subjectVerdicts) ||
    !Array.isArray(value.findings)
  )
    throw new Error("Consolidated review result is invalid.");
  if (value.findings.length > 64 || value.subjectVerdicts.length > 1_024)
    throw new Error("Consolidated review result exceeds budget.");
  const expected = new Set(expectedSubjectIds);
  if (
    !sameIds(
      value.subjectVerdicts.map((item) => item.subjectId),
      expectedSubjectIds,
    )
  )
    throw new Error("Consolidated review subject coverage is incomplete.");
  const issueIds = new Set<string>();
  for (const verdict of value.subjectVerdicts) {
    if (!expected.has(verdict.subjectId) || !["passed", "finding"].includes(verdict.verdict))
      throw new Error("Consolidated review verdict is invalid.");
  }
  for (const finding of value.findings) {
    assertId(finding.issueId, "Review issue");
    if (issueIds.has(finding.issueId) || !expected.has(finding.subjectId))
      throw new Error("Consolidated review finding identity is invalid.");
    issueIds.add(finding.issueId);
    if (!["blocking", "major", "minor", "style"].includes(finding.severity))
      throw new Error(`Review finding ${finding.issueId} severity is invalid.`);
    if (!["low", "medium", "high"].includes(finding.confidence))
      throw new Error(`Review finding ${finding.issueId} confidence is invalid.`);
    for (const text of [finding.locationRef, finding.evidence, finding.requiredCorrection])
      if (!text || text.length > 4_096)
        throw new Error(`Review finding ${finding.issueId} text is invalid.`);
  }
  for (const verdict of value.subjectVerdicts) {
    const hasFinding = value.findings.some((item) => item.subjectId === verdict.subjectId);
    if ((verdict.verdict === "finding") !== hasFinding)
      throw new Error(`Review verdict for ${verdict.subjectId} contradicts findings.`);
  }
  return structuredClone(value);
}

export function reviewRequiresEscalation(result: ConsolidatedReviewResult): boolean {
  return result.findings.some((item) => item.confidence === "low");
}

export function recordAssuranceIssue(
  contract: AssuranceContract,
  state: AssuranceState,
  issue: Omit<AssuranceIssue, "status" | "correctionAttempts" | "rootCauseRequired">,
): AssuranceState {
  validateAssuranceState(contract, state);
  if (state.receipt) throw new Error("Completed ASSURE is immutable.");
  assertId(issue.issueId, "Assurance issue");
  operationById(contract, issue.operationId);
  assertRef(issue.evidenceRef, "Assurance issue evidence");
  const previous = state.issues?.find((item) => item.issueId === issue.issueId);
  const next: AssuranceIssue = previous
    ? { ...previous, status: "active", evidenceRef: issue.evidenceRef }
    : { ...issue, status: "active", correctionAttempts: 0, rootCauseRequired: false };
  return {
    ...state,
    issues: [
      ...(state.issues ?? []).filter((item) => item.issueId !== issue.issueId),
      next,
    ].toSorted((a, b) => a.issueId.localeCompare(b.issueId)),
  };
}

export function recordCorrectionAttempt(
  contract: AssuranceContract,
  state: AssuranceState,
  issueId: string,
): AssuranceState {
  validateAssuranceState(contract, state);
  let found = false;
  const issues = (state.issues ?? []).map((item): AssuranceIssue => {
    if (item.issueId !== issueId) return item;
    found = true;
    if (item.status !== "active") throw new Error(`Assurance issue ${issueId} is not active.`);
    const correctionAttempts = item.correctionAttempts + 1;
    return Object.assign({}, item, {
      correctionAttempts,
      rootCauseRequired: correctionAttempts >= 2,
    });
  });
  if (!found) throw new Error(`Unknown assurance issue ${issueId}.`);
  return { ...state, issues };
}

export function resolveAssuranceIssue(
  contract: AssuranceContract,
  state: AssuranceState,
  issueId: string,
): AssuranceState {
  validateAssuranceState(contract, state);
  let found = false;
  const issues = (state.issues ?? []).map((item): AssuranceIssue => {
    if (item.issueId !== issueId) return item;
    found = true;
    return Object.assign({}, item, { status: "resolved" as const, rootCauseRequired: false });
  });
  if (!found) throw new Error(`Unknown assurance issue ${issueId}.`);
  return { ...state, issues };
}

export function validateAssuranceState(contract: AssuranceContract, state: AssuranceState): void {
  validateAssuranceContract(contract);
  if (!state || state.schemaVersion !== 1 || !Array.isArray(state.evidenceIndex))
    throw new Error("AssuranceState is invalid.");
  if (state.evidenceIndex.length > MAX_EVIDENCE)
    throw new Error("Assurance evidence budget exceeded.");
  const issueIds = new Set<string>();
  for (const issue of state.issues ?? []) {
    assertId(issue.issueId, "Assurance issue");
    operationById(contract, issue.operationId);
    assertRef(issue.evidenceRef, "Assurance issue evidence");
    if (
      issueIds.has(issue.issueId) ||
      !Number.isInteger(issue.correctionAttempts) ||
      issue.correctionAttempts < 0 ||
      issue.rootCauseRequired !== (issue.status === "active" && issue.correctionAttempts >= 2)
    )
      throw new Error(`Assurance issue ${issue.issueId} is invalid.`);
    issueIds.add(issue.issueId);
  }
  const evidenceIds = new Set<string>();
  const operationIds = new Set<string>();
  for (const record of state.evidenceIndex) {
    assertId(record.evidenceId, "Evidence");
    const operation = operationById(contract, record.operationId);
    if (evidenceIds.has(record.evidenceId) || operationIds.has(record.operationId))
      throw new Error("Assurance evidence identities are duplicated.");
    evidenceIds.add(record.evidenceId);
    operationIds.add(record.operationId);
    if (
      record.verifierKind !== operation.kind ||
      !sameIds(record.subjectIds, operation.covers) ||
      record.digest !== digest({ ...record, digest: undefined })
    ) {
      throw new Error(`Assurance evidence ${record.evidenceId} is malformed.`);
    }
  }
  if ((state.receipt === undefined) !== (state.completionIndex === undefined))
    throw new Error("Assurance completion index and receipt must be paired.");
  if (state.receipt) {
    if (state.receipt.receiptDigest !== digest({ ...state.receipt, receiptDigest: undefined }))
      throw new Error("AssuranceReceipt digest is invalid.");
    if (state.pendingHumanObservation)
      throw new Error("Completed ASSURE cannot await observation.");
    if (state.issues?.some((item) => item.status === "active"))
      throw new Error("Completed ASSURE cannot retain active issues.");
    if (!state.completionIndex?.length || state.completionIndex.some((id) => !evidenceIds.has(id)))
      throw new Error("Assurance completion index is invalid.");
    if (state.receipt.evidenceIndexDigest !== digest(state.completionIndex))
      throw new Error("Assurance completion index digest is stale.");
  }
}

function costRank(cost: AssuranceOperation["cost"]): number {
  return cost === "low" ? 0 : cost === "medium" ? 1 : 2;
}

export function assuranceSucceeded(state: AssuranceState | undefined): boolean {
  return Boolean(state?.receipt && state.completionIndex?.length);
}

function validateSubjects(subjects: readonly AssuranceSubject[]): Set<string> {
  const ids = new Set<string>();
  for (const subject of subjects) {
    assertId(subject.id, "Assurance subject");
    if (!["criterion", "risk", "mandatory_check"].includes(subject.kind))
      throw new Error(`Assurance subject ${subject.id} kind is invalid.`);
    if (ids.has(subject.id)) throw new Error(`Duplicate assurance subject ${subject.id}.`);
    ids.add(subject.id);
  }
  if (!ids.size) throw new Error("AssuranceContract requires subjects.");
  return ids;
}

function validateOperations(
  operations: readonly AssuranceOperation[],
  subjects: Set<string>,
): AssuranceOperation[] {
  const ids = new Set<string>();
  const commandIdentities = new Set<string>();
  for (const operation of operations) {
    assertId(operation.id, "Assurance operation");
    if (ids.has(operation.id)) throw new Error(`Duplicate assurance operation ${operation.id}.`);
    ids.add(operation.id);
  }
  for (const operation of operations) {
    if (!["command", "model-inspection", "user-observation"].includes(operation.kind))
      throw new Error(`Assurance operation ${operation.id} kind is invalid.`);
    if (!operation.covers.length || operation.covers.some((id) => !subjects.has(id)))
      throw new Error(`Assurance operation ${operation.id} coverage is invalid.`);
    if (new Set(operation.covers).size !== operation.covers.length)
      throw new Error(`Assurance operation ${operation.id} repeats coverage.`);
    if (operation.dependsOn.some((id) => !ids.has(id) || id === operation.id))
      throw new Error(`Assurance operation ${operation.id} dependency is invalid.`);
    if (operation.fingerprintMode === "scoped" && !operation.scopeRefs.length)
      throw new Error(`Scoped operation ${operation.id} requires declared scope.`);
    if (operation.conditional !== Boolean(operation.activationPredicateRef))
      throw new Error(`Operation ${operation.id} activation predicate is invalid.`);
    if (operation.kind === "command") {
      if (!operation.checkIdentity || !operation.successPredicate)
        throw new Error(`Command operation ${operation.id} requires identity and predicate.`);
      validateCheckIdentity(operation);
      const identity = stable(operation.checkIdentity);
      if (commandIdentities.has(identity))
        throw new Error(`Command operation ${operation.id} duplicates normalized identity.`);
      commandIdentities.add(identity);
      const predicate = operation.successPredicate;
      if (
        !predicate.exitCodes?.length &&
        !predicate.requiredOutputRefs?.length &&
        !predicate.requiredArtifactRefs?.length &&
        !predicate.thresholdRef
      )
        throw new Error(`Command operation ${operation.id} success predicate is empty.`);
      if (predicate.exitCodes?.some((code) => !Number.isInteger(code) || code < 0 || code > 255))
        throw new Error(`Command operation ${operation.id} exit-code predicate is invalid.`);
    } else if (operation.checkIdentity || operation.successPredicate) {
      throw new Error(`Non-command operation ${operation.id} cannot define command contract.`);
    }
  }
  assertAcyclicOperations(operations);
  return [...operations];
}

function validateCheckIdentity(operation: AssuranceOperation): void {
  const identity = operation.checkIdentity as NonNullable<AssuranceOperation["checkIdentity"]>;
  if (!identity.executable || !identity.logicalCwd || !Array.isArray(identity.argv))
    throw new Error(`Command operation ${operation.id} identity is invalid.`);
  if (
    identity.executable.includes("/") ||
    identity.executable.includes("\\") ||
    identity.logicalCwd.startsWith("/") ||
    identity.logicalCwd.includes("\\") ||
    identity.logicalCwd.split("/").includes("..") ||
    identity.argv.some((item) => item.includes("\u0000"))
  )
    throw new Error(`Command operation ${operation.id} contains non-portable identity.`);
  for (const [key, value] of Object.entries(identity.environment)) {
    if (
      !/^[A-Z_][A-Z0-9_]*$/.test(key) ||
      /(?:^|_)(?:TOKEN|SECRET|PASSWORD|KEY)(?:_|$)/.test(key) ||
      !value
    )
      throw new Error(`Command operation ${operation.id} environment is unsafe.`);
  }
  for (const ref of identity.toolFingerprintRefs) assertRef(ref, "Tool fingerprint");
}

function assertAcyclicOperations(operations: readonly AssuranceOperation[]): void {
  const byId = new Map(operations.map((item) => [item.id, item]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Assurance operation graph contains cycle at ${id}.`);
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
}

function operationById(contract: AssuranceContract, id: string): AssuranceOperation {
  const operation = contract.operations.find((item) => item.id === id);
  if (!operation) throw new Error(`Unknown assurance operation ${id}.`);
  return operation;
}

function assertId(value: string, label: string): void {
  if (!ID.test(value)) throw new Error(`${label} id is invalid.`);
}

function assertRef(value: string, label: string): void {
  if (!REF.test(value)) throw new Error(`${label} is invalid.`);
}

function positive(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    [...left].toSorted().every((id, index) => id === [...right].toSorted()[index])
  );
}

function normalizeAt(value?: string): string {
  const output = value ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(output))) throw new Error("Timestamp is invalid.");
  return output;
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

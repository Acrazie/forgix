import { createHash } from "node:crypto";
import {
  dependencyClosure,
  validateDependencyGraph,
  type DependencyGraph,
} from "./shape-dependencies.js";

export type DesignOwner = "intake" | "shape";
export type DesignQuestionKind = "product" | "terminology" | "domain_rule" | "technical";
export type DesignRecordStatus = "proposed" | "resolved" | "approved" | "projected" | "invalidated";
export type DomainDisposition =
  | "project"
  | "already_documented"
  | "task_local"
  | "policy_forbidden";

export interface DesignProvenance {
  sourceRefs: string[];
  freshnessRefs: string[];
}

export interface ProductBaselineDimension {
  key: "objective" | "users_value" | "scope" | "success" | "risks_constraints";
  status: "resolved" | "not_applicable" | "missing" | "unknown";
  value?: string;
  notApplicableReason?: string;
  provenance: DesignProvenance;
  dependencyNodeId: string;
}

export interface ProductBaseline {
  schemaVersion: 1;
  dimensions: ProductBaselineDimension[];
}

export interface DesignQuestionOption {
  id: string;
  label: string;
  consequences: string[];
}

export interface ActiveDesignQuestion {
  schemaVersion: 1;
  id: string;
  decisionKey: string;
  kind: DesignQuestionKind;
  owner: DesignOwner;
  subjectIds: string[];
  prerequisiteIds: string[];
  prompt: string;
  mode: "choice" | "elicitation";
  options?:
    | [DesignQuestionOption, DesignQuestionOption]
    | [DesignQuestionOption, DesignQuestionOption, DesignQuestionOption];
  recommendedOptionId?: string;
  recommendationBasis?: string;
  confidence?: "low" | "medium" | "high";
  priorRole: "intaking" | "discovering" | "planning";
  selectionReason: string;
  directConsequences: string[];
  freeFormAllowed: true;
  clarificationCount: number;
}

export interface DomainGlossaryDelta {
  id: string;
  context: string;
  term: string;
  definition: string;
  aliases: string[];
  rejectedTerms: Array<{ term: string; reason: string }>;
  relatedTermIds: string[];
  provenance: DesignProvenance;
  dependencyNodeId: string;
  status: DesignRecordStatus;
  disposition?: DomainDisposition;
}

export interface DomainScenario {
  id: string;
  angle: "nominal" | "boundary" | "exception" | "contradiction";
  startingSituation: string;
  action: string;
  expectedResult: string;
}

export interface DomainRule {
  id: string;
  context: string;
  termIds: string[];
  actors: string[];
  conditions: string[];
  outcome: string;
  exceptions: string[];
  scenarios: DomainScenario[];
  provenance: DesignProvenance;
  dependencyNodeId: string;
  status: DesignRecordStatus;
  disposition?: DomainDisposition;
}

export interface DecisionAlternative {
  id: string;
  label: string;
  consequences: string[];
  excludedReason?: string;
}

export interface DecisionCandidate {
  id: string;
  owner: DesignOwner;
  context: string;
  materialityReason: string;
  alternatives: DecisionAlternative[];
  evidenceRefs: string[];
  recommendedOptionId?: string;
  confidence: "low" | "medium" | "high";
  selectedOptionId?: string;
  dependencyNodeId: string;
  priorRole: "intaking" | "discovering" | "planning";
  status: DesignRecordStatus;
  disposition?: DomainDisposition;
}

export interface DesignInvalidation {
  rootIds: string[];
  invalidatedNodeIds: string[];
  reason: string;
  at: string;
}

export interface DesignFrontierCandidate {
  question: ActiveDesignQuestion;
  scores: {
    impact: number;
    irreversibility: number;
    risk: number;
    uncertainty: number;
    branchesUnlocked: number;
  };
  scoreReason: string;
}

export interface ProductBaselineResolution {
  key: ProductBaselineDimension["key"];
  status: "resolved" | "not_applicable";
  value?: string;
  notApplicableReason?: string;
  provenance: DesignProvenance;
}

export interface DesignState {
  schemaVersion: 1;
  graph: DependencyGraph;
  productBaseline: ProductBaseline;
  glossaryDeltas: DomainGlossaryDelta[];
  domainRules: DomainRule[];
  decisions: DecisionCandidate[];
  activeQuestion?: ActiveDesignQuestion;
  invalidations: DesignInvalidation[];
  semanticComplete: boolean;
  digest: string;
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]{0,255}$/;
const MAX_TEXT = 4_096;
const MAX_RECORDS = 512;
const BASELINE_KEYS = [
  "objective",
  "users_value",
  "scope",
  "success",
  "risks_constraints",
] as const;

export function createDesignState(): DesignState {
  const state: Omit<DesignState, "digest"> = {
    schemaVersion: 1,
    graph: {
      schemaVersion: 1,
      nodes: BASELINE_KEYS.map((key) => ({
        id: `product:${key}`,
        kind: "product" as const,
        dependsOn: [],
      })),
    },
    productBaseline: {
      schemaVersion: 1,
      dimensions: BASELINE_KEYS.map((key) => ({
        key,
        status: "missing",
        provenance: { sourceRefs: [], freshnessRefs: [] },
        dependencyNodeId: `product:${key}`,
      })),
    },
    glossaryDeltas: [],
    domainRules: [],
    decisions: [],
    invalidations: [],
    semanticComplete: false,
  };
  return withDigest(state);
}

export function compileDesignState(input: Omit<DesignState, "digest">): DesignState {
  const state = withDigest(input);
  validateDesignState(state);
  return state;
}

export function validateDesignState(input: DesignState): DesignState {
  if (!input || input.schemaVersion !== 1) throw new Error("DesignState schemaVersion must be 1.");
  const graph = validateDependencyGraph(input.graph);
  if (
    input.glossaryDeltas.length > MAX_RECORDS ||
    input.domainRules.length > MAX_RECORDS ||
    input.decisions.length > MAX_RECORDS
  ) {
    throw new Error("DesignState record budget exceeded.");
  }
  const dimensions = input.productBaseline?.dimensions;
  if (!Array.isArray(dimensions) || dimensions.length !== BASELINE_KEYS.length)
    throw new Error("ProductBaseline requires exactly five dimensions.");
  const keys = dimensions.map((item) => item.key);
  if (new Set(keys).size !== keys.length || BASELINE_KEYS.some((key) => !keys.includes(key)))
    throw new Error("ProductBaseline dimension keys are incomplete or duplicated.");
  for (const dimension of dimensions) {
    assertId(dimension.dependencyNodeId, "ProductBaseline dependency node");
    assertProvenance(dimension.provenance);
    const node = graph.nodes.find((candidate) => candidate.id === dimension.dependencyNodeId);
    if (node?.kind !== "product")
      throw new Error(`ProductBaseline ${dimension.key} requires product dependency node.`);
    if (dimension.status === "resolved" && !text(dimension.value))
      throw new Error(`ProductBaseline ${dimension.key} resolved without value.`);
    if (dimension.status === "not_applicable" && !text(dimension.notApplicableReason))
      throw new Error(`ProductBaseline ${dimension.key} N/A requires reason.`);
    if (
      ["missing", "unknown"].includes(dimension.status) &&
      (dimension.value || dimension.notApplicableReason)
    )
      throw new Error(`ProductBaseline ${dimension.key} unresolved payload is invalid.`);
  }
  validateQuestion(input.activeQuestion);
  if (input.activeQuestion) {
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    for (const id of [...input.activeQuestion.subjectIds, ...input.activeQuestion.prerequisiteIds])
      if (!nodes.has(id)) throw new Error(`Design question references unknown node ${id}.`);
    if (
      input.activeQuestion.owner === "shape" &&
      input.activeQuestion.subjectIds.some((id) => nodes.get(id)?.kind !== "technical_decision")
    )
      throw new Error("SHAPE design question requires technical-decision subjects.");
  }
  validateOwnershipEdges(graph);
  validateOwnedRecords(input, graph);
  for (const invalidation of input.invalidations) {
    if (
      !text(invalidation.reason) ||
      Number.isNaN(Date.parse(invalidation.at)) ||
      !invalidation.rootIds.length ||
      invalidation.rootIds.some((id) => !graph.nodes.some((node) => node.id === id)) ||
      invalidation.invalidatedNodeIds.some((id) => !graph.nodes.some((node) => node.id === id))
    )
      throw new Error("Design invalidation record is invalid.");
  }
  const expected = digest({ ...input, digest: undefined });
  if (input.digest !== expected) throw new Error("DesignState digest is stale.");
  return structuredClone(input);
}

export function selectDesignFrontier(
  state: DesignState,
  candidates: readonly DesignFrontierCandidate[],
): ActiveDesignQuestion | undefined {
  validateDesignState(state);
  const known = new Set(state.graph.nodes.map((node) => node.id));
  const eligible = candidates.filter(({ question, scores, scoreReason }) => {
    validateQuestion(question);
    validateScores(scores, scoreReason);
    return (
      question.subjectIds.length > 0 &&
      question.subjectIds.every((id) => known.has(id)) &&
      question.prerequisiteIds.every((id) => known.has(id) && nodeResolved(state, id)) &&
      question.subjectIds.some((id) => !nodeResolved(state, id))
    );
  });
  const selected = eligible.toSorted((left, right) => {
    const leftTotal = Object.values(left.scores).reduce((sum, score) => sum + score, 0);
    const rightTotal = Object.values(right.scores).reduce((sum, score) => sum + score, 0);
    return (
      rightTotal - leftTotal ||
      right.scores.risk - left.scores.risk ||
      right.scores.impact - left.scores.impact ||
      left.question.id.localeCompare(right.question.id)
    );
  })[0];
  return selected ? structuredClone(selected.question) : undefined;
}

export function resolveProductBaseline(
  state: DesignState,
  resolutions: readonly ProductBaselineResolution[],
): DesignState {
  validateDesignState(state);
  if (
    !resolutions.length ||
    new Set(resolutions.map((item) => item.key)).size !== resolutions.length
  )
    throw new Error("ProductBaseline resolution set is empty or duplicated.");
  for (const resolution of resolutions) {
    assertProvenance(resolution.provenance);
    if (resolution.status === "resolved" && !text(resolution.value))
      throw new Error(`ProductBaseline ${resolution.key} resolved without value.`);
    if (resolution.status === "not_applicable" && !text(resolution.notApplicableReason))
      throw new Error(`ProductBaseline ${resolution.key} N/A requires reason.`);
  }
  const byKey = new Map(resolutions.map((item) => [item.key, item]));
  const dimensions = state.productBaseline.dimensions.map((dimension) => {
    const resolution = byKey.get(dimension.key);
    if (!resolution) return dimension;
    return {
      key: dimension.key,
      status: resolution.status,
      ...(resolution.value ? { value: resolution.value.trim() } : {}),
      ...(resolution.notApplicableReason
        ? { notApplicableReason: resolution.notApplicableReason.trim() }
        : {}),
      provenance: structuredClone(resolution.provenance),
      dependencyNodeId: dimension.dependencyNodeId,
    };
  });
  const answered = new Set(resolutions.map((item) => `product:${item.key}`));
  const retainQuestion =
    state.activeQuestion && !state.activeQuestion.subjectIds.some((id) => answered.has(id));
  const { activeQuestion: _activeQuestion, ...base } = state;
  return withDigest({
    ...base,
    productBaseline: { schemaVersion: 1, dimensions },
    ...(retainQuestion ? { activeQuestion: state.activeQuestion } : {}),
    semanticComplete: false,
  });
}

export function setActiveDesignQuestion(
  state: DesignState,
  question: ActiveDesignQuestion,
): DesignState {
  validateDesignState(state);
  if (state.activeQuestion) throw new Error("Only one ActiveDesignQuestion may exist.");
  validateQuestion(question);
  const known = new Set(state.graph.nodes.map((node) => node.id));
  for (const id of [...question.subjectIds, ...question.prerequisiteIds])
    if (!known.has(id)) throw new Error(`Design question references unknown node ${id}.`);
  return withDigest({
    ...state,
    activeQuestion: structuredClone(question),
    semanticComplete: false,
  });
}

export function invalidateDesign(
  state: DesignState,
  roots: readonly string[],
  reason: string,
  at = new Date().toISOString(),
): DesignState {
  validateDesignState(state);
  if (!text(reason)) throw new Error("Design invalidation requires reason.");
  const invalidatedNodeIds = dependencyClosure(state.graph, roots);
  const invalid = new Set(invalidatedNodeIds);
  const { activeQuestion, ...base } = state;
  const retainQuestion = activeQuestion && !activeQuestion.subjectIds.some((id) => invalid.has(id));
  return withDigest({
    ...base,
    productBaseline: {
      schemaVersion: 1,
      dimensions: state.productBaseline.dimensions.map((item) =>
        invalid.has(item.dependencyNodeId)
          ? {
              key: item.key,
              status: "unknown" as const,
              provenance: item.provenance,
              dependencyNodeId: item.dependencyNodeId,
            }
          : item,
      ),
    },
    glossaryDeltas: state.glossaryDeltas.map((item) =>
      invalid.has(item.dependencyNodeId) ? { ...item, status: "invalidated" as const } : item,
    ),
    domainRules: state.domainRules.map((item) =>
      invalid.has(item.dependencyNodeId) ? { ...item, status: "invalidated" as const } : item,
    ),
    decisions: state.decisions.map((item) =>
      invalid.has(item.dependencyNodeId) ? { ...item, status: "invalidated" as const } : item,
    ),
    ...(retainQuestion ? { activeQuestion } : {}),
    invalidations: [
      ...state.invalidations,
      { rootIds: [...new Set(roots)].toSorted(), invalidatedNodeIds, reason, at },
    ].slice(-128),
    semanticComplete: false,
  });
}

export function designComplete(state: DesignState): boolean {
  validateDesignState(state);
  return (
    state.semanticComplete &&
    !state.activeQuestion &&
    state.productBaseline.dimensions.every((item) =>
      ["resolved", "not_applicable"].includes(item.status),
    ) &&
    [...state.glossaryDeltas, ...state.domainRules, ...state.decisions].every(
      (item) => item.status !== "proposed" && item.status !== "invalidated",
    )
  );
}

function validateOwnedRecords(state: DesignState, graph: DependencyGraph): void {
  const known = new Set(graph.nodes.map((node) => node.id));
  const ids = new Set<string>();
  for (const item of [...state.glossaryDeltas, ...state.domainRules, ...state.decisions]) {
    assertId(item.id, "Design record");
    assertId(item.dependencyNodeId, "Design dependency node");
    if (ids.has(item.id)) throw new Error(`Duplicate design record ${item.id}.`);
    ids.add(item.id);
    if (!known.has(item.dependencyNodeId))
      throw new Error(`Design record ${item.id} references unknown dependency node.`);
  }
  for (const item of [...state.glossaryDeltas, ...state.domainRules]) {
    assertProvenance(item.provenance);
    if (["approved", "projected"].includes(item.status) && !item.disposition)
      throw new Error(`Durable design record ${item.id} requires disposition.`);
  }
  for (const glossary of state.glossaryDeltas) {
    if (
      !text(glossary.context) ||
      !text(glossary.term) ||
      !text(glossary.definition) ||
      !uniqueText(glossary.aliases, true) ||
      !uniqueText(glossary.relatedTermIds, true) ||
      glossary.rejectedTerms.some((item) => !text(item.term) || !text(item.reason)) ||
      graph.nodes.find((node) => node.id === glossary.dependencyNodeId)?.kind !== "terminology"
    )
      throw new Error(`Glossary delta ${glossary.id} is malformed.`);
  }
  for (const rule of state.domainRules) {
    const angles = new Set(rule.scenarios.map((item) => item.angle));
    if (
      !text(rule.context) ||
      !uniqueText(rule.termIds) ||
      !uniqueText(rule.actors) ||
      !uniqueText(rule.conditions, true) ||
      !text(rule.outcome) ||
      !uniqueText(rule.exceptions, true) ||
      !rule.scenarios.length ||
      !angles.has("nominal") ||
      ![...angles].some((angle) => angle !== "nominal") ||
      new Set(rule.scenarios.map((item) => item.id)).size !== rule.scenarios.length ||
      graph.nodes.find((node) => node.id === rule.dependencyNodeId)?.kind !== "domain_rule"
    )
      throw new Error(`Domain rule ${rule.id} lacks valid stress scenarios.`);
    for (const scenario of rule.scenarios) {
      assertId(scenario.id, "Domain scenario");
      if (
        !text(scenario.startingSituation) ||
        !text(scenario.action) ||
        !text(scenario.expectedResult)
      )
        throw new Error(`Domain scenario ${scenario.id} is malformed.`);
    }
  }
  for (const decision of state.decisions) {
    if (
      !text(decision.context) ||
      !text(decision.materialityReason) ||
      decision.alternatives.length < 2 ||
      decision.alternatives.length > 8 ||
      new Set(decision.alternatives.map((item) => item.id)).size !== decision.alternatives.length ||
      !uniqueText(decision.evidenceRefs)
    )
      throw new Error(`Decision ${decision.id} alternatives are invalid.`);
    for (const alternative of decision.alternatives) {
      assertId(alternative.id, "Decision alternative");
      if (
        !text(alternative.label) ||
        !uniqueText(alternative.consequences) ||
        (alternative.excludedReason !== undefined && !text(alternative.excludedReason))
      )
        throw new Error(`Decision ${decision.id} alternative is malformed.`);
    }
    if (
      decision.selectedOptionId &&
      !decision.alternatives.some((item) => item.id === decision.selectedOptionId)
    )
      throw new Error(`Decision ${decision.id} selected option is unknown.`);
    if (
      ["resolved", "approved", "projected"].includes(decision.status) &&
      !decision.selectedOptionId
    )
      throw new Error(`Resolved decision ${decision.id} lacks explicit selection.`);
    const expectedKind = decision.owner === "shape" ? "technical_decision" : "decision";
    if (graph.nodes.find((node) => node.id === decision.dependencyNodeId)?.kind !== expectedKind)
      throw new Error(`Decision ${decision.id} dependency ownership is invalid.`);
  }
}

function uniqueText(values: readonly string[], allowEmpty = false): boolean {
  return (
    Array.isArray(values) &&
    (allowEmpty || values.length > 0) &&
    new Set(values).size === values.length &&
    values.every(text)
  );
}

function validateOwnershipEdges(graph: DependencyGraph): void {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const intakeKinds = new Set(["product", "terminology", "domain_rule", "domain_scenario"]);
  for (const node of graph.nodes) {
    if (!intakeKinds.has(node.kind)) continue;
    for (const dependencyId of node.dependsOn) {
      if (byId.get(dependencyId)?.kind === "technical_decision")
        throw new Error(`INTAKE node ${node.id} cannot depend on SHAPE technical decision.`);
    }
  }
}

function nodeResolved(state: DesignState, nodeId: string): boolean {
  const dimension = state.productBaseline.dimensions.find(
    (item) => item.dependencyNodeId === nodeId,
  );
  if (dimension) return dimension.status === "resolved" || dimension.status === "not_applicable";
  const record = [...state.glossaryDeltas, ...state.domainRules, ...state.decisions].find(
    (item) => item.dependencyNodeId === nodeId,
  );
  return Boolean(record && ["resolved", "approved", "projected"].includes(record.status));
}

function validateScores(scores: DesignFrontierCandidate["scores"], reason: string): void {
  if (
    !text(reason) ||
    Object.values(scores).some((score) => !Number.isInteger(score) || score < 0 || score > 5)
  )
    throw new Error("Design frontier score is invalid.");
}

function validateQuestion(question: ActiveDesignQuestion | undefined): void {
  if (!question) return;
  assertId(question.id, "Design question");
  assertId(question.decisionKey, "Design decision");
  if (!text(question.prompt) || !text(question.selectionReason))
    throw new Error("Design question prompt and selection reason are required.");
  if (question.owner === "intake" && question.kind === "technical")
    throw new Error("Technical question belongs to SHAPE.");
  if (question.owner === "shape" && question.kind !== "technical")
    throw new Error("Product/domain questions belong to INTAKE.");
  if (question.options && (question.options.length < 2 || question.options.length > 3))
    throw new Error("Design question requires two or three options.");
  if (
    question.recommendedOptionId &&
    !question.options?.some((item) => item.id === question.recommendedOptionId)
  )
    throw new Error("Design question recommendation is unknown.");
  if (
    !["choice", "elicitation"].includes(question.mode) ||
    (question.mode === "choice") !== Boolean(question.options) ||
    !question.freeFormAllowed ||
    !Number.isInteger(question.clarificationCount) ||
    question.clarificationCount < 0 ||
    !Array.isArray(question.directConsequences) ||
    question.directConsequences.some((item) => !text(item))
  )
    throw new Error("Design question interaction contract is invalid.");
}

function assertProvenance(value: DesignProvenance): void {
  if (!value || !Array.isArray(value.sourceRefs) || !Array.isArray(value.freshnessRefs))
    throw new Error("Design provenance is invalid.");
  for (const ref of [...value.sourceRefs, ...value.freshnessRefs]) assertId(ref, "Provenance");
}

function assertId(value: string, label: string): void {
  if (!ID.test(value)) throw new Error(`${label} id is invalid.`);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_TEXT;
}

function withDigest(input: Omit<DesignState, "digest"> | DesignState): DesignState {
  const base = { ...structuredClone(input), digest: undefined };
  return { ...(base as Omit<DesignState, "digest">), digest: digest(base) };
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

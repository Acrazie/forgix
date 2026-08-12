import { createHash, randomUUID } from "node:crypto";
import {
  MACRO_PHASES,
  STATE_MACHINE,
  isTaskStatus,
  type MacroPhase,
  type TaskStatus,
} from "./state-machine.js";
import {
  ALLOWED_MODEL_IDS,
  REASONING_EFFORTS,
  type ModelId,
  type QuotaPressure,
  type ReasoningEffort,
} from "./types.js";

export const LIFECYCLE_METRICS = Object.freeze([
  "model_calls",
  "delegations",
  "input_tokens",
  "output_tokens",
  "token_proxy_context_bytes",
  "context_bytes",
  "latency_ms",
  "capsule_reuses",
  "capsule_invalidations",
  "validation_runs",
  "correction_cycles",
  "review_lanes",
  "human_confirmations",
  "intake_questions",
  "intake_questions_avoided",
  "intake_recommendations_accepted",
  "intake_recommendations_modified",
  "intake_zero_question_paths",
  "intake_late_reopenings",
  "shape_discovery_sessions",
  "shape_planning_sessions",
  "shape_targeted_invalidations",
  "shape_evidence_reuses",
  "routing_decisions",
  "gates",
  "gate_preflight_passes",
  "gate_preflight_failures",
  "gate_approvals",
  "gate_change_requests",
  "gate_rejections",
  "gate_approval_reuses",
  "gate_targeted_returns",
  "blocks",
  "transition_errors",
  "resume_to_first_action_ms",
  "unused_phase_outputs",
  "duplicated_fields",
  "silent_resume_divergences",
  "false_success_detections",
] as const);

export type LifecycleMetric = (typeof LIFECYCLE_METRICS)[number];
export type MetricMeasurement = "measured" | "estimated";
export type MetricSource =
  | "state_history"
  | "native_token_api"
  | "explicit_token_estimate"
  | "context_bytes_proxy"
  | "monotonic_clock"
  | "orchestrator_counter"
  | "operator_audit";

export interface LifecycleMetricEventInput {
  runId: string;
  preparationProfile: "quick" | "plan" | "unselected";
  phase: MacroPhase;
  metric: LifecycleMetric;
  value: number;
  measurement: MetricMeasurement;
  source: MetricSource;
  sequence?: number;
  occurredAtEpochMs?: number;
  model?: ModelId;
  effort?: ReasoningEffort;
  quotaPressure?: QuotaPressure;
}

export interface LifecycleMetricEvent extends LifecycleMetricEventInput {
  schemaVersion: 1;
}

interface AvailableObservation {
  availability: "available";
  measurement: MetricMeasurement;
  source: MetricSource;
  value: number;
}

interface UnavailableObservation {
  availability: "unavailable";
}

export type MetricObservation = AvailableObservation | UnavailableObservation;

export interface LatencyObservationInput {
  value: number;
  measurement: "measured";
  source: "monotonic_clock";
}

export interface TokenUsageObservation {
  inputTokens: number;
  outputTokens: number;
  measurement: MetricMeasurement;
  source: "native_token_api" | "explicit_token_estimate";
}

export interface TraceSummaryInput {
  runId: string;
  preparationProfile: "quick" | "plan" | "unselected";
  source: "contract_fixture" | "runtime";
  statuses: readonly TaskStatus[];
  tokenUsage?: TokenUsageObservation;
  latency?: LatencyObservationInput;
  falseSuccessDetections: number;
  falseSuccessDetectionSource: "contract_tests" | "operator_audit";
}

export interface LifecycleTraceSummary {
  schemaVersion: 1;
  sampleIdHash: string;
  preparationProfile: "quick" | "plan" | "unselected";
  source: "contract_fixture" | "runtime";
  statuses: TaskStatus[];
  phases: MacroPhase[];
  transitions: number;
  gates: number;
  blocks: number;
  resumes: number;
  validationRuns: number;
  reviewRuns: number;
  assureResolutionCycles: number;
  terminalStatus: TaskStatus;
  falseSuccessDetections: number;
  falseSuccessDetectionSource: "contract_tests" | "operator_audit";
  tokenUsage:
    | { availability: "unavailable" }
    | ({ availability: "available" } & TokenUsageObservation);
  latency: MetricObservation;
}

export interface BaselineReport {
  schemaVersion: 1;
  baselineId: string;
  capturedAt: string;
  contractVersion: "P0";
  source: "contract_fixture";
  limitations: Array<
    "contract_fixture_not_runtime" | "token_telemetry_unavailable" | "latency_telemetry_unavailable"
  >;
  samples: LifecycleTraceSummary[];
}

const EVENT_KEYS = new Set([
  "runId",
  "preparationProfile",
  "phase",
  "metric",
  "value",
  "measurement",
  "source",
  "sequence",
  "occurredAtEpochMs",
  "model",
  "effort",
  "quotaPressure",
]);
const TOKEN_METRICS = new Set<LifecycleMetric>(["input_tokens", "output_tokens"]);

export function createLifecycleMetricEvent(input: LifecycleMetricEventInput): LifecycleMetricEvent {
  const unknown = Object.keys(input).filter((key) => !EVENT_KEYS.has(key));
  if (unknown.length) throw new Error(`Unknown metric event fields: ${unknown.join(", ")}.`);
  if (
    !isUuid(input.runId) ||
    !isPreparationProfile(input.preparationProfile) ||
    !(MACRO_PHASES as readonly string[]).includes(input.phase)
  ) {
    throw new Error("Metric event identity, preparation profile, or phase is invalid.");
  }
  if (
    !(LIFECYCLE_METRICS as readonly string[]).includes(input.metric) ||
    !nonNegativeFinite(input.value)
  ) {
    throw new Error("Metric event metric or value is invalid.");
  }
  if (input.sequence !== undefined && (!Number.isInteger(input.sequence) || input.sequence < 0))
    throw new Error("Metric sequence is invalid.");
  if (
    input.occurredAtEpochMs !== undefined &&
    (!Number.isInteger(input.occurredAtEpochMs) || input.occurredAtEpochMs < 0)
  )
    throw new Error("Metric timestamp is invalid.");
  validateDimensions(input);
  validateMeasurementSource(input.metric, input.measurement, input.source);
  return {
    schemaVersion: 1,
    runId: input.runId,
    preparationProfile: input.preparationProfile,
    phase: input.phase,
    metric: input.metric,
    value: input.value,
    measurement: input.measurement,
    source: input.source,
    ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
    ...(input.occurredAtEpochMs !== undefined
      ? { occurredAtEpochMs: input.occurredAtEpochMs }
      : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.effort !== undefined ? { effort: input.effort } : {}),
    ...(input.quotaPressure !== undefined ? { quotaPressure: input.quotaPressure } : {}),
  };
}

export function createMetricRunId(): string {
  return randomUUID();
}

export function tryCreateLifecycleMetricEvent(
  input: unknown,
):
  | { accepted: true; event: LifecycleMetricEvent }
  | { accepted: false; errorCode: "metric_rejected" } {
  try {
    return {
      accepted: true,
      event: createLifecycleMetricEvent(input as LifecycleMetricEventInput),
    };
  } catch {
    return { accepted: false, errorCode: "metric_rejected" };
  }
}

export function summarizeLifecycleTrace(input: TraceSummaryInput): LifecycleTraceSummary {
  if (
    !nonEmpty(input.runId) ||
    !isPreparationProfile(input.preparationProfile) ||
    !["contract_fixture", "runtime"].includes(input.source)
  ) {
    throw new Error("Trace identity, preparation profile, or source is invalid.");
  }
  if (input.source === "runtime" && !isUuid(input.runId))
    throw new Error("Runtime trace requires opaque UUID runId.");
  if (!Array.isArray(input.statuses) || input.statuses.length < 2 || input.statuses[0] !== "new") {
    throw new Error("Lifecycle trace must start at new and contain a transition.");
  }
  const statuses = [...input.statuses];
  for (const [index, status] of statuses.entries()) {
    if (!isTaskStatus(status)) throw new Error(`Unknown lifecycle status ${String(status)}.`);
    if (index === 0) continue;
    const from = statuses[index - 1] as TaskStatus;
    const contract = (
      STATE_MACHINE[from].transitions as Record<string, { guards: readonly string[] }>
    )[status];
    if (!contract) throw new Error(`Lifecycle trace edge ${from} -> ${status} is illegal.`);
  }
  const terminalStatus = statuses.at(-1) as TaskStatus;
  if (!STATE_MACHINE[terminalStatus].stable && !STATE_MACHINE[terminalStatus].terminal) {
    throw new Error(
      `Lifecycle trace must end at stable or terminal status; received ${terminalStatus}.`,
    );
  }
  const phases = unique(statuses.map((status, index) => tracePhase(status, statuses, index)));
  const edges = statuses.slice(1).map((to, index) => ({ from: statuses[index], to }));
  const falseSuccessDetections = input.falseSuccessDetections;
  if (!Number.isInteger(falseSuccessDetections) || falseSuccessDetections < 0)
    throw new Error("falseSuccessDetections must be a non-negative integer.");
  if (!["contract_tests", "operator_audit"].includes(input.falseSuccessDetectionSource))
    throw new Error("falseSuccessDetectionSource is required.");
  const expectedAuditSource =
    input.source === "contract_fixture" ? "contract_tests" : "operator_audit";
  if (input.falseSuccessDetectionSource !== expectedAuditSource)
    throw new Error(
      `Trace source ${input.source} requires false-success source ${expectedAuditSource}.`,
    );
  const tokenUsage = input.tokenUsage
    ? validateTokenUsage(input.tokenUsage)
    : { availability: "unavailable" as const };
  const latency =
    input.latency === undefined
      ? { availability: "unavailable" as const }
      : validateLatency(input.latency);
  return {
    schemaVersion: 1,
    sampleIdHash: sha256(input.runId),
    preparationProfile: input.preparationProfile,
    source: input.source,
    statuses,
    phases,
    transitions: edges.length,
    gates: edges.filter(({ from, to }) => to === "awaiting_approval" && from === "planning").length,
    blocks: edges.filter(({ to }) => to === "blocked").length,
    resumes: edges.filter(
      ({ from, to }) => from === "blocked" && to !== "cancelled" && to !== "failed",
    ).length,
    validationRuns: edges.filter(({ to }) => to === "verifying").length,
    reviewRuns: edges.filter(({ to }) => to === "reviewing").length,
    assureResolutionCycles: edges.filter(({ to }) => to === "resolving_assure").length,
    terminalStatus,
    falseSuccessDetections,
    falseSuccessDetectionSource: input.falseSuccessDetectionSource,
    tokenUsage,
    latency,
  };
}

export function buildBaselineReport(
  input: Omit<BaselineReport, "schemaVersion" | "samples"> & {
    traces: readonly TraceSummaryInput[];
  },
): BaselineReport {
  const samples = input.traces.map(summarizeLifecycleTrace);
  const report: BaselineReport = {
    schemaVersion: 1,
    baselineId: input.baselineId,
    capturedAt: input.capturedAt,
    contractVersion: input.contractVersion,
    source: input.source,
    limitations: [...input.limitations],
    samples,
  };
  const validation = validateBaselineReport(report);
  if (!validation.valid)
    throw new Error(`Invalid baseline report: ${validation.errors.join("; ")}.`);
  return report;
}

export function validateBaselineReport(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["report must be an object"] };
  exactKeys(
    value,
    [
      "schemaVersion",
      "baselineId",
      "capturedAt",
      "contractVersion",
      "source",
      "limitations",
      "samples",
    ],
    "report",
    errors,
  );
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (
    !nonEmpty(value.baselineId) ||
    !isIsoDate(value.capturedAt) ||
    value.contractVersion !== "P0" ||
    value.source !== "contract_fixture"
  )
    errors.push("report identity is invalid");
  const limitations = value.limitations;
  const allowedLimitations = [
    "contract_fixture_not_runtime",
    "token_telemetry_unavailable",
    "latency_telemetry_unavailable",
  ];
  if (
    !Array.isArray(limitations) ||
    JSON.stringify(limitations) !== JSON.stringify(allowedLimitations)
  )
    errors.push("limitations are invalid");
  if (!Array.isArray(value.samples) || value.samples.length !== 3)
    errors.push("baseline requires exactly three samples");
  else {
    const profiles: string[] = [];
    for (const [index, sample] of value.samples.entries())
      validateSummary(sample, index, profiles, errors);
    if (!profiles.includes("quick") || !profiles.includes("plan"))
      errors.push("samples must cover quick and plan");
  }
  return { valid: errors.length === 0, errors };
}

function validateSummary(
  value: unknown,
  index: number,
  profiles: string[],
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`sample ${index} must be an object`);
    return;
  }
  exactKeys(
    value,
    [
      "schemaVersion",
      "sampleIdHash",
      "preparationProfile",
      "source",
      "statuses",
      "phases",
      "transitions",
      "gates",
      "blocks",
      "resumes",
      "validationRuns",
      "reviewRuns",
      "assureResolutionCycles",
      "terminalStatus",
      "falseSuccessDetections",
      "falseSuccessDetectionSource",
      "tokenUsage",
      "latency",
    ],
    `sample ${index}`,
    errors,
  );
  if (
    value.schemaVersion !== 1 ||
    !isPreparationProfile(value.preparationProfile) ||
    value.source !== "contract_fixture" ||
    !/^[a-f0-9]{64}$/.test(String(value.sampleIdHash))
  ) {
    errors.push(`sample ${index} identity is invalid`);
    return;
  }
  profiles.push(value.preparationProfile);
  if (!Number.isInteger(value.falseSuccessDetections) || Number(value.falseSuccessDetections) < 0)
    errors.push(`sample ${index} falseSuccessDetections is invalid`);
  if (value.falseSuccessDetectionSource !== "contract_tests")
    errors.push(`sample ${index} falseSuccessDetectionSource is invalid`);
  try {
    const rebuilt = summarizeLifecycleTrace({
      runId: "validation-placeholder",
      preparationProfile: value.preparationProfile,
      source: value.source,
      statuses: value.statuses as TaskStatus[],
      falseSuccessDetections: value.falseSuccessDetections as number,
      falseSuccessDetectionSource: value.falseSuccessDetectionSource as "contract_tests",
    });
    for (const field of [
      "phases",
      "transitions",
      "gates",
      "blocks",
      "resumes",
      "validationRuns",
      "reviewRuns",
      "assureResolutionCycles",
      "terminalStatus",
    ] as const) {
      if (JSON.stringify(value[field]) !== JSON.stringify(rebuilt[field]))
        errors.push(`sample ${index} ${field} is inconsistent with statuses`);
    }
  } catch (error) {
    errors.push(
      `sample ${index} trace invalid: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
  if (!isUnavailable(value.tokenUsage))
    errors.push(`sample ${index} tokenUsage must be unavailable for P0 fixture`);
  if (!isUnavailable(value.latency))
    errors.push(`sample ${index} latency must be unavailable for P0 fixture`);
}

function validateMeasurementSource(
  metric: LifecycleMetric,
  measurement: MetricMeasurement,
  source: MetricSource,
): void {
  const valid =
    (TOKEN_METRICS.has(metric) && measurement === "measured" && source === "native_token_api") ||
    (TOKEN_METRICS.has(metric) &&
      measurement === "estimated" &&
      source === "explicit_token_estimate") ||
    (metric === "token_proxy_context_bytes" &&
      measurement === "estimated" &&
      source === "context_bytes_proxy") ||
    ((metric === "latency_ms" || metric === "resume_to_first_action_ms") &&
      measurement === "measured" &&
      source === "monotonic_clock") ||
    (metric === "false_success_detections" &&
      measurement === "measured" &&
      source === "operator_audit") ||
    (["unused_phase_outputs", "duplicated_fields", "silent_resume_divergences"].includes(metric) &&
      measurement === "measured" &&
      source === "operator_audit") ||
    ([
      "model_calls",
      "delegations",
      "context_bytes",
      "capsule_reuses",
      "capsule_invalidations",
      "review_lanes",
      "human_confirmations",
      "routing_decisions",
      "intake_questions",
      "intake_questions_avoided",
      "intake_recommendations_accepted",
      "intake_recommendations_modified",
      "intake_zero_question_paths",
      "intake_late_reopenings",
      "shape_discovery_sessions",
      "shape_planning_sessions",
      "shape_targeted_invalidations",
      "shape_evidence_reuses",
      "gate_preflight_passes",
      "gate_preflight_failures",
      "gate_approval_reuses",
    ].includes(metric) &&
      measurement === "measured" &&
      source === "orchestrator_counter") ||
    ([
      "validation_runs",
      "correction_cycles",
      "gates",
      "gate_approvals",
      "gate_change_requests",
      "gate_rejections",
      "gate_targeted_returns",
      "blocks",
      "transition_errors",
    ].includes(metric) &&
      measurement === "measured" &&
      source === "state_history");
  if (!valid) throw new Error(`Metric ${metric} measurement/source mismatch.`);
}

function validateDimensions(input: LifecycleMetricEventInput): void {
  if (input.metric === "model_calls") {
    if (
      !(ALLOWED_MODEL_IDS as readonly string[]).includes(String(input.model)) ||
      !(REASONING_EFFORTS as readonly string[]).includes(String(input.effort))
    ) {
      throw new Error("model_calls requires allowlisted model and effort dimensions.");
    }
  } else if (input.model !== undefined || input.effort !== undefined) {
    throw new Error(`Metric ${input.metric} cannot contain model or effort dimensions.`);
  }
  if (input.metric === "model_calls" || input.metric === "routing_decisions") {
    if (!["normal", "warning", "critical", "unknown"].includes(String(input.quotaPressure)))
      throw new Error(`${input.metric} requires quotaPressure dimension.`);
  } else if (input.quotaPressure !== undefined) {
    throw new Error(`Metric ${input.metric} cannot contain quotaPressure dimension.`);
  }
}

function validateTokenUsage(value: TokenUsageObservation): LifecycleTraceSummary["tokenUsage"] {
  if (!nonNegativeFinite(value.inputTokens) || !nonNegativeFinite(value.outputTokens))
    throw new Error("Token usage values are invalid.");
  validateMeasurementSource("input_tokens", value.measurement, value.source);
  return { availability: "available", ...value };
}

function validateLatency(input: LatencyObservationInput): AvailableObservation {
  if (
    !isRecord(input) ||
    Object.keys(input).some((key) => !["value", "measurement", "source"].includes(key)) ||
    Object.keys(input).length !== 3 ||
    !nonNegativeFinite(input.value) ||
    input.measurement !== "measured" ||
    input.source !== "monotonic_clock"
  )
    throw new Error("Latency observation is invalid or mislabeled.");
  return { availability: "available", ...input };
}

function tracePhase(
  status: TaskStatus,
  statuses: readonly TaskStatus[],
  index: number,
): MacroPhase {
  const rule = STATE_MACHINE[status].macroPhase;
  if ((MACRO_PHASES as readonly string[]).includes(rule)) return rule as MacroPhase;
  if (index === 0) throw new Error(`Cannot derive trace phase for ${status}.`);
  return tracePhase(statuses[index - 1] as TaskStatus, statuses, index - 1);
}

function unique<T>(values: readonly T[]): T[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
  errors: string[],
): void {
  const extras = Object.keys(value).filter((key) => !expected.includes(key));
  const missing = expected.filter((key) => !Object.hasOwn(value, key));
  if (extras.length) errors.push(`${label} has unknown fields: ${extras.join(", ")}`);
  if (missing.length) errors.push(`${label} lacks fields: ${missing.join(", ")}`);
}

function isUnavailable(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 1 && value.availability === "unavailable";
}

function isPreparationProfile(value: unknown): value is "quick" | "plan" | "unselected" {
  return value === "quick" || value === "plan" || value === "unselected";
}

function isIsoDate(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function nonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

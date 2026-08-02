import { randomUUID } from "node:crypto";
import { constants, lstatSync, realpathSync } from "node:fs";
import * as fs from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type {
  BenchmarkDeviationFact,
  BenchmarkRecord,
  BenchmarkSurveyAnswers,
  TaskState,
} from "./types.js";

export const BENCHMARK_DIRECTORY = join(".codex", "benchmarks");
const ELIGIBLE_OUTCOMES = new Set(["finished", "failed"]);
const MAX_COMMENT = 2_000;
const MAX_FILES = 256;
const SECRET = /\b(?:sk-[A-Za-z0-9_-]{8,}|(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+)\b/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export interface BenchmarkActualSurface {
  createdFiles: string[];
  validationComplete: boolean;
}

export interface BenchmarkAuthority {
  plannedFiles?: string[];
  forbidNewFiles?: boolean;
  validationRequired?: boolean;
}

export interface CreateBenchmarkRecordInput {
  taskId: string;
  preparationProfile: "quick" | "plan";
  outcome: BenchmarkRecord["outcome"];
  survey: BenchmarkSurveyAnswers;
  actual: BenchmarkActualSurface;
  canonicalChangeContract: BenchmarkAuthority;
  recordedAt?: string;
}

export interface BenchmarkSummary {
  schemaVersion: 1;
  recordCount: number;
  satisfactionAverage: number | null;
  conformance: Record<BenchmarkSurveyAnswers["conformance"], number>;
  pluginValue: Record<BenchmarkSurveyAnswers["pluginValue"], number>;
  deviations: Record<BenchmarkDeviationFact["code"], number>;
  outcomes: Record<BenchmarkRecord["outcome"], number>;
}

export function shouldOfferBenchmarkSurvey(
  state: Pick<TaskState, "benchmarkEnabled" | "status">,
): boolean {
  return state.benchmarkEnabled === true && ELIGIBLE_OUTCOMES.has(state.status);
}

export function createBenchmarkRecord(input: CreateBenchmarkRecordInput): BenchmarkRecord {
  assertSafeTaskId(input.taskId);
  if (!ELIGIBLE_OUTCOMES.has(input.outcome))
    throw new Error("Benchmark survey is available only after finished or failed.");
  const survey = validateSurvey(input.survey);
  const authority = input.canonicalChangeContract;
  if (!authority) throw new Error("Benchmark requires canonical Shape contract authority.");
  return {
    schemaVersion: 1,
    taskId: input.taskId,
    recordedAt: normalizeAt(input.recordedAt),
    preparationProfile: input.preparationProfile,
    outcome: input.outcome,
    authority: "canonical_change_contract",
    survey,
    deviations: classifyBenchmarkDeviations(authority, input.actual),
  };
}

export function classifyBenchmarkDeviations(
  authority: BenchmarkAuthority,
  actual: BenchmarkActualSurface,
): BenchmarkDeviationFact[] {
  const planned = new Set((authority.plannedFiles ?? []).map(normalizeSurface).filter(Boolean));
  const created = [...new Set(actual.createdFiles.map(normalizeSurface).filter(Boolean))].slice(
    0,
    MAX_FILES,
  );
  const deviations: BenchmarkDeviationFact[] = [];
  for (const file of created) {
    if (authority.forbidNewFiles) deviations.push({ code: "forbidden_new_file", surfaceRef: file });
    else if (planned.size && !planned.has(file))
      deviations.push({ code: "unplanned_new_file", surfaceRef: file });
  }
  if (authority.validationRequired && !actual.validationComplete) {
    deviations.push({ code: "missing_validation", surfaceRef: "validation" });
  }
  return deviations;
}

export class BenchmarkStore {
  readonly workspaceRoot: string;
  readonly root: string;

  constructor(workspaceRoot: string) {
    try {
      this.workspaceRoot = realpathSync(resolve(workspaceRoot));
      if (!lstatSync(this.workspaceRoot).isDirectory()) throw new Error("not directory");
    } catch {
      throw new Error("Benchmark workspace root must be an existing directory.");
    }
    this.root = resolve(this.workspaceRoot, BENCHMARK_DIRECTORY);
  }

  path(taskId: string): string {
    assertSafeTaskId(taskId);
    return join(this.root, `${taskId}.json`);
  }

  async write(record: BenchmarkRecord): Promise<void> {
    const safeRecord = sanitizeBenchmarkRecord(record);
    await this.#ensureRoot(true);
    const destination = this.path(safeRecord.taskId);
    const temporary = join(this.root, `.${safeRecord.taskId}.${randomUUID()}.tmp`);
    try {
      const handle = await fs.open(
        temporary,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        0o600,
      );
      try {
        await handle.writeFile(`${JSON.stringify(safeRecord, null, 2)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temporary, destination);
    } finally {
      await fs.unlink(temporary).catch(() => undefined);
    }
  }

  async summary(): Promise<BenchmarkSummary> {
    if (!(await this.#ensureRoot(false))) return emptySummary();
    let names: string[];
    try {
      names = await fs.readdir(this.root);
    } catch (error) {
      if (hasCode(error, "ENOENT")) return emptySummary();
      throw error;
    }
    const records: BenchmarkRecord[] = [];
    for (const name of names.toSorted()) {
      if (!name.endsWith(".json") || basename(name) !== name) continue;
      try {
        const parsed = JSON.parse(await fs.readFile(join(this.root, name), "utf8")) as unknown;
        records.push(sanitizeBenchmarkRecord(parsed));
      } catch {
        // Incomplete/corrupt local records never count.
      }
    }
    return summarizeBenchmarkRecords(records);
  }

  async #ensureRoot(create: boolean): Promise<boolean> {
    for (const directory of [join(this.workspaceRoot, ".codex"), this.root]) {
      if (create)
        await fs.mkdir(directory, { mode: 0o700 }).catch((error) => {
          if (!hasCode(error, "EEXIST")) throw error;
        });
      let metadata;
      try {
        metadata = await fs.lstat(directory);
      } catch (error) {
        if (!create && hasCode(error, "ENOENT")) return false;
        throw error;
      }
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error("Benchmark path contains a symlink or non-directory component.");
      }
    }
    if ((await fs.realpath(this.root)) !== this.root) {
      throw new Error("Benchmark root resolves outside canonical workspace path.");
    }
    return true;
  }
}

export function createBenchmarkStore(workspaceRoot: string): BenchmarkStore {
  return new BenchmarkStore(workspaceRoot);
}

export async function tryWriteBenchmarkRecord(
  store: Pick<BenchmarkStore, "write">,
  record: BenchmarkRecord | undefined,
): Promise<{ written: boolean; error?: "benchmark_write_failed" }> {
  if (!record) return { written: false };
  try {
    await store.write(record);
    return { written: true };
  } catch {
    return { written: false, error: "benchmark_write_failed" };
  }
}

export function summarizeBenchmarkRecords(records: readonly BenchmarkRecord[]): BenchmarkSummary {
  const summary = emptySummary();
  let satisfaction = 0;
  for (const record of records) {
    const safeRecord = sanitizeBenchmarkRecord(record);
    summary.recordCount += 1;
    satisfaction += safeRecord.survey.satisfaction;
    summary.conformance[safeRecord.survey.conformance] += 1;
    summary.pluginValue[safeRecord.survey.pluginValue] += 1;
    summary.outcomes[safeRecord.outcome] += 1;
    for (const deviation of safeRecord.deviations) summary.deviations[deviation.code] += 1;
  }
  summary.satisfactionAverage = summary.recordCount
    ? Math.round((satisfaction / summary.recordCount) * 100) / 100
    : null;
  return summary;
}

function emptySummary(): BenchmarkSummary {
  return {
    schemaVersion: 1,
    recordCount: 0,
    satisfactionAverage: null,
    conformance: { yes: 0, partial: 0, no: 0 },
    pluginValue: { useful: 0, neutral: 0, counterproductive: 0 },
    deviations: {
      unplanned_new_file: 0,
      forbidden_new_file: 0,
      missing_validation: 0,
    },
    outcomes: { finished: 0, failed: 0 },
  };
}

function validateSurvey(value: BenchmarkSurveyAnswers): BenchmarkSurveyAnswers {
  if (!isRecord(value)) throw new Error("Benchmark survey must be an object.");
  const allowed = new Set(["satisfaction", "conformance", "pluginValue", "comment"]);
  if (Object.keys(value).some((key) => !allowed.has(key)))
    throw new Error("Benchmark survey contains unsupported data.");
  if (![1, 2, 3, 4, 5].includes(value.satisfaction))
    throw new Error("Benchmark satisfaction must be 1–5.");
  if (!["yes", "partial", "no"].includes(value.conformance))
    throw new Error("Benchmark conformance is invalid.");
  if (!["useful", "neutral", "counterproductive"].includes(value.pluginValue))
    throw new Error("Benchmark plugin value is invalid.");
  const comment = sanitizeComment(value.comment);
  return {
    satisfaction: value.satisfaction,
    conformance: value.conformance,
    pluginValue: value.pluginValue,
    ...(comment ? { comment } : {}),
  };
}

function sanitizeBenchmarkRecord(value: unknown): BenchmarkRecord {
  validateRecord(value);
  return {
    schemaVersion: 1,
    taskId: value.taskId,
    recordedAt: value.recordedAt,
    preparationProfile: value.preparationProfile,
    outcome: value.outcome,
    authority: value.authority,
    survey: validateSurvey(value.survey),
    deviations: value.deviations.map((deviation) => ({ ...deviation })),
  };
}

function validateRecord(value: unknown): asserts value is BenchmarkRecord {
  if (!isRecord(value)) throw new Error("Benchmark record must be an object.");
  const keys = Object.keys(value);
  const allowed = new Set([
    "schemaVersion",
    "taskId",
    "recordedAt",
    "preparationProfile",
    "outcome",
    "authority",
    "survey",
    "deviations",
  ]);
  if (keys.some((key) => !allowed.has(key)))
    throw new Error("Benchmark record contains unsupported data.");
  if (value.schemaVersion !== 1 || typeof value.taskId !== "string")
    throw new Error("Benchmark record identity is invalid.");
  assertSafeTaskId(value.taskId);
  if (typeof value.recordedAt !== "string" || Number.isNaN(Date.parse(value.recordedAt)))
    throw new Error("Benchmark recordedAt is invalid.");
  if (!["quick", "plan"].includes(value.preparationProfile as string))
    throw new Error("Benchmark preparation profile is invalid.");
  if (typeof value.outcome !== "string" || !ELIGIBLE_OUTCOMES.has(value.outcome))
    throw new Error("Benchmark outcome is invalid.");
  if (value.authority !== "canonical_change_contract")
    throw new Error("Benchmark authority must be canonical Shape contract.");
  validateSurvey(value.survey as BenchmarkSurveyAnswers);
  if (!Array.isArray(value.deviations) || value.deviations.length > MAX_FILES + 2)
    throw new Error("Benchmark deviations are invalid.");
  for (const deviation of value.deviations) {
    if (
      !isRecord(deviation) ||
      !["unplanned_new_file", "forbidden_new_file", "missing_validation"].includes(
        deviation.code as string,
      ) ||
      typeof deviation.surfaceRef !== "string" ||
      !deviation.surfaceRef ||
      deviation.surfaceRef.length > 512 ||
      Object.keys(deviation).some((key) => key !== "code" && key !== "surfaceRef")
    ) {
      throw new Error("Benchmark deviation is invalid.");
    }
  }
}

function sanitizeComment(value: unknown): string {
  if (typeof value !== "string") return "";
  return (
    value
      .replace(SECRET, "[REDACTED]")
      .replace(EMAIL, "[REDACTED_EMAIL]")
      // oxlint-disable-next-line eslint/no-control-regex -- NUL bytes are intentionally removed from persisted input.
      .replace(/\u0000/g, "")
      .trim()
      .slice(0, MAX_COMMENT)
  );
}

function normalizeSurface(value: unknown): string {
  if (typeof value !== "string") return "";
  const safe = value
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    // oxlint-disable-next-line eslint/no-control-regex -- NUL bytes are intentionally removed from path input.
    .replace(/\u0000/g, "")
    .trim();
  if (!safe || safe.startsWith("/") || safe.split("/").includes("..")) return "";
  return safe.slice(0, 512);
}

function normalizeAt(value?: string): string {
  if (value && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return new Date().toISOString();
}

function assertSafeTaskId(taskId: string): void {
  // oxlint-disable-next-line eslint/no-control-regex -- NUL is an explicitly forbidden path byte.
  if (!taskId || taskId === "." || taskId === ".." || /[/\\\u0000]/.test(taskId)) {
    throw new Error("Benchmark task ID must be one non-traversing path segment.");
  }
}

function hasCode(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

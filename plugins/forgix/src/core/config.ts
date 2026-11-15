import {
  cancel as clackCancel,
  intro as clackIntro,
  note as clackNote,
  outro as clackOutro,
  select as clackSelect,
  text as clackText,
} from "@clack/prompts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  MODEL_COST_MULTIPLIERS,
  MODEL_COST_PROFILES,
  ROUTING_POLICY_VERSION,
  ROUTING_TASKS,
  chooseRoute,
} from "./routing.js";
import { ConfigValidationError, PolicyError, validateSchema } from "./schema.js";
import { createWorkspaceStore } from "./store.js";
import {
  HARNESS_IDS,
  REASONING_EFFORTS,
  type CliResult,
  type HarnessPreference,
  type ModelCapability,
  type QuotaPressure,
  type ResolvedSubscriptionPlan,
  type RiskLevel,
  type RoutingDecision,
  type SubscriptionConfig,
} from "../types.js";

export interface ConfigSource {
  source: string;
  value: Record<string, unknown>;
}

export interface LoadConfigOptions {
  cwd?: string;
  home?: string;
  flags?: Record<string, unknown>;
}

export interface ResolvedConfig {
  value: Record<string, unknown>;
  provenance: Record<string, string>;
}

export const DEFAULT_SUBSCRIPTION_CONFIG: SubscriptionConfig = {
  plan: "auto",
  quota: {
    warningPercent: 50,
    criticalPercent: 80,
    unknownPolicy: "conservative",
  },
  modelAllowlist: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"],
  modelCosts: MODEL_COST_PROFILES,
};

export const DEFAULT_CONFIG: Record<string, unknown> = {
  schemaVersion: 1,
  worktree: { mode: "auto" },
  merge: "never",
  integrations: { plugins: [], skills: [] },
  subscription: DEFAULT_SUBSCRIPTION_CONFIG,
};

export function validateConfigSource(value: Record<string, unknown>, source = "config"): void {
  const candidate = mergeForValidation(DEFAULT_CONFIG, value);
  const result = validateSchema("config", candidate);
  if (!result.valid) {
    const first = result.errors[0] as { instancePath?: string; message?: string } | undefined;
    throw new ConfigValidationError(
      `Invalid configuration from ${source} at ${first?.instancePath || "/"}: ${first?.message ?? "schema validation failed"}.`,
      source,
      result.errors,
    );
  }
}

export function loadConfigSources(options: LoadConfigOptions = {}): ConfigSource[] {
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? process.env.HOME ?? "";
  const files: Array<{ source: string; path: string }> = [
    ...(home ? [{ source: "user", path: join(home, ".forgix", "config.yaml") }] : []),
    { source: "repo", path: join(cwd, ".forgix", "config.yaml") },
    { source: "local", path: join(cwd, ".forgix", "config.local.yaml") },
  ];
  const sources: ConfigSource[] = [];
  for (const file of files) {
    if (!existsSync(file.path)) continue;
    const parsed = parseYaml(readFileSync(file.path, "utf8")) as unknown;
    if (!isRecord(parsed)) {
      throw new ConfigValidationError(
        `Invalid configuration from ${file.source}: root must be an object.`,
        file.source,
        [],
      );
    }
    sources.push({ source: file.source, value: parsed });
  }
  if (options.flags) sources.push({ source: "flags", value: options.flags });
  return sources;
}

export function resolveConfig(sources: ConfigSource[]): ResolvedConfig {
  const suppliedDefaults = sources.some((source) => source.source === "defaults");
  const ordered = suppliedDefaults
    ? sources
    : [{ source: "defaults", value: DEFAULT_CONFIG }, ...sources];
  for (const source of ordered) validateConfigSource(source.value, source.source);
  const value: Record<string, unknown> = {};
  const provenance: Record<string, string> = {};
  for (const source of ordered) merge(value, source.value, source.source, provenance);
  return { value, provenance };
}

export function explainConfig(config: ResolvedConfig): {
  value: Record<string, unknown>;
  provenance: Record<string, string>;
} {
  return {
    value: copy(config.value) as Record<string, unknown>,
    provenance: { ...config.provenance },
  };
}

export interface PolicyInput {
  schemaVersion: number;
  requirements: Record<string, unknown>;
  prohibitions: Record<string, unknown>;
  bounds: Record<string, unknown>;
  locks: string[];
}

export function applyPolicy(config: ResolvedConfig, policy: PolicyInput): ResolvedConfig {
  for (const [path, requiredValue] of Object.entries(policy.requirements)) {
    if (readPath(config.value, path) !== requiredValue) {
      throw new PolicyError(
        `Policy requires ${path} to be ${JSON.stringify(requiredValue)}.`,
        path,
        config.provenance[path],
      );
    }
  }
  for (const [path, forbiddenValue] of Object.entries(policy.prohibitions)) {
    if (readPath(config.value, path) === forbiddenValue) {
      throw new PolicyError(
        `Policy prohibits ${path} from being ${JSON.stringify(forbiddenValue)}.`,
        path,
        config.provenance[path],
      );
    }
  }
  return config;
}

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

export interface PromptChoice<Value extends string> {
  value: Value;
  label: string;
  hint?: string | undefined;
}

export interface InitPromptAdapter {
  intro(message: string): void;
  outro(message: string): void;
  note(message: string, title?: string): void;
  cancel(message: string): void;
  select<Value extends string>(options: {
    message: string;
    choices: PromptChoice<Value>[];
    initialValue: Value;
  }): Promise<Value | symbol>;
  text(options: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
    validate?: (value: string) => string | undefined;
  }): Promise<string | symbol>;
}

export interface InitOptions {
  cwd?: string;
  home?: string;
  scope?: "repo" | "user";
  global?: boolean;
  prompts?: InitPromptAdapter;
}

type WorktreeMode = "auto" | "required";
type InitSubscriptionPlan = "auto" | "plus" | "pro_5x" | "pro_20x";
type ReviewAction = "write" | "harness" | "workflow" | "subscription" | "integrations" | "cancel";

interface InitDraft {
  harness: HarnessPreference;
  worktreeMode: WorktreeMode;
  plan: InitSubscriptionPlan;
  warningPercent: number;
  criticalPercent: number;
  plugins: string[];
  skills: string[];
}

const INTEGRATION_ID = /^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9][A-Za-z0-9._/-]*)?$/;
const INIT_RELATIVE_CONFIG_PATH = ".forgix/config.yaml";

export function buildRoutingPreview(
  plan: InitSubscriptionPlan,
  pressure: QuotaPressure = "normal",
): RoutingDecision[] {
  const resolvedPlan: ResolvedSubscriptionPlan = plan === "auto" ? "unknown" : plan;
  const models: ModelCapability[] = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"].map((id) => ({
    id: id as ModelCapability["id"],
    supportedReasoningEfforts: [...REASONING_EFFORTS],
  }));
  return ROUTING_TASKS.map((task) =>
    chooseRoute(
      {
        schemaVersion: 1,
        capturedAt: "preview",
        plan: resolvedPlan,
        account: {},
        quota: { pressure, source: "unknown" },
        models,
        warnings: [],
        provenance: {
          plan: plan === "auto" ? "unknown" : "config",
          quota: "unknown",
          models: "model/list",
        },
      },
      task,
    ),
  );
}

export async function runInit(options: InitOptions = {}): Promise<CliResult> {
  if (!options.prompts && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new Error("init requires an interactive terminal.");
  }

  const prompts = options.prompts ?? createClackAdapter();
  const useUserScope = options.scope === "user" || options.global === true;
  const targetRoot = useUserScope
    ? (options.home ?? process.env.HOME ?? "")
    : (options.cwd ?? process.cwd());
  if (!targetRoot) {
    throw new ConfigValidationError(
      "Home directory is required for user configuration.",
      "user",
      [],
    );
  }

  const store = createWorkspaceStore(targetRoot);
  const path = join(store.workspaceRoot, INIT_RELATIVE_CONFIG_PATH);
  const existingContent = await store.readText(INIT_RELATIVE_CONFIG_PATH, true);
  const existed = existingContent !== undefined;
  const current = existed ? parseConfigContent(existingContent, path) : {};
  const initialDraft = draftFromConfiguration(current);

  prompts.intro("Forgix · project setup");
  prompts.note(
    "Configure workflow isolation, subscription-aware routing, quota safeguards, and optional integrations.\nNo model choice is required: Forgix assigns models and reasoning automatically.",
    "What this wizard does",
  );

  try {
    let draft = await collectHarness(prompts, initialDraft);
    draft = await collectWorkflow(prompts, draft);
    if (usesCodexRouting(draft.harness)) {
      draft = await collectSubscription(prompts, draft);
    }
    draft = await collectIntegrations(prompts, draft);

    const outcome = await reviewInitDraft(prompts, store, path, current, draft, existed);
    return outcome;
  } catch (error) {
    if (error instanceof InitCancelledError) return cancelled(prompts, path);
    throw error;
  }
}

async function reviewInitDraft(
  prompts: InitPromptAdapter,
  store: ReturnType<typeof createWorkspaceStore>,
  path: string,
  current: Record<string, unknown>,
  initialDraft: InitDraft,
  existed: boolean,
): Promise<CliResult> {
  let draft = initialDraft;
  const config = buildConfiguration(current, draft);
  validateConfigSource(config, "init");
  prompts.note(renderConfigurationSummary(path, draft), "Configuration summary");
  if (usesCodexRouting(draft.harness)) {
    prompts.note(
      renderRoutingSummary(draft.plan, "normal"),
      `Automatic routing · ${ROUTING_POLICY_VERSION}`,
    );
  } else {
    prompts.note(
      "Host-native routing active: Codex app-server and gpt-5.6-* quotas are not required.",
      `Host-native routing · ${ROUTING_POLICY_VERSION}`,
    );
  }

  const choices: PromptChoice<ReviewAction>[] = [
    {
      value: "write",
      label: existed ? "Update configuration" : "Create configuration",
      hint: path,
    },
    {
      value: "harness",
      label: "Edit target harness",
      hint: "Auto, Codex, Claude Code, or Antigravity",
    },
    {
      value: "workflow",
      label: "Edit workflow behavior",
      hint: "Worktree isolation",
    },
    ...(usesCodexRouting(draft.harness)
      ? [
          {
            value: "subscription" as const,
            label: "Edit subscription and quota",
            hint: "Plan and pressure thresholds",
          },
        ]
      : []),
    {
      value: "integrations",
      label: "Edit integrations",
      hint: "External plugin and skill allowlists",
    },
    { value: "cancel", label: "Cancel", hint: "Leave existing files unchanged" },
  ];

  const action = await required(
    prompts,
    prompts.select<ReviewAction>({
      message: existed
        ? "Review complete. What should Forgix do?"
        : "Configuration ready. What should Forgix do?",
      initialValue: "write",
      choices,
    }),
  );

  if (action === "cancel") return cancelled(prompts, path);
  if (action === "harness") {
    const previousHarness = draft.harness;
    draft = await collectHarness(prompts, draft);
    if (!usesCodexRouting(previousHarness) && usesCodexRouting(draft.harness)) {
      draft = await collectSubscription(prompts, draft);
    }
    return reviewInitDraft(prompts, store, path, current, draft, existed);
  }
  if (action === "workflow") {
    draft = await collectWorkflow(prompts, draft);
    return reviewInitDraft(prompts, store, path, current, draft, existed);
  }
  if (action === "subscription") {
    draft = await collectSubscription(prompts, draft);
    return reviewInitDraft(prompts, store, path, current, draft, existed);
  }
  if (action === "integrations") {
    draft = await collectIntegrations(prompts, draft);
    return reviewInitDraft(prompts, store, path, current, draft, existed);
  }

  const yaml = stringifyYaml(config, { lineWidth: 0 });
  await store.writeTextAtomically(INIT_RELATIVE_CONFIG_PATH, yaml);
  prompts.outro(`Configuration ${existed ? "updated" : "created"}: ${path}`);
  return { command: "init", status: existed ? "updated" : "created", data: { path, config } };
}

function usesCodexRouting(harness: HarnessPreference): boolean {
  return harness === "codex" || harness === "auto";
}

function totalSteps(harness: HarnessPreference): number {
  return usesCodexRouting(harness) ? 4 : 3;
}

async function collectHarness(prompts: InitPromptAdapter, draft: InitDraft): Promise<InitDraft> {
  prompts.note(
    "Choose which agent harness runs Forgix routing in this repository.",
    "1 · Target harness",
  );
  const harness = await required(
    prompts,
    prompts.select<HarnessPreference>({
      message: "Which harness should Forgix target in this repository?",
      initialValue: draft.harness,
      choices: [
        {
          value: "auto",
          label: "Auto-detect active harness",
          hint: "Recommended — detects Codex, Claude Code, or Antigravity at runtime",
        },
        {
          value: "codex",
          label: "Codex",
          hint: "Uses Codex app-server and gpt-5.6-* quota-aware routing",
        },
        {
          value: "claude",
          label: "Claude Code",
          hint: "Uses host-native Claude Code model and session",
        },
        {
          value: "antigravity",
          label: "Antigravity",
          hint: "Uses host-native Antigravity model and session",
        },
      ],
    }),
  );
  return { ...draft, harness };
}

async function collectWorkflow(prompts: InitPromptAdapter, draft: InitDraft): Promise<InitDraft> {
  prompts.note(
    "Choose how Forgix isolates changes.",
    `2/${totalSteps(draft.harness)} · Workflow behavior`,
  );
  const worktreeMode = await required(
    prompts,
    prompts.select<WorktreeMode>({
      message: "How should isolated Git worktrees be used?",
      initialValue: draft.worktreeMode,
      choices: [
        {
          value: "auto",
          label: "Automatic (recommended)",
          hint: "Require isolation only when workflow risk needs it",
        },
        {
          value: "required",
          label: "Always required",
          hint: "Every applicable change runs in an isolated worktree",
        },
      ],
    }),
  );
  return { ...draft, worktreeMode };
}

async function collectSubscription(
  prompts: InitPromptAdapter,
  draft: InitDraft,
): Promise<InitDraft> {
  prompts.note(
    "Your plan controls available routing depth. Forgix still chooses each model by skill, workflow risk, and initial quota pressure.",
    "3/4 · Subscription and quota",
  );
  const plan = await required(
    prompts,
    prompts.select<InitSubscriptionPlan>({
      message: "Which Codex subscription capacity should this project use?",
      initialValue: draft.plan,
      choices: [
        {
          value: "auto",
          label: "Detect automatically (recommended)",
          hint: "Read account plan once at workflow start; unknown uses Plus baseline",
        },
        { value: "plus", label: "Codex Plus", hint: "1x capacity · conservative routing depth" },
        {
          value: "pro_5x",
          label: "Codex Pro 5x",
          hint: "5x capacity · deeper reasoning on high-leverage skills",
        },
        {
          value: "pro_20x",
          label: "Codex Pro 20x",
          hint: "20x capacity · deepest default routing",
        },
      ],
    }),
  );

  const thresholds = await promptQuotaThresholds(
    prompts,
    draft.warningPercent,
    draft.criticalPercent,
  );
  return {
    ...draft,
    plan,
    warningPercent: thresholds.warningPercent,
    criticalPercent: thresholds.criticalPercent,
  };
}

async function promptQuotaThresholds(
  prompts: InitPromptAdapter,
  initialWarning: number,
  initialCritical: number,
): Promise<{ warningPercent: number; criticalPercent: number }> {
  const warningPercent = await numberPrompt(
    prompts,
    "When should quota pressure become a warning?",
    initialWarning,
    "Example: 50 means 50% of the five-hour window used",
  );
  const criticalPercent = await numberPrompt(
    prompts,
    "When should quota pressure become critical?",
    initialCritical,
    "Example: 80 means 80% of the five-hour window used",
  );
  if (warningPercent < criticalPercent) {
    return { warningPercent, criticalPercent };
  }
  prompts.note(
    "Warning threshold must be lower than critical threshold. Please enter both values again.",
    "Invalid quota thresholds",
  );
  return promptQuotaThresholds(prompts, warningPercent, criticalPercent);
}

async function collectIntegrations(
  prompts: InitPromptAdapter,
  draft: InitDraft,
): Promise<InitDraft> {
  const steps = totalSteps(draft.harness);
  prompts.note(
    "Optional allowlists restrict external capabilities Forgix may use. Leave empty for none.\nExamples: impeccable, context-mode:ctx-search",
    `${steps}/${steps} · External integrations`,
  );
  const plugins = await idsPrompt(
    prompts,
    "Allowed external plugin IDs",
    draft.plugins,
    "impeccable, context-mode",
  );
  const skills = await idsPrompt(
    prompts,
    "Allowed external skill IDs",
    draft.skills,
    "impeccable:frontend-design",
  );
  return { ...draft, plugins, skills };
}

function buildConfiguration(
  current: Record<string, unknown>,
  draft: InitDraft,
): Record<string, unknown> {
  const { harness: _previousHarness, ...restCurrent } = current;
  const worktree = record(restCurrent.worktree);
  const subscription = record(restCurrent.subscription);
  const quota = record(subscription.quota);
  const integrations = record(restCurrent.integrations);
  return {
    ...restCurrent,
    schemaVersion: 1,
    ...(draft.harness !== "auto" ? { harness: draft.harness } : {}),
    worktree: { ...worktree, mode: draft.worktreeMode },
    merge: "never",
    subscription: {
      ...subscription,
      plan: draft.plan,
      quota: {
        ...quota,
        warningPercent: draft.warningPercent,
        criticalPercent: draft.criticalPercent,
        unknownPolicy: "conservative",
      },
    },
    integrations: { ...integrations, plugins: draft.plugins, skills: draft.skills },
  };
}

function draftFromConfiguration(current: Record<string, unknown>): InitDraft {
  const worktree = record(current.worktree);
  const subscription = record(current.subscription);
  const quota = record(subscription.quota);
  const integrations = record(current.integrations);
  return {
    harness: choiceValue(current.harness, ["auto", ...HARNESS_IDS], "auto"),
    worktreeMode: choiceValue(worktree.mode, ["auto", "required"], "auto"),
    plan: choiceValue(subscription.plan, ["auto", "plus", "pro_5x", "pro_20x"], "auto"),
    warningPercent: numberValue(quota.warningPercent, 50),
    criticalPercent: numberValue(quota.criticalPercent, 80),
    plugins: stringArray(integrations.plugins),
    skills: stringArray(integrations.skills),
  };
}

function renderConfigurationSummary(path: string, draft: InitDraft): string {
  return [
    `Target: ${path}`,
    `Harness: ${draft.harness}`,
    `Worktrees: ${draft.worktreeMode}`,
    ...(usesCodexRouting(draft.harness)
      ? [
          `Subscription: ${draft.plan === "auto" ? "automatic (Plus if unknown)" : draft.plan}`,
          `Quota pressure: warning ${draft.warningPercent}% · critical ${draft.criticalPercent}%`,
        ]
      : [`Routing: host-native (managed by ${draft.harness})`]),
    `Plugins: ${draft.plugins.join(", ") || "none"}`,
    `Skills: ${draft.skills.join(", ") || "none"}`,
    ...(usesCodexRouting(draft.harness)
      ? [
          `Model costs: Luna ${MODEL_COST_MULTIPLIERS["gpt-5.6-luna"]}x · Terra ${MODEL_COST_MULTIPLIERS["gpt-5.6-terra"]}x · Sol ${MODEL_COST_MULTIPLIERS["gpt-5.6-sol"]}x`,
        ]
      : []),
  ].join("\n");
}

function renderRoutingSummary(plan: InitSubscriptionPlan, pressure: QuotaPressure): string {
  const labels: Record<string, string> = {
    design: "Design",
    discover: "Discover",
    plan: "Plan",
    review: "Review",
    debug: "Debug root cause",
  };
  const routes = buildRoutingPreview(plan, pressure).map(
    (decision) =>
      `${labels[decision.stage]}: ${decision.model ?? "unavailable"} · ${decision.effort ?? "unavailable"}`,
  );
  return [
    `Baseline: ${plan === "auto" ? "Plus until account detection" : plan} · ${pressure} quota`,
    ...routes,
    "Live availability is captured once when a Forgix workflow starts; exact unavailable routes block instead of falling back.",
  ].join("\n");
}

async function numberPrompt(
  prompts: InitPromptAdapter,
  message: string,
  fallback: number,
  placeholder: string,
): Promise<number> {
  const answer = await required(
    prompts,
    prompts.text({
      message,
      defaultValue: String(fallback),
      placeholder,
      validate: (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100
          ? undefined
          : "Enter a number from 0 to 100.";
      },
    }),
  );
  return Number(answer);
}

async function idsPrompt(
  prompts: InitPromptAdapter,
  message: string,
  fallback: string[],
  placeholder: string,
): Promise<string[]> {
  const answer = await required(
    prompts,
    prompts.text({
      message,
      defaultValue: fallback.join(", "),
      placeholder,
      validate: (value) => {
        const invalid = parseIds(value).find((id) => !INTEGRATION_ID.test(id));
        return invalid ? `Invalid integration identifier: ${invalid}` : undefined;
      },
    }),
  );
  return parseIds(answer);
}

function parseIds(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

async function required<Value>(
  prompts: InitPromptAdapter,
  answer: Promise<Value | symbol>,
): Promise<Value> {
  const value = await answer;
  if (typeof value === "symbol") throw new InitCancelledError();
  return value;
}

function cancelled(prompts: InitPromptAdapter, path: string): CliResult {
  prompts.cancel("Initialization cancelled. No files changed.");
  return { command: "init", status: "cancelled", data: { path } };
}

function createClackAdapter(): InitPromptAdapter {
  return {
    intro: clackIntro,
    outro: clackOutro,
    note: clackNote,
    cancel: clackCancel,
    select: <Value extends string>(options: {
      message: string;
      choices: PromptChoice<Value>[];
      initialValue: Value;
    }) => {
      const choices = options.choices.map((choice) => ({
        value: choice.value,
        label: choice.label,
        ...(choice.hint ? { hint: choice.hint } : {}),
      })) as Parameters<typeof clackSelect<Value>>[0]["options"];
      return clackSelect({
        message: options.message,
        options: choices,
        initialValue: options.initialValue,
      });
    },
    text: (options) =>
      clackText({
        message: options.message,
        ...(options.placeholder !== undefined ? { placeholder: options.placeholder } : {}),
        ...(options.defaultValue !== undefined ? { defaultValue: options.defaultValue } : {}),
        ...(options.validate ? { validate: (value) => options.validate?.(value ?? "") } : {}),
      }),
  };
}

function parseConfigContent(content: string, path: string): Record<string, unknown> {
  const parsed: unknown = parseYaml(content);
  if (!isRecord(parsed)) {
    throw new Error(`Invalid configuration at ${path}: root must be an object.`);
  }
  return parsed;
}

function mergeForValidation(
  base: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const output = copy(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(incoming)) {
    const current = output[key];
    if (isRecord(current) && isRecord(value)) output[key] = mergeForValidation(current, value);
    else output[key] = copy(value);
  }
  return output;
}

function merge(
  target: Record<string, unknown>,
  incoming: Record<string, unknown>,
  source: string,
  provenance: Record<string, string>,
  prefix = "",
): void {
  for (const [key, incomingValue] of Object.entries(incoming)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const targetValue = target[key];
    if (isRecord(targetValue) && isRecord(incomingValue)) {
      merge(targetValue, incomingValue, source, provenance, path);
      continue;
    }
    target[key] = copy(incomingValue);
    recordLeaves(incomingValue, source, provenance, path);
  }
}

function recordLeaves(
  value: unknown,
  source: string,
  provenance: Record<string, string>,
  prefix: string,
): void {
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      recordLeaves(nested, source, provenance, prefix ? `${prefix}.${key}` : key);
    }
    return;
  }
  provenance[prefix] = source;
}

function readPath(value: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function copy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copy);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry)]));
  }
  return value;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function choiceValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  fallback: Values[number],
): Values[number] {
  return typeof value === "string" && values.includes(value) ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class InitCancelledError extends Error {}

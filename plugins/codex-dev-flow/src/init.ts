import {
  cancel as clackCancel,
  intro as clackIntro,
  note as clackNote,
  outro as clackOutro,
  select as clackSelect,
  text as clackText,
} from "@clack/prompts";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { validateConfigSource } from "./config.js";
import {
  MODEL_COST_MULTIPLIERS,
  ROUTING_POLICY_VERSION,
  chooseRoute,
  type RouteTask,
} from "./routing.js";
import {
  REASONING_EFFORTS,
  type CliResult,
  type ModelCapability,
  type QuotaPressure,
  type ResolvedSubscriptionPlan,
  type RoutingDecision,
} from "./types.js";

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
  prompts?: InitPromptAdapter;
}

type WorktreeMode = "auto" | "required";
type SubscriptionPlan = "auto" | "plus" | "pro_5x" | "pro_20x";
type ReviewAction = "write" | "workflow" | "subscription" | "integrations" | "cancel";

interface InitDraft {
  worktreeMode: WorktreeMode;
  plan: SubscriptionPlan;
  warningPercent: number;
  criticalPercent: number;
  plugins: string[];
  skills: string[];
}

const INTEGRATION_ID = /^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9][A-Za-z0-9._/-]*)?$/;
const ROUTING_TASKS: RouteTask[] = [
  { stage: "discover", risk: "medium", ambiguity: "medium" },
  { stage: "plan", risk: "medium", ambiguity: "medium" },
  { stage: "execute", risk: "medium", ambiguity: "medium" },
  { stage: "debug", risk: "medium", ambiguity: "medium" },
  { stage: "review", risk: "medium", ambiguity: "medium" },
  { stage: "verify", risk: "medium", ambiguity: "medium" },
];

export async function runInit(options: InitOptions = {}): Promise<CliResult> {
  if (!options.prompts && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new Error("init requires an interactive terminal.");
  }

  const prompts = options.prompts ?? createClackAdapter();
  const cwd = options.cwd ?? process.cwd();
  const directory = join(cwd, ".codex");
  const path = join(directory, "dev-flow.yaml");
  const existed = existsSync(path);
  const current = existed ? readConfiguration(path) : {};
  let draft = draftFromConfiguration(current);

  prompts.intro("Codex Dev Flow · project setup");
  prompts.note(
    "Configure workflow isolation, subscription-aware routing, quota safeguards, and optional integrations.\nNo model choice is required: Dev Flow assigns models and reasoning automatically.",
    "What this wizard does",
  );

  try {
    draft = await collectWorkflow(prompts, draft);
    draft = await collectSubscription(prompts, draft);
    draft = await collectIntegrations(prompts, draft);

    for (;;) {
      const config = buildConfiguration(current, draft);
      validateConfigSource(config, "init");
      prompts.note(renderConfigurationSummary(path, draft), "Configuration summary");
      prompts.note(
        renderRoutingSummary(draft.plan, "normal"),
        `Automatic routing · ${ROUTING_POLICY_VERSION}`,
      );

      const action = await required(
        prompts,
        prompts.select<ReviewAction>({
          message: existed
            ? "Review complete. What should Dev Flow do?"
            : "Configuration ready. What should Dev Flow do?",
          initialValue: "write",
          choices: [
            {
              value: "write",
              label: existed ? "Update configuration" : "Create configuration",
              hint: path,
            },
            {
              value: "workflow",
              label: "Edit workflow behavior",
              hint: "Worktree isolation",
            },
            {
              value: "subscription",
              label: "Edit subscription and quota",
              hint: "Plan and pressure thresholds",
            },
            {
              value: "integrations",
              label: "Edit integrations",
              hint: "External plugin and skill allowlists",
            },
            { value: "cancel", label: "Cancel", hint: "Leave existing files unchanged" },
          ],
        }),
      );

      if (action === "workflow") {
        draft = await collectWorkflow(prompts, draft);
        continue;
      }
      if (action === "subscription") {
        draft = await collectSubscription(prompts, draft);
        continue;
      }
      if (action === "integrations") {
        draft = await collectIntegrations(prompts, draft);
        continue;
      }
      if (action === "cancel") return cancelled(prompts, path);

      const yaml = stringifyYaml(config, { lineWidth: 0 });
      await mkdir(directory, { recursive: true });
      const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
      try {
        await writeFile(temporaryPath, yaml, { encoding: "utf8", mode: 0o600 });
        await rename(temporaryPath, path);
      } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
      }
      prompts.outro(`Configuration ${existed ? "updated" : "created"}: ${path}`);
      return { command: "init", status: existed ? "updated" : "created", data: { path, config } };
    }
  } catch (error) {
    if (error instanceof InitCancelledError) return cancelled(prompts, path);
    throw error;
  }
}

export function buildRoutingPreview(
  plan: SubscriptionPlan,
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

async function collectWorkflow(prompts: InitPromptAdapter, draft: InitDraft): Promise<InitDraft> {
  prompts.note("Choose how Dev Flow isolates changes.", "1/3 · Workflow behavior");
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
    "Your plan controls available routing depth. Dev Flow still chooses each model by skill, workflow risk, and initial quota pressure.",
    "2/3 · Subscription and quota",
  );
  const plan = await required(
    prompts,
    prompts.select<SubscriptionPlan>({
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

  let warningPercent = draft.warningPercent;
  let criticalPercent = draft.criticalPercent;
  for (;;) {
    warningPercent = await numberPrompt(
      prompts,
      "When should quota pressure become a warning?",
      warningPercent,
      "Example: 50 means 50% of the five-hour window used",
    );
    criticalPercent = await numberPrompt(
      prompts,
      "When should quota pressure become critical?",
      criticalPercent,
      "Example: 80 means 80% of the five-hour window used",
    );
    if (warningPercent < criticalPercent) break;
    prompts.note(
      "Warning threshold must be lower than critical threshold. Please enter both values again.",
      "Invalid quota thresholds",
    );
  }
  return { ...draft, plan, warningPercent, criticalPercent };
}

async function collectIntegrations(
  prompts: InitPromptAdapter,
  draft: InitDraft,
): Promise<InitDraft> {
  prompts.note(
    "Optional allowlists restrict external capabilities Dev Flow may use. Leave empty for none.\nExamples: impeccable, context-mode:ctx-search",
    "3/3 · External integrations",
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
  const worktree = record(current.worktree);
  const subscription = record(current.subscription);
  const quota = record(subscription.quota);
  const integrations = record(current.integrations);
  return {
    ...current,
    schemaVersion: 1,
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
    `Worktrees: ${draft.worktreeMode}`,
    `Subscription: ${draft.plan === "auto" ? "automatic (Plus if unknown)" : draft.plan}`,
    `Quota pressure: warning ${draft.warningPercent}% · critical ${draft.criticalPercent}%`,
    `Plugins: ${draft.plugins.join(", ") || "none"}`,
    `Skills: ${draft.skills.join(", ") || "none"}`,
    `Model costs: Luna ${MODEL_COST_MULTIPLIERS["gpt-5.6-luna"]}x · Terra ${MODEL_COST_MULTIPLIERS["gpt-5.6-terra"]}x · Sol ${MODEL_COST_MULTIPLIERS["gpt-5.6-sol"]}x`,
  ].join("\n");
}

function renderRoutingSummary(plan: SubscriptionPlan, pressure: QuotaPressure): string {
  const labels: Record<string, string> = {
    discover: "Discover",
    plan: "Plan",
    execute: "Execute",
    review: "Review",
    verify: "Verify",
    debug: "Debug root cause",
  };
  const routes = buildRoutingPreview(plan, pressure).map(
    (decision) =>
      `${labels[decision.stage]}: ${decision.model ?? "unavailable"} · ${decision.effort ?? "unavailable"}`,
  );
  return [
    `Baseline: ${plan === "auto" ? "Plus until account detection" : plan} · ${pressure} quota`,
    ...routes,
    "Live availability is captured once when a Dev Flow workflow starts; exact unavailable routes block instead of falling back.",
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
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 && number <= 100
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

function readConfiguration(path: string): Record<string, unknown> {
  const parsed: unknown = parseYaml(readFileSync(path, "utf8"));
  if (!isRecord(parsed))
    throw new Error(`Invalid configuration at ${path}: root must be an object.`);
  return parsed;
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

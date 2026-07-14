import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { validateConfigSource } from "./config.js";
import type { CliResult } from "./types.js";

export interface InitOptions {
  cwd?: string;
  ask?: (question: string) => Promise<string>;
  write?: (value: string) => void;
}

const INTEGRATION_ID = /^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9][A-Za-z0-9._/-]*)?$/;

export async function runInit(options: InitOptions = {}): Promise<CliResult> {
  const cwd = options.cwd ?? process.cwd();
  const output = options.write ?? ((value: string) => process.stdout.write(value));
  let closePrompt: (() => void) | undefined;
  let ask = options.ask;
  if (!ask) {
    if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
      throw new Error("init requires an interactive terminal.");
    }
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    ask = (question) => prompt.question(question);
    closePrompt = () => prompt.close();
  }

  const directory = join(cwd, ".codex");
  const path = join(directory, "dev-flow.yaml");
  const existed = existsSync(path);
  const current = existed ? readConfiguration(path) : {};
  const worktree = record(current.worktree);
  const finish = record(current.finish);
  const subscription = record(current.subscription);
  const quota = record(subscription.quota);
  const integrations = record(current.integrations);

  output("\nCodex Dev Flow initialization\n\n");
  try {
    const worktreeMode = await askChoice(ask, output, "Worktree mode", ["auto", "required"], stringValue(worktree.mode, "auto"));
    const pullRequest = await askChoice(ask, output, "Pull request", ["optional", "required"], stringValue(finish.pullRequest, "optional"));
    const plan = await askChoice(ask, output, "Subscription plan", ["auto", "plus", "pro_5x", "pro_20x"], stringValue(subscription.plan, "auto"));

    let warningPercent: number;
    let criticalPercent: number;
    do {
      warningPercent = await askNumber(ask, output, "Quota warning percent", numberValue(quota.warningPercent, 50));
      criticalPercent = await askNumber(ask, output, "Quota critical percent", numberValue(quota.criticalPercent, 80));
      if (warningPercent >= criticalPercent) output("Warning threshold must be lower than critical threshold.\n");
    } while (warningPercent >= criticalPercent);

    const plugins = await askIds(ask, output, "Allowed external plugins", stringArray(integrations.plugins));
    const skills = await askIds(ask, output, "Allowed external skills", stringArray(integrations.skills));
    const config: Record<string, unknown> = {
      ...current,
      schemaVersion: 1,
      worktree: { ...worktree, mode: worktreeMode },
      finish: { ...finish, pullRequest },
      merge: "never",
      subscription: {
        ...subscription,
        plan,
        quota: { ...quota, warningPercent, criticalPercent, unknownPolicy: "conservative" }
      },
      integrations: { ...integrations, plugins, skills }
    };
    validateConfigSource(config, "init");
    const yaml = stringifyYaml(config, { lineWidth: 0 });
    output(`\nConfiguration preview (${path}):\n\n${yaml}\n`);
    const confirmed = await askConfirm(ask, output, existed ? "Replace repository configuration" : "Write repository configuration");
    if (!confirmed) {
      output("Initialization cancelled.\n");
      return { command: "init", status: "cancelled", data: { path } };
    }

    await mkdir(directory, { recursive: true });
    const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
    try {
      await writeFile(temporaryPath, yaml, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, path);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
    output(`Configuration ${existed ? "updated" : "created"}: ${path}\n`);
    return { command: "init", status: existed ? "updated" : "created", data: { path, config } };
  } finally {
    closePrompt?.();
  }
}

function readConfiguration(path: string): Record<string, unknown> {
  const parsed: unknown = parseYaml(readFileSync(path, "utf8"));
  if (!isRecord(parsed)) throw new Error(`Invalid configuration at ${path}: root must be an object.`);
  return parsed;
}

async function askChoice(
  ask: (question: string) => Promise<string>,
  write: (value: string) => void,
  label: string,
  values: string[],
  fallback: string
): Promise<string> {
  const defaultValue = values.includes(fallback) ? fallback : values[0];
  if (!defaultValue) throw new Error(`No choices configured for ${label}.`);
  for (;;) {
    const answer = (await ask(`${label} [${values.join("/")}] (${defaultValue}): `)).trim();
    const value = answer || defaultValue;
    if (values.includes(value)) return value;
    write(`Choose one of: ${values.join(", ")}.\n`);
  }
}

async function askNumber(
  ask: (question: string) => Promise<string>,
  write: (value: string) => void,
  label: string,
  fallback: number
): Promise<number> {
  for (;;) {
    const answer = (await ask(`${label} (${fallback}): `)).trim();
    const value = answer === "" ? fallback : Number(answer);
    if (Number.isFinite(value) && value >= 0 && value <= 100) return value;
    write("Enter a number from 0 to 100.\n");
  }
}

async function askIds(
  ask: (question: string) => Promise<string>,
  write: (value: string) => void,
  label: string,
  fallback: string[]
): Promise<string[]> {
  for (;;) {
    const suffix = fallback.length > 0 ? ` (${fallback.join(", ")})` : " (none)";
    const answer = (await ask(`${label}, comma-separated${suffix}: `)).trim();
    const values = answer === "" ? fallback : [...new Set(answer.split(",").map((value) => value.trim()).filter(Boolean))];
    const invalid = values.find((value) => !INTEGRATION_ID.test(value));
    if (!invalid) return values;
    write(`Invalid integration identifier: ${invalid}.\n`);
  }
}

async function askConfirm(
  ask: (question: string) => Promise<string>,
  write: (value: string) => void,
  label: string
): Promise<boolean> {
  for (;;) {
    const answer = (await ask(`${label}? [y/N]: `)).trim().toLowerCase();
    if (["y", "yes"].includes(answer)) return true;
    if (["", "n", "no"].includes(answer)) return false;
    write("Answer yes or no.\n");
  }
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

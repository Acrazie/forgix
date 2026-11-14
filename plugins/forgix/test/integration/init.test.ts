// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { parse as parseYaml } from "yaml";
import { expectRejected } from "../support/expect-error.ts";

function scriptedPrompts({ selects = [], texts = [], confirms = [] } = {}) {
  const output = [];
  let selectIndex = 0;
  let textIndex = 0;
  let confirmIndex = 0;
  return {
    output,
    intro: (message) => output.push(`intro:${message}`),
    outro: (message) => output.push(`outro:${message}`),
    note: (message, title) => output.push(`note:${title ?? ""}:${message}`),
    cancel: (message) => output.push(`cancel:${message}`),
    select: async (options) => selects[selectIndex++] ?? options.initialValue,
    text: async (options) => {
      const value = texts[textIndex++] ?? options.defaultValue ?? "";
      const error = options.validate?.(value);
      if (error) throw new Error(`Invalid scripted answer: ${error}`);
      return value;
    },
    confirm: async (options) => confirms[confirmIndex++] ?? options.initialValue,
  };
}

test("init writes validated configuration and explains automatic skill routing", async () => {
  const { runInvocation, validateSchema } = sourceApi;
  const root = await mkdtemp(join(tmpdir(), "forgix-init-"));
  const prompts = scriptedPrompts({
    selects: ["auto", "required", "plus", "write"],
    texts: ["60", "85", "impeccable", "impeccable:frontend-design"],
  });
  try {
    const result = await runInvocation(["init"], { init: { cwd: root, prompts } });
    expect(result.status).toBe("created");
    const path = join(root, ".codex", "forgix.yaml");
    const config = parseYaml(await readFile(path, "utf8"));
    expect(config.integrations).toEqual({
      plugins: ["impeccable"],
      skills: ["impeccable:frontend-design"],
    });
    expect(config.worktree.mode).toBe("required");
    expect(config.finish).toBeUndefined();
    expect(config.subscription.plan).toBe("plus");
    expect(config.subscription.quota.warningPercent).toBe(60);
    expect(config.subscription.quota.criticalPercent).toBe(85);
    expect(validateSchema("config", config).valid).toBe(true);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    const output = prompts.output.join("\n");
    expect(output).toContain("note:1 · Target harness:");
    expect(output).toContain("note:2/4 · Workflow behavior:");
    expect(output).toContain("note:3/4 · Subscription and quota:");
    expect(output).toContain("note:4/4 · External integrations:");
    expect(output).toMatch(/No model choice is required/);
    expect(output).toMatch(/Plan: gpt-5\.6-sol · medium/);
    expect(output).not.toMatch(/Execute:/);
    expect(output).toMatch(/exact unavailable routes block instead of falling back/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("review can revisit subscription before one atomic write", async () => {
  const { runInvocation } = sourceApi;
  const root = await mkdtemp(join(tmpdir(), "forgix-init-revisit-"));
  const prompts = scriptedPrompts({
    selects: ["auto", "auto", "plus", "subscription", "pro_20x", "write"],
    texts: ["50", "80", "", "", "55", "90"],
  });
  try {
    const result = await runInvocation(["init"], { init: { cwd: root, prompts } });
    expect(result.status).toBe("created");
    const config = parseYaml(await readFile(result.data.path, "utf8"));
    expect(config.subscription.plan).toBe("pro_20x");
    expect(config.subscription.quota.warningPercent).toBe(55);
    expect(config.subscription.quota.criticalPercent).toBe(90);
    expect(
      prompts.output.filter((line) => line.includes("Automatic routing")).length >= 2,
    ).toBeTruthy();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cancellation preserves an existing configuration byte-for-byte", async () => {
  const { runInvocation } = sourceApi;
  const root = await mkdtemp(join(tmpdir(), "forgix-init-cancel-"));
  try {
    const firstPrompts = scriptedPrompts({
      selects: ["auto", "auto", "auto", "write"],
      texts: ["50", "80", "", ""],
    });
    const first = await runInvocation(["init"], { init: { cwd: root, prompts: firstPrompts } });
    const before = await readFile(first.data.path, "utf8");
    const cancelPrompts = scriptedPrompts({
      selects: ["auto", "auto", "auto", "cancel"],
      texts: ["50", "80", "", ""],
    });
    const second = await runInvocation(["init"], { init: { cwd: root, prompts: cancelPrompts } });
    expect(second.status).toBe("cancelled");
    expect(await readFile(first.data.path, "utf8")).toBe(before);
    expect(cancelPrompts.output.at(-1)).toMatch(/No files changed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Ctrl+C cancellation symbol exits cleanly before file creation", async () => {
  const { runInvocation } = sourceApi;
  const root = await mkdtemp(join(tmpdir(), "forgix-init-interrupt-"));
  const prompts = scriptedPrompts({ selects: [Symbol("cancel")] });
  try {
    const result = await runInvocation(["init"], { init: { cwd: root, prompts } });
    expect(result.status).toBe("cancelled");
    await expectRejected(
      () => readFile(join(root, ".codex", "forgix.yaml")),
      (error) => error instanceof Error && error.message.includes("ENOENT"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("routing preview applies Plus baseline for auto without model selection", async () => {
  const { buildRoutingPreview } = sourceApi;
  const preview = buildRoutingPreview("auto");
  expect(preview.map(({ stage, model, effort }) => [stage, model, effort])).toEqual([
    ["design", "gpt-5.6-terra", "medium"],
    ["discover", "gpt-5.6-terra", "medium"],
    ["plan", "gpt-5.6-sol", "medium"],
    ["debug", "gpt-5.6-sol", "high"],
    ["review", "gpt-5.6-luna", "medium"],
  ]);
});

test("claude harness init skips subscription prompts and returning to auto removes harness key", async () => {
  const { runInvocation } = sourceApi;
  const root = await mkdtemp(join(tmpdir(), "forgix-init-harness-"));
  try {
    const firstPrompts = scriptedPrompts({
      selects: ["claude", "auto", "write"],
      texts: ["", ""],
    });
    const first = await runInvocation(["init"], { init: { cwd: root, prompts: firstPrompts } });
    expect(first.status).toBe("created");
    const createdConfig = parseYaml(await readFile(first.data.path, "utf8"));
    expect(createdConfig.harness).toBe("claude");
    const firstOutput = firstPrompts.output.join("\n");
    expect(firstOutput).toContain("note:1 · Target harness:");
    expect(firstOutput).toContain("note:2/3 · Workflow behavior:");
    expect(firstOutput).toContain("note:3/3 · External integrations:");
    expect(firstPrompts.output.some((line) => line.includes("Host-native routing active"))).toBe(
      true,
    );

    const secondPrompts = scriptedPrompts({
      selects: ["claude", "auto", "harness", "auto", "pro_5x", "write"],
      texts: ["", "", "50", "80"],
    });
    const second = await runInvocation(["init"], { init: { cwd: root, prompts: secondPrompts } });
    expect(second.status).toBe("updated");
    const updatedConfig = parseYaml(await readFile(second.data.path, "utf8"));
    expect("harness" in updatedConfig).toBe(false);
    expect(updatedConfig.subscription.plan).toBe("pro_5x");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

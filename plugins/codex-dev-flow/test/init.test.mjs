import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

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
    confirm: async (options) => confirms[confirmIndex++] ?? options.initialValue
  };
}

test("init writes validated configuration and explains automatic skill routing", async () => {
  const { runInvocation, validateSchema } = await import(bundle);
  const root = await mkdtemp(join(tmpdir(), "dev-flow-init-"));
  const prompts = scriptedPrompts({
    selects: ["required", "required", "plus", "write"],
    texts: ["60", "85", "impeccable", "impeccable:frontend-design"]
  });
  try {
    const result = await runInvocation(["init"], { init: { cwd: root, prompts } });
    assert.equal(result.status, "created");
    const path = join(root, ".codex", "dev-flow.yaml");
    const config = parseYaml(await readFile(path, "utf8"));
    assert.deepEqual(config.integrations, { plugins: ["impeccable"], skills: ["impeccable:frontend-design"] });
    assert.equal(config.worktree.mode, "required");
    assert.equal(config.finish.pullRequest, "required");
    assert.equal(config.subscription.plan, "plus");
    assert.equal(config.subscription.quota.warningPercent, 60);
    assert.equal(config.subscription.quota.criticalPercent, 85);
    assert.equal(validateSchema("config", config).valid, true);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    const output = prompts.output.join("\n");
    assert.match(output, /No model choice is required/);
    assert.match(output, /Plan: gpt-5\.6-sol · medium/);
    assert.match(output, /Execute: gpt-5\.6-terra · high/);
    assert.match(output, /exact unavailable routes block instead of falling back/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("review can revisit subscription before one atomic write", async () => {
  const { runInvocation } = await import(bundle);
  const root = await mkdtemp(join(tmpdir(), "dev-flow-init-revisit-"));
  const prompts = scriptedPrompts({
    selects: ["auto", "optional", "plus", "subscription", "pro_20x", "write"],
    texts: ["50", "80", "", "", "55", "90"]
  });
  try {
    const result = await runInvocation(["init"], { init: { cwd: root, prompts } });
    assert.equal(result.status, "created");
    const config = parseYaml(await readFile(result.data.path, "utf8"));
    assert.equal(config.subscription.plan, "pro_20x");
    assert.equal(config.subscription.quota.warningPercent, 55);
    assert.equal(config.subscription.quota.criticalPercent, 90);
    assert.ok(prompts.output.filter((line) => line.includes("Automatic routing")).length >= 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cancellation preserves an existing configuration byte-for-byte", async () => {
  const { runInvocation } = await import(bundle);
  const root = await mkdtemp(join(tmpdir(), "dev-flow-init-cancel-"));
  try {
    const firstPrompts = scriptedPrompts({ selects: ["auto", "optional", "auto", "write"], texts: ["50", "80", "", ""] });
    const first = await runInvocation(["init"], { init: { cwd: root, prompts: firstPrompts } });
    const before = await readFile(first.data.path, "utf8");
    const cancelPrompts = scriptedPrompts({ selects: ["auto", "optional", "auto", "cancel"], texts: ["50", "80", "", ""] });
    const second = await runInvocation(["init"], { init: { cwd: root, prompts: cancelPrompts } });
    assert.equal(second.status, "cancelled");
    assert.equal(await readFile(first.data.path, "utf8"), before);
    assert.match(cancelPrompts.output.at(-1), /No files changed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Ctrl+C cancellation symbol exits cleanly before file creation", async () => {
  const { runInvocation } = await import(bundle);
  const root = await mkdtemp(join(tmpdir(), "dev-flow-init-interrupt-"));
  const prompts = scriptedPrompts({ selects: [Symbol("cancel")] });
  try {
    const result = await runInvocation(["init"], { init: { cwd: root, prompts } });
    assert.equal(result.status, "cancelled");
    await assert.rejects(readFile(join(root, ".codex", "dev-flow.yaml")), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("routing preview applies Plus baseline for auto without model selection", async () => {
  const { buildRoutingPreview } = await import(bundle);
  const preview = buildRoutingPreview("auto");
  assert.deepEqual(preview.map(({ stage, model, effort }) => [stage, model, effort]), [
    ["discover", "gpt-5.6-terra", "medium"],
    ["plan", "gpt-5.6-sol", "medium"],
    ["execute", "gpt-5.6-terra", "high"],
    ["debug", "gpt-5.6-sol", "high"],
    ["review", "gpt-5.6-sol", "medium"],
    ["verify", "gpt-5.6-luna", "medium"]
  ]);
});

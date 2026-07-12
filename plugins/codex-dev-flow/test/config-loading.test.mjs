import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

test("loads user, repository, local, and flags sources in precedence order", async () => {
  const { loadConfigSources, resolveConfig } = await import(bundle);
  const root = await mkdtemp(join(os.tmpdir(), "dev-flow-config-"));
  const home = await mkdtemp(join(os.tmpdir(), "dev-flow-home-"));
  await mkdir(join(home, ".codex"));
  await mkdir(join(root, ".codex"));
  await writeFile(join(home, ".codex", "dev-flow.yaml"), "subscription:\n  plan: plus\n");
  await writeFile(join(root, ".codex", "dev-flow.yaml"), "subscription:\n  plan: pro_5x\n");
  await writeFile(join(root, ".codex", "dev-flow.local.yaml"), "subscription:\n  plan: pro_20x\n");
  const resolved = resolveConfig(loadConfigSources({ cwd: root, home, flags: { subscription: { plan: "plus" } } }));
  assert.equal(resolved.value.subscription.plan, "plus");
  assert.equal(resolved.provenance["subscription.plan"], "flags");
});


// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/config.ts";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

test("loads user, repository, local, and flags sources in precedence order", async () => {
  const { loadConfigSources, resolveConfig } = sourceApi;
  const root = await mkdtemp(join(os.tmpdir(), "dev-flow-config-"));
  const home = await mkdtemp(join(os.tmpdir(), "dev-flow-home-"));
  await mkdir(join(home, ".codex"));
  await mkdir(join(root, ".codex"));
  await writeFile(join(home, ".codex", "dev-flow.yaml"), "subscription:\n  plan: plus\n");
  await writeFile(join(root, ".codex", "dev-flow.yaml"), "subscription:\n  plan: pro_5x\n");
  await writeFile(join(root, ".codex", "dev-flow.local.yaml"), "subscription:\n  plan: pro_20x\n");
  const resolved = resolveConfig(
    loadConfigSources({ cwd: root, home, flags: { subscription: { plan: "plus" } } }),
  );
  expect(resolved.value.subscription.plan).toBe("plus");
  expect(resolved.provenance["subscription.plan"]).toBe("flags");
});

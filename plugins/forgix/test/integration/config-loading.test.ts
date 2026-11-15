// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/core/config.ts";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

test("Forgix reads forgix configuration paths without rewriting their bytes and ignores legacy files", async () => {
  const directory = await mkdtemp(join(os.tmpdir(), "forgix-config-files-"));
  const home = join(directory, "home");
  const root = join(directory, "repo");
  const files = [
    [join(home, ".forgix", "config.yaml"), "subscription:\n  plan: plus\n"],
    [join(root, ".forgix", "config.yaml"), "subscription:\n  plan: pro_5x\n"],
    [join(root, ".forgix", "config.local.yaml"), "subscription:\n  plan: pro_20x\n"],
  ];
  try {
    await mkdir(join(home, ".forgix"), { recursive: true });
    await mkdir(join(root, ".forgix"), { recursive: true });
    await Promise.all(files.map(([path, bytes]) => writeFile(path, bytes)));
    const sources = sourceApi.loadConfigSources({ cwd: root, home });
    expect(sources.map((source) => source.source)).toEqual(["user", "repo", "local"]);
    expect(sources.map((source) => source.value.subscription.plan)).toEqual([
      "plus",
      "pro_5x",
      "pro_20x",
    ]);
    const resolved = sourceApi.resolveConfig(sources);
    expect(resolved.value.subscription.plan).toBe("pro_20x");
    expect(resolved.provenance["subscription.plan"]).toBe("local");
    const contents = await Promise.all(files.map(([path]) => readFile(path, "utf8")));
    expect(contents).toEqual(files.map(([, bytes]) => bytes));

    const legacyHome = join(directory, "legacy-home");
    const legacyRoot = join(directory, "legacy-repo");
    await mkdir(join(legacyHome, ".codex"), { recursive: true });
    await mkdir(join(legacyRoot, ".codex"), { recursive: true });
    await writeFile(join(legacyHome, ".codex", "dev-flow.yaml"), "subscription:\n  plan: plus\n");
    await writeFile(join(legacyRoot, ".codex", "forgix.yaml"), "subscription:\n  plan: pro_5x\n");
    await writeFile(
      join(legacyRoot, ".codex", "dev-flow.local.yaml"),
      "subscription:\n  plan: pro_20x\n",
    );
    expect(sourceApi.loadConfigSources({ cwd: legacyRoot, home: legacyHome })).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("loads user, repository, local, and flags sources in precedence order", async () => {
  const { loadConfigSources, resolveConfig } = sourceApi;
  const root = await mkdtemp(join(os.tmpdir(), "forgix-config-"));
  const home = await mkdtemp(join(os.tmpdir(), "forgix-home-"));
  await mkdir(join(home, ".forgix"));
  await mkdir(join(root, ".forgix"));
  await writeFile(join(home, ".forgix", "config.yaml"), "subscription:\n  plan: plus\n");
  await writeFile(join(root, ".forgix", "config.yaml"), "subscription:\n  plan: pro_5x\n");
  await writeFile(join(root, ".forgix", "config.local.yaml"), "subscription:\n  plan: pro_20x\n");
  const resolved = resolveConfig(
    loadConfigSources({ cwd: root, home, flags: { subscription: { plan: "plus" } } }),
  );
  expect(resolved.value.subscription.plan).toBe("plus");
  expect(resolved.provenance["subscription.plan"]).toBe("flags");
});

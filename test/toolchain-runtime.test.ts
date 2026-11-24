import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { parse } from "yaml";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("development and published CLI minimum both require Node 26", () => {
  expect(read(".node-version").trim()).toMatch(/^26\./);
  expect(JSON.parse(read("package.json")).engines.node).toBe(">=26.0.0");
});

test("CI builds on Node 26 and checks packed runtime on Node 26 via Dagger", () => {
  const pipeline = parse(read(".buildkite/pipeline.yml")) as {
    steps: { key: string; commands: string[] }[];
  };
  const stepByKey = (key: string) => pipeline.steps.find((s) => s.key === key);
  const quality = stepByKey("quality-gate");
  const smoke = stepByKey("runtime-smoke");
  expect(quality).toBeDefined();
  expect(smoke).toBeDefined();
  expect(quality!.commands.join("\n")).toContain("dagger call check --source=.");
  expect(quality!.commands.join("\n")).toContain("dagger call pack-runtime");
  expect(smoke!.commands.join("\n")).toContain(
    "dagger call runtime-smoke --source=. --tarball=.artifacts/forgix.tgz",
  );

  const daggerSource = read(".dagger/src/index.ts");
  const nodeVersion = read(".node-version").trim();
  expect(nodeVersion).toMatch(/^26\./);
  expect(daggerSource).toContain(`const NODE_VERSION = "${nodeVersion}"`);
  expect(daggerSource).toContain("const NODE_IMAGE = `node:${NODE_VERSION}-bookworm-slim`");
  expect(daggerSource).toContain("test/runtime/runtime-smoke.test.mjs");
});

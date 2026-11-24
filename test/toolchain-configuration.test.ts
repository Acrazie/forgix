import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import toolchain, { distribution } from "../vite.config.ts";

const manifest = (path: string) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

test("one pinned Vite+ dependency owns quality and packaging", () => {
  const root = manifest("package.json");
  const plugin = manifest("package.json");
  expect(root.devDependencies["vite-plus"]).toBe("1.6.0");
  expect(plugin.devDependencies["vite-plus"]).toBe(root.devDependencies["vite-plus"]);
  for (const name of ["oxfmt", "oxlint", "oxlint-tsgolint", "esbuild", "tsdown", "rolldown"]) {
    expect(root.devDependencies[name]).toBeUndefined();
    expect(plugin.devDependencies[name]).toBeUndefined();
  }
  expect(root.scripts["format:check"]).toBe("vp fmt --check .");
  expect(root.scripts["lint:type-aware"]).toBe("vp lint --type-aware .");
});

test("distribution retains a single bundled Node 26 ESM artifact", () => {
  expect(distribution.target).toBe("node26.0");
  expect(distribution.format).toBe("esm");
  expect(distribution.outputOptions.codeSplitting).toBe(false);
  expect(distribution.deps.alwaysBundle[0].test("yaml")).toBe(true);
  expect(distribution.clean).toBe(false);
  expect(distribution.dts).toBe(false);
  expect(distribution.sourcemap).toBe(false);
  expect(toolchain.pack).toBe(distribution);
});

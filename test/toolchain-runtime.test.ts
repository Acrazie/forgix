import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { parse } from "yaml";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("development and published CLI minimum both require Node 26", () => {
  expect(read(".node-version").trim()).toMatch(/^26\./);
  expect(JSON.parse(read("plugins/forgix/package.json")).engines.node).toBe(">=26.0.0");
});

test("CI builds on Node 26 and checks packed runtime on Node 26", () => {
  const { jobs } = parse(read(".github/workflows/ci.yml"));
  expect(jobs.website).toBeUndefined();
  for (const name of ["quality-gate", "maintainer-release-macos"]) {
    const setup = jobs[name].steps.find((step: { uses?: string }) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    expect(setup.with["node-version-file"]).toBe(".node-version");
  }
  expect(jobs["runtime-smoke"].strategy.matrix).toEqual({
    os: ["ubuntu-latest", "macos-latest"],
    node: [26],
  });
  const setup = jobs["runtime-smoke"].steps.find((step: { uses?: string }) =>
    step.uses?.startsWith("actions/setup-node@"),
  );
  expect(setup.with["node-version"]).toBe("${{ matrix.node }}");
});

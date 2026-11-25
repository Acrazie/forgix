import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const config = join(repository, ".fallowrc.json");

function withFixture(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "forgix-fallow-test-"));
  try {
    mkdirSync(join(root, "src", "core"), { recursive: true });
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });
    mkdirSync(join(root, "fallow-rules"), { recursive: true });
    cpSync(
      join(repository, "fallow-rules", "no-network.json"),
      join(root, "fallow-rules", "no-network.json"),
    );
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "fallow-fixture", private: true, main: "src/cli.ts" }),
    );
    writeFileSync(join(root, "src/cli.ts"), 'console.log("live");\n');
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function fallow(script: string, root: string, configPath = config, ...args: string[]) {
  const { exitCode, stdout, stderr } = Bun.spawnSync(
    [process.execPath, "run", "--silent", script, "--root", root, "--config", configPath, ...args],
    { cwd: repository },
  );
  return { exitCode, stdout: stdout.toString(), stderr: stderr.toString() };
}

function fallowCli(root: string, ...args: string[]) {
  const { exitCode, stdout, stderr } = Bun.spawnSync(
    [process.execPath, "x", "fallow", ...args, "--root", root, "--config", config],
    { cwd: repository },
  );
  return { exitCode, stdout: stdout.toString(), stderr: stderr.toString() };
}

test("reports new unreachable code without failing the dead-code command", () => {
  withFixture((root) => {
    writeFileSync(join(root, "src/core/orphan.ts"), "export const orphan = true;\n");
    const result = fallow("check:dead-code", root);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      check: { unused_files: [{ path: "src/core/orphan.ts" }] },
      gate_outcomes: { "error-severity-findings": { status: "fail", enforced: false } },
    });
  });
});

test("the informational command does not swallow invalid configuration or parse errors", () => {
  withFixture((root) => {
    const invalidConfig = join(root, ".fallowrc.json");
    writeFileSync(invalidConfig, "{");
    expect(fallow("check:dead-code", root, invalidConfig).exitCode).toBe(2);

    writeFileSync(join(root, "src/cli.ts"), "const = )\n");
    const result = fallow("check:dead-code", root);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      gate_outcomes: { "parse-error": { status: "fail", enforced: true } },
    });
  });
});

test("architecture blocks an import from a src zone into the tooling zone", () => {
  withFixture((root) => {
    writeFileSync(join(root, "test/fixtures/helper.ts"), "export const helper = true;\n");
    expect(fallow("check:architecture", root).exitCode).toBe(0);

    writeFileSync(
      join(root, "src/cli.ts"),
      'import { helper } from "../test/fixtures/helper.ts";\nconsole.log(helper);\n',
    );
    const result = fallow("check:architecture", root);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("test/fixtures/helper.ts");
  });
});

test("architecture blocks cross-domain imports between roadmap, profile, and task", () => {
  withFixture((root) => {
    mkdirSync(join(root, "src", "task"), { recursive: true });
    mkdirSync(join(root, "src", "roadmap"), { recursive: true });
    mkdirSync(join(root, "src", "profile"), { recursive: true });

    writeFileSync(join(root, "src/task/index.ts"), "export const taskHelper = 1;\n");
    writeFileSync(
      join(root, "src/roadmap/index.ts"),
      'import { taskHelper } from "../task/index.ts";\nexport const roadmapValue = taskHelper + 1;\n',
    );
    writeFileSync(
      join(root, "src/cli.ts"),
      'import { roadmapValue } from "./roadmap/index.ts";\nconsole.log(roadmapValue);\n',
    );
    const roadmapToTask = fallow("check:architecture", root);
    expect(roadmapToTask.exitCode).toBe(1);
    expect(roadmapToTask.stdout).toContain("src/task/index.ts");

    writeFileSync(join(root, "src/roadmap/index.ts"), "export const roadmapValue = 1;\n");
    writeFileSync(
      join(root, "src/profile/index.ts"),
      'import { taskHelper } from "../task/index.ts";\nexport const profileValue = taskHelper + 1;\n',
    );
    writeFileSync(
      join(root, "src/cli.ts"),
      'import { profileValue } from "./profile/index.ts";\nconsole.log(profileValue);\n',
    );
    const profileToTask = fallow("check:architecture", root);
    expect(profileToTask.exitCode).toBe(1);
    expect(profileToTask.stdout).toContain("src/task/index.ts");
  });
});

test("architecture blocks import cycles and re-export cycles", () => {
  withFixture((root) => {
    writeFileSync(
      join(root, "src/core/a.ts"),
      'import { b } from "./b.ts";\nexport const a = b + 1;\n',
    );
    writeFileSync(
      join(root, "src/core/b.ts"),
      'import { a } from "./a.ts";\nexport const b = a + 1;\n',
    );
    writeFileSync(join(root, "src/cli.ts"), 'import { a } from "./core/a.ts";\nconsole.log(a);\n');
    expect(fallow("check:architecture", root).exitCode).toBe(1);

    writeFileSync(
      join(root, "src/core/a.ts"),
      'export { b } from "./b.ts";\nexport const a = 1;\n',
    );
    writeFileSync(
      join(root, "src/core/b.ts"),
      'export { a } from "./a.ts";\nexport const b = 2;\n',
    );
    expect(fallow("check:architecture", root).exitCode).toBe(1);
  });
});

test("architecture blocks unzoned files under src/", () => {
  withFixture((root) => {
    writeFileSync(join(root, "src/unzoned.ts"), "export const stray = true;\n");
    writeFileSync(
      join(root, "src/cli.ts"),
      'import { stray } from "./unzoned.ts";\nconsole.log(stray);\n',
    );
    const result = fallow("check:architecture", root);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("src/unzoned.ts");
  });
});

test("architecture policy blocks fetch calls and bare network imports in src/**", () => {
  withFixture((root) => {
    writeFileSync(
      join(root, "src/core/net.ts"),
      'export async function ping() { return fetch("https://example.com"); }\n',
    );
    writeFileSync(
      join(root, "src/cli.ts"),
      'import { ping } from "./core/net.ts";\nvoid ping();\n',
    );
    const fetchResult = fallow("check:architecture", root);
    expect(fetchResult.exitCode).toBe(1);
    expect(fetchResult.stdout).toContain("no-network");

    writeFileSync(join(root, "src/core/net.ts"), 'import "node:http";\nexport const ok = true;\n');
    writeFileSync(
      join(root, "src/cli.ts"),
      'import { ok } from "./core/net.ts";\nconsole.log(ok);\n',
    );
    const bareImportResult = fallow("check:architecture", root);
    expect(bareImportResult.exitCode).toBe(1);
    expect(bareImportResult.stdout).toContain("no-network");
  });
});

test("health gate blocks >300-LOC src files and >15 complexity functions", () => {
  withFixture((root) => {
    const bigLines = Array.from({ length: 305 }, (_, i) => `export const v${i} = ${i};`).join("\n");
    writeFileSync(join(root, "src/core/big.ts"), `${bigLines}\n`);
    writeFileSync(
      join(root, "src/cli.ts"),
      'import { v0 } from "./core/big.ts";\nconsole.log(v0);\n',
    );
    const bigResult = fallowCli(root, "health", "--no-cache", "--fail-on-parse-error");
    expect(bigResult.exitCode).toBe(1);

    rmSync(join(root, "src/core/big.ts"));
    const branches = Array.from(
      { length: 16 },
      (_, i) => `  if (n === ${i}) return ${i * 2};`,
    ).join("\n");
    writeFileSync(
      join(root, "src/core/complex.ts"),
      `export function complex(n: number): number {\n${branches}\n  return -1;\n}\n`,
    );
    writeFileSync(
      join(root, "src/cli.ts"),
      'import { complex } from "./core/complex.ts";\nconsole.log(complex(1));\n',
    );
    const complexResult = fallowCli(root, "health", "--no-cache", "--fail-on-parse-error");
    expect(complexResult.exitCode).toBe(1);
  });
});

test("dead-code and dupes gates block new unused exports and duplication in src/", () => {
  withFixture((root) => {
    writeFileSync(
      join(root, "src/core/mod.ts"),
      "export const used = 1;\nexport const unusedExport = 2;\n",
    );
    writeFileSync(
      join(root, "src/cli.ts"),
      'import { used } from "./core/mod.ts";\nconsole.log(used);\n',
    );
    const deadResult = fallowCli(
      root,
      "dead-code",
      "--fail-on-issues",
      "--no-cache",
      "--fail-on-parse-error",
    );
    expect(deadResult.exitCode).toBe(1);

    const block = [
      "export function computeDigest(items: string[], salt: string): string {",
      "  const filtered = items.map((entry) => entry.trim().toLowerCase()).filter(Boolean);",
      "  const sorted = [...filtered].sort((left, right) => left.localeCompare(right));",
      "  const joined = sorted.join('|');",
      "  const checksum = joined.length * 31 + salt.length * 17;",
      "  return `${salt}:${checksum}:${joined}`;",
      "}",
    ].join("\n");
    writeFileSync(join(root, "src/core/dup1.ts"), `${block}\n`);
    writeFileSync(join(root, "src/core/dup2.ts"), `${block}\n`);
    writeFileSync(
      join(root, "src/cli.ts"),
      'import { computeDigest as d1 } from "./core/dup1.ts";\nimport { computeDigest as d2 } from "./core/dup2.ts";\nconsole.log(d1(["a"], "s"), d2(["b"], "t"));\n',
    );
    const dupesResult = fallowCli(root, "dupes", "--fail-on-issues", "--no-cache");
    expect(dupesResult.exitCode).toBe(1);
  });
});

test("runs complexity and duplication as standalone reports", () => {
  withFixture((root) => {
    for (const [script, kind] of [
      ["report:complexity", "health"],
      ["report:duplication", "dupes"],
    ] as const) {
      const result = fallow(script, root, config, "--format", "json");
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ kind });
    }
  });
});

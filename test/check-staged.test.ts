import { describe, expect, test } from "bun:test";

import {
  chunkPaths,
  classifyStagedPaths,
  executeFastGate,
  parseNulPaths,
  runCheckStaged,
  type CommandRunner,
} from "../scripts/check-staged.ts";

describe("staged path parsing", () => {
  test("preserves whitespace and newlines with NUL-delimited Git output", () => {
    expect(
      parseNulPaths(Buffer.from("src/normal.ts\0docs/space name.md\0docs/line\nbreak.md\0")),
    ).toEqual(["src/normal.ts", "docs/space name.md", "docs/line\nbreak.md"]);
  });

  test("returns an empty set for empty output", () => {
    expect(parseNulPaths(Buffer.alloc(0))).toEqual([]);
  });
});

describe("staged path classification", () => {
  test("excludes only the Release Please generated changelog, not other Markdown", () => {
    expect(
      classifyStagedPaths([
        "plugins/codex-dev-flow/CHANGELOG.md",
        "plugins/codex-dev-flow/README.md",
        "docs/CHANGELOG.md",
        "plugins/other/CHANGELOG.md",
      ]),
    ).toEqual({
      formatPaths: [
        "plugins/codex-dev-flow/README.md",
        "docs/CHANGELOG.md",
        "plugins/other/CHANGELOG.md",
      ],
      lintPaths: [],
    });
  });

  test("separates formatter and linter inputs without duplicates", () => {
    expect(
      classifyStagedPaths([
        "README.md",
        "plugins/codex-dev-flow/src/cli.ts",
        "plugins/codex-dev-flow/src/cli.ts",
        "plugins/codex-dev-flow/test/copy name.mjs",
        "plugins/codex-dev-flow/.github/workflows/ci.yml",
        ".gitignore",
      ]),
    ).toEqual({
      formatPaths: [
        "README.md",
        "plugins/codex-dev-flow/src/cli.ts",
        "plugins/codex-dev-flow/test/copy name.mjs",
        "plugins/codex-dev-flow/.github/workflows/ci.yml",
      ],
      lintPaths: ["plugins/codex-dev-flow/src/cli.ts", "plugins/codex-dev-flow/test/copy name.mjs"],
    });
  });

  test("excludes generated, cached, lock, distribution, and fixture paths", () => {
    expect(
      classifyStagedPaths([
        "bun.lock",
        ".worktrees/task/src/a.ts",
        ".codex/tasks/task/state.json",
        ".codex/benchmarks/run.json",
        "plugins/codex-dev-flow/dist/dev-flow.mjs",
        "plugins/codex-dev-flow/coverage/lcov.info",
        "plugins/codex-dev-flow/test/fixtures/app-server-error.mjs",
        "plugins/codex-dev-flow/src/state.ts",
      ]),
    ).toEqual({
      formatPaths: ["plugins/codex-dev-flow/src/state.ts"],
      lintPaths: ["plugins/codex-dev-flow/src/state.ts"],
    });
  });
});

describe("argument batching", () => {
  test("keeps every path exactly once and permits an oversized singleton", () => {
    const paths = ["a.ts", "space name.ts", "x".repeat(80) + ".ts", "last.ts"];
    const chunks = chunkPaths(paths, ["--check"], 24);
    expect(chunks.flat()).toEqual(paths);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((chunk) => chunk.length === 1 && chunk[0] === paths[2])).toBe(true);
  });
});

describe("Fast Gate execution", () => {
  test("does nothing for an empty supported path set", () => {
    const calls: string[] = [];
    const status = executeFastGate({
      cwd: "/repo",
      formatPaths: [],
      lintPaths: [],
      run(command) {
        calls.push(command);
        return { status: 0 };
      },
    });
    expect(status).toBe(0);
    expect(calls).toEqual([]);
  });

  test("runs check-only formatter and native linter without shell interpolation", () => {
    const calls: Array<{ command: string; args: string[]; capture: boolean }> = [];
    const status = executeFastGate({
      cwd: "/repo",
      formatPaths: ["docs/space name.md", "plugins/codex-dev-flow/src/a.ts"],
      lintPaths: ["plugins/codex-dev-flow/src/a.ts"],
      run(command, args, options) {
        calls.push({ command, args, capture: options.capture });
        return { status: 0 };
      },
    });

    expect(status).toBe(0);
    expect(calls).toEqual([
      {
        command: "oxfmt",
        args: [
          "--check",
          "--no-error-on-unmatched-pattern",
          "--disable-nested-config",
          "docs/space name.md",
          "plugins/codex-dev-flow/src/a.ts",
        ],
        capture: false,
      },
      {
        command: "oxlint",
        args: [
          "--disable-nested-config",
          "--no-error-on-unmatched-pattern",
          "plugins/codex-dev-flow/src/a.ts",
        ],
        capture: false,
      },
    ]);
  });

  test("runs both tools and preserves failure status", () => {
    const commands: string[] = [];
    const status = executeFastGate({
      cwd: "/repo",
      formatPaths: ["README.md"],
      lintPaths: ["src/a.ts"],
      run(command) {
        commands.push(command);
        return { status: command === "oxfmt" ? 2 : 0 };
      },
    });
    expect(status).toBe(2);
    expect(commands).toEqual(["oxfmt", "oxlint"]);
  });

  test("treats a child spawn error as a gate failure", () => {
    expect(
      executeFastGate({
        cwd: "/repo",
        formatPaths: ["README.md"],
        lintPaths: [],
        run() {
          return { status: null, error: new Error("spawn failed") };
        },
      }),
    ).toBe(1);
  });
});

describe("Git adapter", () => {
  test("requests added, copied, modified, and renamed staged paths", () => {
    const calls: Array<{ command: string; args: string[]; capture: boolean }> = [];
    const run: CommandRunner = (command, args, options) => {
      calls.push({ command, args, capture: options.capture });
      if (command === "git") {
        return {
          status: 0,
          stdout: Buffer.from("README.md\0plugins/codex-dev-flow/src/renamed.ts\0"),
        };
      }
      return { status: 0 };
    };

    expect(runCheckStaged({ cwd: "/repo", run })).toBe(0);
    expect(calls[0]).toEqual({
      command: "git",
      args: ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"],
      capture: true,
    });
    expect(calls.slice(1).map(({ command }) => command)).toEqual(["oxfmt", "oxlint"]);
  });

  test("stops when Git cannot read the index", () => {
    const calls: string[] = [];
    expect(
      runCheckStaged({
        cwd: "/repo",
        run(command) {
          calls.push(command);
          return { status: 128, stderr: Buffer.from("fatal: index unavailable") };
        },
      }),
    ).toBe(128);
    expect(calls).toEqual(["git"]);
  });
});

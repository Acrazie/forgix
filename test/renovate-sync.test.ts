import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  COMMIT_TITLE,
  RENOVATE_BRANCH,
  RenovateSyncError,
  applyUpdatesToWorkingTree,
  parseReportPathArg,
  runRenovateSync,
  validateRenovateReport,
  type CommandResult,
  type CommandRunner,
} from "../scripts/renovate-sync.ts";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function seedRepoFixture(dir: string): void {
  mkdirSync(join(dir, "dist"), { recursive: true });
  mkdirSync(join(dir, ".buildkite"), { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify(
      {
        name: "@acrasie/forgix",
        packageManager: "bun@1.4.4",
        devDependencies: {
          yaml: "2.9.0",
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(dir, ".bun-version"), "1.4.4\n");
  writeFileSync(join(dir, ".node-version"), "26.8.1\n");
  writeFileSync(
    join(dir, ".buildkite/pipeline.yml"),
    ["env:", '  GIT_CLIFF_VERSION: "2.14.1"', '  RENOVATE_VERSION: "44.247.1"', ""].join("\n"),
  );
  writeFileSync(join(dir, "dist/forgix.mjs"), "// built\n");
}

function writeReport(dir: string, payload: unknown): string {
  const reportPath = join(dir, "renovate-report.json");
  writeFileSync(reportPath, JSON.stringify(payload, null, 2));
  return reportPath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("parseReportPathArg", () => {
  test("supports --report-path <path>, --report-path=<path>, positional arg, and env", () => {
    expect(parseReportPathArg(["--report-path", "/tmp/r.json"], {})).toBe("/tmp/r.json");
    expect(parseReportPathArg(["--report-path=/tmp/r2.json"], {})).toBe("/tmp/r2.json");
    expect(parseReportPathArg(["/tmp/r3.json"], {})).toBe("/tmp/r3.json");
    expect(parseReportPathArg([], { RENOVATE_REPORT_PATH: "/tmp/r4.json" })).toBe("/tmp/r4.json");
  });

  test("rejects missing report path or empty --report-path", () => {
    expect(() => parseReportPathArg([], {})).toThrow(RenovateSyncError);
    expect(() => parseReportPathArg(["--report-path"], {})).toThrow(RenovateSyncError);
    expect(() => parseReportPathArg(["--report-path="], {})).toThrow(RenovateSyncError);
  });
});

describe("validateRenovateReport", () => {
  test("rejects malformed or unsafe Renovate JSON reports", () => {
    expect(() => validateRenovateReport(null)).toThrow(RenovateSyncError);
    expect(() => validateRenovateReport([])).toThrow(RenovateSyncError);
    expect(() => validateRenovateReport({})).toThrow(/repositories/);
    expect(() => validateRenovateReport({ repositories: {} })).toThrow(/repositories\.local/);
    expect(() => validateRenovateReport({ repositories: { local: {} } })).toThrow(/packageFiles/);
    expect(() =>
      validateRenovateReport({ repositories: { local: { packageFiles: { bun: "bad" } } } }),
    ).toThrow(/must be an array/);
    expect(() =>
      validateRenovateReport({
        repositories: {
          local: { packageFiles: { regex: [{ packageFile: "../outside", deps: [] }] } },
        },
      }),
    ).toThrow(/Unsafe packageFile path/);
    expect(() =>
      validateRenovateReport({
        repositories: {
          local: {
            packageFiles: {
              bun: [
                {
                  packageFile: "package.json",
                  deps: [{ depName: "yaml", currentValue: "2.9.0", updates: [{ newValue: "" }] }],
                },
              ],
            },
          },
        },
      }),
    ).toThrow(/Invalid update entry/);
  });
});

describe("runRenovateSync", () => {
  test("exits 0 with no git/bun/entire commands when report has no updates", () => {
    const dir = makeTempDir("renovate-empty-");
    const reportPath = writeReport(dir, {
      repositories: {
        local: {
          packageFiles: {
            bun: [
              {
                packageFile: "package.json",
                deps: [
                  {
                    depType: "devDependencies",
                    depName: "yaml",
                    currentValue: "2.9.0",
                    updates: [],
                  },
                ],
              },
            ],
            regex: [
              {
                packageFile: ".bun-version",
                deps: [
                  { depName: "bun", currentValue: "1.4.4", replaceString: "1.4.4", updates: [] },
                ],
              },
            ],
          },
        },
      },
    });

    const commands: string[] = [];
    const runner: CommandRunner = (program, args) => {
      commands.push(`${program} ${args.join(" ")}`);
      return { status: 0, stdout: "", stderr: "" };
    };

    const outcome = runRenovateSync(reportPath, { cwd: dir, runCommand: runner });
    expect(outcome.status).toBe("no-updates");
    expect(outcome.updates).toEqual([]);
    expect(commands).toEqual([]);
  });

  test("applies bun + regex updates, aligns .bun-version and packageManager, runs check, pushes, and creates trail", () => {
    const dir = makeTempDir("renovate-apply-");
    seedRepoFixture(dir);
    const reportPath = writeReport(dir, {
      repositories: {
        local: {
          packageFiles: {
            bun: [
              {
                packageFile: "package.json",
                deps: [
                  {
                    depType: "devDependencies",
                    depName: "yaml",
                    currentValue: "2.9.0",
                    updates: [{ newValue: "2.9.1" }],
                  },
                ],
              },
              {
                packageFile: "package.json",
                deps: [
                  {
                    depType: "devDependencies",
                    depName: "yaml",
                    currentValue: "2.9.0",
                    updates: [{ newValue: "2.9.1" }],
                  },
                ],
              },
            ],
            regex: [
              {
                packageFile: ".bun-version",
                deps: [
                  {
                    depName: "bun",
                    currentValue: "1.4.4",
                    replaceString: "1.4.4",
                    updates: [{ newValue: "1.4.5" }],
                  },
                ],
              },
              {
                packageFile: ".node-version",
                deps: [
                  {
                    depName: "node",
                    currentValue: "26.8.1",
                    replaceString: "26.8.1",
                    updates: [{ newValue: "26.13.1" }],
                  },
                ],
              },
              {
                packageFile: ".buildkite/pipeline.yml",
                deps: [
                  {
                    depName: "orhun/git-cliff",
                    currentValue: "2.14.1",
                    replaceString: 'GIT_CLIFF_VERSION: "2.14.1"',
                    updates: [{ newValue: "2.14.2" }],
                  },
                ],
              },
            ],
          },
        },
      },
    });

    const calls: { program: string; args: readonly string[] }[] = [];
    const runner: CommandRunner = (program, args): CommandResult => {
      calls.push({ program, args });
      if (program === "git" && args[0] === "diff") {
        return { status: 1, stdout: "", stderr: "" };
      }
      if (program === "git" && args[0] === "rev-parse") {
        return { status: 1, stdout: "", stderr: "" };
      }
      if (program === "git" && args[0] === "status") {
        return {
          status: 0,
          stdout: [
            " M package.json",
            " M package.json",
            " M bun.lock",
            " M .bun-version",
            " M .node-version",
            " M .buildkite/pipeline.yml",
            " M dist/forgix.mjs",
          ].join("\n"),
          stderr: "",
        };
      }
      if (program === "entire" && args[0] === "trail" && args[1] === "list") {
        return { status: 0, stdout: JSON.stringify({ items: [] }), stderr: "" };
      }
      return { status: 0, stdout: "{}", stderr: "" };
    };

    const outcome = runRenovateSync(reportPath, { cwd: dir, runCommand: runner });

    expect(outcome.status).toBe("created-trail");
    expect(outcome.modifiedFiles).toContain("dist/forgix.mjs");

    const rootPkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      packageManager: string;
      devDependencies: Record<string, string>;
    };
    const pluginPkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      packageManager: string;
      devDependencies: Record<string, string>;
    };
    expect(rootPkg.devDependencies.yaml).toBe("2.9.1");
    expect(pluginPkg.devDependencies.yaml).toBe("2.9.1");
    expect(rootPkg.packageManager).toBe("bun@1.4.5");
    expect(pluginPkg.packageManager).toBe("bun@1.4.5");
    expect(readFileSync(join(dir, ".bun-version"), "utf8")).toBe("1.4.5\n");
    expect(readFileSync(join(dir, ".node-version"), "utf8")).toBe("26.13.1\n");
    expect(readFileSync(join(dir, ".buildkite/pipeline.yml"), "utf8")).toContain(
      'GIT_CLIFF_VERSION: "2.14.2"',
    );

    const commitCall = calls.find((c) => c.program === "git" && c.args[0] === "commit");
    expect(commitCall).toBeDefined();
    expect(commitCall?.args[2]).toBe(COMMIT_TITLE);
    expect(commitCall?.args.join(" ")).not.toContain("Co-authored-by:");

    const pushCall = calls.find((c) => c.program === "git" && c.args[0] === "push");
    expect(pushCall?.args).toEqual(["push", "--force-with-lease", "origin", RENOVATE_BRANCH]);

    const createCall = calls.find(
      (c) => c.program === "entire" && c.args[0] === "trail" && c.args[1] === "create",
    );
    expect(createCall).toBeDefined();
    expect(createCall?.args).toContain("--base");
    expect(createCall?.args).toContain("main");
  });

  test("comments on existing open trail instead of creating a duplicate", () => {
    const dir = makeTempDir("renovate-comment-");
    seedRepoFixture(dir);
    const reportPath = writeReport(dir, {
      repositories: {
        local: {
          packageFiles: {
            regex: [
              {
                packageFile: ".node-version",
                deps: [
                  {
                    depName: "node",
                    currentValue: "26.8.1",
                    replaceString: "26.8.1",
                    updates: [{ newValue: "26.13.1" }],
                  },
                ],
              },
            ],
          },
        },
      },
    });

    const calls: { program: string; args: readonly string[] }[] = [];
    const runner: CommandRunner = (program, args): CommandResult => {
      calls.push({ program, args });
      if (program === "git" && args[0] === "diff") return { status: 1, stdout: "", stderr: "" };
      if (program === "git" && args[0] === "rev-parse")
        return { status: 1, stdout: "", stderr: "" };
      if (program === "git" && args[0] === "status") {
        return { status: 0, stdout: " M .node-version", stderr: "" };
      }
      if (program === "entire" && args[0] === "trail" && args[1] === "list") {
        return {
          status: 0,
          stdout: JSON.stringify({
            items: [{ id: "01TRAIL", number: 42, title: COMMIT_TITLE, status: "open" }],
          }),
          stderr: "",
        };
      }
      return { status: 0, stdout: "{}", stderr: "" };
    };

    const outcome = runRenovateSync(reportPath, { cwd: dir, runCommand: runner });
    expect(outcome.status).toBe("commented-trail");

    const commentCall = calls.find(
      (c) => c.program === "entire" && c.args[0] === "trail" && c.args[1] === "comment",
    );
    expect(commentCall).toBeDefined();
    expect(commentCall?.args).toContain("--trail");
    expect(commentCall?.args).toContain("42");
  });

  test("aborts loudly before commit or push when bun run check fails", () => {
    const dir = makeTempDir("renovate-check-fail-");
    seedRepoFixture(dir);
    const reportPath = writeReport(dir, {
      repositories: {
        local: {
          packageFiles: {
            regex: [
              {
                packageFile: ".node-version",
                deps: [
                  {
                    depName: "node",
                    currentValue: "26.8.1",
                    replaceString: "26.8.1",
                    updates: [{ newValue: "26.13.1" }],
                  },
                ],
              },
            ],
          },
        },
      },
    });

    const calls: string[] = [];
    const runner: CommandRunner = (program, args): CommandResult => {
      calls.push(`${program} ${args.join(" ")}`);
      if (program === "bun" && args[0] === "run" && args[1] === "check") {
        return { status: 1, stdout: "", stderr: "typecheck failed" };
      }
      return { status: 0, stdout: "", stderr: "" };
    };

    expect(() => runRenovateSync(reportPath, { cwd: dir, runCommand: runner })).toThrow(
      /bun run check.*failed/,
    );
    expect(calls.some((c) => c.startsWith("git commit") || c.startsWith("git push"))).toBe(false);
    expect(calls.some((c) => c.startsWith("entire"))).toBe(false);
  });

  test("exits cleanly without push or trail when working tree matches origin/chore/renovate-deps", () => {
    const dir = makeTempDir("renovate-noop-remote-");
    seedRepoFixture(dir);
    const reportPath = writeReport(dir, {
      repositories: {
        local: {
          packageFiles: {
            regex: [
              {
                packageFile: ".node-version",
                deps: [
                  {
                    depName: "node",
                    currentValue: "26.8.1",
                    replaceString: "26.8.1",
                    updates: [{ newValue: "26.13.1" }],
                  },
                ],
              },
            ],
          },
        },
      },
    });

    const calls: string[] = [];
    const runner: CommandRunner = (program, args): CommandResult => {
      calls.push(`${program} ${args.join(" ")}`);
      if (program === "git" && args[0] === "diff" && args[2] === "HEAD") {
        return { status: 1, stdout: "", stderr: "" };
      }
      if (program === "git" && args[0] === "rev-parse") {
        return { status: 0, stdout: "abc123\n", stderr: "" };
      }
      if (program === "git" && args[0] === "diff" && args[2] === `origin/${RENOVATE_BRANCH}`) {
        return { status: 0, stdout: "", stderr: "" };
      }
      return { status: 0, stdout: "", stderr: "" };
    };

    const outcome = runRenovateSync(reportPath, { cwd: dir, runCommand: runner });
    expect(outcome.status).toBe("no-op-remote");
    expect(calls.some((c) => c.startsWith("git commit") || c.startsWith("git push"))).toBe(false);
    expect(calls.some((c) => c.startsWith("entire"))).toBe(false);
  });

  test("fails explicitly if text replacement target is missing or ambiguous", () => {
    const dir = makeTempDir("renovate-ambiguous-");
    writeFileSync(join(dir, ".node-version"), "26.8.1\n26.8.1\n");

    expect(() =>
      applyUpdatesToWorkingTree(dir, [
        {
          manager: "regex",
          packageFile: ".node-version",
          depName: "node",
          depType: undefined,
          currentValue: "26.8.1",
          newValue: "26.13.1",
          replaceString: undefined,
        },
      ]),
    ).toThrow(/Ambiguous multiple occurrences/);
  });
});

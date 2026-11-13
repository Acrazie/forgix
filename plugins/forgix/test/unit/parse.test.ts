// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { expect, test } from "bun:test";
import { expectThrown } from "../support/expect-error.ts";

test("parses an unclassified run objective", async () => {
  const { parseInvocation } = sourceApi;
  expect(parseInvocation(["rename", "the", "DTO"])).toEqual({
    command: "run",
    objective: "rename the DTO",
    flags: {},
  });
});

test("treats legacy mode words as objective text and parses read-only subcommands", async () => {
  const { parseInvocation } = sourceApi;
  expect(parseInvocation(["--help"])).toEqual({ command: "help" });
  expect(parseInvocation(["help", "with", "tests"])).toEqual({
    command: "run",
    objective: "help with tests",
    flags: {},
  });
  expect(parseInvocation(["init"])).toEqual({
    command: "init",
  });
  expect(parseInvocation(["critical", "migrate", "sessions"])).toEqual({
    command: "run",
    objective: "critical migrate sessions",
    flags: {},
  });
  expect(parseInvocation(["resume", "task-42"])).toEqual({
    command: "resume",
    taskId: "task-42",
  });
  expect(parseInvocation(["status"])).toEqual({
    command: "status",
    taskId: undefined,
  });
  expect(parseInvocation(["config", "show", "--explain"])).toEqual({
    command: "config_show",
    explain: true,
  });
  expect(parseInvocation(["project-profile", "inspect"])).toEqual({
    command: "project_profile_inspect",
    local: false,
  });
  expect(parseInvocation(["project-profile", "validate", "--local"])).toEqual({
    command: "project_profile_validate",
    local: true,
  });
  expect(parseInvocation(["project-profile", "session-view"])).toEqual({
    command: "project_profile_session_view",
  });
  expect(parseInvocation(["roadmap", "session-view", "--format=mermaid"])).toEqual({
    command: "roadmap_session_view",
    format: "mermaid",
  });
  expect(parseInvocation(["roadmap", "validate", "--session"])).toEqual({
    command: "roadmap_validate",
    session: true,
  });
  expect(parseInvocation(["roadmap", "publish-plan"])).toEqual({
    command: "roadmap_publish_plan",
  });
  expect(
    parseInvocation([
      "roadmap",
      "select-ready",
      "--limit=2",
      "--max-risk=medium",
      "--require-issue",
    ]),
  ).toEqual({
    command: "roadmap_select_ready",
    limit: 2,
    maxRisk: "medium",
    requireIssueNumber: true,
  });
});

test("rejects invalid invocations with a stable exit code", async () => {
  const { EXIT_CODES, InvocationError, parseInvocation } = sourceApi;
  expectThrown(
    () => parseInvocation(["config", "validate", "--unknown"]),
    (error) => error instanceof InvocationError && error.exitCode === EXIT_CODES.INVALID_INVOCATION,
  );
  expect(() => parseInvocation(["project-profile", "inspect", "--local"])).toThrow(
    /Invalid project-profile invocation/,
  );
  expect(() => parseInvocation(["roadmap", "select-ready", "--limit=0"])).toThrow(
    /Invalid --limit value/,
  );
  expect(() => parseInvocation(["roadmap", "unknown"])).toThrow(/Invalid roadmap invocation/);
});

test("parses --harness option across subcommands and run objectives", async () => {
  const { InvocationError, parseInvocation } = sourceApi;
  expect(parseInvocation(["--harness", "claude", "status"])).toEqual({
    command: "status",
    taskId: undefined,
    harness: "claude",
  });
  expect(parseInvocation(["status", "task-7", "--harness=antigravity"])).toEqual({
    command: "status",
    taskId: "task-7",
    harness: "antigravity",
  });
  expect(parseInvocation(["config", "show", "--harness", "codex", "--explain"])).toEqual({
    command: "config_show",
    explain: true,
    harness: "codex",
  });
  expect(parseInvocation(["--harness", "claude", "--benchmark", "ship", "auth"])).toEqual({
    command: "run",
    objective: "ship auth",
    flags: { benchmark: true },
    harness: "claude",
  });
  expect(parseInvocation(["--benchmark", "--harness=auto", "ship", "auth"])).toEqual({
    command: "run",
    objective: "ship auth",
    flags: { benchmark: true },
    harness: "auto",
  });
  expectThrown(
    () => parseInvocation(["--harness", "cursor", "status"]),
    (e) => e instanceof InvocationError,
  );
  expectThrown(
    () => parseInvocation(["--harness", "claude", "--harness", "codex", "status"]),
    (e) => e instanceof InvocationError,
  );
  expectThrown(
    () => parseInvocation(["status", "--harness="]),
    (e) => e instanceof InvocationError,
  );
});

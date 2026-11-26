// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import * as schema from "../../src/core/schema.ts";
import { expect, test } from "bun:test";
import { expectThrown } from "../support/expect-error.ts";

test("parses an unclassified run objective", async () => {
  const { parseInvocation } = sourceApi;
  expect(parseInvocation(["rename", "the", "DTO"])).toEqual({
    command: "run",
    objective: "rename the DTO",
  });
});

test("treats legacy mode words as objective text and parses read-only subcommands", async () => {
  const { parseInvocation } = sourceApi;
  expect(parseInvocation(["--help"])).toEqual({ command: "help" });
  expect(parseInvocation(["help", "with", "tests"])).toEqual({
    command: "run",
    objective: "help with tests",
  });
  expect(parseInvocation(["init", "check"])).toEqual({
    command: "init_check",
  });
  expectThrown(
    () => parseInvocation(["init"]),
    (error) =>
      error instanceof schema.InvocationError &&
      error.exitCode === schema.EXIT_CODES.INVALID_INVOCATION,
  );
  expect(parseInvocation(["critical", "migrate", "sessions"])).toEqual({
    command: "run",
    objective: "critical migrate sessions",
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
  expect(parseInvocation(["init", "plan", "--adopt"])).toEqual({
    command: "init_plan",
    adopt: true,
  });
  expect(parseInvocation(["init", "apply", "--adopt"])).toEqual({
    command: "init_apply",
    adopt: true,
  });
  for (const removed of ["session-view", "session-save", "session-clear"]) {
    expectThrown(
      () => parseInvocation(["project-profile", removed]),
      (error) =>
        error instanceof schema.InvocationError &&
        error.exitCode === schema.EXIT_CODES.INVALID_INVOCATION,
    );
  }
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
  expect(parseInvocation(["task", "validate", "task-42"])).toEqual({
    command: "task_validate",
    taskId: "task-42",
  });
  expect(parseInvocation(["task", "validate"])).toEqual({
    command: "task_validate",
  });
  expect(parseInvocation(["task", "save", "task-42"])).toEqual({
    command: "task_save",
    taskId: "task-42",
  });
  expect(parseInvocation(["task", "gate", "task-42"])).toEqual({
    command: "task_gate",
    taskId: "task-42",
    action: "view",
  });
  expect(parseInvocation(["task", "gate", "task-42", "--approve"])).toEqual({
    command: "task_gate",
    taskId: "task-42",
    action: "approve",
  });
  expect(parseInvocation(["task", "gate", "task-42", "--change=Narrow scope"])).toEqual({
    command: "task_gate",
    taskId: "task-42",
    action: "change",
    instruction: "Narrow scope",
  });
  expect(parseInvocation(["task", "gate", "task-42", "--autonomous", "--issue=#12"])).toEqual({
    command: "task_gate",
    taskId: "task-42",
    action: "autonomous",
    issueRef: "#12",
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
  const { parseInvocation } = sourceApi;
  expectThrown(
    () => parseInvocation(["config", "validate", "--unknown"]),
    (error) =>
      error instanceof schema.InvocationError &&
      error.exitCode === schema.EXIT_CODES.INVALID_INVOCATION,
  );
  expectThrown(
    () => parseInvocation(["--benchmark", "ship", "auth"]),
    (error) =>
      error instanceof schema.InvocationError &&
      error.exitCode === schema.EXIT_CODES.INVALID_INVOCATION,
  );
  expect(() => parseInvocation(["project-profile", "inspect", "--local"])).toThrow(
    /Invalid project-profile invocation/,
  );
  expect(() => parseInvocation(["task", "unknown"])).toThrow(/Invalid task invocation/);
  expect(() => parseInvocation(["roadmap", "select-ready", "--limit=0"])).toThrow(
    /Invalid --limit value/,
  );
  expect(() => parseInvocation(["roadmap", "unknown"])).toThrow(/Invalid roadmap invocation/);
});

test("parses --harness option across subcommands and run objectives", async () => {
  const { parseInvocation } = sourceApi;
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
  expect(parseInvocation(["--harness", "claude", "ship", "auth"])).toEqual({
    command: "run",
    objective: "ship auth",
    harness: "claude",
  });
  expect(parseInvocation(["--harness=auto", "ship", "auth"])).toEqual({
    command: "run",
    objective: "ship auth",
    harness: "auto",
  });
  expectThrown(
    () => parseInvocation(["--harness", "cursor", "status"]),
    (e) => e instanceof schema.InvocationError,
  );
  expectThrown(
    () => parseInvocation(["--harness", "claude", "--harness", "codex", "status"]),
    (e) => e instanceof schema.InvocationError,
  );
  expectThrown(
    () => parseInvocation(["status", "--harness="]),
    (e) => e instanceof schema.InvocationError,
  );
});

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
});

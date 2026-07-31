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
});

test("rejects invalid invocations with a stable exit code", async () => {
  const { EXIT_CODES, InvocationError, parseInvocation } = sourceApi;
  expectThrown(
    () => parseInvocation(["config", "validate", "--unknown"]),
    (error) => error instanceof InvocationError && error.exitCode === EXIT_CODES.INVALID_INVOCATION,
  );
});

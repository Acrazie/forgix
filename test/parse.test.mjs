import assert from "node:assert/strict";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

test("parses an unclassified run objective", async () => {
  const { parseInvocation } = await import(bundle);
  assert.deepEqual(parseInvocation(["rename", "the", "DTO"]), {
    command: "run",
    mode: undefined,
    objective: "rename the DTO",
    flags: {}
  });
});

test("parses explicit modes and read-only subcommands", async () => {
  const { parseInvocation } = await import(bundle);
  assert.deepEqual(parseInvocation(["critical", "migrate", "sessions"]), {
    command: "run",
    mode: "critical",
    objective: "migrate sessions",
    flags: {}
  });
  assert.deepEqual(parseInvocation(["resume", "task-42"]), {
    command: "resume",
    taskId: "task-42"
  });
  assert.deepEqual(parseInvocation(["status"]), {
    command: "status",
    taskId: undefined
  });
  assert.deepEqual(parseInvocation(["config", "show", "--explain"]), {
    command: "config_show",
    explain: true
  });
});

test("rejects invalid invocations with a stable exit code", async () => {
  const { EXIT_CODES, InvocationError, parseInvocation } = await import(bundle);
  assert.throws(
    () => parseInvocation(["config", "validate", "--unknown"]),
    (error) => error instanceof InvocationError && error.exitCode === EXIT_CODES.INVALID_INVOCATION
  );
});

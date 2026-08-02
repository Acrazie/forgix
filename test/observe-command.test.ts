import { describe, expect, test } from "bun:test";
import type { SpawnSyncReturns } from "node:child_process";
import { runObservedCommand } from "../scripts/observe-command.ts";

function childResult(status: number): SpawnSyncReturns<Buffer> {
  return {
    pid: 1,
    output: [],
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    status,
    signal: null,
    error: undefined,
  };
}

describe("timing observer", () => {
  test("preserves child failure status", () => {
    expect(
      runObservedCommand("Full Gate", "bun", ["run", "check"], {
        now: sequence(10, 35),
        run: () => childResult(7),
        report: () => {},
      }),
    ).toBe(7);
  });

  test("reporting failure cannot fail a passing command", () => {
    expect(
      runObservedCommand("Fast Gate", "bun", ["run", "check:staged"], {
        now: sequence(0, 12),
        run: () => childResult(0),
        report: () => {
          throw new Error("summary unavailable");
        },
      }),
    ).toBe(0);
  });
});

function sequence(...values: number[]): () => number {
  return () => values.shift() ?? 0;
}

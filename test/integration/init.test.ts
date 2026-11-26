import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HELP_TEXT, parseInvocation, runInvocation } from "../../src/cli.ts";
import { EXIT_CODES, InvocationError } from "../../src/core/schema.ts";
import { mergeHarnessHooksConfig } from "../../src/init/hooks-config.ts";
import { expectRejected, expectThrown } from "../support/expect-error.ts";

describe("agent-first init and hook CLI contract", () => {
  test("bare `forgix init` fails with EXIT_CODES.INVALID_INVOCATION and agent-first guidance", async () => {
    expectThrown(
      () => parseInvocation(["init"]),
      (error) =>
        error instanceof InvocationError &&
        error.exitCode === EXIT_CODES.INVALID_INVOCATION &&
        error.message.includes("$forgix init") &&
        error.message.includes("/forgix:forgix init") &&
        error.message.includes("/forgix init"),
    );

    await expectRejected(
      () => runInvocation(["init"]),
      (error) =>
        error instanceof InvocationError && error.exitCode === EXIT_CODES.INVALID_INVOCATION,
    );
  });

  test("parses `init plan|apply|check` and rejects unsupported init subcommands", () => {
    expect(parseInvocation(["init", "plan"])).toEqual({ command: "init_plan" });
    expect(parseInvocation(["init", "plan", "--adopt"])).toEqual({
      command: "init_plan",
      adopt: true,
    });
    expect(parseInvocation(["init", "apply"])).toEqual({ command: "init_apply" });
    expect(parseInvocation(["init", "apply", "--adopt"])).toEqual({
      command: "init_apply",
      adopt: true,
    });
    expect(parseInvocation(["init", "check"])).toEqual({ command: "init_check" });
    expect(parseInvocation(["--harness", "codex", "init", "check"])).toEqual({
      command: "init_check",
      harness: "codex",
    });

    for (const argv of [
      ["init", "wizard"],
      ["init", "plan", "extra"],
      ["init", "check-build", "auto"],
      ["init", "--global"],
    ]) {
      expectThrown(
        () => parseInvocation(argv),
        (error) =>
          error instanceof InvocationError && error.exitCode === EXIT_CODES.INVALID_INVOCATION,
      );
    }
  });

  test("BUILD installation checks are read-only and never confirm native registration", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "forgix-init-check-build-"));
    try {
      const entrypoint = fileURLToPath(new URL("../../src/cli.ts", import.meta.url));
      const args = ["init", "check-build", "codex"];
      const options = { workspaceRoot, env: { FORGIX_CLI_PATH: entrypoint } };
      expect(await runInvocation(args, options)).toMatchObject({
        status: "blocked",
        data: { findings: [expect.stringContaining("Git worktree")] },
      });

      expect(spawnSync("git", ["init", "-q"], { cwd: workspaceRoot }).status).toBe(0);
      expect(await runInvocation(args, options)).toMatchObject({
        status: "blocked",
        data: { findings: [expect.stringContaining(".codex/hooks.json")] },
      });

      await mkdir(join(workspaceRoot, ".codex"));
      const hooks = join(workspaceRoot, ".codex/hooks.json");
      await symlink(entrypoint, hooks);
      expect(await runInvocation(args, options)).toMatchObject({
        status: "blocked",
        data: { findings: ["Cannot safely read .codex/hooks.json."] },
      });

      const config = mergeHarnessHooksConfig("codex", undefined, true);
      if (!config.ok || !config.content) throw new Error("Missing generated hooks");
      await rm(hooks);
      await writeFile(hooks, config.content);
      expect(await runInvocation(args, options)).toMatchObject({
        status: "native_verification_required",
        data: { bundle: { buildAuthorizationReceiptVersion: 2 }, findings: [] },
      });
      expect(
        await runInvocation(args, {
          workspaceRoot,
          env: { FORGIX_CLI_PATH: `${entrypoint}.missing` },
        }),
      ).toMatchObject({
        status: "blocked",
        data: { findings: [expect.stringContaining("FORGIX_CLI_PATH")] },
      });
      expect(
        await runInvocation(args, {
          workspaceRoot,
          env: { HOME: workspaceRoot, XDG_CONFIG_HOME: join(workspaceRoot, ".xdg") },
        }),
      ).toMatchObject({
        status: "blocked",
        data: { findings: [expect.stringContaining("FORGIX_CLI_PATH")] },
      });
      const apply = await runInvocation(["init", "apply"], {
        workspaceRoot,
        env: { HOME: workspaceRoot, XDG_CONFIG_HOME: join(workspaceRoot, ".xdg") },
        init: {
          input: JSON.stringify({
            schemaVersion: 1,
            harnesses: ["codex"],
            rules: { enabled: false },
            hooks: { enabled: true },
            gitignore: { enabled: false },
            worktreeInclude: { enabled: false },
          }),
        },
      });
      expect(apply.status).toBe("ok");
      expect(
        await runInvocation(args, {
          workspaceRoot,
          env: { HOME: workspaceRoot, XDG_CONFIG_HOME: join(workspaceRoot, ".xdg") },
        }),
      ).toMatchObject({
        status: "native_verification_required",
        data: { bundle: { buildAuthorizationReceiptVersion: 2 }, findings: [] },
      });
      expect(await readFile(hooks, "utf8")).toBe(config.content);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("parses `hook <harness> <event>` and rejects invalid harness or event arguments", () => {
    expect(parseInvocation(["hook", "codex", "session-start"])).toEqual({
      command: "hook",
      targetHarness: "codex",
      event: "session-start",
    });
    expect(parseInvocation(["hook", "claude", "pre-tool-use"])).toEqual({
      command: "hook",
      targetHarness: "claude",
      event: "pre-tool-use",
    });
    expect(parseInvocation(["hook", "claude", "post-tool-use"])).toEqual({
      command: "hook",
      targetHarness: "claude",
      event: "post-tool-use",
    });
    expect(parseInvocation(["hook", "antigravity", "post-invocation"])).toEqual({
      command: "hook",
      targetHarness: "antigravity",
      event: "post-invocation",
    });

    for (const argv of [
      ["hook"],
      ["hook", "codex"],
      ["hook", "unknown", "session-start"],
      ["hook", "codex", "unknown-event"],
      ["hook", "codex", "session-start", "extra"],
    ]) {
      expectThrown(
        () => parseInvocation(argv),
        (error) =>
          error instanceof InvocationError && error.exitCode === EXIT_CODES.INVALID_INVOCATION,
      );
    }
  });

  test("HELP_TEXT advertises deterministic init and hook commands instead of interactive wizard", () => {
    expect(HELP_TEXT).toContain("init plan|apply [--adopt]");
    expect(HELP_TEXT).toContain("init check");
    expect(HELP_TEXT).not.toContain("project-profile session-view");
    expect(HELP_TEXT).toContain(
      "hook <codex|claude|antigravity> <session-start|pre-tool-use|post-tool-use|post-invocation>",
    );
  });
});

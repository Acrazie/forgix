import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildHookCommand,
  HARNESS_HOOK_EVENTS,
  HOOK_EVENT_NATIVE_NAMES,
  isSupportedHarnessHookEvent,
  runHook,
} from "../../src/hooks/index.js";
import type { HarnessId, HookEvent } from "../../src/types.js";

function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function initGitRepo(dir: string, branch = "main"): void {
  spawnSync("git", ["init", "-b", branch], { cwd: dir, encoding: "utf8" });
  spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: dir, encoding: "utf8" });
  spawnSync("git", ["config", "user.name", "Test"], { cwd: dir, encoding: "utf8" });
  writeFileSync(join(dir, "README.md"), "# repo\n");
  spawnSync("git", ["add", "README.md"], { cwd: dir, encoding: "utf8" });
  spawnSync("git", ["commit", "-m", "initial"], { cwd: dir, encoding: "utf8" });
}

describe("hooks command wrapper and event map", () => {
  test("maps expected lifecycle events and native names per harness", () => {
    expect(HARNESS_HOOK_EVENTS.codex).toEqual([
      { event: "session-start", nativeName: "SessionStart" },
      { event: "pre-tool-use", nativeName: "PreToolUse" },
      { event: "post-tool-use", nativeName: "PostToolUse" },
    ]);
    expect(HARNESS_HOOK_EVENTS.claude).toEqual([
      { event: "session-start", nativeName: "SessionStart" },
      { event: "pre-tool-use", nativeName: "PreToolUse" },
      { event: "post-tool-use", nativeName: "PostToolUse" },
    ]);
    expect(HARNESS_HOOK_EVENTS.antigravity).toEqual([
      { event: "session-start", nativeName: "SessionStart" },
      { event: "pre-tool-use", nativeName: "PreToolUse" },
      { event: "post-invocation", nativeName: "PostInvocation" },
    ]);
    expect(HOOK_EVENT_NATIVE_NAMES["post-invocation"]).toBe("PostInvocation");
    expect(isSupportedHarnessHookEvent("antigravity", "post-tool-use")).toBe(false);
    expect(isSupportedHarnessHookEvent("codex", "post-invocation")).toBe(false);
    expect(() => buildHookCommand("antigravity", "post-tool-use")).toThrow(RangeError);
    expect(() => buildHookCommand("claude", "post-invocation")).toThrow(RangeError);
  });

  test("fail-open shell wrapper never falls back to PATH, plugin root or a relative pin", () => {
    const dir = createTempDir("forgix-hook-wrapper-");
    try {
      mkdirSync(join(dir, "dist"), { recursive: true });
      writeFileSync(join(dir, "dist", "forgix.mjs"), "process.exit(99);\n");
      writeFileSync(join(dir, "forgix"), "#!/bin/sh\nexit 99\n", { mode: 0o755 });

      const minimalEnv: Record<string, string> = {
        HOME: dir,
        XDG_CONFIG_HOME: join(dir, "xdg"),
        PATH: `${dir}:${process.env.PATH ?? "/usr/bin:/bin"}`,
        CLAUDE_PLUGIN_ROOT: dir,
      };

      const cases: Array<{ harness: HarnessId; event: HookEvent; expectSystemMessage: boolean }> = [
        { harness: "codex", event: "session-start", expectSystemMessage: true },
        { harness: "claude", event: "session-start", expectSystemMessage: true },
        { harness: "antigravity", event: "session-start", expectSystemMessage: true },
        { harness: "codex", event: "pre-tool-use", expectSystemMessage: false },
        { harness: "claude", event: "post-tool-use", expectSystemMessage: false },
        { harness: "antigravity", event: "pre-tool-use", expectSystemMessage: false },
        { harness: "antigravity", event: "post-invocation", expectSystemMessage: false },
      ];

      for (const [index, item] of cases.entries()) {
        const cmd = buildHookCommand(item.harness, item.event);
        const result = spawnSync("/bin/sh", ["-c", cmd], {
          cwd: dir,
          env: {
            ...minimalEnv,
            FORGIX_CLI_PATH: ["", "./dist/forgix.mjs", join(dir, "missing.mjs")][index % 3],
          },
          input: "{}",
          encoding: "utf8",
        });
        expect(result.status).toBe(0);
        const parsed = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
        if (item.expectSystemMessage) {
          if (item.harness === "antigravity") {
            expect(parsed).toHaveProperty("injectSteps");
          } else {
            expect(typeof parsed.systemMessage).toBe("string");
          }
        } else {
          expect(parsed).toEqual({});
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("shell wrapper resolves machine-local pin and Antigravity default path without FORGIX_CLI_PATH", () => {
    const dir = createTempDir("forgix-hook-autopin-");
    try {
      const stub = join(dir, "stub.mjs");
      writeFileSync(
        stub,
        'process.stdout.write(JSON.stringify({ argv: process.argv.slice(2) }) + "\\n");\n',
      );
      const xdg = join(dir, "xdg");
      mkdirSync(join(xdg, "forgix"), { recursive: true });
      writeFileSync(join(xdg, "forgix", "cli-path.codex"), `${stub}\n`);

      const codexRes = spawnSync("/bin/sh", ["-c", buildHookCommand("codex", "session-start")], {
        cwd: dir,
        env: { HOME: dir, XDG_CONFIG_HOME: xdg, PATH: process.env.PATH ?? "/usr/bin:/bin" },
        input: "{}",
        encoding: "utf8",
      });
      expect(codexRes.status).toBe(0);
      expect(JSON.parse(codexRes.stdout.trim())).toEqual({
        argv: ["hook", "codex", "session-start"],
      });

      const agyDefault = join(dir, ".gemini", "config", "plugins", "forgix", "dist", "forgix.mjs");
      mkdirSync(join(dir, ".gemini", "config", "plugins", "forgix", "dist"), { recursive: true });
      writeFileSync(
        agyDefault,
        'process.stdout.write(JSON.stringify({ argv: process.argv.slice(2) }) + "\\n");\n',
      );
      const agyRes = spawnSync(
        "/bin/sh",
        ["-c", buildHookCommand("antigravity", "session-start")],
        {
          cwd: dir,
          env: { HOME: dir, XDG_CONFIG_HOME: xdg, PATH: process.env.PATH ?? "/usr/bin:/bin" },
          input: "{}",
          encoding: "utf8",
        },
      );
      expect(agyRes.status).toBe(0);
      expect(JSON.parse(agyRes.stdout.trim())).toEqual({
        argv: ["hook", "antigravity", "session-start"],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("hooks fail-open and malformed input handling", () => {
  test("malformed stdin never exits with code 2 and warns lightly only on session-start", async () => {
    const dir = createTempDir("forgix-hook-malformed-");
    try {
      const codexPre = await runHook("codex", "pre-tool-use", {
        workspaceRoot: dir,
        input: "{not valid json",
      });
      expect(codexPre.exitCode).toBe(0);
      expect(codexPre.stdout).toBe("{}");

      const claudePost = await runHook("claude", "post-tool-use", {
        workspaceRoot: dir,
        input: "[1, 2, 3]",
      });
      expect(claudePost.exitCode).toBe(0);
      expect(claudePost.stdout).toBe("{}");

      const agySession = await runHook("antigravity", "session-start", {
        workspaceRoot: dir,
        input: "{broken",
      });
      expect(agySession.exitCode).toBe(0);
      const parsed = JSON.parse(agySession.stdout) as {
        injectSteps: Array<{ systemMessage: { systemMessage: string } }>;
      };
      expect(parsed.injectSteps[0]?.systemMessage.systemMessage).toContain("Malformed JSON");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("broken config.yaml fails open without throwing or returning exit code 2", async () => {
    const dir = createTempDir("forgix-hook-bad-config-");
    try {
      mkdirSync(join(dir, ".forgix"), { recursive: true });
      writeFileSync(join(dir, ".forgix", "config.yaml"), "hooks: [unterminated\n");

      const session = await runHook("codex", "session-start", {
        workspaceRoot: dir,
        input: "{}",
      });
      expect(session.exitCode).toBe(0);
      const parsed = JSON.parse(session.stdout) as { systemMessage: string };
      expect(parsed.systemMessage).toContain("Config warning");

      const pre = await runHook("claude", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "git status" } }),
      });
      expect(pre.exitCode).toBe(0);
      expect(pre.stdout).toBe("{}");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("hooks universal destructive shell command invariants", () => {
  test("blocks git commit --no-verify / -n and git push --force / -f in balanced/strict, allows --force-with-lease", async () => {
    const dir = createTempDir("forgix-hook-shell-");
    try {
      // git commit --no-verify on Codex (balanced default)
      const noVerify = await runHook("codex", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: 'git commit --no-verify -m "skip"' },
        }),
      });
      expect(noVerify.exitCode).toBe(2);
      expect(noVerify.stderr).toContain("--no-verify");

      // git commit -an on Antigravity (balanced default) -> exit 0 + deny
      const shortN = await runHook("antigravity", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({
          toolCall: { name: "run_command", args: { CommandLine: 'git commit -an -m "skip"' } },
        }),
      });
      expect(shortN.exitCode).toBe(0);
      expect(JSON.parse(shortN.stdout)).toMatchObject({ decision: "deny" });

      // Safe commit message mentioning -n and --no-verify must be allowed
      const safeCommit = await runHook("claude", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: 'git commit -m "document -n and --no-verify handling"' },
        }),
      });
      expect(safeCommit.exitCode).toBe(0);
      expect(safeCommit.stdout).toBe("{}");

      // git push -f blocked
      const forcePush = await runHook("claude", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: "git push -f origin feature" },
        }),
      });
      expect(forcePush.exitCode).toBe(2);
      expect(forcePush.stderr).toContain("--force-with-lease");

      // git push --force-with-lease allowed
      const leasePush = await runHook("claude", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: "git push --force-with-lease origin feature" },
        }),
      });
      expect(leasePush.exitCode).toBe(0);
      expect(leasePush.stdout).toBe("{}");

      // warn mode downgrades destructive command to warning
      mkdirSync(join(dir, ".forgix"), { recursive: true });
      writeFileSync(
        join(dir, ".forgix", "config.yaml"),
        "schemaVersion: 1\nhooks:\n  enforcement: warn\n",
      );
      const warnCodex = await runHook("codex", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: "git push --force origin feature" },
        }),
      });
      expect(warnCodex.exitCode).toBe(0);
      expect(JSON.parse(warnCodex.stdout)).toHaveProperty("systemMessage");

      const warnAgy = await runHook("antigravity", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({
          toolCall: { name: "run_command", args: { CommandLine: "git push --force origin feat" } },
        }),
      });
      expect(warnAgy.exitCode).toBe(0);
      expect(JSON.parse(warnAgy.stdout)).toMatchObject({ decision: "allow" });
      expect(JSON.parse(warnAgy.stdout).reason).toContain("--force-with-lease");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("blocks direct git merge on trunk branch while allowing merge on feature branch", async () => {
    const dir = createTempDir("forgix-hook-merge-");
    try {
      initGitRepo(dir, "main");

      const trunkMerge = await runHook("codex", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({
          cwd: dir,
          tool_name: "Bash",
          tool_input: { command: "git merge feature/x" },
        }),
      });
      expect(trunkMerge.exitCode).toBe(2);
      expect(trunkMerge.stderr).toContain('trunk branch "main"');

      // git merge --abort is allowed even on main
      const abortMerge = await runHook("codex", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({
          cwd: dir,
          tool_name: "Bash",
          tool_input: { command: "git merge --abort" },
        }),
      });
      expect(abortMerge.exitCode).toBe(0);

      // Switch to feature branch -> merge allowed
      spawnSync("git", ["checkout", "-b", "feat/work"], { cwd: dir, encoding: "utf8" });
      const featureMerge = await runHook("codex", "pre-tool-use", {
        workspaceRoot: dir,
        input: JSON.stringify({
          cwd: dir,
          tool_name: "Bash",
          tool_input: { command: "git merge origin/main" },
        }),
      });
      expect(featureMerge.exitCode).toBe(0);
      expect(featureMerge.stdout).toBe("{}");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

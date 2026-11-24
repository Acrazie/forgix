import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compileFactoryPolicies,
  scanDiffForFactoryEscapeHatches,
} from "../../src/core/factory-policy.ts";
import {
  ConfigValidationError,
  EXIT_CODES,
  InvocationError,
  validateSchema,
} from "../../src/core/schema.ts";
import { buildHookCommand } from "../../src/hooks/command.ts";
import { checkHarnessHooksConfig, mergeHarnessHooksConfig } from "../../src/init/hooks-config.ts";
import {
  MANDATORY_GITIGNORE_ENTRIES,
  MAX_RULES_CONTENT_BYTES,
  runInitBootstrap,
} from "../../src/init/index.ts";
import {
  HASH_FORGIX_MARKERS,
  HTML_FORGIX_MARKERS,
  inspectMarkerBlock,
  removeMarkerBlock,
  upsertMarkerBlock,
} from "../../src/init/markers.ts";
import { expectRejected } from "../support/expect-error.ts";

function makeValidManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    harnesses: ["codex", "claude", "antigravity"],
    rules: {
      enabled: true,
      items: [
        {
          id: "core-quality",
          description: "Run checks before shipping",
          globs: ["src/**"],
          enforce: {
            protectedSurfaces: ["config/secrets/**"],
            blockedCommands: [{ pattern: "rm -rf /", reason: "No destructive root delete." }],
            escapeHatchPatterns: [{ kind: "no-debug", pattern: "\\bdebugger\\b" }],
          },
          content: "# Project Rules\n\n- Run `bun run check` before shipping.\n",
        },
      ],
    },
    agents: {
      enabled: true,
      items: [
        {
          id: "arch-reviewer",
          name: "Architecture Reviewer",
          description: "Reviews module boundaries",
          role: "reviewer",
          tools: ["read"],
          content: "Verify zone boundaries and acyclic imports.",
        },
      ],
    },
    skills: {
      enabled: true,
      items: [
        {
          id: "release-check",
          name: "release-check",
          description: "Verify release readiness",
          content: "Run checks before tagging a release.",
        },
      ],
    },
    hooks: {
      enabled: true,
      enforcement: "balanced",
    },
    gitignore: {
      enabled: true,
    },
    worktreeInclude: {
      enabled: true,
      entries: [".env", ".forgix/config.local.yaml"],
    },
    ...overrides,
  };
}

describe("init-bootstrap schema and manifest validation", () => {
  test("accepts valid manifest and rejects forbidden configPatch keys", () => {
    expect(validateSchema("init-bootstrap", makeValidManifest()).valid).toBe(true);

    expect(
      validateSchema(
        "init-bootstrap",
        makeValidManifest({
          harnesses: [],
          rules: { enabled: false },
          hooks: { enabled: false },
          gitignore: { enabled: false },
          worktreeInclude: { enabled: false },
        }),
      ).valid,
    ).toBe(true);

    // Valid operational configPatch keys
    expect(
      validateSchema(
        "init-bootstrap",
        makeValidManifest({
          configPatch: {
            harness: "claude",
            worktree: { mode: "required" },
            runner: { mode: "auto", assureRunner: "dagger" },
            integrations: { plugins: ["entire"], skills: ["context7-mcp"] },
          },
        }),
      ).valid,
    ).toBe(true);

    // Forbidden bootstrap keys inside configPatch
    for (const forbiddenKey of ["harnesses", "hooks", "bootstrap", "schemaVersion"] as const) {
      const result = validateSchema(
        "init-bootstrap",
        makeValidManifest({ configPatch: { [forbiddenKey]: true } }),
      );
      expect(result.valid).toBe(false);
    }

    // rules.items required when rules.enabled === true
    expect(
      validateSchema("init-bootstrap", makeValidManifest({ rules: { enabled: true } })).valid,
    ).toBe(false);

    // Invalid slugs, path traversal globs, and invalid managedPaths rejected
    expect(
      validateSchema(
        "init-bootstrap",
        makeValidManifest({
          rules: {
            enabled: true,
            items: [{ id: "../bad", description: "bad", content: "x" }],
          },
        }),
      ).valid,
    ).toBe(false);

    expect(
      validateSchema("config", {
        schemaVersion: 1,
        bootstrap: { managedPaths: ["../escape.md"] },
      }).valid,
    ).toBe(false);

    expect(
      validateSchema("config", {
        schemaVersion: 1,
        bootstrap: {
          managedPaths: [
            ".forgix/factory/rules/core-quality.md",
            ".claude/rules/forgix-core-quality.md",
          ],
        },
      }).valid,
    ).toBe(true);

    // Duplicate harnesses rejected
    expect(
      validateSchema("init-bootstrap", makeValidManifest({ harnesses: ["codex", "codex"] })).valid,
    ).toBe(false);

    // Newlines in gitignore / worktreeInclude entries rejected
    expect(
      validateSchema(
        "init-bootstrap",
        makeValidManifest({ gitignore: { enabled: true, extraEntries: ["a\nb"] } }),
      ).valid,
    ).toBe(false);
  });

  test("rejects missing stdin (exit 2), malformed input (exit 3), and >24KB UTF-8 rules.content (exit 3)", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgix-init-unit-"));
    try {
      await expectRejected(
        () => runInitBootstrap("plan", { workspaceRoot: root }),
        (error) =>
          error instanceof InvocationError && error.exitCode === EXIT_CODES.INVALID_INVOCATION,
      );

      await expectRejected(
        () => runInitBootstrap("plan", { workspaceRoot: root, input: "   " }),
        (error) => error instanceof InvocationError,
      );

      await expectRejected(
        () => runInitBootstrap("plan", { workspaceRoot: root, input: "{not valid: [yaml" }),
        (error) =>
          error instanceof ConfigValidationError &&
          error.exitCode === EXIT_CODES.INVALID_CONFIGURATION,
      );

      // Multi-byte UTF-8: 12001 × 2-byte char = 24002 bytes > 24000 bytes
      const oversized = "é".repeat(12_001);
      expect(Buffer.byteLength(oversized, "utf8")).toBeGreaterThan(MAX_RULES_CONTENT_BYTES);
      await expectRejected(
        () =>
          runInitBootstrap("plan", {
            workspaceRoot: root,
            input: JSON.stringify(
              makeValidManifest({
                rules: {
                  enabled: true,
                  items: [{ id: "big-rule", description: "Big", content: oversized }],
                },
              }),
            ),
          }),
        (error) => error instanceof ConfigValidationError,
      );

      // Duplicate rule IDs rejected
      await expectRejected(
        () =>
          runInitBootstrap("plan", {
            workspaceRoot: root,
            input: JSON.stringify(
              makeValidManifest({
                rules: {
                  enabled: true,
                  items: [
                    { id: "dup", description: "A", content: "a" },
                    { id: "dup", description: "B", content: "b" },
                  ],
                },
              }),
            ),
          }),
        (error) => error instanceof ConfigValidationError,
      );

      // Invalid regex in enforce.blockedCommands rejected
      await expectRejected(
        () =>
          runInitBootstrap("plan", {
            workspaceRoot: root,
            input: JSON.stringify(
              makeValidManifest({
                rules: {
                  enabled: true,
                  items: [
                    {
                      id: "bad-regex",
                      description: "Bad regex",
                      enforce: { blockedCommands: [{ pattern: "[unclosed", reason: "invalid" }] },
                      content: "rule",
                    },
                  ],
                },
              }),
            ),
          }),
        (error) => error instanceof ConfigValidationError,
      );

      // Marker injection rejected
      await expectRejected(
        () =>
          runInitBootstrap("plan", {
            workspaceRoot: root,
            input: JSON.stringify(
              makeValidManifest({
                gitignore: { enabled: true, extraEntries: ["# forgix:end"] },
              }),
            ),
          }),
        (error) => error instanceof ConfigValidationError,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("init/markers", () => {
  test("inserts, updates, and removes delimited blocks while preserving surrounding bytes", () => {
    const original = "# Header\n\nCustom user content.\n";
    const inserted = upsertMarkerBlock(original, HTML_FORGIX_MARKERS, "Forgix line 1");
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    expect(inserted.content).toBe(
      "# Header\n\nCustom user content.\n\n<!-- forgix:start -->\nForgix line 1\n<!-- forgix:end -->\n",
    );

    const updated = upsertMarkerBlock(inserted.content, HTML_FORGIX_MARKERS, "Forgix line 2");
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.content).toBe(
      "# Header\n\nCustom user content.\n\n<!-- forgix:start -->\nForgix line 2\n<!-- forgix:end -->\n",
    );

    const removed = removeMarkerBlock(updated.content, HTML_FORGIX_MARKERS);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.content).toBe(original);
  });

  test("preserves content both before and after a middle block", () => {
    const content = "before-1\n# forgix:start\nold\n# forgix:end\nafter-1\n";
    const updated = upsertMarkerBlock(content, HASH_FORGIX_MARKERS, "new");
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.content).toBe("before-1\n# forgix:start\nnew\n# forgix:end\nafter-1\n");

    const removed = removeMarkerBlock(updated.content, HASH_FORGIX_MARKERS);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.content).toBe("before-1\nafter-1\n");
  });

  test("returns undefined when removing the sole block in a file", () => {
    const created = upsertMarkerBlock(undefined, HASH_FORGIX_MARKERS, ".env");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const removed = removeMarkerBlock(created.content, HASH_FORGIX_MARKERS);
    expect(removed).toEqual({ ok: true, content: undefined });
  });

  test("detects orphan, reversed, and duplicate markers as conflicts", () => {
    expect(inspectMarkerBlock("# forgix:start\nfoo\n", HASH_FORGIX_MARKERS)).toMatchObject({
      status: "conflict",
      conflict: { code: "orphan_marker" },
    });
    expect(inspectMarkerBlock("foo\n# forgix:end\n", HASH_FORGIX_MARKERS)).toMatchObject({
      status: "conflict",
      conflict: { code: "orphan_marker" },
    });
    expect(inspectMarkerBlock("# forgix:end\n# forgix:start\n", HASH_FORGIX_MARKERS)).toMatchObject(
      {
        status: "conflict",
        conflict: { code: "reversed_markers" },
      },
    );
    expect(
      inspectMarkerBlock(
        "<!-- forgix:start -->\na\n<!-- forgix:end -->\n<!-- forgix:start -->\nb\n<!-- forgix:end -->\n",
        HTML_FORGIX_MARKERS,
      ),
    ).toMatchObject({
      status: "conflict",
      conflict: { code: "duplicate_markers" },
    });
  });
});

describe("init/hooks-config", () => {
  test("merges Antigravity hooks with exact flat/grouped asymmetry while preserving Entire", () => {
    const entireHooks = JSON.stringify(
      {
        entire: {
          SessionStart: [{ type: "command", command: "entire hooks antigravity session-start" }],
          PreToolUse: [
            {
              matcher: "*",
              hooks: [{ type: "command", command: "entire hooks antigravity pre-tool-use" }],
            },
          ],
        },
      },
      null,
      2,
    );

    const merged = mergeHarnessHooksConfig("antigravity", entireHooks, true);
    expect(merged.ok).toBe(true);
    if (!merged.ok || !merged.content) return;

    const parsed = JSON.parse(merged.content) as Record<string, Record<string, unknown[]>>;
    expect(parsed.entire).toBeDefined();
    expect(parsed.forgix).toBeDefined();
    // Flat SessionStart & PostInvocation
    expect(parsed.forgix!.SessionStart).toEqual([
      {
        type: "command",
        command: buildHookCommand("antigravity", "session-start"),
        timeout: 5,
      },
    ]);
    expect(parsed.forgix!.PostInvocation).toEqual([
      {
        type: "command",
        command: buildHookCommand("antigravity", "post-invocation"),
        timeout: 5,
      },
    ]);
    // Grouped PreToolUse
    expect(parsed.forgix!.PreToolUse).toEqual([
      {
        matcher: "*",
        hooks: [
          {
            type: "command",
            command: buildHookCommand("antigravity", "pre-tool-use"),
            timeout: 5,
          },
        ],
      },
    ]);
    expect(checkHarnessHooksConfig("antigravity", merged.content)).toEqual([]);

    // Removing Forgix leaves Entire intact
    const removed = mergeHarnessHooksConfig("antigravity", merged.content, false);
    expect(removed.ok).toBe(true);
    if (!removed.ok || !removed.content) return;
    const afterRemove = JSON.parse(removed.content) as Record<string, unknown>;
    expect(afterRemove.forgix).toBeUndefined();
    expect(afterRemove.entire).toBeDefined();
  });

  test("merges and removes Codex and Claude hooks without touching third-party entries or settings", () => {
    const existingCodex = JSON.stringify(
      {
        hooks: {
          SessionStart: [
            {
              matcher: null,
              hooks: [
                { type: "command", command: "entire hooks codex session-start", timeout: 30 },
              ],
            },
          ],
          Stop: [
            {
              matcher: null,
              hooks: [{ type: "command", command: "entire hooks codex stop", timeout: 30 }],
            },
          ],
        },
      },
      null,
      2,
    );

    const mergedCodex = mergeHarnessHooksConfig("codex", existingCodex, true);
    expect(mergedCodex.ok).toBe(true);
    if (!mergedCodex.ok || !mergedCodex.content) return;
    expect(checkHarnessHooksConfig("codex", mergedCodex.content)).toEqual([]);

    // Idempotent second merge
    const mergedCodexAgain = mergeHarnessHooksConfig("codex", mergedCodex.content, true);
    expect(mergedCodexAgain).toEqual(mergedCodex);

    // Removal preserves Entire hooks
    const removedCodex = mergeHarnessHooksConfig("codex", mergedCodex.content, false);
    expect(removedCodex.ok).toBe(true);
    if (!removedCodex.ok || !removedCodex.content) return;
    const codexParsed = JSON.parse(removedCodex.content) as {
      hooks: Record<string, unknown[]>;
    };
    expect(codexParsed.hooks.SessionStart).toHaveLength(1);
    expect(codexParsed.hooks.Stop).toHaveLength(1);
    expect(codexParsed.hooks.PreToolUse).toBeUndefined();
    expect(codexParsed.hooks.PostToolUse).toBeUndefined();

    // Claude preserves unrelated settings keys
    const existingClaude = JSON.stringify(
      {
        permissions: { allow: ["Read"] },
        env: { FOO: "bar" },
      },
      null,
      2,
    );
    const mergedClaude = mergeHarnessHooksConfig("claude", existingClaude, true);
    expect(mergedClaude.ok).toBe(true);
    if (!mergedClaude.ok || !mergedClaude.content) return;
    expect(checkHarnessHooksConfig("claude", mergedClaude.content)).toEqual([]);
    const claudeParsed = JSON.parse(mergedClaude.content) as Record<string, unknown>;
    expect(claudeParsed.permissions).toEqual({ allow: ["Read"] });
    expect(claudeParsed.env).toEqual({ FOO: "bar" });

    const removedClaude = mergeHarnessHooksConfig("claude", mergedClaude.content, false);
    expect(removedClaude.ok).toBe(true);
    if (!removedClaude.ok || !removedClaude.content) return;
    expect(JSON.parse(removedClaude.content)).toEqual({
      permissions: { allow: ["Read"] },
      env: { FOO: "bar" },
    });
  });

  test("reports invalid JSON conflicts and mandatory gitignore entries include config.local.yaml", () => {
    expect(mergeHarnessHooksConfig("codex", "{broken json", true)).toMatchObject({
      ok: false,
      conflict: { code: "invalid_json" },
    });
    expect(checkHarnessHooksConfig("claude", "{broken json")[0]).toMatchObject({
      code: "hooks_json_invalid",
    });
    expect(MANDATORY_GITIGNORE_ENTRIES).toContain(".forgix/config.local.yaml");
    expect(MANDATORY_GITIGNORE_ENTRIES).toContain(".forgix/init/");
  });

  test("compiles sorted factoryPolicies and honors approvedEscapeHatches in custom scan", () => {
    const compiled = compileFactoryPolicies([
      {
        id: "r1",
        description: "R1",
        enforce: {
          protectedSurfaces: ["z/**", "a/**"],
          blockedCommands: [
            { pattern: "z-cmd", reason: "No Z" },
            { pattern: "a-cmd", reason: "No A" },
          ],
          escapeHatchPatterns: [
            { kind: "z-hatch", pattern: "\\bz_hatch\\b" },
            { kind: "a-hatch", pattern: "\\ba_hatch\\b" },
          ],
        },
        content: "body",
      },
    ]);
    expect(compiled?.protectedSurfaces).toEqual(["a/**", "z/**"]);
    expect(compiled?.blockedCommands?.map((c) => c.pattern)).toEqual(["a-cmd", "z-cmd"]);
    expect(compiled?.escapeHatchPatterns?.map((h) => h.kind)).toEqual(["a-hatch", "z-hatch"]);

    const diff = "+++ b/src/demo.ts\n@@ -1,1 +1,2 @@\n+a_hatch\n+z_hatch\n";
    expect(scanDiffForFactoryEscapeHatches(diff, compiled, ["src/demo.ts:a-hatch"])).toHaveLength(
      1,
    );
  });
});

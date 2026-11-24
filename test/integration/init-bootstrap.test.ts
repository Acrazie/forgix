import { describe, expect, test } from "bun:test";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { EXIT_CODES, StateStoreError } from "../../src/core/schema.ts";
import { createWorkspaceStore } from "../../src/core/store.ts";
import {
  runInitBootstrap,
  type InitCheckFinding,
  type InitPlanAction,
} from "../../src/init/index.ts";
import { expectRejected } from "../support/expect-error.ts";

const makeWorkspace = () => mkdtemp(join(tmpdir(), "forgix-init-bootstrap-"));

function makeManifest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
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
            blockedCommands: [{ pattern: "curl\\s+.*\\|\\s*sh", reason: "No pipe-to-shell." }],
            escapeHatchPatterns: [{ kind: "no-debugger", pattern: "\\bdebugger\\b" }],
          },
          content: "# Canonical Repo Rules\n\n- Always run `bun run check`.\n",
        },
      ],
    },
    agents: {
      enabled: true,
      items: [
        {
          id: "arch-reviewer",
          name: "Architecture Reviewer",
          description: "Checks module boundaries",
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
      extraEntries: [".custom-cache/"],
    },
    worktreeInclude: {
      enabled: true,
      entries: [".env", ".forgix/config.local.yaml", ".forgix/project.local.yaml"],
    },
    ...overrides,
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("init bootstrap integration (plan | apply | check)", () => {
  test("plan is strictly read-only, fresh apply sets 0o755/0o644 permissions, second apply is idempotent, and check passes", async () => {
    const root = await makeWorkspace();
    try {
      const manifest = makeManifest();

      // 1. plan creates nothing
      const planResult = await runInitBootstrap("plan", {
        workspaceRoot: root,
        input: manifest,
      });
      expect(planResult.command).toBe("init_plan");
      expect(planResult.status).toBe("ok");
      const planData = planResult.data as { actions: InitPlanAction[]; conflicts: unknown[] };
      expect(planData.conflicts).toEqual([]);
      expect(planData.actions.some((a) => a.kind === "create" && a.preview)).toBe(true);
      expect(await readdir(root)).toEqual([]);

      // 2. apply creates all versioned artifacts with 0o644 / 0o755
      const applyResult = await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: manifest,
      });
      expect(applyResult.command).toBe("init_apply");
      expect(applyResult.status).toBe("ok");

      // Check .forgix dir is 0o755 and versioned files are 0o644 (masked against umask)
      const forgixDirMode = (await lstat(join(root, ".forgix"))).mode & 0o777;
      expect(forgixDirMode & 0o700).toBe(0o700);
      expect(forgixDirMode & 0o055).not.toBe(0);

      const versionedPaths = [
        ".forgix/config.yaml",
        ".forgix/factory/rules/core-quality.md",
        ".forgix/factory/agents/arch-reviewer.md",
        ".forgix/factory/skills/release-check/SKILL.md",
        ".claude/rules/forgix-core-quality.md",
        ".agents/rules/forgix-core-quality.md",
        ".claude/agents/forgix-arch-reviewer.md",
        ".agents/agents/forgix-arch-reviewer.md",
        ".codex/agents/forgix-arch-reviewer.md",
        ".claude/skills/forgix-release-check/SKILL.md",
        ".agents/skills/forgix-release-check/SKILL.md",
        "AGENTS.md",
        ".agents/hooks.json",
        ".codex/hooks.json",
        ".claude/settings.json",
        ".gitignore",
        ".worktreeinclude",
      ];
      const modes = await Promise.all(
        versionedPaths.map(async (relPath) => (await lstat(join(root, relPath))).mode & 0o777),
      );
      for (const mode of modes) {
        expect(mode & 0o600).toBe(0o600);
        // Group/other readable (0o644 minus umask 0o022 => 0o644)
        expect(mode & 0o044).toBe(0o044);
      }

      // CLAUDE.md is never written
      expect(await pathExists(join(root, "CLAUDE.md"))).toBe(false);

      // Projections keep valid YAML frontmatter on line 1 with ownership marker after closing ---
      const claudeRule = await readFile(join(root, ".claude/rules/forgix-core-quality.md"), "utf8");
      const agyRule = await readFile(join(root, ".agents/rules/forgix-core-quality.md"), "utf8");
      const agentsMd = await readFile(join(root, "AGENTS.md"), "utf8");
      expect(claudeRule.startsWith("---\n")).toBe(true);
      expect(claudeRule).toContain('---\n<!-- forgix:managed kind="rule" id="core-quality"');
      expect(claudeRule).toContain("paths:\n  - src/**");
      expect(agyRule.startsWith("---\n")).toBe(true);
      expect(agyRule).toContain("trigger: glob");
      expect(agentsMd).toContain(".forgix/factory/rules/core-quality.md");
      expect(agentsMd.split("\n").length).toBeLessThan(30);

      // .gitignore includes .forgix/config.local.yaml and extraEntries
      const gitignore = await readFile(join(root, ".gitignore"), "utf8");
      expect(gitignore).toContain(".forgix/config.local.yaml");
      expect(gitignore).toContain(".custom-cache/");

      // 3. Second apply is idempotent (all actions unchanged)
      const secondApply = await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: manifest,
      });
      expect(secondApply.status).toBe("ok");
      const secondActions = (secondApply.data as { actions: InitPlanAction[] }).actions;
      expect(secondActions.every((a) => a.kind === "unchanged")).toBe(true);

      // 4. check reports inSync: true
      const checkResult = await runInitBootstrap("check", { workspaceRoot: root });
      expect(checkResult).toEqual({
        command: "init_check",
        status: "ok",
        data: { inSync: true, findings: [] },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("preserves existing .forgix/config.yaml sections, Entire hooks, and CLAUDE.md -> AGENTS.md symlink", async () => {
    const root = await makeWorkspace();
    try {
      await mkdir(join(root, ".forgix"), { recursive: true });
      await mkdir(join(root, ".agents"), { recursive: true });
      await mkdir(join(root, ".codex"), { recursive: true });

      await writeFile(
        join(root, ".forgix/config.yaml"),
        stringifyYaml({
          schemaVersion: 1,
          harness: "codex",
          merge: "never",
          runner: { mode: "dagger", assureRunner: "dagger" },
          subscription: { plan: "pro_5x" },
          roadmap: { adapter: "github", requirePlanAudit: true },
        }),
      );

      await writeFile(join(root, "AGENTS.md"), "# Existing Agents\n\nKeep this verbatim.\n");
      await symlink("AGENTS.md", join(root, "CLAUDE.md"));

      await writeFile(
        join(root, ".agents/hooks.json"),
        JSON.stringify(
          {
            entire: {
              SessionStart: [
                { type: "command", command: "entire hooks antigravity session-start" },
              ],
            },
          },
          null,
          2,
        ),
      );
      await writeFile(
        join(root, ".codex/hooks.json"),
        JSON.stringify(
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
            },
          },
          null,
          2,
        ),
      );

      const result = await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest({
          configPatch: {
            worktree: { mode: "required" },
          },
          hooks: { enabled: true, enforcement: "strict" },
        }),
      });
      expect(result.status).toBe("ok");

      // Config preserved unrelated sections and applied configPatch + root bootstrap fields
      const mergedConfig = parseYaml(
        await readFile(join(root, ".forgix/config.yaml"), "utf8"),
      ) as Record<string, unknown>;
      expect(mergedConfig.harness).toBe("codex");
      expect(mergedConfig.runner).toEqual({ mode: "dagger", assureRunner: "dagger" });
      expect(mergedConfig.subscription).toEqual({ plan: "pro_5x" });
      expect(mergedConfig.roadmap).toEqual({ adapter: "github", requirePlanAudit: true });
      expect(mergedConfig.worktree).toEqual({ mode: "required" });
      expect(mergedConfig.harnesses).toEqual(["codex", "claude", "antigravity"]);
      expect(mergedConfig.hooks).toEqual({ enforcement: "strict" });
      expect(mergedConfig.bootstrap).toMatchObject({
        rules: true,
        agents: true,
        skills: true,
        hooks: true,
        gitignore: true,
        worktreeInclude: true,
      });
      expect(mergedConfig.factoryPolicies).toEqual({
        protectedSurfaces: ["config/secrets/**"],
        blockedCommands: [{ pattern: "curl\\s+.*\\|\\s*sh", reason: "No pipe-to-shell." }],
        escapeHatchPatterns: [{ kind: "no-debugger", pattern: "\\bdebugger\\b" }],
      });

      // CLAUDE.md symlink preserved untouched
      const claudeStat = await lstat(join(root, "CLAUDE.md"));
      expect(claudeStat.isSymbolicLink()).toBe(true);
      expect(await readlink(join(root, "CLAUDE.md"))).toBe("AGENTS.md");

      // AGENTS.md preserved original content
      const agentsContent = await readFile(join(root, "AGENTS.md"), "utf8");
      expect(agentsContent).toContain("# Existing Agents\n\nKeep this verbatim.\n");
      expect(agentsContent).toContain("<!-- forgix:start -->");

      // Entire hooks coexisted in both files
      const agyHooks = JSON.parse(
        await readFile(join(root, ".agents/hooks.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(agyHooks.entire).toBeDefined();
      expect(agyHooks.forgix).toBeDefined();

      const codexHooks = JSON.parse(await readFile(join(root, ".codex/hooks.json"), "utf8")) as {
        hooks: { SessionStart: unknown[] };
      };
      expect(codexHooks.hooks.SessionStart).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("check respects disabled modules in config.bootstrap and full removal cleans up Forgix artifacts only", async () => {
    const root = await makeWorkspace();
    try {
      await writeFile(join(root, "AGENTS.md"), "# User Agents\n");
      await writeFile(join(root, ".gitignore"), "node_modules/\n");
      await writeFile(join(root, ".worktreeinclude"), "# User worktreeinclude\n.env.custom\n");

      // Apply with worktreeInclude and hooks disabled
      await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest({
          harnesses: ["claude"],
          hooks: { enabled: false },
          worktreeInclude: { enabled: false },
        }),
      });

      // check must report zero drift even though hooks and .worktreeinclude block are absent
      const checkDisabled = await runInitBootstrap("check", { workspaceRoot: root });
      expect(checkDisabled).toEqual({
        command: "init_check",
        status: "ok",
        data: { inSync: true, findings: [] },
      });

      // Now enable everything, then cleanly remove all Forgix artifacts
      await runInitBootstrap("apply", { workspaceRoot: root, input: makeManifest() });
      expect(await pathExists(join(root, ".claude/rules/forgix-core-quality.md"))).toBe(true);
      expect(await pathExists(join(root, ".agents/rules/forgix-core-quality.md"))).toBe(true);
      expect(await pathExists(join(root, ".forgix/factory/rules/core-quality.md"))).toBe(true);
      expect(await pathExists(join(root, ".forgix/factory/agents/arch-reviewer.md"))).toBe(true);
      expect(await pathExists(join(root, ".forgix/factory/skills/release-check/SKILL.md"))).toBe(
        true,
      );

      await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest({
          harnesses: [],
          rules: { enabled: false },
          agents: { enabled: false },
          skills: { enabled: false },
          hooks: { enabled: false },
          gitignore: { enabled: false },
          worktreeInclude: { enabled: false },
        }),
      });

      expect(await pathExists(join(root, ".forgix/factory/rules/core-quality.md"))).toBe(false);
      expect(await pathExists(join(root, ".forgix/factory/agents/arch-reviewer.md"))).toBe(false);
      expect(await pathExists(join(root, ".forgix/factory/skills/release-check/SKILL.md"))).toBe(
        false,
      );
      expect(await pathExists(join(root, ".claude/rules/forgix-core-quality.md"))).toBe(false);
      expect(await pathExists(join(root, ".agents/rules/forgix-core-quality.md"))).toBe(false);
      expect(await pathExists(join(root, ".agents/hooks.json"))).toBe(false);
      expect(await pathExists(join(root, ".codex/hooks.json"))).toBe(false);
      expect(await pathExists(join(root, ".claude/settings.json"))).toBe(false);

      // User content preserved byte-for-byte
      expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe("# User Agents\n");
      expect(await readFile(join(root, ".gitignore"), "utf8")).toBe("node_modules/\n");
      expect(await readFile(join(root, ".worktreeinclude"), "utf8")).toBe(
        "# User worktreeinclude\n.env.custom\n",
      );

      // check still inSync with all modules disabled
      const checkAfterRemoval = await runInitBootstrap("check", { workspaceRoot: root });
      expect(checkAfterRemoval).toEqual({
        command: "init_check",
        status: "ok",
        data: { inSync: true, findings: [] },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("check detects drift when canonical factory, policies, projections, or legacy rules drift", async () => {
    const root = await makeWorkspace();
    try {
      await runInitBootstrap("apply", { workspaceRoot: root, input: makeManifest() });

      // Tamper projection, leave legacy .forgix/rules.md, and corrupt .claude/settings.json
      await writeFile(join(root, ".claude/rules/forgix-core-quality.md"), "manual edit\n");
      await writeFile(join(root, ".forgix/rules.md"), "# Legacy\n");
      await writeFile(join(root, ".claude/settings.json"), "{not json");

      const check = await runInitBootstrap("check", { workspaceRoot: root });
      expect(check.command).toBe("init_check");
      expect(check.status).toBe("drift");
      const data = check.data as { inSync: boolean; findings: InitCheckFinding[] };
      expect(data.inSync).toBe(false);
      expect(data.findings.some((f) => f.code === "legacy_rules_present")).toBe(true);
      expect(data.findings.some((f) => f.code === "factory_projection_drift")).toBe(true);
      expect(data.findings.some((f) => f.path === ".claude/settings.json")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocks unmanaged file collisions and migrates legacy Forgix rules pointers cleanly", async () => {
    const root = await makeWorkspace();
    try {
      await mkdir(join(root, ".claude/rules"), { recursive: true });
      await writeFile(join(root, ".claude/rules/forgix-core-quality.md"), "# Hand-written rule\n");

      const blockedPlan = await runInitBootstrap("plan", {
        workspaceRoot: root,
        input: makeManifest({ harnesses: ["claude"] }),
      });
      expect(blockedPlan.status).toBe("blocked");
      expect(
        (blockedPlan.data as { conflicts: Array<{ code: string }> }).conflicts.some(
          (c) => c.code === "unmanaged_file_collision",
        ),
      ).toBe(true);

      // Remove unmanaged colliding file, plant legacy .forgix/rules.md + valid legacy pointer
      await rm(join(root, ".claude/rules/forgix-core-quality.md"));
      await mkdir(join(root, ".forgix"), { recursive: true });
      await writeFile(join(root, ".forgix/rules.md"), "# Old rules\n");
      await writeFile(
        join(root, ".claude/rules/forgix.md"),
        "# Forgix Workflow Rules\n\n- Read `.forgix/rules.md` and run `$forgix init`.\n",
      );

      const applied = await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest({ harnesses: ["claude"] }),
      });
      expect(applied.status).toBe("ok");
      expect(await pathExists(join(root, ".forgix/rules.md"))).toBe(false);
      expect(await pathExists(join(root, ".claude/rules/forgix.md"))).toBe(false);
      expect(await pathExists(join(root, ".claude/rules/forgix-core-quality.md"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("check detects canonical symlinks, invalid filenames, malformed frontmatter, and policy drift", async () => {
    const root = await makeWorkspace();
    try {
      await runInitBootstrap("apply", { workspaceRoot: root, input: makeManifest() });

      // Invalid filenames, symlinks, malformed frontmatter, and policy drift
      await writeFile(join(root, ".forgix/factory/rules/BAD_NAME.md"), "ignored\n");
      await symlink(
        join(root, ".forgix/factory/rules/core-quality.md"),
        join(root, ".forgix/factory/rules/link-rule.md"),
      );
      await writeFile(join(root, ".forgix/factory/rules/core-quality.md"), "no frontmatter\n");
      await writeFile(join(root, ".forgix/factory/agents/arch-reviewer.md"), "no frontmatter\n");
      await writeFile(
        join(root, ".forgix/factory/skills/release-check/SKILL.md"),
        "no frontmatter\n",
      );
      await writeFile(join(root, ".forgix/factory/skills/BAD_SKILL_FILE"), "not a dir\n");
      await mkdir(join(root, ".forgix/factory/skills/BAD_DIR"), { recursive: true });

      const check = await runInitBootstrap("check", { workspaceRoot: root });
      expect(check.status).toBe("drift");
      const findings = (check.data as { findings: InitCheckFinding[] }).findings;
      const codes = new Set(findings.map((f) => f.code));
      expect(codes.has("factory_invalid_filename")).toBe(true);
      expect(codes.has("symlink_or_non_file")).toBe(true);
      expect(codes.has("factory_canonical_invalid")).toBe(true);
      expect(codes.has("factory_policy_drift")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("blocking conflicts (corrupt JSON, symlink AGENTS.md, duplicate markers) fail with exit 5 before any write", async () => {
    // 1. Corrupt JSON in .codex/hooks.json
    const rootJson = await makeWorkspace();
    try {
      await mkdir(join(rootJson, ".codex"), { recursive: true });
      await writeFile(join(rootJson, ".codex/hooks.json"), "{invalid json");

      const plan = await runInitBootstrap("plan", {
        workspaceRoot: rootJson,
        input: makeManifest(),
      });
      expect(plan.status).toBe("blocked");

      await expectRejected(
        () => runInitBootstrap("apply", { workspaceRoot: rootJson, input: makeManifest() }),
        (error) => error instanceof StateStoreError && error.exitCode === EXIT_CODES.STATE_CONFLICT,
      );

      expect(await pathExists(join(rootJson, ".forgix/config.yaml"))).toBe(false);
      expect(await pathExists(join(rootJson, ".forgix/rules.md"))).toBe(false);
    } finally {
      await rm(rootJson, { recursive: true, force: true });
    }

    // 2. Symlink on AGENTS.md
    const rootSymlink = await makeWorkspace();
    try {
      await writeFile(join(rootSymlink, "REAL_AGENTS.md"), "# Real\n");
      await symlink("REAL_AGENTS.md", join(rootSymlink, "AGENTS.md"));

      const plan = await runInitBootstrap("plan", {
        workspaceRoot: rootSymlink,
        input: makeManifest(),
      });
      expect(plan.status).toBe("blocked");

      await expectRejected(
        () => runInitBootstrap("apply", { workspaceRoot: rootSymlink, input: makeManifest() }),
        (error) => error instanceof StateStoreError && error.exitCode === EXIT_CODES.STATE_CONFLICT,
      );

      expect(await readFile(join(rootSymlink, "REAL_AGENTS.md"), "utf8")).toBe("# Real\n");
      expect(await pathExists(join(rootSymlink, ".forgix/config.yaml"))).toBe(false);
    } finally {
      await rm(rootSymlink, { recursive: true, force: true });
    }

    // 3. Duplicate markers in .gitignore
    const rootMarkers = await makeWorkspace();
    try {
      await writeFile(
        join(rootMarkers, ".gitignore"),
        "# forgix:start\na\n# forgix:end\n# forgix:start\nb\n# forgix:end\n",
      );

      await expectRejected(
        () => runInitBootstrap("apply", { workspaceRoot: rootMarkers, input: makeManifest() }),
        (error) => error instanceof StateStoreError && error.exitCode === EXIT_CODES.STATE_CONFLICT,
      );

      expect(await pathExists(join(rootMarkers, ".forgix/config.yaml"))).toBe(false);
    } finally {
      await rm(rootMarkers, { recursive: true, force: true });
    }
  });

  test("writes .forgix/config.yaml last and performs best-effort rollback on mid-apply I/O failure", async () => {
    const root = await makeWorkspace();
    try {
      const originalGitignore = "node_modules/\n";
      await writeFile(join(root, ".gitignore"), originalGitignore);

      const writeOrder: string[] = [];
      let shouldFailConfig = true;
      const fsPromises = await import("node:fs/promises");

      const failingStore = createWorkspaceStore(root, {
        fileSystem: {
          rename: async (from, to) => {
            writeOrder.push(basename(to));
            if (shouldFailConfig && to.endsWith("/.forgix/config.yaml")) {
              throw Object.assign(new Error("Simulated EACCES"), { code: "EACCES" });
            }
            await fsPromises.rename(from, to);
          },
        },
      });

      await expectRejected(
        () =>
          runInitBootstrap("apply", {
            workspaceRoot: root,
            input: makeManifest(),
            store: failingStore,
          }),
        (error) => error instanceof StateStoreError && error.exitCode === EXIT_CODES.INTERNAL_ERROR,
      );

      // .forgix/config.yaml was attempted last (before rollback writes)
      const configAttemptIndex = writeOrder.indexOf("config.yaml");
      expect(configAttemptIndex).toBeGreaterThan(0);

      // Rollback restored existing .gitignore and removed newly created files
      expect(await readFile(join(root, ".gitignore"), "utf8")).toBe(originalGitignore);
      expect(await pathExists(join(root, ".forgix/factory/rules/core-quality.md"))).toBe(false);
      expect(await pathExists(join(root, ".claude/rules/forgix-core-quality.md"))).toBe(false);
      expect(await pathExists(join(root, ".agents/rules/forgix-core-quality.md"))).toBe(false);
      expect(await pathExists(join(root, ".forgix/config.yaml"))).toBe(false);

      // Re-running apply after transient I/O error converges cleanly
      shouldFailConfig = false;
      const retry = await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest(),
      });
      expect(retry.status).toBe("ok");
      expect(await runInitBootstrap("check", { workspaceRoot: root })).toEqual({
        command: "init_check",
        status: "ok",
        data: { inSync: true, findings: [] },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

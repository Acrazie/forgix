import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { runInvocation } from "../../src/cli.ts";
import { EXIT_CODES, StateStoreError, validateSchema } from "../../src/core/schema.ts";
import { PLUGIN_VERSION } from "../../src/core/version.ts";
import {
  DEFAULT_WORKTREE_INCLUDE_ENTRIES,
  MANDATORY_GITIGNORE_ENTRIES,
  runInitBootstrap,
  runInitSync,
  type InitCheckFinding,
  type InitPlanAction,
} from "../../src/init/index.ts";
import {
  approveProjectProfile,
  prepareProjectProfile,
  renderProjectProfile,
} from "../../src/profile/index.ts";
import { expectRejected } from "../support/expect-error.ts";

const makeWorkspace = () => mkdtemp(join(tmpdir(), "forgix-init-sync-"));

async function makeFakeBundle(dir: string, name = "forgix.mjs"): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, "export {};\n");
  return realpath(path);
}

function makeManifest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    harnesses: ["codex", "claude", "antigravity"],
    rules: {
      enabled: true,
      items: [
        {
          id: "core-quality",
          description: "Run quality checks",
          content: "- Always run checks.\n",
        },
      ],
    },
    agents: { enabled: false },
    skills: { enabled: false },
    hooks: { enabled: true, enforcement: "balanced" },
    gitignore: { enabled: true, extraEntries: [".custom-cache/"] },
    worktreeInclude: {
      enabled: true,
      entries: [".env", ...DEFAULT_WORKTREE_INCLUDE_ENTRIES],
    },
    ...overrides,
  });
}

async function seedProjectProfile(
  root: string,
  decisions?: Array<{ key: string; sourceRef: string; value: string }>,
): Promise<void> {
  const profile = approveProjectProfile(
    prepareProjectProfile({
      schemaVersion: 1,
      profileId: "demo",
      revision: 1,
      content: {
        project: { id: "demo", name: "Demo" },
        ...(decisions
          ? {
              decisions: decisions.map((d) => ({
                key: d.key,
                category: "stack" as const,
                value: "Node 26",
                rationale: "Pinned runtime.",
                provenance: {
                  kind: "repository" as const,
                  sourceRefs: [d.sourceRef],
                  capturedAt: "2026-11-26T00:00:00.000Z",
                },
                sourceFingerprints: [{ sourceRef: d.sourceRef, value: d.value }],
                dependsOn: [],
              })),
            }
          : {}),
      },
    }),
    "2026-11-26T00:00:00.000Z",
  );
  await mkdir(join(root, ".forgix"), { recursive: true });
  await writeFile(join(root, ".forgix", "project.yaml"), renderProjectProfile(profile));
}

describe("forgix init check & init sync", () => {
  test("healthy v4.4.0 repo with bootstrap.agents: false and runner omitted is inSync with 0 sync actions", async () => {
    const root = await makeWorkspace();
    const xdg = await makeWorkspace();
    const bundleDir = await makeWorkspace();
    try {
      const bundle = await makeFakeBundle(bundleDir);
      const env = { HOME: xdg, XDG_CONFIG_HOME: xdg };

      await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest(),
        env,
        entrypointPath: bundle,
      });
      await seedProjectProfile(root);

      const check = await runInvocation(["--harness", "antigravity", "init", "check"], {
        workspaceRoot: root,
        env,
        entrypointPath: bundle,
      });
      expect(check.status).toBe("ok");
      expect(check.data).toMatchObject({
        pluginVersion: PLUGIN_VERSION,
        inSync: true,
        repoInSync: true,
        localInSync: true,
        activeHarness: "antigravity",
        findings: [],
        repoFindings: [],
        localFindings: [],
        projectProfile: { status: "ok" },
      });

      const plan = await runInvocation(["--harness", "antigravity", "init", "sync", "--plan"], {
        workspaceRoot: root,
        env,
        entrypointPath: bundle,
      });
      expect(plan.status).toBe("ok");
      const planData = plan.data as {
        hasChanges: boolean;
        actions: InitPlanAction[];
        conflicts: unknown[];
        localPin: { kind: string };
      };
      expect(planData.hasChanges).toBe(false);
      expect(planData.conflicts).toEqual([]);
      expect(planData.localPin.kind).toBe("unchanged");
      expect(planData.actions.every((a) => a.kind === "unchanged")).toBe(true);
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(xdg, { recursive: true, force: true }),
        rm(bundleDir, { recursive: true, force: true }),
      ]);
    }
  });

  test("stateless check detects missing .worktreeinclude entries, missing bootstrap capability, stale/invalid/missing project.yaml, and separates repo vs local findings for --strict CI", async () => {
    const root = await makeWorkspace();
    const xdg = await makeWorkspace();
    const bundleDir = await makeWorkspace();
    try {
      const bundle = await makeFakeBundle(bundleDir);
      const env = { HOME: xdg, XDG_CONFIG_HOME: xdg };

      await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest(),
        env,
        entrypointPath: bundle,
      });
      await writeFile(join(root, "package.json"), '{"name":"demo"}\n');
      const pkgHash = `sha256:${createHash("sha256").update('{"name":"demo"}\n').digest("hex")}`;
      await seedProjectProfile(root, [
        { key: "runtime", sourceRef: "package.json", value: pkgHash },
      ]);

      // 1. Fresh CI clone (no local CLI pin): repoInSync is true, localInSync is false
      const ciXdg = await makeWorkspace();
      try {
        const ciCheck = await runInvocation(["--harness", "codex", "init", "check", "--strict"], {
          workspaceRoot: root,
          env: { HOME: ciXdg, XDG_CONFIG_HOME: ciXdg },
          entrypointPath: bundle,
        });
        expect(ciCheck.data).toMatchObject({
          repoInSync: true,
          localInSync: false,
          strict: true,
          repoFindings: [],
        });
        const localCodes = (
          ciCheck.data as { localFindings: InitCheckFinding[] }
        ).localFindings.map((f) => f.code);
        expect(localCodes).toContain("cli_pin_stale");
      } finally {
        await rm(ciXdg, { recursive: true, force: true });
      }

      // 2. Introduce repo drift: missing .worktreeinclude default entry, missing bootstrap.worktreeInclude key, stale project.yaml
      await writeFile(join(root, ".worktreeinclude"), "# forgix:start\n.env\n# forgix:end\n");
      const cfg = parseYaml(await readFile(join(root, ".forgix/config.yaml"), "utf8")) as Record<
        string,
        unknown
      >;
      const bootstrap = cfg.bootstrap as Record<string, unknown>;
      delete bootstrap.worktreeInclude;
      await writeFile(join(root, ".forgix/config.yaml"), stringifyYaml(cfg));
      await writeFile(join(root, "package.json"), '{"name":"demo","version":"2.0.0"}\n');

      const drifted = await runInvocation(["--harness", "codex", "init", "check", "--strict"], {
        workspaceRoot: root,
        env,
        entrypointPath: bundle,
      });
      expect(drifted.status).toBe("drift");
      const data = drifted.data as {
        repoInSync: boolean;
        repoFindings: InitCheckFinding[];
        projectProfile: { status: string; staleDecisionKeys?: string[] };
      };
      expect(data.repoInSync).toBe(false);
      const repoCodes = data.repoFindings.map((f) => f.code);
      expect(repoCodes).toContain("worktree_include_entries_missing");
      expect(repoCodes).toContain("bootstrap_capability_missing");
      expect(repoCodes).toContain("project_profile_stale");
      expect(data.projectProfile).toMatchObject({
        status: "stale",
        staleDecisionKeys: ["runtime"],
      });

      // 3. Invalid project.yaml
      await writeFile(join(root, ".forgix/project.yaml"), "schemaVersion: 99\n");
      const invalidProfile = await runInitBootstrap("check", { workspaceRoot: root });
      const invalidCodes = (
        invalidProfile.data as { repoFindings: InitCheckFinding[] }
      ).repoFindings.map((f) => f.code);
      expect(invalidCodes).toContain("project_profile_invalid");
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(xdg, { recursive: true, force: true }),
        rm(bundleDir, { recursive: true, force: true }),
      ]);
    }
  });

  test("uninitialized repo refuses init sync --plan and --apply with config_missing and writes nothing", async () => {
    const root = await makeWorkspace();
    try {
      const plan = await runInitSync("plan", { workspaceRoot: root });
      expect(plan.command).toBe("init_sync_plan");
      expect(plan.status).toBe("blocked");
      const conflicts = (plan.data as { conflicts: Array<{ code: string; message: string }> })
        .conflicts;
      expect(conflicts[0]?.code).toBe("config_missing");
      expect(conflicts[0]?.message).toContain("$forgix init");
      expect(await readdir(root)).toEqual([]);

      await expectRejected(
        () => runInitSync("apply", { workspaceRoot: root }),
        (error) =>
          error instanceof StateStoreError &&
          error.code === "config_missing" &&
          error.exitCode === EXIT_CODES.BLOCKED &&
          error.message.includes("config_missing") &&
          error.message.includes("$forgix init"),
      );
      expect(await readdir(root)).toEqual([]);

      // Symlinked .forgix/config.yaml bails out before creating apply.lock.sqlite
      await mkdir(join(root, ".forgix"), { recursive: true });
      const external = await makeWorkspace();
      try {
        await writeFile(join(external, "config.yaml"), "schemaVersion: 1\n");
        await symlink(join(external, "config.yaml"), join(root, ".forgix/config.yaml"));
        await expectRejected(
          () => runInitSync("apply", { workspaceRoot: root }),
          (error) =>
            error instanceof StateStoreError && error.exitCode === EXIT_CODES.STATE_CONFLICT,
        );
        expect(await readdir(join(root, ".forgix"))).toEqual(["config.yaml"]);
      } finally {
        await rm(external, { recursive: true, force: true });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("init sync --apply reconciles drift idempotently, preserves rules/opt-outs/third-party hooks, isolates active harness CLI pin, and keeps config.yaml schema-compatible", async () => {
    const root = await makeWorkspace();
    const xdg = await makeWorkspace();
    const bundleDir = await makeWorkspace();
    try {
      const oldBundle = await makeFakeBundle(bundleDir, "old-forgix.mjs");
      const newBundle = await makeFakeBundle(bundleDir, "new-forgix.mjs");
      const env = { HOME: xdg, XDG_CONFIG_HOME: xdg };

      await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest(),
        env,
        entrypointPath: oldBundle,
      });
      await seedProjectProfile(root);

      // Write custom third-party Entire hook into .claude/settings.json and stale Forgix hook
      const claudeSettings = JSON.parse(
        await readFile(join(root, ".claude/settings.json"), "utf8"),
      ) as { hooks: Record<string, unknown[]> };
      claudeSettings.hooks.SessionStart = [
        { hooks: [{ type: "command", command: "entire hooks claude session-start" }] },
        { hooks: [{ type: "command", command: "forgix hook claude session-start" }] },
      ];
      await writeFile(join(root, ".claude/settings.json"), JSON.stringify(claudeSettings, null, 2));

      // Remove a mandatory .gitignore entry (keep custom entry), remove default .worktreeinclude entry (keep .env),
      // tamper a projection, and delete bootstrap.worktreeInclude to simulate pre-upgrade config
      await writeFile(
        join(root, ".gitignore"),
        "node_modules/\n\n# forgix:start\n.forgix/init/\n.custom-cache/\n# forgix:end\n",
      );
      await writeFile(join(root, ".worktreeinclude"), "# forgix:start\n.env\n# forgix:end\n");
      await writeFile(
        join(root, ".claude/rules/forgix-core-quality.md"),
        '<!-- forgix:managed kind="rule" id="core-quality" source=".forgix/factory/rules/core-quality.md" -->\n\nstale projection\n',
      );
      const cfg = parseYaml(await readFile(join(root, ".forgix/config.yaml"), "utf8")) as Record<
        string,
        unknown
      >;
      const bootstrap = cfg.bootstrap as Record<string, unknown>;
      delete bootstrap.worktreeInclude;
      await writeFile(join(root, ".forgix/config.yaml"), stringifyYaml(cfg));

      // Record pre-existing codex & claude pins to verify multi-harness isolation
      const codexPinPath = join(xdg, "forgix", "cli-path.codex");
      const claudePinPath = join(xdg, "forgix", "cli-path.claude");
      const agyPinPath = join(xdg, "forgix", "cli-path.antigravity");
      expect((await readFile(codexPinPath, "utf8")).trim()).toBe(oldBundle);
      expect((await readFile(claudePinPath, "utf8")).trim()).toBe(oldBundle);

      // Plan (read-only, no stdin) reports changes and localPin update
      const plan = await runInvocation(["--harness", "antigravity", "init", "sync", "--plan"], {
        workspaceRoot: root,
        env,
        entrypointPath: newBundle,
      });
      expect(plan.status).toBe("ok");
      const planData = plan.data as {
        hasChanges: boolean;
        localPin: { harness: string; kind: string };
      };
      expect(planData.hasChanges).toBe(true);
      expect(planData.localPin).toMatchObject({ harness: "antigravity", kind: "update" });

      // Apply sync from Antigravity
      const apply = await runInvocation(["--harness", "antigravity", "init", "sync", "--apply"], {
        workspaceRoot: root,
        env,
        entrypointPath: newBundle,
      });
      expect(apply.status).toBe("ok");

      // Verify: all 3 repo hooks updated, third-party Entire hook preserved
      const nextClaude = await readFile(join(root, ".claude/settings.json"), "utf8");
      expect(nextClaude).toContain("entire hooks claude session-start");
      expect(nextClaude).not.toContain('"forgix hook claude session-start"');

      // Verify: .gitignore & .worktreeinclude preserve user entries and restore all defaults
      const nextGitignore = await readFile(join(root, ".gitignore"), "utf8");
      expect(nextGitignore).toContain(".custom-cache/");
      for (const entry of MANDATORY_GITIGNORE_ENTRIES) expect(nextGitignore).toContain(entry);

      const nextWt = await readFile(join(root, ".worktreeinclude"), "utf8");
      expect(nextWt).toContain(".env");
      for (const entry of DEFAULT_WORKTREE_INCLUDE_ENTRIES) expect(nextWt).toContain(entry);

      // Verify: .forgix/config.yaml preserves agents: false, has NO pluginVersion key, passes v1 schema
      const nextCfg = parseYaml(
        await readFile(join(root, ".forgix/config.yaml"), "utf8"),
      ) as Record<string, unknown>;
      expect("pluginVersion" in nextCfg).toBe(false);
      expect(validateSchema("config", nextCfg).valid).toBe(true);
      expect((nextCfg.bootstrap as Record<string, unknown>).agents).toBe(false);
      expect((nextCfg.bootstrap as Record<string, unknown>).worktreeInclude).toBe(true);

      // Verify: ONLY cli-path.antigravity updated; codex & claude pins untouched
      expect((await readFile(agyPinPath, "utf8")).trim()).toBe(newBundle);
      expect((await readFile(codexPinPath, "utf8")).trim()).toBe(oldBundle);
      expect((await readFile(claudePinPath, "utf8")).trim()).toBe(oldBundle);

      // Second check returns inSync: true and second plan is a no-op
      const recheck = await runInvocation(["--harness", "antigravity", "init", "check"], {
        workspaceRoot: root,
        env,
        entrypointPath: newBundle,
      });
      expect(recheck.status).toBe("ok");
      expect(recheck.data).toMatchObject({ inSync: true, findings: [] });

      const replan = await runInvocation(["--harness", "antigravity", "init", "sync", "--plan"], {
        workspaceRoot: root,
        env,
        entrypointPath: newBundle,
      });
      expect((replan.data as { hasChanges: boolean }).hasChanges).toBe(false);
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(xdg, { recursive: true, force: true }),
        rm(bundleDir, { recursive: true, force: true }),
      ]);
    }
  });

  test("init sync blocks on unmanaged_file_collision unless --adopt, and always blocks on invalid_json", async () => {
    const root = await makeWorkspace();
    try {
      await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest({ harnesses: ["claude"] }),
      });

      // Replace managed projection with unmanaged content (no forgix:managed marker)
      await writeFile(join(root, ".claude/rules/forgix-core-quality.md"), "# User custom rule\n");

      const blockedPlan = await runInitSync("plan", { workspaceRoot: root });
      expect(blockedPlan.status).toBe("blocked");
      expect(
        (blockedPlan.data as { conflicts: Array<{ code: string }> }).conflicts.map((c) => c.code),
      ).toContain("unmanaged_file_collision");

      await expectRejected(
        () => runInitSync("apply", { workspaceRoot: root }),
        (error) => error instanceof StateStoreError && error.exitCode === EXIT_CODES.STATE_CONFLICT,
      );

      // With --adopt, collision resolves cleanly
      const adopted = await runInitSync("apply", { workspaceRoot: root, adopt: true });
      expect(adopted.status).toBe("ok");

      // Hard safety conflict (invalid JSON) still blocks even with --adopt
      await writeFile(join(root, ".claude/settings.json"), "{broken json");
      await expectRejected(
        () => runInitSync("apply", { workspaceRoot: root, adopt: true }),
        (error) => error instanceof StateStoreError && error.exitCode === EXIT_CODES.STATE_CONFLICT,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("regression: runtime harness takes precedence over config.harness when --harness is omitted", async () => {
    const root = await makeWorkspace();
    const xdg = await makeWorkspace();
    const bundleDir = await makeWorkspace();
    try {
      const oldBundle = await makeFakeBundle(bundleDir, "old.mjs");
      const newBundle = await makeFakeBundle(bundleDir, "new.mjs");
      const baseEnv = { HOME: xdg, XDG_CONFIG_HOME: xdg };

      await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest({ configPatch: { harness: "codex" } }),
        env: baseEnv,
        entrypointPath: oldBundle,
      });
      await seedProjectProfile(root);

      const agyEnv = { ...baseEnv, ANTIGRAVITY_AGENT: "1" };
      const check = await runInvocation(["init", "check"], {
        workspaceRoot: root,
        env: agyEnv,
        entrypointPath: newBundle,
      });
      expect((check.data as { activeHarness: string }).activeHarness).toBe("antigravity");

      const apply = await runInvocation(["init", "sync", "--apply"], {
        workspaceRoot: root,
        env: agyEnv,
        entrypointPath: newBundle,
      });
      expect(apply.status).toBe("ok");
      expect((await readFile(join(xdg, "forgix", "cli-path.antigravity"), "utf8")).trim()).toBe(
        newBundle,
      );
      expect((await readFile(join(xdg, "forgix", "cli-path.codex"), "utf8")).trim()).toBe(
        oldBundle,
      );
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(xdg, { recursive: true, force: true }),
        rm(bundleDir, { recursive: true, force: true }),
      ]);
    }
  });

  test("regression: init check and init sync agree when bootstrap or harnesses is omitted", async () => {
    const root = await makeWorkspace();
    try {
      await mkdir(join(root, ".forgix"), { recursive: true });
      await seedProjectProfile(root);

      // Case A: harnesses set, bootstrap omitted entirely
      await writeFile(join(root, ".forgix/config.yaml"), "schemaVersion: 1\nharnesses: [codex]\n");
      const checkNoBootstrap = await runInitBootstrap("check", { workspaceRoot: root });
      const planNoBootstrap = await runInitSync("plan", { workspaceRoot: root });
      expect((checkNoBootstrap.data as { repoInSync: boolean }).repoInSync).toBe(false);
      expect(
        (checkNoBootstrap.data as { repoFindings: InitCheckFinding[] }).repoFindings.map(
          (f) => f.code,
        ),
      ).toContain("bootstrap_capability_missing");
      expect((planNoBootstrap.data as { hasChanges: boolean }).hasChanges).toBe(true);

      // Case B: bootstrap set, harnesses omitted
      await writeFile(
        join(root, ".forgix/config.yaml"),
        [
          "schemaVersion: 1",
          "harness: codex",
          "bootstrap:",
          "  rules: false",
          "  agents: false",
          "  skills: false",
          "  hooks: false",
          "  gitignore: false",
          "  worktreeInclude: false",
          "",
        ].join("\n"),
      );
      const checkNoHarnesses = await runInitBootstrap("check", { workspaceRoot: root });
      const planNoHarnesses = await runInitSync("plan", { workspaceRoot: root });
      expect((checkNoHarnesses.data as { repoInSync: boolean }).repoInSync).toBe(false);
      expect(
        (checkNoHarnesses.data as { repoFindings: InitCheckFinding[] }).repoFindings.map(
          (f) => f.code,
        ),
      ).toContain("harnesses_missing");
      expect((planNoHarnesses.data as { hasChanges: boolean }).hasChanges).toBe(true);

      const applied = await runInitSync("apply", { workspaceRoot: root });
      expect(applied.status).toBe("ok");
      const afterCheck = await runInitBootstrap("check", { workspaceRoot: root });
      expect((afterCheck.data as { inSync: boolean }).inSync).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("regression: project.yaml digest tampering and symlinked parent directory sourceRef are rejected", async () => {
    const root = await makeWorkspace();
    const external = await makeWorkspace();
    try {
      await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest({
          harnesses: ["codex"],
          rules: { enabled: false },
          hooks: { enabled: false },
        }),
      });

      // 1. Tamper content.project.name without updating contentDigest
      await seedProjectProfile(root);
      const rawProfile = await readFile(join(root, ".forgix/project.yaml"), "utf8");
      await writeFile(
        join(root, ".forgix/project.yaml"),
        rawProfile.replace("name: Demo", "name: Hacked"),
      );
      const tampered = await runInitBootstrap("check", { workspaceRoot: root });
      expect(
        (tampered.data as { repoFindings: InitCheckFinding[] }).repoFindings.map((f) => f.code),
      ).toContain("project_profile_invalid");

      // 2. Symlinked parent directory pointing outside workspace must not be hashed
      await writeFile(join(external, "README.md"), "secret outside workspace\n");
      const externalHash = `sha256:${createHash("sha256")
        .update("secret outside workspace\n")
        .digest("hex")}`;
      await symlink(external, join(root, "evidence"));
      await seedProjectProfile(root, [
        { key: "escape", sourceRef: "evidence/README.md", value: externalHash },
      ]);
      const escaped = await runInitBootstrap("check", { workspaceRoot: root });
      expect(
        (escaped.data as { repoFindings: InitCheckFinding[] }).repoFindings.map((f) => f.code),
      ).toContain("project_profile_stale");
      expect(
        (escaped.data as { projectProfile: { missingSourceRefs?: string[] } }).projectProfile
          .missingSourceRefs,
      ).toContain("evidence/README.md");
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(external, { recursive: true, force: true }),
      ]);
    }
  });

  test("regression: pin write failure or stale FORGIX_CLI_PATH fails loudly, .gitignore preserves negations, legacy rules.md is preserved, and --adopt-path scopes adoption", async () => {
    const root = await makeWorkspace();
    const bundleDir = await makeWorkspace();
    try {
      const oldBundle = await makeFakeBundle(bundleDir, "old.mjs");
      const newBundle = await makeFakeBundle(bundleDir, "new.mjs");

      // 1. Unwritable XDG_CONFIG_HOME (/dev/null) fails init sync --apply instead of reporting ok
      await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest({ harnesses: ["claude", "antigravity"] }),
      });
      await expectRejected(
        () =>
          runInitSync("apply", {
            workspaceRoot: root,
            harness: "claude",
            env: { HOME: "/dev/null", XDG_CONFIG_HOME: "/dev/null" },
            entrypointPath: newBundle,
          }),
        (error) => error instanceof StateStoreError && error.code === "state_write_failed",
      );

      // 2. FORGIX_CLI_PATH override pointing to another bundle fails with state_conflict
      const xdg = await makeWorkspace();
      try {
        await expectRejected(
          () =>
            runInitSync("apply", {
              workspaceRoot: root,
              harness: "claude",
              env: { HOME: xdg, XDG_CONFIG_HOME: xdg, FORGIX_CLI_PATH: oldBundle },
              entrypointPath: newBundle,
            }),
          (error) => error instanceof StateStoreError && error.code === "state_conflict",
        );
      } finally {
        await rm(xdg, { recursive: true, force: true });
      }

      // 3. .gitignore preserves duplicate patterns across negations
      await writeFile(
        join(root, ".gitignore"),
        "# forgix:start\n*.log\n!keep.log\n*.log\n# forgix:end\n",
      );
      await runInitSync("apply", { workspaceRoot: root });
      const gitignore = await readFile(join(root, ".gitignore"), "utf8");
      expect(gitignore).toContain("*.log\n!keep.log\n*.log\n");

      // 4. --adopt-path adopts only the explicitly approved collision path
      await writeFile(join(root, ".claude/rules/forgix-core-quality.md"), "# User claude rule\n");
      await writeFile(join(root, ".agents/rules/forgix-core-quality.md"), "# User agents rule\n");
      const partial = await runInitSync("plan", {
        workspaceRoot: root,
        adoptPaths: [".claude/rules/forgix-core-quality.md"],
      });
      expect(partial.status).toBe("blocked");
      const remainingCollisions = (
        partial.data as { conflicts: Array<{ path: string }> }
      ).conflicts.map((c) => c.path);
      expect(remainingCollisions).toEqual([".agents/rules/forgix-core-quality.md"]);

      // 5. Legacy .forgix/rules.md is NOT scheduled for deletion when .forgix/factory/rules/ is empty
      await rm(join(root, ".forgix/factory/rules"), { recursive: true, force: true });
      await writeFile(join(root, ".forgix/rules.md"), "# Only copy of legacy rules\n");
      const legacyPlan = await runInitSync("plan", { workspaceRoot: root });
      expect(legacyPlan.status).toBe("blocked");
      const legacyActions = (legacyPlan.data as { actions: InitPlanAction[] }).actions;
      expect(legacyActions.some((a) => a.path === ".forgix/rules.md" && a.kind === "remove")).toBe(
        false,
      );
      expect(
        (legacyPlan.data as { conflicts: Array<{ code: string }> }).conflicts.map((c) => c.code),
      ).toContain("legacy_rules_migration_required");
      expect(await readFile(join(root, ".forgix/rules.md"), "utf8")).toBe(
        "# Only copy of legacy rules\n",
      );
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(bundleDir, { recursive: true, force: true }),
      ]);
    }
  });

  test("regression round 2: rules:false preserves legacy .forgix/rules.md, matching FORGIX_CLI_PATH still repairs stale pin file, and ..fixtures sourceRef is allowed", async () => {
    const root = await makeWorkspace();
    const xdg = await makeWorkspace();
    const bundleDir = await makeWorkspace();
    try {
      const oldBundle = await makeFakeBundle(bundleDir, "old.mjs");
      const newBundle = await makeFakeBundle(bundleDir, "new.mjs");
      const baseEnv = { HOME: xdg, XDG_CONFIG_HOME: xdg };

      // 1. bootstrap.rules: false + existing .forgix/rules.md -> leaves .forgix/rules.md untouched
      await runInitBootstrap("apply", {
        workspaceRoot: root,
        input: makeManifest({ harnesses: ["codex"], rules: { enabled: false } }),
        env: baseEnv,
        entrypointPath: oldBundle,
      });
      await writeFile(join(root, ".forgix/rules.md"), "# User-owned legacy rules\n");

      // 2. Valid workspace-relative directory starting with ".." (..fixtures/contract.md)
      await mkdir(join(root, "..fixtures"), { recursive: true });
      await writeFile(join(root, "..fixtures/contract.md"), "# Contract\n");
      const contractHash = `sha256:${createHash("sha256").update("# Contract\n").digest("hex")}`;
      await seedProjectProfile(root, [
        { key: "contract", sourceRef: "..fixtures/contract.md", value: contractHash },
      ]);

      // 3. Stale on-disk cli-path.codex (points to oldBundle) while FORGIX_CLI_PATH matches newBundle
      const envWithMatchingOverride = { ...baseEnv, FORGIX_CLI_PATH: newBundle };
      const checkBefore = await runInvocation(["--harness", "codex", "init", "check"], {
        workspaceRoot: root,
        env: envWithMatchingOverride,
        entrypointPath: newBundle,
      });
      expect((checkBefore.data as { repoInSync: boolean }).repoInSync).toBe(true);
      expect((checkBefore.data as { localInSync: boolean }).localInSync).toBe(false);
      expect(
        (checkBefore.data as { projectProfile: { status: string } }).projectProfile.status,
      ).toBe("ok");

      const plan = await runInvocation(["--harness", "codex", "init", "sync", "--plan"], {
        workspaceRoot: root,
        env: envWithMatchingOverride,
        entrypointPath: newBundle,
      });
      expect(plan.status).toBe("ok");
      const planData = plan.data as {
        hasChanges: boolean;
        actions: InitPlanAction[];
        localPin: { kind: string };
      };
      expect(planData.hasChanges).toBe(true);
      expect(planData.localPin.kind).toBe("update");
      expect(
        planData.actions.some((a) => a.path === ".forgix/rules.md" && a.kind === "remove"),
      ).toBe(false);

      const applied = await runInvocation(["--harness", "codex", "init", "sync", "--apply"], {
        workspaceRoot: root,
        env: envWithMatchingOverride,
        entrypointPath: newBundle,
      });
      expect(applied.status).toBe("ok");
      expect((applied.data as { localPin: { kind: string } }).localPin.kind).toBe("updated");
      expect((await readFile(join(xdg, "forgix", "cli-path.codex"), "utf8")).trim()).toBe(
        newBundle,
      );
      expect(await readFile(join(root, ".forgix/rules.md"), "utf8")).toBe(
        "# User-owned legacy rules\n",
      );

      // Re-check WITHOUT FORGIX_CLI_PATH now passes cleanly
      const checkAfter = await runInvocation(["--harness", "codex", "init", "check"], {
        workspaceRoot: root,
        env: baseEnv,
        entrypointPath: newBundle,
      });
      expect(checkAfter.status).toBe("ok");
      expect((checkAfter.data as { inSync: boolean }).inSync).toBe(true);
    } finally {
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(xdg, { recursive: true, force: true }),
        rm(bundleDir, { recursive: true, force: true }),
      ]);
    }
  });
});

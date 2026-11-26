import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";

const defaultTarball = fileURLToPath(new URL("../../.artifacts/forgix.tgz", import.meta.url));
const tarball = resolve(process.env.FORGIX_TARBALL ?? defaultTarball);
const sandbox = mkdtempSync(join(tmpdir(), "forgix-runtime-"));
const packageRoot = join(sandbox, "package");
const bundle = join(packageRoot, "dist", "forgix.mjs");

before(() => {
  assert.ok(existsSync(tarball), `packed runtime artifact missing: ${tarball}`);
  const listing = spawnSync("tar", ["-tzf", tarball], { encoding: "utf8", shell: false });
  assert.equal(listing.status, 0, listing.stderr);
  const entries = listing.stdout.trim().split("\n");
  assert.equal(new Set(entries).size, entries.length, "packed archive must not duplicate files");
  const extracted = spawnSync("tar", ["-xzf", tarball, "-C", sandbox], {
    encoding: "utf8",
    shell: false,
  });
  assert.equal(extracted.status, 0, extracted.stderr);
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

test("packed npm artifact contains runtime-only files for Node 26", () => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  assert.equal(manifest.name, "@acrasie/forgix");
  assert.deepEqual(manifest.bin, {
    forgix: "dist/forgix.mjs",
  });
  assert.equal(manifest.engines.node, ">=26.0.0");
  assert.ok(existsSync(join(packageRoot, "skills", "forgix", "SKILL.md")));
  assert.equal(existsSync(join(packageRoot, "skills", "dev-flow")), false);
  assert.equal(existsSync(join(packageRoot, "dist", "dev-flow.mjs")), false);
  assert.equal(existsSync(join(packageRoot, "dist", "codex-dev-flow.mjs")), false);
  assert.ok(existsSync(join(packageRoot, ".codex-plugin", "plugin.json")));
  assert.ok(existsSync(join(packageRoot, "schemas", "init-bootstrap.schema.json")));
  assert.ok(
    existsSync(
      join(packageRoot, "docs", "adr", "0037-agent-first-plugin-and-harness-bootstrap.md"),
    ),
  );
  assert.ok(existsSync(bundle));
  assert.equal(
    readFileSync(bundle, "utf8").includes("@clack/prompts"),
    false,
    "packed CLI bundle must not include @clack/prompts",
  );
  for (const excluded of ["src", "test", "scripts", "node_modules", ".github", ".buildkite"]) {
    assert.equal(existsSync(join(packageRoot, excluded)), false, `${excluded} must stay unpacked`);
  }
});

test("packed plugin icons and overview resolve without the source repository", () => {
  const codex = JSON.parse(readFileSync(join(packageRoot, ".codex-plugin/plugin.json"), "utf8"));
  const antigravity = JSON.parse(readFileSync(join(packageRoot, "plugin.json"), "utf8"));
  for (const path of [
    codex.interface.logo,
    codex.interface.logoDark,
    codex.interface.composerIcon,
    antigravity.logo,
  ]) {
    assert.equal(typeof path, "string");
    assert.equal(isAbsolute(path) || /^[a-z]+:/i.test(path), false);
    const target = realpathSync(resolve(packageRoot, path));
    const withinRoot = relative(realpathSync(packageRoot), target);
    assert.ok(withinRoot !== ".." && !withinRoot.startsWith(`..${sep}`) && !isAbsolute(withinRoot));
    assert.equal(withinRoot.split(sep).join("/"), "assets/logo.svg");
    assert.match(readFileSync(target, "utf8"), /<svg\b/);
  }
  const overview = readFileSync(join(packageRoot, "README.md"), "utf8");
  assert.ok(
    overview.includes(
      'src="https://raw.githubusercontent.com/Acrazie/forgix/0180c348feed2ac1156938353c6fd8d343db0731/docs/assets/forgix-readme-banner.png"',
    ),
  );
  assert.equal(existsSync(join(packageRoot, "docs/assets/forgix-readme-banner.png")), false);
  for (const target of ["docs/getting-started.md", "docs/lifecycle-contract.md"]) {
    assert.ok(existsSync(join(packageRoot, target)));
    assert.ok(overview.includes(target));
  }
});

test("packed documentation links and resources resolve without repository files", () => {
  const documents = [join(packageRoot, "README.md")];
  for (const entry of readdirSync(join(packageRoot, "docs"), {
    recursive: true,
    withFileTypes: true,
  })) {
    if (entry.isFile() && entry.name.endsWith(".md"))
      documents.push(join(entry.parentPath, entry.name));
  }
  for (const document of documents) {
    for (const match of readFileSync(document, "utf8").matchAll(
      /!?\[[^\]]*\]\(([^)]+)\)|\b(?:href|src)="([^"]+)"/g,
    )) {
      const target = (match[1] ?? match[2]).split("#")[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      assert.ok(existsSync(resolve(dirname(document), target)), `${document}: ${target}`);
    }
  }
  for (const excluded of [
    ".agents",
    ".claude-plugin/marketplace.json",
    "docs/forgix",
    "docs/repository-guide.md",
    ".git",
    ".env",
    ".dagger",
  ]) {
    assert.equal(existsSync(join(packageRoot, excluded)), false, `${excluded} must not ship`);
  }
});

test("packed bundle imports under Node", async () => {
  const module = await import(pathToFileURL(bundle).href);
  assert.equal(typeof module.main, "function");
});

test("packed CLI exposes help and validates configuration", () => {
  const workspace = join(sandbox, "workspace");
  const home = join(sandbox, "home");
  mkdirSync(workspace, { recursive: true });
  mkdirSync(home, { recursive: true });

  const helpStart = performance.now();
  const help = runNodeCli(bundle, ["--help"], { cwd: workspace, home });
  observeTiming("Cold CLI start", performance.now() - helpStart);
  assert.match(help.stdout, /Usage: forgix/);

  const absentValidate = runNodeCli(bundle, ["config", "validate", "--json"], {
    cwd: workspace,
    home,
  });
  const absentResult = JSON.parse(absentValidate.stdout);
  assert.equal(absentResult.command, "config_validate");
  assert.equal(absentResult.status, "valid");

  mkdirSync(join(workspace, ".forgix"), { recursive: true });
  writeFileSync(join(workspace, ".forgix", "config.yaml"), "harness: antigravity\n");
  const presentValidate = runNodeCli(bundle, ["config", "validate", "--json"], {
    cwd: workspace,
    home,
  });
  const presentResult = JSON.parse(presentValidate.stdout);
  assert.equal(presentResult.command, "config_validate");
  assert.equal(presentResult.status, "valid");

  const bareInit = spawnSync(process.execPath, [bundle, "init"], {
    cwd: workspace,
    env: { ...process.env, HOME: home },
    encoding: "utf8",
    shell: false,
  });
  assert.equal(bareInit.status, 2);
  assert.match(bareInit.stderr, /\$forgix init/);
  assert.match(bareInit.stderr, /\/forgix:forgix init/);
  assert.match(bareInit.stderr, /\/forgix init/);

  const hookResult = spawnSync(process.execPath, [bundle, "hook", "codex", "session-start"], {
    cwd: workspace,
    env: { ...process.env, HOME: home },
    input: "{}",
    encoding: "utf8",
    shell: false,
  });
  assert.equal(hookResult.status, 0, hookResult.stderr);
  const hookPayload = JSON.parse(hookResult.stdout);
  assert.equal("command" in hookPayload, false, "hook output must bypass CLI JSON envelope");
});

test("managed BUILD preflight compares the installed bundle and rejects missing pins or stale registrations", () => {
  const workspace = mkdtempSync(join(sandbox, "build-installation-"));
  const isolatedHome = join(workspace, ".isolated-home");
  const isolatedXdg = join(isolatedHome, ".config");
  mkdirSync(isolatedXdg, { recursive: true });
  const pin = join(workspace, "installed bundle.mjs");
  symlinkSync(bundle, pin);
  const baseEnv = {
    ...process.env,
    HOME: isolatedHome,
    XDG_CONFIG_HOME: isolatedXdg,
    PATH: `${dirname(process.execPath)}:${process.env.PATH}`,
  };
  delete baseEnv.FORGIX_CLI_PATH;
  const env = { ...baseEnv, FORGIX_CLI_PATH: pin };
  const run = (args, input, overrides) =>
    spawnSync(process.execPath, [bundle, ...args], {
      cwd: workspace,
      env: { ...baseEnv, ...overrides },
      encoding: "utf8",
      input,
    });
  const git = spawnSync("git", ["init"], { cwd: workspace, encoding: "utf8" });
  assert.equal(git.status, 0, git.stderr ?? git.error?.message);
  const harnesses = ["codex", "claude", "antigravity"];
  const apply = run(
    ["init", "apply"],
    JSON.stringify({
      schemaVersion: 1,
      harnesses,
      rules: { enabled: false },
      hooks: { enabled: true },
      gitignore: { enabled: false },
      worktreeInclude: { enabled: false },
    }),
  );
  assert.equal(apply.status, 0, apply.stderr);
  assert.equal(JSON.parse(apply.stdout).status, "ok");

  for (const [harness, path] of [
    ["codex", ".codex/hooks.json"],
    ["claude", ".claude/settings.json"],
    ["antigravity", ".agents/hooks.json"],
  ]) {
    const preflight = run(["init", "check-build", harness]);
    assert.equal(preflight.status, 0, preflight.stderr);
    const ready = JSON.parse(preflight.stdout);
    assert.equal(ready.status, "native_verification_required");
    const expected = {
      harness,
      workspaceRoot: realpathSync(workspace),
      bundle: {
        path: realpathSync(bundle),
        sha256: createHash("sha256").update(readFileSync(bundle)).digest("hex"),
        buildAuthorizationReceiptVersion: 2,
      },
    };
    assert.deepEqual(
      {
        harness: ready.data.harness,
        workspaceRoot: ready.data.workspaceRoot,
        bundle: ready.data.bundle,
      },
      expected,
    );

    const config = JSON.parse(readFileSync(join(workspace, path), "utf8"));
    const start = (config.forgix ?? config.hooks).SessionStart[0];
    const launched = spawnSync("/bin/sh", ["-c", (start.hooks?.[0] ?? start).command], {
      cwd: workspace,
      env: baseEnv,
      input: JSON.stringify({ cwd: workspace }),
      encoding: "utf8",
    });
    assert.equal(launched.status, 0, launched.stderr);
    const payload = JSON.parse(launched.stdout);
    const message = payload.systemMessage ?? payload.injectSteps[0].systemMessage.systemMessage;
    const prefix = "Forgix native SessionStart: ";
    const identity = message.split("\n").find((line) => line.startsWith(prefix));
    assert.ok(identity, message);
    assert.deepEqual(JSON.parse(identity.slice(prefix.length)), expected);
  }

  const other = join(workspace, "other.mjs");
  writeFileSync(other, 'process.stdout.write("{}");\n');
  for (const value of ["installed bundle.mjs", join(workspace, "missing.mjs"), other]) {
    const check = run(["init", "check-build", "codex"], undefined, { FORGIX_CLI_PATH: value });
    assert.notEqual(check.status, 0);
    const blocked = JSON.parse(check.stdout);
    assert.equal(blocked.status, "blocked");
    assert.match(blocked.data.findings.join("\n"), /FORGIX_CLI_PATH/);
  }
  const emptyHome = join(workspace, ".empty-home");
  mkdirSync(emptyHome, { recursive: true });
  const unpinned = run(["init", "check-build", "codex"], undefined, {
    HOME: emptyHome,
    XDG_CONFIG_HOME: join(emptyHome, ".config"),
    FORGIX_CLI_PATH: "",
  });
  assert.notEqual(unpinned.status, 0);
  assert.match(JSON.parse(unpinned.stdout).data.findings.join("\n"), /FORGIX_CLI_PATH/);
  const wrapper = join(workspace, "wrapper.mjs");
  writeFileSync(
    wrapper,
    `import { main } from ${JSON.stringify(pathToFileURL(bundle).href)}; main();\n`,
  );
  const delegated = spawnSync(process.execPath, [wrapper, "init", "check-build", "codex"], {
    cwd: workspace,
    env: { ...env, FORGIX_CLI_PATH: wrapper },
    encoding: "utf8",
  });
  assert.notEqual(delegated.status, 0);
  assert.match(JSON.parse(delegated.stdout).data.findings.join("\n"), /FORGIX_CLI_PATH/);

  const codexPath = join(workspace, ".codex/hooks.json");
  const config = JSON.parse(readFileSync(codexPath, "utf8"));
  config.hooks.PreToolUse.push({
    matcher: "*",
    hooks: [{ type: "command", command: "forgix hook codex pre-tool-use" }],
  });
  config.hooks.PostToolUse[0].matcher = "not-all-tools";
  writeFileSync(codexPath, JSON.stringify(config));
  const stale = run(["init", "check-build", "codex"]);
  assert.notEqual(stale.status, 0);
  const blocked = JSON.parse(stale.stdout);
  assert.equal(blocked.status, "blocked");
  assert.match(blocked.data.findings.join("\n"), /codex:PreToolUse/);
  assert.match(blocked.data.findings.join("\n"), /codex:PostToolUse/);
});

test("packed CLI validates, saves, views, and checks status for a V6 task under Node", () => {
  const workspace = join(sandbox, "task-workspace");
  const home = join(sandbox, "home");
  mkdirSync(workspace, { recursive: true });
  mkdirSync(home, { recursive: true });

  const dimensions = ["objective", "users_value", "scope", "success", "risks_constraints"];
  const taskState = {
    schemaVersion: 6,
    taskId: "smoke-task",
    status: "new",
    revision: 0,
    risk: "low",
    design: {
      schemaVersion: 1,
      graph: {
        schemaVersion: 1,
        nodes: dimensions.map((key) => ({
          id: `product:${key}`,
          kind: "product",
          dependsOn: [],
        })),
      },
      productBaseline: {
        schemaVersion: 1,
        dimensions: dimensions.map((key) => ({
          key,
          status: "resolved",
          value: `baseline-${key}`,
          provenance: { sourceRefs: ["request"], freshnessRefs: ["request:v1"] },
          dependencyNodeId: `product:${key}`,
        })),
      },
      glossaryDeltas: [],
      domainRules: [],
    },
    configSnapshot: { schemaVersion: 1 },
    policySnapshot: {
      schemaVersion: 1,
      requirements: {},
      prohibitions: {},
      bounds: {},
      locks: [],
    },
    issues: [],
    history: [
      {
        sequence: 1,
        at: "2026-08-01T00:00:00.000Z",
        type: "task.created",
        refs: [{ kind: "task", ref: "smoke-task" }],
      },
    ],
  };

  const validated = spawnSync(process.execPath, [bundle, "task", "validate"], {
    cwd: workspace,
    env: { ...process.env, HOME: home },
    input: JSON.stringify(taskState),
    encoding: "utf8",
    shell: false,
  });
  assert.equal(validated.status, 0, validated.stderr);
  assert.equal(JSON.parse(validated.stdout).status, "valid");

  const saved = spawnSync(process.execPath, [bundle, "task", "save", "smoke-task"], {
    cwd: workspace,
    env: { ...process.env, HOME: home },
    input: JSON.stringify(taskState),
    encoding: "utf8",
    shell: false,
  });
  assert.equal(saved.status, 0, saved.stderr);
  assert.equal(JSON.parse(saved.stdout).status, "saved");
  assert.ok(existsSync(join(workspace, ".forgix", "tasks", "smoke-task.json")));

  const statusResult = runNodeCli(bundle, ["status", "smoke-task"], { cwd: workspace, home });
  const statusPayload = JSON.parse(statusResult.stdout);
  assert.equal(statusPayload.status, "new");
  assert.equal(statusPayload.data.macroPhase, "INTAKE");
});

test("packed CLI exposes pluginVersion and executes init check --strict and init sync without external deps", () => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  const workspace = mkdtempSync(join(sandbox, "init-sync-smoke-"));
  const isolatedHome = join(workspace, ".isolated-home");
  const isolatedXdg = join(isolatedHome, ".config");
  mkdirSync(isolatedXdg, { recursive: true });
  const env = { ...process.env, HOME: isolatedHome, XDG_CONFIG_HOME: isolatedXdg };
  delete env.FORGIX_CLI_PATH;
  const run = (args, input) =>
    spawnSync(process.execPath, [bundle, ...args], {
      cwd: workspace,
      env,
      encoding: "utf8",
      input,
      shell: false,
    });

  // Bare init sync refuses with exit 2
  const bareSync = run(["init", "sync"]);
  assert.equal(bareSync.status, 2);

  // Uninitialized repo refuses init sync --plan with exit 6 (config_missing)
  const missingPlan = run(["init", "sync", "--plan"]);
  assert.equal(missingPlan.status, 6);
  const missingPayload = JSON.parse(missingPlan.stdout);
  assert.equal(missingPayload.data.pluginVersion, manifest.version);
  assert.equal(missingPayload.data.conflicts[0].code, "config_missing");

  // Bootstrap + publish minimal project.yaml
  const apply = run(
    ["init", "apply"],
    JSON.stringify({
      schemaVersion: 1,
      harnesses: ["codex"],
      rules: { enabled: false },
      hooks: { enabled: true },
      gitignore: { enabled: true },
      worktreeInclude: { enabled: true },
    }),
  );
  assert.equal(apply.status, 0, apply.stderr);
  const pub = run(
    ["project-profile", "publish"],
    JSON.stringify({
      schemaVersion: 1,
      profileId: "smoke-app",
      content: { project: { id: "smoke-app", name: "Smoke App" } },
    }),
  );
  assert.equal(pub.status, 0, pub.stderr);

  // Simulate drift on .worktreeinclude, verify init check --strict exits 6
  writeFileSync(join(workspace, ".worktreeinclude"), "# forgix:start\n.env\n# forgix:end\n");
  const strictDrift = run(["--harness", "codex", "init", "check", "--strict"]);
  assert.equal(strictDrift.status, 6);
  const driftPayload = JSON.parse(strictDrift.stdout);
  assert.equal(driftPayload.data.pluginVersion, manifest.version);
  assert.equal(driftPayload.data.repoInSync, false);

  // Reconcile via init sync --apply (no stdin)
  const synced = run(["--harness", "codex", "init", "sync", "--apply"]);
  assert.equal(synced.status, 0, synced.stderr);
  assert.equal(JSON.parse(synced.stdout).data.pluginVersion, manifest.version);

  // Clean repo passes init check --strict even with fresh empty XDG (CI simulation)
  const ciHome = join(workspace, ".ci-home");
  mkdirSync(ciHome, { recursive: true });
  const ciStrict = spawnSync(
    process.execPath,
    [bundle, "--harness", "codex", "init", "check", "--strict"],
    {
      cwd: workspace,
      env: { ...process.env, HOME: ciHome, XDG_CONFIG_HOME: join(ciHome, ".config") },
      encoding: "utf8",
      shell: false,
    },
  );
  assert.equal(ciStrict.status, 0, ciStrict.stderr);
  const ciPayload = JSON.parse(ciStrict.stdout);
  assert.equal(ciPayload.data.repoInSync, true);
  assert.equal(ciPayload.data.localInSync, false);
});

for (const command of ["forgix"]) {
  test(`packed CLI executes through installed ${command} symlink`, () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
    const binary = join(sandbox, "bin", command);
    mkdirSync(dirname(binary), { recursive: true });
    symlinkSync(join(packageRoot, manifest.bin[command]), binary);
    const result = spawnSync(binary, ["--help"], { encoding: "utf8", shell: false });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: forgix/);
  });
}

function runNodeCli(
  entrypoint,
  args,
  { cwd = dirname(entrypoint), home = join(sandbox, "empty-home") } = {},
) {
  mkdirSync(home, { recursive: true });
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd,
    env: { ...process.env, HOME: home },
    encoding: "utf8",
    shell: false,
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function observeTiming(label, durationMs) {
  const line = `| ${label} (${process.platform}) | ${durationMs.toFixed(1)} ms |`;
  console.log(line);
}

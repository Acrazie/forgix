import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";

const defaultTarball = fileURLToPath(new URL("../../../../.artifacts/forgix.tgz", import.meta.url));
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

test("packed npm artifact contains runtime-only files for Node 24", () => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  assert.equal(manifest.name, "@acrasie/forgix");
  assert.deepEqual(manifest.bin, {
    forgix: "dist/forgix.mjs",
  });
  assert.equal(manifest.engines.node, ">=24.0.0");
  assert.ok(existsSync(join(packageRoot, "skills", "forgix", "SKILL.md")));
  assert.equal(existsSync(join(packageRoot, "skills", "dev-flow")), false);
  assert.equal(existsSync(join(packageRoot, "dist", "dev-flow.mjs")), false);
  assert.equal(existsSync(join(packageRoot, "dist", "codex-dev-flow.mjs")), false);
  assert.ok(existsSync(join(packageRoot, ".codex-plugin", "plugin.json")));
  assert.ok(existsSync(bundle));
  for (const excluded of ["src", "test", "scripts", "node_modules", ".github"]) {
    assert.equal(existsSync(join(packageRoot, excluded)), false, `${excluded} must stay unpacked`);
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

  mkdirSync(join(workspace, ".codex"), { recursive: true });
  writeFileSync(join(workspace, ".codex", "forgix.yaml"), "harness: antigravity\n");
  const presentValidate = runNodeCli(bundle, ["config", "validate", "--json"], {
    cwd: workspace,
    home,
  });
  const presentResult = JSON.parse(presentValidate.stdout);
  assert.equal(presentResult.command, "config_validate");
  assert.equal(presentResult.status, "valid");
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
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  try {
    appendFileSync(
      summary,
      `### Runtime timing\n\n| Observation | Duration |\n| --- | ---: |\n${line}\n`,
    );
  } catch (error) {
    console.warn(`Timing summary unavailable: ${String(error)}`);
  }
}

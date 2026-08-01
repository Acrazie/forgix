import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";

const defaultTarball = fileURLToPath(
  new URL("../../../../.artifacts/codex-dev-flow.tgz", import.meta.url),
);
const tarball = resolve(process.env.DEV_FLOW_TARBALL ?? defaultTarball);
const sandbox = mkdtempSync(join(tmpdir(), "codex-dev-flow-runtime-"));
const packageRoot = join(sandbox, "package");
const bundle = join(packageRoot, "dist", "dev-flow.mjs");

before(() => {
  assert.ok(existsSync(tarball), `packed runtime artifact missing: ${tarball}`);
  const extracted = spawnSync("tar", ["-xzf", tarball, "-C", sandbox], {
    encoding: "utf8",
    shell: false,
  });
  assert.equal(extracted.status, 0, extracted.stderr);
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

test("packed npm artifact contains runtime-only files for Node 24", () => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  assert.equal(manifest.engines.node, ">=24.0.0");
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
  const helpStart = performance.now();
  const help = runNodeCli(bundle, ["--help"]);
  observeTiming("Cold CLI start", performance.now() - helpStart);
  assert.match(help.stdout, /Usage: codex-dev-flow/);

  const validate = runNodeCli(bundle, ["config", "validate", "--json"]);
  const result = JSON.parse(validate.stdout);
  assert.equal(result.command, "config_validate");
  assert.equal(result.status, "valid");
});

test("packed CLI executes through installed binary symlink", () => {
  const binary = join(sandbox, "bin", "codex-dev-flow");
  mkdirSync(dirname(binary), { recursive: true });
  symlinkSync(bundle, binary);
  const result = spawnSync(binary, ["--help"], { encoding: "utf8", shell: false });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: codex-dev-flow/);
});

function runNodeCli(entrypoint, args) {
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: dirname(entrypoint),
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

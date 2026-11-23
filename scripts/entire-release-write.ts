import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  GITHUB,
  INTENTS,
  assertNoUnresolvedVersion,
  git,
  provenanceInvocation,
  readIntent,
  releaseInputs,
} from "./entire-release-intent.ts";
import { mirrorRelease } from "./entire-release-mirror.ts";
import { verifyTagAndManifest } from "./entire-release-source.ts";

function main(): void {
  const cwd = process.cwd();
  const artifactDir = resolve(process.env.RELEASE_HANDOFF ?? "");
  const { intent } = releaseInputs(cwd, artifactDir);
  const base = mkdtempSync(join(tmpdir(), "forgix-release-control-"));
  try {
    const ledger = join(base, "ledger");
    const source = join(base, "source");
    git(
      cwd,
      "clone",
      "--quiet",
      "--single-branch",
      "--branch",
      "npm-release-intents",
      `${GITHUB}.git`,
      ledger,
    );
    const previous = readIntent(ledger, intent);
    if (process.argv[2] === "confirm") {
      const invocation = process.env.VERIFIED_INVOCATION;
      if (!previous || !invocation || provenanceInvocation(previous) !== invocation) {
        throw new Error("Verified provenance does not match the recorded intent.");
      }
      record(ledger, "confirmations", intent.evidence.version, {
        invocation,
        integrity: intent.evidence.integrity,
      });
      return;
    }
    assertNoUnresolvedVersion(ledger, intent.evidence.version);
    if (previous) return; // Reconcile this invocation; never overwrite a receipt.
    if (
      git(cwd, "ls-remote", "--refs", `${GITHUB}.git`, "refs/heads/main") !==
      `${intent.control}\trefs/heads/main`
    ) {
      throw new Error("The approved control commit is no longer current.");
    }
    mkdirSync(source);
    git(source, "init", "--bare", "--quiet");
    const tagRef = `refs/tags/${intent.evidence.tag}`;
    git(
      source,
      "fetch",
      "--quiet",
      "--no-tags",
      resolve(process.env.RELEASE_BUNDLE ?? ""),
      `${tagRef}:${tagRef}`,
    );
    // The reader verified first-parent membership on Entire. Recheck tag and
    // package identity here against the exact object in the transported bundle.
    verifyTagAndManifest(intent.evidence, (args) => git(source, ...args));
    mirrorRelease(intent.evidence, source, `${GITHUB}.git`);
    record(ledger, "intents", intent.evidence.version, intent);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

function record(ledger: string, directory: string, version: string, data: object): void {
  const path = `${directory}/${version}.json`;
  const body = JSON.stringify(data);
  const history = git(ledger, "log", "--format=%H", "HEAD", "--", path);
  if (history) {
    if (/^[0-9a-f]{40}$/.test(history) && git(ledger, "show", `HEAD:${path}`) === body) return;
    throw new Error("Refusing to edit an existing release record.");
  }
  mkdirSync(join(ledger, directory), { recursive: true });
  writeFileSync(join(ledger, path), body + "\n", { flag: "wx" });
  git(ledger, "add", "--", path);
  git(
    ledger,
    "-c",
    "user.name=github-actions[bot]",
    "-c",
    "user.email=41898282+github-actions[bot]@users.noreply.github.com",
    "commit",
    "-m",
    `chore(release): record npm ${directory} for ${version}`,
  );
  git(ledger, "push", "--no-follow-tags", "origin", `HEAD:${INTENTS}`);
  if (
    git(ledger, "ls-remote", "--refs", "origin", INTENTS) !==
    `${git(ledger, "rev-parse", "HEAD")}\t${INTENTS}`
  ) {
    throw new Error("Durable record was not confirmed on GitHub.");
  }
}

try {
  main();
} catch {
  console.error(
    "Failed to verify the mirror or record the durable release intent. No npm call made.",
  );
  process.exitCode = 1;
}

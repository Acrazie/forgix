// Native Node.js only: privileged jobs must not install or execute project dependencies.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareVersions,
  validateVersions,
  releaseIdentity,
  requireCommand,
  ReleaseError,
} from "../plugins/forgix/scripts/release-lib.ts";
import { git, verifyPreparedNotes } from "../plugins/forgix/scripts/release-notes.ts";

const REPOSITORY = "Acrazie/forgix";
const PACKAGE = "@acrasie/forgix";
const REGISTRY = "https://registry.npmjs.org";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
interface Evidence {
  tag: string;
  sha: string;
  target: "both" | "npm" | "plugin";
  version: string;
  pluginVersion: string;
  integrity: string;
  notesSha256: string;
}
interface PackageMetadata {
  name: string;
  version: string;
  dist: { integrity: string; attestations?: { url: string } };
}
interface ProvenanceStatement {
  predicateType: string;
  subject: { name: string; digest: { sha512?: string } }[];
  predicate: {
    buildDefinition?: {
      externalParameters?: { workflow?: { repository?: string; ref?: string; path?: string } };
      resolvedDependencies?: { uri: string; digest: { gitCommit?: string } }[];
    };
  };
}
interface AuditResult {
  invalid: unknown[];
  missing: unknown[];
  verified?: {
    name: string;
    version: string;
    attestationBundles: { predicateType: string; bundle: { dsseEnvelope: { payload: string } } }[];
  }[];
}
export function hash(bytes: Uint8Array | string, algorithm = "sha256"): string {
  return createHash(algorithm).update(bytes).digest("hex");
}
const json = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const command = (program: string, args: readonly string[], cwd = root) =>
  requireCommand(program, args, { cwd }).stdout.trim();
const gh = (path: string): unknown => JSON.parse(command("gh", ["api", path]));
function output(name: string, value: string): void {
  const path = process.env.GITHUB_OUTPUT;
  if (path) writeFileSync(path, `${name}=${value}\n`, { flag: "a" });
}
function tagInput(): string {
  const tag = process.env.RELEASE_TAG ?? "";
  releaseIdentity(tag);
  return tag;
}

export function assertContext(tag: string, sha: string, env: NodeJS.ProcessEnv): void {
  releaseIdentity(tag);
  if (
    env.GITHUB_REPOSITORY !== REPOSITORY ||
    !["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME ?? "") ||
    env.GITHUB_REF !== `refs/tags/${tag}` ||
    env.GITHUB_SHA !== sha ||
    env.GITHUB_WORKFLOW_REF !== `${REPOSITORY}/.github/workflows/release.yml@refs/tags/${tag}`
  ) {
    throw new ReleaseError(
      "Release requires the exact trusted tag workflow context, not a branch or different input tag.",
    );
  }
}

function resolvedTag(tag: string): string {
  return git(root, ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`]);
}
export function assertUniqueNpmTag(tag: string, tags: readonly string[]): void {
  const identity = releaseIdentity(tag);
  if (identity.target === "plugin") return;
  const aliases = new Set([
    `v${identity.version}`,
    `npm-v${identity.version}`,
    `forgix-v${identity.version}`,
  ]);
  if (tags.some((other) => other !== tag && aliases.has(other)))
    throw new ReleaseError("Another tag already owns this npm version.");
}
function resolveSource(): Evidence {
  const tag = tagInput();
  const sha = resolvedTag(tag);
  assertContext(tag, sha, process.env);
  git(root, ["merge-base", "--is-ancestor", sha, "origin/main"]);
  const identity = releaseIdentity(tag);
  assertUniqueNpmTag(tag, git(root, ["tag", "--list"]).split("\n"));
  const pluginVersion = validateVersions(root, tag);
  // The preparation PR is squash-merged: out-of-target version fields must not change.
  const unchanged =
    identity.target === "npm"
      ? [
          "plugins/forgix/.codex-plugin/plugin.json",
          "plugins/forgix/.claude-plugin/plugin.json",
          "plugins/forgix/plugin.json",
          ".claude-plugin/marketplace.json",
        ]
      : identity.target === "plugin"
        ? ["plugins/forgix/package.json"]
        : [];
  for (const path of unchanged) {
    if (git(root, ["show", `${sha}^:${path}`]) !== git(root, ["show", `${sha}:${path}`]))
      throw new ReleaseError("Out-of-target manifest changed in preparation commit.");
  }
  output("sha", sha);
  output("tag", tag);
  output("target", identity.target);
  output("version", identity.version);
  return {
    tag,
    sha,
    target: identity.target,
    version: identity.version,
    pluginVersion,
    integrity: "",
    notesSha256: "",
  };
}

function remoteTag(tag: string): string {
  let object = (
    gh(`repos/${REPOSITORY}/git/ref/tags/${tag}`) as { object: { type: string; sha: string } }
  ).object;
  for (let i = 0; object.type === "tag" && i < 5; i++)
    object = (
      gh(`repos/${REPOSITORY}/git/tags/${object.sha}`) as { object: { type: string; sha: string } }
    ).object;
  if (object.type !== "commit") throw new ReleaseError("Remote tag does not resolve to a commit.");
  return object.sha;
}
function assertPublic(): void {
  const repo = gh(`repos/${REPOSITORY}`) as { private: unknown; full_name: unknown };
  if (repo.private !== false || repo.full_name !== REPOSITORY)
    throw new ReleaseError("Public source repository required for provenance.");
}

export async function registryVersion(
  version: string,
  request: typeof fetch = fetch,
): Promise<PackageMetadata | null> {
  const response = await request(`${REGISTRY}/${encodeURIComponent(PACKAGE)}/${version}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new ReleaseError(`npm metadata request failed: HTTP ${response.status}.`);
  const data = (await response.json()) as PackageMetadata;
  if (data.name !== PACKAGE || data.version !== version || !data.dist?.integrity)
    throw new ReleaseError("Invalid npm metadata.");
  return data;
}

function candidate(directory: string): void {
  const evidence = resolveSource();
  const notes = verifyPreparedNotes(root, evidence.tag);
  mkdirSync(directory, { recursive: true });
  if (evidence.target !== "plugin") {
    const packed = JSON.parse(
      command(
        "npm",
        ["pack", "--ignore-scripts", "--json", "--pack-destination", directory],
        join(root, "plugins/forgix"),
      ),
    ) as { filename: string; files: { path: string }[] }[];
    if (
      packed.length !== 1 ||
      !packed[0]!.files.some((f) => f.path === "dist/forgix.mjs") ||
      packed[0]!.files.some((f) => /^(src|test|scripts|node_modules|\.github)\//.test(f.path))
    )
      throw new ReleaseError("Unexpected npm package contents.");
    renameSync(join(directory, packed[0]!.filename), join(directory, "forgix.tgz"));
    evidence.integrity = `sha512-${createHash("sha512")
      .update(readFileSync(join(directory, "forgix.tgz")))
      .digest("base64")}`;
  }
  evidence.notesSha256 = hash(notes);
  writeFileSync(join(directory, "RELEASE_NOTES.md"), notes);
  writeFileSync(join(directory, "release.json"), JSON.stringify(evidence, null, 2) + "\n");
}

function loadCandidate(directory: string): Evidence {
  const evidence = json(join(directory, "release.json")) as Evidence;
  const expected = resolveSource();
  for (const key of ["tag", "sha", "target", "version", "pluginVersion"] as const)
    if (evidence[key] !== expected[key]) throw new ReleaseError("Candidate identity mismatch.");
  if (evidence.notesSha256 !== hash(readFileSync(join(directory, "RELEASE_NOTES.md"))))
    throw new ReleaseError("Candidate notes digest mismatch.");
  if (evidence.target !== "plugin") {
    const digest = `sha512-${createHash("sha512")
      .update(readFileSync(join(directory, "forgix.tgz")))
      .digest("base64")}`;
    if (evidence.integrity !== digest) throw new ReleaseError("Candidate tarball digest mismatch.");
  }
  if (remoteTag(evidence.tag) !== evidence.sha)
    throw new ReleaseError("Remote tag moved; publication blocked.");
  assertPublic();
  return evidence;
}

export function verifyAudit(result: AuditResult, evidence: Evidence): void {
  if (result.invalid.length || result.missing.length)
    throw new ReleaseError("npm signature verification failed.");
  const verified = result.verified?.find(
    (v) => v.name === PACKAGE && v.version === evidence.version,
  );
  const bundles =
    verified?.attestationBundles.filter(
      (b) => b.predicateType === "https://slsa.dev/provenance/v1",
    ) ?? [];
  const expectedDigest = Buffer.from(evidence.integrity.slice("sha512-".length), "base64").toString(
    "hex",
  );
  const valid = bundles.some(({ bundle }) => {
    const statement = JSON.parse(
      Buffer.from(bundle.dsseEnvelope.payload, "base64").toString("utf8"),
    ) as ProvenanceStatement;
    const definition = statement.predicate.buildDefinition;
    const workflow = definition?.externalParameters?.workflow;
    return (
      statement.predicateType === "https://slsa.dev/provenance/v1" &&
      statement.subject.some((s) => s.digest.sha512 === expectedDigest) &&
      workflow?.repository === `https://github.com/${REPOSITORY}` &&
      workflow.ref === `refs/tags/${evidence.tag}` &&
      workflow.path === ".github/workflows/release.yml" &&
      definition?.resolvedDependencies?.some(
        (d) =>
          d.digest.gitCommit === evidence.sha &&
          d.uri.startsWith(`git+https://github.com/${REPOSITORY}@`),
      )
    );
  });
  if (!valid)
    throw new ReleaseError(
      "Verified npm provenance must match repository, workflow, tag, source SHA and tarball digest.",
    );
}

async function verifyNpm(evidence: Evidence): Promise<void> {
  const metadata = await registryVersion(evidence.version);
  if (!metadata || metadata.dist.integrity !== evidence.integrity || !metadata.dist.attestations)
    throw new ReleaseError("npm publication is missing or has different integrity/provenance.");
  // npm's native verifier checks signatures, certificate trust and transparency log.
  // Install the published package only in an empty sandbox; never execute its scripts.
  const directory = mkdtempSync(join(tmpdir(), "forgix-provenance-"));
  try {
    writeFileSync(
      join(directory, "package.json"),
      '{"name":"forgix-publication-verifier","version":"0.0.0","private":true}',
    );
    command(
      "npm",
      [
        "install",
        `${PACKAGE}@${evidence.version}`,
        "--ignore-scripts",
        "--no-bin-links",
        "--no-audit",
        "--no-fund",
        `--registry=${REGISTRY}`,
      ],
      directory,
    );
    const result = JSON.parse(
      command(
        "npm",
        ["audit", "signatures", "--json", "--include-attestations", `--registry=${REGISTRY}`],
        directory,
      ),
    ) as AuditResult;
    verifyAudit(result, evidence);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function publishNpm(directory: string): Promise<void> {
  const evidence = loadCandidate(directory);
  if (evidence.target === "plugin")
    throw new ReleaseError("Plugin-only releases cannot publish npm.");
  const existing = await registryVersion(evidence.version);
  if (!existing) {
    const response = await fetch(`${REGISTRY}/${encodeURIComponent(PACKAGE)}/latest`);
    if (!response.ok) throw new ReleaseError(`Cannot verify npm latest: HTTP ${response.status}.`);
    const latest = (await response.json()) as { version: string };
    if (compareVersions(evidence.version, latest.version) <= 0)
      throw new ReleaseError("Refusing to regress npm latest.");
    if (remoteTag(evidence.tag) !== evidence.sha)
      throw new ReleaseError("Remote tag changed before npm publication.");
    // A timeout may occur after acceptance. Never blindly retry this command.
    command("npm", [
      "publish",
      join(directory, "forgix.tgz"),
      "--ignore-scripts",
      "--access",
      "public",
      `--registry=${REGISTRY}`,
    ]);
  }
  await verifyNpm(evidence);
}

interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  body: string;
}
function releaseBody(evidence: Evidence, directory: string): string {
  return (
    readFileSync(join(directory, "RELEASE_NOTES.md"), "utf8").trimEnd() +
    `\n\n<!-- forgix-source: ${evidence.sha} -->\n`
  );
}
async function publishGitHub(directory: string): Promise<void> {
  const evidence = loadCandidate(directory);
  if (evidence.target !== "plugin") await verifyNpm(evidence);
  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/releases/tags/${evidence.tag}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN ?? ""}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  const notes = releaseBody(evidence, directory);
  if (response.ok) {
    const release = (await response.json()) as GitHubRelease;
    if (
      release.tag_name !== evidence.tag ||
      release.draft ||
      release.prerelease ||
      release.body.trimEnd() !== notes.trimEnd()
    )
      throw new ReleaseError("Existing GitHub Release has incompatible identity or notes.");
    return;
  }
  if (response.status !== 404)
    throw new ReleaseError(`GitHub release lookup failed: HTTP ${response.status}.`);
  writeFileSync(join(directory, "PUBLISH_NOTES.md"), notes);
  // Never let an older retry or plugin-only release change GitHub's latest pointer.
  // New npm-bearing releases promote only if newer than the current GitHub latest.
  let latest = false;
  if (evidence.target !== "plugin") {
    const latestResponse = await fetch(
      `https://api.github.com/repos/${REPOSITORY}/releases/latest`,
      { headers: { Authorization: `Bearer ${process.env.GH_TOKEN ?? ""}` } },
    );
    if (latestResponse.status === 404) latest = true;
    else if (!latestResponse.ok) throw new ReleaseError("Cannot verify latest GitHub Release.");
    else {
      const previous = (await latestResponse.json()) as GitHubRelease;
      try {
        latest = compareVersions(evidence.version, releaseIdentity(previous.tag_name).version) > 0;
      } catch {
        throw new ReleaseError("Cannot compare latest GitHub Release identity.");
      }
    }
  }
  if (latest) {
    const npmLatest = await fetch(`${REGISTRY}/${encodeURIComponent(PACKAGE)}/latest`);
    if (!npmLatest.ok) throw new ReleaseError("Cannot verify npm latest before GitHub promotion.");
    const current = (await npmLatest.json()) as { version: string };
    latest = current.version === evidence.version;
  }
  if (remoteTag(evidence.tag) !== evidence.sha)
    throw new ReleaseError("Remote tag changed before GitHub publication.");
  command("gh", [
    "release",
    "create",
    evidence.tag,
    "--repo",
    REPOSITORY,
    "--verify-tag",
    "--target",
    evidence.sha,
    "--title",
    `Forgix ${evidence.tag}`,
    "--notes-file",
    join(directory, "PUBLISH_NOTES.md"),
    `--latest=${latest}`,
  ]);
}

async function main(): Promise<void> {
  const directory = resolve(process.argv[3] ?? ".artifacts");
  switch (process.argv[2]) {
    case "source":
      resolveSource();
      break;
    case "candidate":
      candidate(directory);
      break;
    case "npm":
      await publishNpm(directory);
      break;
    case "github":
      await publishGitHub(directory);
      break;
    default:
      throw new ReleaseError(
        "Usage: node scripts/release-ci.ts <source|candidate|npm|github> [artifact-directory]",
      );
  }
}
if (import.meta.main)
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

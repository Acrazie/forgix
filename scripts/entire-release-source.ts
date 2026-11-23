import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertControlContext, REMOTE } from "./entire-release-preflight.ts";

export const PACKAGE = "@acrasie/forgix";
export const MIRROR_REPOSITORY = "git+https://github.com/Acrazie/forgix.git";
const FLOOR = "4.0.0";
const TAG = /^(?:npm-)?v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
const SHA = /^[0-9a-f]{40}$/;
const APPROVAL_PATH = "release/entire-npm.json";

export interface ReleaseSource {
  version: string;
  tag: string;
  tagObject: string;
  commit: string;
}

export function compareVersions(a: string, b: string): number {
  const right = b.split(".");
  for (const [i, part] of a.split(".").entries()) {
    const diff = BigInt(part) - BigInt(right[i] ?? "0");
    if (diff !== 0n) return diff > 0n ? 1 : -1;
  }
  return 0;
}

export function parseReleaseApproval(raw: string): ReleaseSource {
  const value = JSON.parse(raw) as Partial<ReleaseSource> | null;
  if (
    !value ||
    Object.keys(value).toSorted().join(",") !== "commit,tag,tagObject,version" ||
    typeof value.tag !== "string" ||
    typeof value.version !== "string" ||
    TAG.exec(value.tag)?.[1] !== value.version ||
    compareVersions(value.version, FLOOR) <= 0 ||
    typeof value.tagObject !== "string" ||
    typeof value.commit !== "string" ||
    !SHA.test(value.tagObject) ||
    !SHA.test(value.commit) ||
    value.tagObject === value.commit
  ) {
    throw new Error("Invalid GitHub release approval.");
  }
  return {
    tag: value.tag,
    version: value.version,
    tagObject: value.tagObject,
    commit: value.commit,
  };
}

export function assertCanonicalRefs(refs: string, approval: ReleaseSource): void {
  const aliases = [
    `v${approval.version}`,
    `npm-v${approval.version}`,
    `forgix-v${approval.version}`,
  ];
  const tag = `refs/tags/${approval.tag}`;
  const records = refs
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
  if (
    records.some(([, ref]) =>
      aliases.some(
        (alias) =>
          alias !== approval.tag &&
          (ref === `refs/tags/${alias}` || ref === `refs/tags/${alias}^{}`),
      ),
    )
  ) {
    throw new Error("Conflicting canonical tags own the approved npm version.");
  }
  const direct = records.filter(([, ref]) => ref === tag);
  const peeled = records.filter(([, ref]) => ref === `${tag}^{}`);
  if (
    direct.length !== 1 ||
    direct[0]?.[0] !== approval.tagObject ||
    peeled.length !== 1 ||
    peeled[0]?.[0] !== approval.commit
  ) {
    throw new Error("Entire tag is absent or differs from the GitHub approval.");
  }
}

export function readReleaseApproval(cwd: string, sha: string): ReleaseSource | null {
  if (!SHA.test(sha)) throw new Error("Invalid approval commit.");
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    }).trim();
  if (git(["rev-parse", "HEAD"]) !== sha) {
    throw new Error("Approval checkout does not match the GitHub run commit.");
  }
  if (!git(["ls-tree", "--name-only", sha, APPROVAL_PATH])) return null;
  if (
    !/^100644 blob [0-9a-f]{40}\trelease\/entire-npm\.json$/.test(
      git(["ls-tree", sha, APPROVAL_PATH]),
    )
  ) {
    throw new Error("Approval must be a regular file in the GitHub commit.");
  }
  return parseReleaseApproval(git(["show", `${sha}:${APPROVAL_PATH}`]));
}

export function assertExportApproval(annotation: string): void {
  const declarations = annotation
    .split(/\r?\n/)
    .filter((line) => /^\s*mirror-export\s*:/i.test(line));
  if (declarations.length !== 1 || declarations[0] !== "Mirror-Export: approved") {
    throw new Error("Release tag does not contain exactly one canonical export approval.");
  }
}

export function verifyTagAndManifest(
  candidate: ReleaseSource,
  git: (args: string[]) => string,
): void {
  const ref = `refs/tags/${candidate.tag}`;
  if (
    git(["rev-parse", "--verify", ref]) !== candidate.tagObject ||
    git(["cat-file", "-t", ref]) !== "tag" ||
    git(["rev-parse", "--verify", `${ref}^{commit}`]) !== candidate.commit
  ) {
    throw new Error("Canonical tag changed during validation.");
  }
  const tag = git(["cat-file", "tag", ref]);
  if (!tag.startsWith(`object ${candidate.commit}\ntype commit\ntag ${candidate.tag}\n`)) {
    throw new Error("Canonical tag must directly annotate the exact release commit.");
  }
  assertExportApproval(tag.slice(tag.indexOf("\n\n") + 2));
  const manifest = JSON.parse(git(["show", `${candidate.commit}:package.json`]));
  if (
    manifest?.name !== PACKAGE ||
    manifest.version !== candidate.version ||
    manifest.private === true ||
    manifest.repository?.url !== MIRROR_REPOSITORY
  ) {
    throw new Error("Canonical release npm manifest does not match the version and mirror.");
  }
}

export function verifyCandidate(candidate: ReleaseSource, git: (args: string[]) => string): void {
  verifyTagAndManifest(candidate, git);
  if (
    !git(["rev-list", "--first-parent", "refs/remotes/entire/main"])
      .split("\n")
      .includes(candidate.commit) ||
    git(["show", "-s", "--format=%s", candidate.commit]) !== `chore(release): ${candidate.tag}`
  ) {
    throw new Error("Release commit is not the matching first-parent preparation on Entire main.");
  }
}

function inspectCandidate(): ReleaseSource | null {
  const candidate = readReleaseApproval(process.cwd(), process.env.GITHUB_SHA ?? "");
  if (!candidate) {
    if (process.env.GITHUB_EVENT_NAME === "push")
      throw new Error("Missing release approval in GitHub main.");
    return null;
  }
  if (!process.env.ENTIRE_TOKEN) throw new Error("Missing Entire reader identity.");
  const dir = mkdtempSync(join(tmpdir(), "forgix-entire-source-"));
  try {
    const git = (args: string[]) =>
      execFileSync("git", args, {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 90_000,
      }).trim();
    const checkRemote = () => assertCanonicalRefs(git(["ls-remote", "--tags", REMOTE]), candidate);
    checkRemote();
    git(["init", "--bare", "--quiet"]);
    const tag = `refs/tags/${candidate.tag}`;
    git([
      "fetch",
      "--no-tags",
      "--quiet",
      REMOTE,
      "refs/heads/main:refs/remotes/entire/main",
      `${tag}:${tag}`,
    ]);
    verifyCandidate(candidate, git);
    checkRemote();
    const bundle = process.env.RELEASE_BUNDLE;
    if (bundle) {
      const info = JSON.parse(
        execFileSync("entire", ["repo", "view", REMOTE, "--authoritative", "--json"], {
          cwd: dir,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 30_000,
        }),
      );
      if (info?.visibility !== "public")
        throw new Error("Only public Entire sources can be exported.");
      git(["bundle", "create", bundle, tag]);
    }
    return candidate;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assertControlContext(process.env, true);
    const candidate = inspectCandidate();
    if (!process.env.GITHUB_OUTPUT) throw new Error("Missing GitHub output.");
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `candidate=${candidate ? JSON.stringify(candidate) : ""}\n`,
    );
    console.log(
      candidate
        ? "Approved Entire tag and commit verified."
        : "No release approved on this GitHub commit.",
    );
  } catch {
    console.error("Canonical release inspection failed. Nothing was exported or published.");
    process.exitCode = 1;
  }
}

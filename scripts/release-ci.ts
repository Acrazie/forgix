// Native Node.js only: privileged jobs must not install or execute project dependencies.
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateVersions, releaseIdentity, requireCommand, ReleaseError } from "./release-lib.ts";
import { git, verifyPreparedNotes } from "./release-notes.ts";

const BUILDKITE_REPO_PATTERN =
  /^(?:https:\/\/entire\.com|entire:\/\/[^/]+)\/et\/forgix\/forgix(?:\.git)?$/;
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

interface Evidence {
  tag: string;
  sha: string;
  version: string;
  pluginVersion: string;
  integrity: string;
  notesSha256: string;
}

function hash(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const command = (program: string, args: readonly string[], cwd = root) =>
  requireCommand(program, args, { cwd }).stdout.trim();

function tagInput(): string {
  const tag = process.env.RELEASE_TAG || process.env.BUILDKITE_TAG || "";
  releaseIdentity(tag);
  return tag;
}

export function assertContext(
  tag: string,
  sha: string,
  env: NodeJS.ProcessEnv,
  tagObjectSha?: string,
): void {
  releaseIdentity(tag);
  const validCommits = new Set([sha, ...(tagObjectSha ? [tagObjectSha] : [])]);
  if (
    env.BUILDKITE !== "true" ||
    !BUILDKITE_REPO_PATTERN.test(env.BUILDKITE_REPO ?? "") ||
    env.BUILDKITE_TAG !== tag ||
    !validCommits.has(env.BUILDKITE_COMMIT ?? "") ||
    (env.BUILDKITE_PULL_REQUEST && env.BUILDKITE_PULL_REQUEST !== "false")
  ) {
    throw new ReleaseError(
      "Release requires the exact trusted Buildkite tag build context, not a branch, pull request, or mismatched tag.",
    );
  }
}

function resolvedTag(tag: string): string {
  return git(root, ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`]);
}

export function assertUniqueNpmTag(tag: string, tags: readonly string[]): void {
  const { version } = releaseIdentity(tag);
  const aliases = new Set([`v${version}`, `npm-v${version}`, `forgix-v${version}`]);
  if (tags.some((other) => other !== tag && aliases.has(other)))
    throw new ReleaseError("Another tag already owns this npm version.");
}

function resolveSource(): Evidence {
  const tag = tagInput();
  const sha = resolvedTag(tag);
  const tagObjectSha = git(root, ["rev-parse", "--verify", `refs/tags/${tag}`]);
  assertContext(tag, sha, process.env, tagObjectSha);
  git(root, ["merge-base", "--is-ancestor", sha, "origin/main"]);
  const { version } = releaseIdentity(tag);
  assertUniqueNpmTag(tag, git(root, ["tag", "--list"]).split("\n"));
  const pluginVersion = validateVersions(root, tag);
  return {
    tag,
    sha,
    version,
    pluginVersion,
    integrity: "",
    notesSha256: "",
  };
}

function candidate(directory: string): void {
  const evidence = resolveSource();
  const notes = verifyPreparedNotes(root, evidence.tag);
  mkdirSync(directory, { recursive: true });
  const packed = JSON.parse(
    command(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", directory],
      join(root, "."),
    ),
  ) as { filename: string; files: { path: string }[] }[];
  if (
    packed.length !== 1 ||
    !packed[0]!.files.some((f) => f.path === "dist/forgix.mjs") ||
    packed[0]!.files.some((f) =>
      /^(src|test|scripts|node_modules|\.buildkite|\.dagger)\//.test(f.path),
    )
  )
    throw new ReleaseError("Unexpected npm package contents.");
  renameSync(join(directory, packed[0]!.filename), join(directory, "forgix.tgz"));
  evidence.integrity = `sha512-${createHash("sha512")
    .update(readFileSync(join(directory, "forgix.tgz")))
    .digest("base64")}`;
  evidence.notesSha256 = hash(notes);
  writeFileSync(join(directory, "RELEASE_NOTES.md"), notes);
  writeFileSync(join(directory, "release.json"), JSON.stringify(evidence, null, 2) + "\n");
}

function main(): void {
  const directory = resolve(process.argv[3] ?? ".artifacts");
  switch (process.argv[2]) {
    case "source":
      resolveSource();
      break;
    case "candidate":
      candidate(directory);
      break;
    default:
      throw new ReleaseError(
        "Usage: node scripts/release-ci.ts <source|candidate> [artifact-directory]",
      );
  }
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

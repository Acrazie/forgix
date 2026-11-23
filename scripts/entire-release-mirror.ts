import { execFileSync } from "node:child_process";
import type { ReleaseSource } from "./entire-release-source.ts";

const OID = /^[0-9a-f]{40}$/;
const RELEASE_TAG = /^(?:npm-)?v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

// Called only after the control plane verifies export approval, source visibility,
// live ref protections and Buildkite evidence. The destination is supplied by
// trusted control code, never by the candidate or a workflow input.
export function mirrorRelease(
  source: ReleaseSource,
  sourceDir: string,
  destination: string,
): string {
  if (
    !RELEASE_TAG.test(source.tag) ||
    source.tag.replace(/^(?:npm-)?v/, "") !== source.version ||
    !OID.test(source.tagObject) ||
    !OID.test(source.commit) ||
    source.tagObject === source.commit
  ) {
    throw new Error("Invalid release source for mirroring.");
  }
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd: sourceDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 90_000,
    }).trim();
  const canonical = `refs/tags/${source.tag}`;
  if (
    git(["rev-parse", "--verify", canonical]) !== source.tagObject ||
    git(["cat-file", "-t", source.tagObject]) !== "tag" ||
    git(["rev-parse", "--verify", `${source.tagObject}^{commit}`]) !== source.commit
  ) {
    throw new Error("Local canonical tag object does not match the verified release.");
  }

  const ref = `refs/tags/entire-source/${source.tag}`;
  const remoteValue = () => git(["ls-remote", "--refs", "--", destination, ref]);
  const expected = `${source.commit}\t${ref}`;
  const current = remoteValue();
  if (current === expected) return ref;
  if (current) throw new Error("Existing mirror ref points to a different object.");
  // Push one lightweight ref; never push the annotated source tag, other refs,
  // or use force. A concurrent conflicting tag is rejected by the receiving Git.
  git(["push", "--no-follow-tags", "--", destination, `${source.commit}:${ref}`]);
  if (remoteValue() !== expected) throw new Error("Mirror ref not verified after push.");
  return ref;
}

import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mirrorRelease } from "../scripts/entire-release-mirror.ts";

const tag = "npm-v4.0.1";
const git = (repo: string, args: string[]) =>
  execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

test("exports one exact immutable ref into a disposable mirror and rejects divergence", () => {
  const root = mkdtempSync(join(tmpdir(), "forgix-mirror-test-"));
  const source = join(root, "source");
  const destination = join(root, "destination");
  const commit = (message: string) => {
    git(source, ["-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", message]);
    return git(source, ["rev-parse", "HEAD"]);
  };
  try {
    git(root, ["init", "-b", "main", source]);
    git(root, ["init", "--bare", "-b", "main", destination]);
    git(source, ["config", "user.name", "Mirror test"]);
    git(source, ["config", "user.email", "mirror@example.invalid"]);
    const main = commit("Existing control commit");
    git(source, ["push", destination, "HEAD:refs/heads/main"]);
    const release = commit("chore(release): npm-v4.0.1");
    git(source, ["-c", "tag.gpgsign=false", "tag", "-a", tag, "-m", "Mirror-Export: approved"]);
    git(source, ["tag", "partially-private-fixture", main]);
    const identity = {
      tag,
      version: "4.0.1",
      tagObject: git(source, ["rev-parse", `refs/tags/${tag}`]),
      commit: release,
    };
    const ref = `refs/tags/entire-source/${tag}`;
    expect(() => mirrorRelease({ ...identity, commit: main }, source, destination)).toThrow(
      /does not match/,
    );
    expect(mirrorRelease(identity, source, destination)).toBe(ref);
    expect(mirrorRelease(identity, source, destination)).toBe(ref);
    expect(
      git(destination, ["for-each-ref", "--format=%(refname) %(objectname)"]).split("\n"),
    ).toEqual([`refs/heads/main ${main}`, `${ref} ${release}`]);

    const divergent = join(root, "divergent");
    git(root, ["init", "--bare", divergent]);
    git(source, ["push", divergent, `${main}:${ref}`]);
    expect(() => mirrorRelease(identity, source, divergent)).toThrow(/different object/);
    expect(git(divergent, ["rev-parse", ref])).toBe(main);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertExportApproval,
  MIRROR_REPOSITORY,
  PACKAGE,
  assertCanonicalRefs,
  parseReleaseApproval,
  readReleaseApproval,
  verifyCandidate,
} from "../scripts/entire-release-source.ts";

const object = "a".repeat(40);
const commit = "b".repeat(40);
const tag = "npm-v4.0.2";
const candidate = { tag, version: "4.0.2", tagObject: object, commit };
const refLines = (name: string) =>
  `${object}\trefs/tags/${name}\n${commit}\trefs/tags/${name}^{}\n`;

test("reads approval from the exact GitHub commit, never its working copy", () => {
  const cwd = mkdtempSync(join(tmpdir(), "forgix-approval-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const snapshot = () => {
    git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "Approval fixture");
    return git("rev-parse", "HEAD");
  };
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Approval fixture");
    git("config", "user.email", "approval@example.invalid");
    const empty = snapshot();
    expect(readReleaseApproval(cwd, empty)).toBeNull();
    const path = join(cwd, "release", "entire-npm.json");
    mkdirSync(join(cwd, "release"));
    writeFileSync(path, JSON.stringify(candidate));
    git("add", "release/entire-npm.json");
    const approved = snapshot();
    writeFileSync(path, "{}");
    expect(readReleaseApproval(cwd, approved)).toEqual(candidate);
    expect(() => readReleaseApproval(cwd, empty)).toThrow(/does not match/);
    rmSync(path);
    symlinkSync("../other.json", path);
    git("add", "release/entire-npm.json");
    const indirect = snapshot();
    expect(() => readReleaseApproval(cwd, indirect)).toThrow(/regular file/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("requires explicit approval for one stable npm tag and exact object and commit", () => {
  expect(parseReleaseApproval(JSON.stringify(candidate))).toEqual(candidate);
  for (const invalid of [
    { ...candidate, tag: "v4.0.0", version: "4.0.0" },
    { ...candidate, tag: "plugin-v4.0.2" },
    { ...candidate, tag: "v4.0.3" },
    { ...candidate, tagObject: commit },
    { ...candidate, commit: "not-an-oid" },
    { ...candidate, repository: "other" },
  ]) {
    expect(() => parseReleaseApproval(JSON.stringify(invalid))).toThrow(/approval/);
  }
});

test("matches only the PR-approved tag and refuses moved, missing or aliased tags", () => {
  const refs = refLines("v4.0.1") + refLines(tag) + refLines("v4.0.10");
  expect(() => assertCanonicalRefs(refs, candidate)).not.toThrow();
  for (const invalid of [
    refLines("v4.0.1"),
    refLines(tag).replace(object, "c".repeat(40)),
    refLines(tag).replace(commit, "d".repeat(40)),
    refLines(tag) + refLines(tag),
  ]) {
    expect(() => assertCanonicalRefs(invalid, candidate)).toThrow(/differs/);
  }
  for (const alias of ["v4.0.2", "forgix-v4.0.2"]) {
    expect(() => assertCanonicalRefs(refLines(tag) + refLines(alias), candidate)).toThrow(
      /Conflicting/,
    );
  }
});

test("requires exactly one literal export authorization", () => {
  expect(() => assertExportApproval("Release note\n\nMirror-Export: approved\n")).not.toThrow();
  for (const text of [
    "Mirror-Export: refused",
    "mirror-export: approved",
    "Mirror-Export: approved\nMirror-Export: refused",
    "Mirror-Export: approved\nMirror-Export: approved",
  ]) {
    expect(() => assertExportApproval(text)).toThrow(/approval/);
  }
});

test("binds the annotated object to a first-parent release and the packed manifest identity", () => {
  const ref = `refs/tags/${tag}`;
  const replies: Record<string, string> = {
    [`rev-parse --verify ${ref}`]: object,
    [`rev-parse --verify ${ref}^{commit}`]: commit,
    [`cat-file -t ${ref}`]: "tag",
    [`cat-file tag ${ref}`]: `object ${commit}\ntype commit\ntag ${tag}\ntagger Fixture\n\nMirror-Export: approved`,
    "rev-list --first-parent refs/remotes/entire/main": commit,
    [`show -s --format=%s ${commit}`]: `chore(release): ${tag}`,
    [`show ${commit}:package.json`]: JSON.stringify({
      name: PACKAGE,
      version: candidate.version,
      repository: { url: MIRROR_REPOSITORY },
    }),
  };
  const verify = (overrides: Record<string, string>) =>
    verifyCandidate(candidate, (args) => ({ ...replies, ...overrides })[args.join(" ")] ?? "");
  expect(() => verify({})).not.toThrow();
  expect(() => verify({ [`rev-parse --verify ${ref}`]: "c".repeat(40) })).toThrow(/changed/);
  expect(() => verify({ "rev-list --first-parent refs/remotes/entire/main": "" })).toThrow(
    /first-parent/,
  );
  expect(() => verify({ [`show ${commit}:package.json`]: "{}" })).toThrow(/manifest/);
});

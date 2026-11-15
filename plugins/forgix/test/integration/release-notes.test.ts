import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import { requireCommand, releaseIdentity } from "../../scripts/release-lib.ts";
import {
  changelogSection,
  git,
  notesMetadata,
  previousTag,
  renderNotes,
  verifyPreparedNotes,
} from "../../scripts/release-notes.ts";

function history() {
  const root = mkdtempSync(join(tmpdir(), "forgix-release-history-"));
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.name", "Release test"]);
  git(root, ["config", "user.email", "release@example.invalid"]);
  cpSync(new URL("../../../../cliff.toml", import.meta.url), join(root, "cliff.toml"));
  let count = 0;
  const commit = (message: string) => {
    writeFileSync(join(root, "source"), String(++count));
    git(root, ["add", "."]);
    git(root, ["-c", "commit.gpgsign=false", "commit", "-m", message]);
  };
  return { root, commit, close: () => rmSync(root, { recursive: true, force: true }) };
}

describe("release tag contracts", () => {
  test("recognizes three stable identities and rejects malformed cachebusters and injection", () => {
    expect(releaseIdentity("v2.0.0")).toEqual({ target: "both", version: "2.0.0" });
    expect(releaseIdentity("npm-v2.0.0").target).toBe("npm");
    expect(releaseIdentity("plugin-v1.0.1-codex.20261115120000").pluginVersion).toBe(
      "1.0.1+codex.20261115120000",
    );
    for (const tag of [
      "v02.0.0",
      "v2.0.0-beta",
      "npm-v2.0.0-codex.20261115120000",
      "plugin-v1.0.0",
      "plugin-v1.0.0-codex.20260230120000",
      "plugin-v1.0.0-codex.20261301120000",
      "--help",
      "v1.0.0; echo unsafe",
      "forgix-v1.0.1",
    ])
      expect(() => releaseIdentity(tag)).toThrow();
  });
  test("selects ancestry, not lexical version or tag dates, and separates planes", () => {
    const h = history();
    try {
      h.commit("feat: initial");
      git(h.root, ["tag", "v1.0.0"]);
      h.commit("feat: npm update");
      git(h.root, ["tag", "npm-v2.0.0"]);
      h.commit("fix: plugin update");
      git(h.root, ["tag", "plugin-v1.0.0-codex.20261115120000"]);
      expect(previousTag(h.root, "npm")).toBe("npm-v2.0.0");
      expect(previousTag(h.root, "plugin")).toBe("plugin-v1.0.0-codex.20261115120000");
      expect(notesMetadata(h.root, "v3.0.0", "2026-11-15")).toMatchObject({
        npmBase: "npm-v2.0.0",
        pluginBase: "plugin-v1.0.0-codex.20261115120000",
      });
      git(h.root, ["tag", "npm-v1.0.0"]);
      git(h.root, ["tag", "v9.0.0"]);
      expect(() => previousTag(h.root, "npm")).toThrow(/Conflicting/);
    } finally {
      h.close();
    }
  });
  test("prefers combined alias on same commit and handles absence of predecessor", () => {
    const h = history();
    try {
      h.commit("feat: initial");
      expect(previousTag(h.root, "npm")).toBeNull();
      git(h.root, ["tag", "npm-v1.0.0"]);
      git(h.root, ["tag", "v1.0.0"]);
      expect(previousTag(h.root, "npm")).toBe("v1.0.0");
    } finally {
      h.close();
    }
  });
});

describe("pinned git-cliff notes", () => {
  test("keeps breaking changes, excludes pure release commit, and reproduces tagged section", () => {
    const h = history();
    try {
      h.commit("feat: initial");
      git(h.root, ["tag", "v1.0.0"]);
      h.commit("fix!: require new runtime");
      h.commit("chore(release): breaking metadata\n\nBREAKING CHANGE: must remain visible");
      const metadata = notesMetadata(h.root, "v2.0.0", "2026-11-15");
      const notes = renderNotes(h.root, metadata);
      expect(notes).toContain("**BREAKING:**");
      expect(notes).toContain("breaking metadata");
      expect(notes).not.toContain("initial");
      const changelog = "# Changelog\n\n" + notes + "\n## [1.0.0] - old\n\nHistorical bytes.\n";
      const path = join(h.root, "plugins/forgix");
      requireCommand("mkdir", ["-p", path]);
      writeFileSync(join(path, "CHANGELOG.md"), changelog);
      h.commit("chore(release): v2.0.0");
      git(h.root, ["tag", "v2.0.0"]);
      expect(verifyPreparedNotes(h.root, "v2.0.0")).toBe(notes);
      expect(changelogSection(changelog, "v2.0.0").notes).toBe(notes);
      expect(readFileSync(join(path, "CHANGELOG.md"), "utf8")).toEndWith("Historical bytes.\n");
      writeFileSync(
        join(path, "CHANGELOG.md"),
        changelog.replace("new runtime", "different runtime"),
      );
      expect(() => verifyPreparedNotes(h.root, "v2.0.0")).toThrow(/differs/);
      expect(() => changelogSection(changelog + "\n" + notes, "v2.0.0")).toThrow(/one prepared/);
    } finally {
      h.close();
    }
  });
  test("splits combined notes only when the two predecessor ranges differ", () => {
    const h = history();
    try {
      h.commit("feat: original");
      git(h.root, ["tag", "v1.0.0"]);
      h.commit("fix: npm only");
      git(h.root, ["tag", "npm-v1.0.1"]);
      h.commit("feat: following change");
      const notes = renderNotes(h.root, notesMetadata(h.root, "v2.0.0", "2026-11-15"));
      expect(notes).toContain("### npm (since npm-v1.0.1)");
      expect(notes).toContain("### Plugins (since v1.0.0)");
      expect(notes.match(/npm only/g)).toHaveLength(1);
    } finally {
      h.close();
    }
  });
  test("retired local publication option exits without modifying the worktree", () => {
    const script = resolve(import.meta.dir, "../../scripts/release.ts");
    const before = git(resolve(import.meta.dir, "../../../.."), ["status", "--porcelain=v1"]);
    const result = Bun.spawnSync(["bun", script, "--publish-existing", "forgix-v1.0.1"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Local publication has been retired");
    expect(git(resolve(import.meta.dir, "../../../.."), ["status", "--porcelain=v1"])).toBe(before);
  });
});

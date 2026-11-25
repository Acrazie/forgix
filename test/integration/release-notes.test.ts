import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { releaseIdentity } from "../../scripts/release-lib.ts";
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
  cpSync(new URL("../../cliff.toml", import.meta.url), join(root, "cliff.toml"));
  let count = 0;
  const commit = (message: string) => {
    writeFileSync(join(root, "source"), String(++count));
    git(root, ["add", "."]);
    git(root, ["-c", "commit.gpgsign=false", "commit", "-m", message]);
  };
  return { root, commit, close: () => rmSync(root, { recursive: true, force: true }) };
}

describe("release tag contracts", () => {
  test("recognizes only unified vX.Y.Z tags and rejects legacy or malformed tags", () => {
    expect(releaseIdentity("v2.0.0")).toEqual({ version: "2.0.0" });
    for (const tag of [
      "v02.0.0",
      "v2.0.0-beta",
      "npm-v2.0.0",
      "plugin-v1.0.0-codex.20261115120000",
      "--help",
      "v1.0.0; echo unsafe",
      "forgix-v1.0.1",
    ])
      expect(() => releaseIdentity(tag)).toThrow();
  });

  test("selects nearest first-parent v* ancestor and rejects conflicting tags on one commit", () => {
    const h = history();
    try {
      h.commit("feat: initial");
      expect(previousTag(h.root)).toBeNull();
      git(h.root, ["tag", "v1.0.0"]);
      h.commit("fix: legacy ignored");
      git(h.root, ["tag", "npm-v1.0.1"]);
      expect(previousTag(h.root)).toBe("v1.0.0");
      expect(notesMetadata(h.root, "v2.0.0", "2026-11-15")).toEqual({
        tag: "v2.0.0",
        date: "2026-11-15",
        base: "v1.0.0",
      });
      git(h.root, ["tag", "v1.1.0"]);
      git(h.root, ["tag", "v9.0.0"]);
      expect(() => previousTag(h.root)).toThrow(/Conflicting/);
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
      expect(notes).toContain("### Changes (since v1.0.0)");
      expect(notes).toContain("**BREAKING:**");
      expect(notes).toContain("breaking metadata");
      expect(notes).not.toContain("initial");
      const changelog = "# Changelog\n\n" + notes + "\n## [1.0.0] - old\n\nHistorical bytes.\n";
      writeFileSync(join(h.root, "CHANGELOG.md"), changelog);
      h.commit("chore(release): v2.0.0");
      git(h.root, ["tag", "v2.0.0"]);
      expect(verifyPreparedNotes(h.root, "v2.0.0")).toBe(notes);
      expect(changelogSection(changelog, "v2.0.0").notes).toBe(notes);
      expect(readFileSync(join(h.root, "CHANGELOG.md"), "utf8")).toEndWith("Historical bytes.\n");
      writeFileSync(
        join(h.root, "CHANGELOG.md"),
        changelog.replace("new runtime", "different runtime"),
      );
      expect(() => verifyPreparedNotes(h.root, "v2.0.0")).toThrow(/differs/);
      expect(() => changelogSection(changelog + "\n" + notes, "v2.0.0")).toThrow(/one prepared/);
    } finally {
      h.close();
    }
  });
});

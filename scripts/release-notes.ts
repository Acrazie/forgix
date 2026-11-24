import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { requireCommand, ReleaseError, releaseIdentity } from "./release-lib.ts";

const GIT_CLIFF_VERSION = "2.14.1";
export function git(root: string, args: readonly string[]): string {
  return requireCommand("git", args, { cwd: root }).stdout.trimEnd();
}

// The migration inventory contains only v1.0.0 and v1.0.1; no historical aliases
// are needed. Keep the three target namespaces distinct when selecting predecessors.
function tagPlane(tag: string, plane: "npm" | "plugin"): string | null {
  try {
    const identity = releaseIdentity(tag);
    if (identity.target === "both" || identity.target === plane) return identity.version;
  } catch {
    /* Historical release tags do not satisfy the new trigger contract. */
  }
  return null;
}

export function previousTag(
  root: string,
  plane: "npm" | "plugin",
  head = "HEAD",
  exclude?: string,
): string | null {
  const commits = git(root, ["rev-list", "--first-parent", head]).split("\n");
  const refs = git(root, ["tag", "--merged", head]).split("\n").filter(Boolean);
  const byCommit = new Map<string, string[]>();
  for (const tag of refs) {
    if (tag === exclude || !tagPlane(tag, plane)) continue;
    const commit = git(root, ["rev-parse", `refs/tags/${tag}^{commit}`]);
    byCommit.set(commit, [...(byCommit.get(commit) ?? []), tag]);
  }
  for (const commit of commits) {
    const tags = byCommit.get(commit);
    if (!tags?.length) continue;
    if (new Set(tags.map((tag) => tagPlane(tag, plane))).size !== 1)
      throw new ReleaseError("Conflicting release tags on one commit.");
    return tags.toSorted(
      (a, b) => Number(b.startsWith("v")) - Number(a.startsWith("v")) || a.localeCompare(b),
    )[0]!;
  }
  return null;
}

export interface NotesMetadata {
  tag: string;
  date: string;
  npmBase: string | null;
  pluginBase: string | null;
}
export function notesMetadata(
  root: string,
  tag: string,
  date: string,
  head = "HEAD",
): NotesMetadata {
  const { target } = releaseIdentity(tag);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new ReleaseError("Invalid release date.");
  return {
    tag,
    date,
    npmBase: target === "plugin" ? null : previousTag(root, "npm", head, tag),
    pluginBase: target === "npm" ? null : previousTag(root, "plugin", head, tag),
  };
}

export function renderNotes(root: string, metadata: NotesMetadata, head = "HEAD"): string {
  const actualVersion = requireCommand("git-cliff", ["--version"], { cwd: root }).stdout.trimEnd();
  if (actualVersion !== `git-cliff ${GIT_CLIFF_VERSION}`)
    throw new ReleaseError(`Require git-cliff ${GIT_CLIFF_VERSION}; found ${actualVersion}.`);
  const { target } = releaseIdentity(metadata.tag);
  const planes: [string, string | null][] =
    target === "npm"
      ? [["npm", metadata.npmBase]]
      : target === "plugin"
        ? [["Plugins", metadata.pluginBase]]
        : metadata.npmBase === metadata.pluginBase
          ? [["npm + plugins", metadata.npmBase]]
          : [
              ["npm", metadata.npmBase],
              ["Plugins", metadata.pluginBase],
            ];
  const sections = planes.map(([plane, base]) => {
    const range = base
      ? `${git(root, ["rev-parse", `refs/tags/${base}^{commit}`])}..${head}`
      : head;
    const body = requireCommand(
      "git-cliff",
      ["--config", resolve(root, "cliff.toml"), "--strip", "all", range],
      { cwd: root },
    ).stdout.trimEnd();
    return `### ${plane} (since ${base ?? "start of history"})\n\n${body || "No user-facing changes."}`;
  });
  return `## [${metadata.tag}] - ${metadata.date}\n\n<!-- forgix-release: ${JSON.stringify(metadata)} -->\n\n${sections.join("\n\n")}\n`;
}

export function changelogSection(
  changelog: string,
  tag: string,
): { metadata: NotesMetadata; notes: string } {
  releaseIdentity(tag);
  const sections = changelog.split(/(?=^## \[)/m).filter((s) => s.startsWith(`## [${tag}] - `));
  if (sections.length !== 1)
    throw new ReleaseError("Expected one prepared changelog section for release tag.");
  const notes = sections[0]!.trimEnd() + "\n";
  const marker = /<!-- forgix-release: (.+) -->/.exec(notes);
  if (!marker) throw new ReleaseError("Prepared release metadata missing.");
  const metadata = JSON.parse(marker[1]!) as NotesMetadata;
  if (metadata.tag !== tag) throw new ReleaseError("Changelog release identity differs.");
  return { metadata, notes };
}

export function verifyPreparedNotes(root: string, tag: string): string {
  const source = readFileSync(resolve(root, "CHANGELOG.md"), "utf8");
  const { metadata, notes } = changelogSection(source, tag);
  const expected = notesMetadata(root, tag, metadata.date);
  if (
    JSON.stringify(expected) !== JSON.stringify(metadata) ||
    renderNotes(root, expected) !== notes
  )
    throw new ReleaseError(
      "Prepared changelog differs from tagged history. Refresh preparation through a PR.",
    );
  return notes;
}

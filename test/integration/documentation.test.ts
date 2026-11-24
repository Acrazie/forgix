import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

const repositoryReadmePath = fileURLToPath(new URL("../../README.md", import.meta.url));
const pluginReadmePath = fileURLToPath(new URL("../../README.md", import.meta.url));
const gettingStartedPath = fileURLToPath(new URL("../../docs/getting-started.md", import.meta.url));

const read = (path: string) => readFileSync(path, "utf8");

const installationJourneyMarkers = [
  "codex plugin marketplace add Acrazie/forgix",
  "codex plugin add forgix@acrazie",
  "/plugin marketplace add Acrazie/forgix",
  "/plugin install forgix@acrazie",
  "agy plugin install",
  "$forgix init",
  "/forgix:forgix",
  "/forgix",
  "$forgix Add rate limiting to the public authentication endpoints",
  "INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓",
  "Project INIT",
  "bare `forgix init`",
  ".forgix/project.yaml",
  ".forgix/config.yaml",
  ".forgix/factory/{rules,agents,skills}",
  ".forgix/project.local.yaml",
  ".forgix/init/state.yaml",
];

function relativeLinks(markdown: string): string[] {
  const targets: string[] = [];
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1]?.split("#", 1).at(0);
    if (target && !/^[a-z]+:/i.test(target)) targets.push(target);
  }
  for (const match of markdown.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const target = match[1]?.split("#", 1).at(0);
    if (target && !/^[a-z]+:/i.test(target)) targets.push(target);
  }
  return targets;
}

describe("public documentation", () => {
  test("current installation documentation describes the rename without old CLI aliases", () => {
    expect(read(repositoryReadmePath)).not.toMatch(/dev-flow/i);
    for (const path of [repositoryReadmePath, pluginReadmePath, gettingStartedPath]) {
      const documentation = read(path);
      if (path === gettingStartedPath) {
        expect(documentation).toContain(
          "Neither `dev-flow` nor `codex-dev-flow` is shipped as a CLI alias.",
        );
      }
      expect(documentation).not.toContain("npm rejects the unscoped");
      expect(documentation).not.toContain("remains an alias of the same executable");
    }
    const runbook = read(
      fileURLToPath(new URL("../../docs/runbooks/maintainer-release.md", import.meta.url)),
    );
    expect(runbook).toContain("npmjs `@acrasie/forgix` remains canonical");
    expect(runbook).not.toContain("unscoped `forgix` publication was rejected");
    expect(runbook).toContain("No package is renamed.");
    expect(runbook).toContain(
      "GitHub Actions is the intended npm publisher via Trusted Publishing.",
    );
  });
  test("root README and installation guide preserve the complete installation journey", () => {
    const documentation = [read(gettingStartedPath)];
    for (const marker of installationJourneyMarkers) {
      for (const entry of documentation) expect(entry).toContain(marker);
    }
    for (const readme of [...documentation, read(pluginReadmePath)]) {
      expect(readme).not.toMatch(
        /accepted next target|implementation pending|not yet implemented/i,
      );
    }
  });

  test("plugin overview stays concise and supports all three installed hosts", () => {
    const overview = read(pluginReadmePath);
    expect(overview).toContain(
      '<img alt="Forgix" src="https://raw.githubusercontent.com/Acrazie/forgix/0180c348feed2ac1156938353c6fd8d343db0731/docs/assets/forgix-readme-banner.png"',
    );
    expect(overview).toContain('alt="npm version"');
    expect(overview).toContain('alt="License: MIT"');
    expect(overview).toContain('alt="Node.js >= 26"');
    expect(overview.split(/\s+/).length).toBeLessThan(600);
    for (const prefix of ["$forgix", "/forgix:forgix", "/forgix"]) {
      expect(overview).toContain(`${prefix} init`);
    }
    expect(overview).toContain("$forgix Add rate limiting to the public authentication endpoints");
    expect(overview).toContain("use `/forgix:forgix` in Claude Code or `/forgix` in Antigravity");
    for (const marker of [
      "Node.js 26 or newer",
      "Git",
      "Linux or macOS",
      "Windows is unsupported",
      "explicit GATE approval",
      "fresh verification evidence",
      "Approval does not authorize commit, push, pull request, registry publication, or release.",
      "docs/getting-started.md",
      "docs/lifecycle-contract.md",
      "https://github.com/Acrazie/forgix/blob/main/docs/repository-guide.md",
    ])
      expect(overview).toContain(marker);
    expect(overview).not.toMatch(/dev-flow/);
  });

  test("retained repository guide installs Antigravity into its discovered plugin directory", () => {
    const guide = read(fileURLToPath(new URL("../../docs/repository-guide.md", import.meta.url)));
    const antigravity = guide.split("### Antigravity\n")[1]?.split("### Standalone CLI")[0];
    expect(antigravity).toContain("`./forgix/` into `~/.gemini/config/plugins/forgix/`");
    expect(antigravity).not.toContain("`~/.gemini/config/`");
  });

  test("entry-point documentation has no broken relative Markdown or HTML links", () => {
    for (const path of [repositoryReadmePath, pluginReadmePath, gettingStartedPath]) {
      for (const target of relativeLinks(read(path))) {
        expect(existsSync(resolve(dirname(path), target)), `${path} -> ${target}`).toBe(true);
      }
    }
  });
});

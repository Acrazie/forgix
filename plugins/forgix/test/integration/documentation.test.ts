import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

const repositoryReadmePath = fileURLToPath(new URL("../../../../README.md", import.meta.url));
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
  "npx @acrasie/forgix init",
  "INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓",
  "Project INIT",
  "Configuration wizard",
  ".codex/forgix.project.yaml",
  ".codex/forgix.project.local.yaml",
  ".codex/project-init/state.yaml",
];

function relativeLinks(markdown: string): string[] {
  const targets: string[] = [];
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
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
    expect(runbook).toContain("public `@acrasie/forgix` package on npmjs");
    expect(runbook).not.toContain("unscoped `forgix` publication was rejected");
    expect(runbook).toContain("no former CLI alias is retained");
  });
  test("root README and installation guide preserve the complete installation journey", () => {
    const documentation = [read(repositoryReadmePath), read(gettingStartedPath)];
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
    expect(overview).toContain("![Forgix](assets/logo.svg)");
    expect(overview.split(/\s+/).length).toBeLessThan(600);
    for (const prefix of ["$forgix", "/forgix:forgix", "/forgix"]) {
      expect(overview).toContain(`${prefix} init`);
      expect(overview).toContain(
        `${prefix} Add rate limiting to the public authentication endpoints`,
      );
    }
    for (const marker of [
      "Node.js 24 or newer",
      "Git",
      "Linux or macOS",
      "Windows is unsupported",
      "explicit GATE approval",
      "fresh verification evidence",
      "Commit, push, pull request, registry publication, and release",
      "docs/getting-started.md",
      "docs/lifecycle-contract.md",
      "https://github.com/Acrazie/forgix#readme",
    ])
      expect(overview).toContain(marker);
    expect(overview).not.toMatch(/plugin (?:install|add)|marketplace add|dev-flow/);
  });

  test("entry-point documentation has no broken relative links", () => {
    for (const path of [repositoryReadmePath, pluginReadmePath, gettingStartedPath]) {
      for (const target of relativeLinks(read(path))) {
        expect(existsSync(resolve(dirname(path), target)), `${path} -> ${target}`).toBe(true);
      }
    }
  });
});

test("website branding uses Forgix and preserves its scaffold boundary", () => {
  const siteRoot = new URL("../../../../site/", import.meta.url);
  const manifest = JSON.parse(read(fileURLToPath(new URL("package.json", siteRoot))));
  const page = read(fileURLToPath(new URL("src/pages/index.astro", siteRoot)));
  const config = read(fileURLToPath(new URL("astro.config.mjs", siteRoot)));
  expect(manifest.name).toBe("forgix-site");
  expect(page).toContain('<h1 class="text-4xl font-semibold">Forgix</h1>');
  expect(page).toContain("<title>Forgix — local build scaffold</title>");
  expect(page).toContain('name="robots" content="noindex"');
  expect(config).toContain('site: "https://forgix.acrazie.dev"');
});

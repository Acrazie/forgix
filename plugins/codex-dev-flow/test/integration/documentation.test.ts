import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

const repositoryReadmePath = fileURLToPath(new URL("../../../../README.md", import.meta.url));
const pluginReadmePath = fileURLToPath(new URL("../../README.md", import.meta.url));
const gettingStartedPath = fileURLToPath(new URL("../../docs/getting-started.md", import.meta.url));

const read = (path: string) => readFileSync(path, "utf8");

const sharedJourneyMarkers = [
  "Turn a software objective into an approved, implemented, and verified change.",
  "codex plugin marketplace add Acrazie/codex-dev-flow",
  "codex plugin add dev-flow@acrazie",
  "$dev-flow init",
  "$dev-flow Add rate limiting to the public authentication endpoints",
  "npx @acrasie/dev-flow init",
  "INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓",
  "Project INIT",
  "Configuration wizard",
  ".codex/dev-flow.project.yaml",
  ".codex/dev-flow.project.local.yaml",
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
  test("root and packaged README share the current user journey", () => {
    const readmes = [read(repositoryReadmePath), read(pluginReadmePath)];
    for (const marker of sharedJourneyMarkers) {
      for (const readme of readmes) expect(readme).toContain(marker);
    }
    for (const readme of readmes) {
      expect(readme).not.toMatch(
        /accepted next target|implementation pending|not yet implemented/i,
      );
    }
  });

  test("entry-point documentation has no broken relative links", () => {
    for (const path of [repositoryReadmePath, pluginReadmePath, gettingStartedPath]) {
      for (const target of relativeLinks(read(path))) {
        expect(existsSync(resolve(dirname(path), target)), `${path} -> ${target}`).toBe(true);
      }
    }
  });
});

test("website branding uses Dev Flow and preserves its scaffold boundary", () => {
  const siteRoot = new URL("../../../../site/", import.meta.url);
  const manifest = JSON.parse(read(fileURLToPath(new URL("package.json", siteRoot))));
  const page = read(fileURLToPath(new URL("src/pages/index.astro", siteRoot)));
  const config = read(fileURLToPath(new URL("astro.config.mjs", siteRoot)));
  expect(manifest.name).toBe("dev-flow-site");
  expect(page).toContain('<h1 class="text-4xl font-semibold">Dev Flow</h1>');
  expect(page).toContain("<title>Dev Flow — local build scaffold</title>");
  expect(page).toContain('name="robots" content="noindex"');
  expect(config).toContain('site: "https://dev-flow.acrazie.dev"');
});

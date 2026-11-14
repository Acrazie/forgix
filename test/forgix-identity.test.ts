import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "bun:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const json = (path: string) => JSON.parse(read(path));

test("Forgix has one package, plugin, marketplace and public skill identity", () => {
  expect(existsSync(new URL("../plugins/codex-dev-flow", import.meta.url))).toBe(false);
  const manifest = json("plugins/forgix/package.json");
  expect(manifest.name).toBe("@acrasie/forgix");
  expect(manifest.bin).toEqual({ forgix: "dist/forgix.mjs" });
  expect(manifest.repository.directory).toBe("plugins/forgix");
  expect(manifest.repository.url).toBe("git+https://github.com/Acrazie/forgix.git");

  const plugin = json("plugins/forgix/.codex-plugin/plugin.json");
  expect(plugin.name).toBe("forgix");
  expect(plugin.interface.displayName).toBe("Forgix");
  expect(plugin.interface.defaultPrompt).toEqual(["Use $forgix to plan and implement a change."]);
  expect(plugin.skills).toBe("./skills/");
  const marketplace = json(".agents/plugins/marketplace.json");
  expect(marketplace.plugins).toHaveLength(1);
  expect(marketplace.plugins[0].name).toBe("forgix");
  expect(marketplace.plugins[0].source).toEqual({ source: "local", path: "./plugins/forgix" });
  expect(read("plugins/forgix/skills/forgix/SKILL.md")).toContain("name: forgix\n");
  expect(existsSync(new URL("../plugins/forgix/skills/dev-flow", import.meta.url))).toBe(false);
  expect(existsSync(new URL("../plugins/forgix/dist/dev-flow.mjs", import.meta.url))).toBe(false);
});

test("release configuration preserves version under the new path and component", () => {
  const manifest = json("plugins/forgix/package.json");
  expect(json(".release-please-manifest.json")).toEqual({ "plugins/forgix": manifest.version });
  expect(json("release-please-config.json").packages).toEqual({
    "plugins/forgix": {
      "release-type": "node",
      "package-name": "@acrasie/forgix",
      component: "forgix",
      "changelog-path": "CHANGELOG.md",
    },
  });
});

test("active root tooling follows the renamed workspace and artifact", () => {
  const scripts = json("package.json").scripts;
  for (const name of ["build", "check", "pack:runtime", "release"]) {
    expect(scripts[name]).toContain("plugins/forgix");
    expect(scripts[name]).not.toContain("plugins/codex-dev-flow");
  }
  expect(read(".github/workflows/ci.yml")).toContain(".artifacts/forgix.tgz");
  expect(read(".github/workflows/publish-github-package.yml")).toContain("forgix-v");
  expect(read("scripts/mirror-npm-to-github.ts")).toContain('SOURCE_PACKAGE = "@acrasie/forgix"');
  expect(read("scripts/mirror-npm-to-github.ts")).toContain(
    'DESTINATION_PACKAGE = "@acrazie/forgix"',
  );
});

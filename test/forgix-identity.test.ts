import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
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

test("release automation replaces Release Please without changing package version", () => {
  expect(existsSync(new URL("../.github/workflows/release-please.yml", import.meta.url))).toBe(
    false,
  );
  expect(existsSync(new URL("../.release-please-manifest.json", import.meta.url))).toBe(false);
  expect(existsSync(new URL("../release-please-config.json", import.meta.url))).toBe(false);
  expect(json("plugins/forgix/package.json").version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(read("cliff.toml")).toContain("protect_breaking_commits = true");
});

test("active root tooling follows the renamed workspace and artifact", () => {
  const scripts = json("package.json").scripts;
  for (const name of ["build", "check", "pack:runtime", "release"]) {
    expect(scripts[name]).toContain("plugins/forgix");
    expect(scripts[name]).not.toContain("plugins/codex-dev-flow");
  }
  expect(read(".github/workflows/ci.yml")).toContain(".artifacts/forgix.tgz");
  expect(read("scripts/mirror-npm-to-github.ts")).toContain("forgix-v");
  expect(read("scripts/mirror-npm-to-github.ts")).toContain('SOURCE_PACKAGE = "@acrasie/forgix"');
  expect(read("scripts/mirror-npm-to-github.ts")).toContain(
    'DESTINATION_PACKAGE = "@acrazie/forgix"',
  );
});

const pluginRoot = fileURLToPath(new URL("../plugins/forgix/", import.meta.url));

function pluginAsset(path: string): string {
  if (isAbsolute(path) || /^[a-z]+:/i.test(path)) throw new Error("Asset must be local");
  const target = realpathSync(resolve(pluginRoot, path));
  const withinRoot = relative(realpathSync(pluginRoot), target);
  if (withinRoot === ".." || withinRoot.startsWith(`..${sep}`) || isAbsolute(withinRoot)) {
    throw new Error("Asset must remain inside the plugin");
  }
  return target;
}

test("plugin branding uses the bundled brand master without changing Claude compatibility", () => {
  const codex = json("plugins/forgix/.codex-plugin/plugin.json");
  const antigravity = json("plugins/forgix/plugin.json");
  const claude = json("plugins/forgix/.claude-plugin/plugin.json");
  for (const field of ["logo", "logoDark", "composerIcon"]) {
    expect(codex.interface[field]).toBe("./assets/logo.svg");
    expect(pluginAsset(codex.interface[field])).toBe(resolve(pluginRoot, "assets/logo.svg"));
  }
  expect(antigravity.logo).toBe("assets/logo.svg");
  expect(pluginAsset(antigravity.logo)).toBe(resolve(pluginRoot, "assets/logo.svg"));
  expect(claude).not.toHaveProperty("icon");
  expect(claude).not.toHaveProperty("interface");
  const logo = read("plugins/forgix/assets/logo.svg");
  expect(logo).toBe(read("docs/assets/brand/svg/symbol-color.svg"));
  expect(logo).not.toMatch(/<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=/i);
});

test("plugin asset checks reject missing, remote and out-of-root files", () => {
  expect(() => pluginAsset("assets/missing.svg")).toThrow();
  expect(() => pluginAsset("../../docs/assets/brand/svg/symbol-color.svg")).toThrow(
    "Asset must remain inside the plugin",
  );
  expect(() => pluginAsset("https://example.com/logo.svg")).toThrow("Asset must be local");
  expect(() => pluginAsset(resolve(pluginRoot, "assets/logo.svg"))).toThrow("Asset must be local");
});

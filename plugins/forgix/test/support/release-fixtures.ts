import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Release tests exercise a fixed historical fixture, not the package version under test.
export function pinReleaseFixtureVersions(root: string): void {
  for (const [path, version] of [
    ["plugins/forgix/package.json", "1.0.1"],
    ["plugins/forgix/.codex-plugin/plugin.json", "1.0.1+codex.20261114212029"],
    ["plugins/forgix/.claude-plugin/plugin.json", "1.0.1"],
    ["plugins/forgix/plugin.json", "1.0.1"],
  ] as const) {
    const file = join(root, path);
    const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    manifest.version = version;
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const file = join(root, ".claude-plugin/marketplace.json");
  const marketplace = JSON.parse(readFileSync(file, "utf8")) as {
    plugins: { name: string; version: string }[];
  };
  const forgix = marketplace.plugins.find((entry) => entry.name === "forgix");
  if (!forgix) throw new Error("Release fixture requires the Forgix marketplace entry.");
  forgix.version = "1.0.1";
  writeFileSync(file, `${JSON.stringify(marketplace, null, 2)}\n`);
}

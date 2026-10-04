import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

if (Number(process.versions.node.split(".")[0]) !== 26) {
  console.error("Website commands require Node 26; plugin commands remain on Node 24.");
  process.exit(1);
}

const manifest = new URL(import.meta.resolve("astro/package.json"));
const { bin } = JSON.parse(readFileSync(manifest, "utf8"));
const cli = fileURLToPath(new URL(bin.astro, manifest));
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);

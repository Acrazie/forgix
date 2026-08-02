import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

export function createPackedArtifact(outputPath: string): string {
  const output = resolve(outputPath);
  mkdirSync(dirname(output), { recursive: true });
  rmSync(output, { force: true });

  const result = spawnSync(
    "bun",
    ["pm", "pack", "--ignore-scripts", "--filename", output, "--quiet"],
    { cwd: PACKAGE_ROOT, encoding: "utf8", shell: false },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`bun pm pack failed (${result.status ?? "unknown"}): ${result.stderr.trim()}`);
  }
  return output;
}

if (import.meta.main) {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error("Usage: bun scripts/package-artifact.ts <output.tgz>");
  console.log(createPackedArtifact(outputPath));
}

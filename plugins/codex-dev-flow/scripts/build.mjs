import { build } from "esbuild";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT_PATH = "dist/dev-flow.mjs";

export async function createDistributionBundle() {
  const result = await build({
    bundle: true,
    entryPoints: ["src/cli.ts"],
    format: "esm",
    outfile: OUTPUT_PATH,
    platform: "node",
    // Strip layout-specific generated names/comments without changing module resolution.
    minify: true,
    sourcemap: false,
    target: "node24.0",
    write: false,
    banner: {
      js: '#!/usr/bin/env node\nimport { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
    },
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error("esbuild did not produce the distribution bundle.");
  return output.contents;
}

export async function writeDistributionBundle() {
  const contents = await createDistributionBundle();
  await mkdir("dist", { recursive: true });
  await writeFile(OUTPUT_PATH, contents);
  await chmod(OUTPUT_PATH, 0o755);
  // Bun packs duplicate bin targets twice. Keep the legacy command as a thin alias
  // so both names share the same implementation without duplicating the bundle.
  const legacyPath = "dist/codex-dev-flow.mjs";
  await writeFile(
    legacyPath,
    '#!/usr/bin/env node\nimport { main } from "./dev-flow.mjs";\nmain();\n',
  );
  await chmod(legacyPath, 0o755);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) await writeDistributionBundle();

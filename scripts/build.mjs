import { build } from "vite-plus/pack";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { distribution } from "../vite.config.ts";

const OUTPUT_PATH = fileURLToPath(new URL("../dist/forgix.mjs", import.meta.url));
const PACKAGE_JSON_PATH = fileURLToPath(new URL("../package.json", import.meta.url));

export async function createDistributionBundle() {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, "utf8"));
  const { bundles } = await build({
    ...distribution,
    define: {
      ...distribution.define,
      FORGIX_PLUGIN_VERSION: JSON.stringify(packageJson.version),
    },
    config: false,
    write: false,
    logLevel: "error",
  });
  try {
    const outputs = bundles.flatMap((bundle) => bundle.chunks);
    if (outputs.length !== 1 || outputs[0].type !== "chunk") {
      throw new Error("Vite+ must produce exactly one JavaScript distribution bundle.");
    }
    const code = outputs[0].code;
    return Buffer.from(code.startsWith("#!") ? code : `#!/usr/bin/env node\n${code}`);
  } finally {
    await Promise.all(bundles.map((bundle) => bundle[Symbol.asyncDispose]()));
  }
}

export async function writeDistributionBundle() {
  const contents = await createDistributionBundle();
  await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT_PATH, contents);
  await chmod(OUTPUT_PATH, 0o755);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) await writeDistributionBundle();

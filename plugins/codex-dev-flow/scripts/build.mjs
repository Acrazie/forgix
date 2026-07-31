import { build } from "esbuild";
import { chmod } from "node:fs/promises";

await build({
  bundle: true,
  entryPoints: ["src/cli.ts"],
  format: "esm",
  outfile: "dist/dev-flow.mjs",
  platform: "node",
  sourcemap: false,
  target: "node22.18",
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});

await chmod("dist/dev-flow.mjs", 0o755);

import { build } from "esbuild";

await build({
  bundle: true,
  entryPoints: ["src/cli.ts"],
  format: "esm",
  outfile: "dist/dev-flow.mjs",
  platform: "node",
  sourcemap: false,
  target: "node22.18"
});

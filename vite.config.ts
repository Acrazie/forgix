import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

export const distribution = {
  cwd: fileURLToPath(new URL("./plugins/forgix/", import.meta.url)),
  entry: { forgix: "src/cli.ts" },
  outDir: "dist",
  format: "esm",
  platform: "node",
  target: "node26.0",
  deps: { alwaysBundle: [/.*/] },
  dts: false,
  minify: true,
  sourcemap: false,
  clean: false,
  outputOptions: { codeSplitting: false },
} satisfies PackUserConfig;

export default defineConfig({
  fmt: {
    printWidth: 100,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    proseWrap: "preserve",
    sortImports: false,
    sortPackageJson: false,
    ignorePatterns: [
      "**/dist/**",
      "**/coverage/**",
      ".worktrees/**",
      ".codex/tasks/**",
      ".codex/benchmarks/**",
      "docs/roadmap.md",
      "bun.lock",
      "plugins/forgix/CHANGELOG.md",
      "plugins/forgix/test/fixtures/**",
      "plugins/forgix/docs/baselines/**",
      "plugins/forgix/docs/lifecycle-contract.projection.json",
      "docs/ROADMAP.md",
    ],
  },
  lint: {
    categories: {
      correctness: "error",
      suspicious: "error",
      perf: "error",
      pedantic: "off",
      style: "off",
      restriction: "off",
      nursery: "off",
    },
    plugins: ["eslint", "typescript", "unicorn", "oxc", "node"],
    options: {
      denyWarnings: true,
      maxWarnings: 0,
      reportUnusedDisableDirectives: "error",
      typeAware: false,
      typeCheck: false,
    },
    rules: {
      "typescript/no-unsafe-type-assertion": "off",
    },
    ignorePatterns: [
      "**/dist/**",
      "**/coverage/**",
      ".worktrees/**",
      ".codex/tasks/**",
      ".codex/benchmarks/**",
      "plugins/forgix/test/fixtures/**",
      "docs/ROADMAP.md",
    ],
    overrides: [
      {
        files: [
          "plugins/forgix/src/benchmark.ts",
          "plugins/forgix/src/init.ts",
          "plugins/forgix/src/release.ts",
          "plugins/forgix/src/state-store.ts",
          "plugins/forgix/test/integration/lifecycle-paths.test.ts",
          "plugins/forgix/test/integration/state-store.test.ts",
        ],
        rules: {
          "eslint/no-await-in-loop": "off",
        },
      },
      {
        files: ["**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        rules: {
          "typescript/no-floating-promises": "off",
        },
      },
    ],
  },
  pack: distribution,
});

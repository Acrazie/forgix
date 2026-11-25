import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

export const distribution = {
  cwd: fileURLToPath(new URL("./", import.meta.url)),
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
      ".forgix/tasks/**",
      ".forgix/cache/**",
      ".forgix/init/**",
      ".forgix/roadmap/**",
      "docs/roadmap.md",
      "bun.lock",
      "CHANGELOG.md",
      "docs/forgix/2026-11-18-fallow-factory-guardrails.md",
      "test/fixtures/**",
      "docs/ROADMAP.md",
      ".dagger/**",
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
      // TypeScript strict mode + Ajv runtime schemas validate external inputs; targeted narrow casts remain explicit.
      "typescript/no-unsafe-type-assertion": "off",
    },
    ignorePatterns: [
      "**/dist/**",
      "**/coverage/**",
      ".worktrees/**",
      ".forgix/tasks/**",
      ".forgix/cache/**",
      ".forgix/init/**",
      ".forgix/roadmap/**",
      "test/fixtures/**",
      "docs/ROADMAP.md",
      ".dagger/**",
    ],
    overrides: [
      {
        // Golden Rule 2.2: bound function length to <= 60 physical lines across runtime and repo scripts.
        files: ["src/**/*.{js,mjs,cjs,ts,mts,cts}", "scripts/**/*.{js,mjs,cjs,ts,mts,cts}"],
        rules: {
          "eslint/max-lines-per-function": [
            "error",
            { max: 60, skipBlankLines: false, skipComments: false },
          ],
        },
      },
      {
        // Legacy monoliths with pre-existing functions > 60 lines; retire entries as modules are split.
        files: [
          "scripts/release.ts",
          "scripts/renovate-sync.ts",
          "scripts/verify-formal-kernel.ts",
          "src/cli.ts",
          "src/core/config.ts",
          "src/core/digest.ts",
          "src/core/routing.ts",
          "src/core/store.ts",
          "src/hooks/context.ts",
          "src/hooks/guards.ts",
          "src/hooks/index.ts",
          "src/hooks/io.ts",
          "src/init/hooks-config.ts",
          "src/init/index.ts",
          "src/profile/index.ts",
          "src/roadmap/index.ts",
          "src/task/index.ts",
          "src/task/plan.ts",
        ],
        rules: {
          "eslint/max-lines-per-function": "off",
        },
      },
      {
        // Sequential I/O and ordered filesystem/state operations intentionally await inside loops.
        files: [
          "scripts/release-lib.ts",
          "src/core/config.ts",
          "src/core/store.ts",
          "src/task/index.ts",
          "src/profile/index.ts",
          "src/roadmap/index.ts",
          "test/integration/lifecycle-paths.test.ts",
          "test/integration/state-store.test.ts",
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

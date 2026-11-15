import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

const root = fileURLToPath(new URL("..", import.meta.url));

test("real Vite+ staged checks preserve index and working files on success and failure", () => {
  const directory = mkdtempSync(join(tmpdir(), "forgix-staged-"));
  try {
    execFileSync("git", ["init", "--quiet", directory]);
    symlinkSync(join(root, "node_modules"), join(directory, "node_modules"), "dir");
    writeFileSync(join(directory, "vite.config.ts"), readFileSync(join(root, "vite.config.ts")));
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({
        name: "staged-fixture",
        private: true,
        type: "module",
        packageManager: "bun@1.4.4",
      }),
    );
    writeFileSync(join(directory, "example.ts"), "export const value = 1;\n");
    execFileSync("git", ["-C", directory, "add", "--", "example.ts"]);
    const index = join(directory, ".git", "index");
    const originalIndex = readFileSync(index);
    for (const [contents, expectedStatus] of [
      ["export const value = 1;\n", 0],
      ["export const value=2;\n", 1],
    ] as const) {
      writeFileSync(join(directory, "example.ts"), contents);
      const result = spawnSync(process.execPath, [join(root, "scripts/check-staged.ts")], {
        cwd: directory,
        env: {
          ...process.env,
          PATH: `${join(root, "node_modules/.bin")}${delimiter}${process.env.PATH}`,
        },
        encoding: "utf8",
        shell: false,
      });
      expect(result.error).toBeUndefined();
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(expectedStatus);
      expect(readFileSync(index)).toEqual(originalIndex);
      expect(readFileSync(join(directory, "example.ts"), "utf8")).toBe(contents);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);

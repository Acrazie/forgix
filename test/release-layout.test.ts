import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "bun:test";
import { manifestAtRevision } from "../scripts/release-ci.ts";
import { git } from "../scripts/release-notes.ts";

test("release comparisons read homologous manifests across root migration and fail on absence", () => {
  const root = mkdtempSync(join(tmpdir(), "forgix-layout-"));
  const write = (path: string, value: unknown) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify(value));
  };
  const commit = () => {
    git(root, ["add", "."]);
    git(root, ["-c", "commit.gpgsign=false", "commit", "-m", "test: layout"]);
    return git(root, ["rev-parse", "HEAD"]);
  };
  try {
    git(root, ["init"]);
    git(root, ["config", "user.name", "Layout test"]);
    git(root, ["config", "user.email", "layout@example.invalid"]);
    const product = { name: "@acrasie/forgix", version: "2.0.0" };
    write("package.json", { name: "forgix-repository", private: true, workspaces: ["plugins/*"] });
    write("plugins/forgix/package.json", product);
    const old = commit();
    rmSync(join(root, "plugins"), { recursive: true });
    write("package.json", product);
    const current = commit();
    expect(manifestAtRevision(root, old, "package.json")).toBe(
      manifestAtRevision(root, current, "package.json"),
    );
    expect(() => manifestAtRevision(root, old, "plugin.json")).toThrow();
    expect(() => manifestAtRevision(root, current, "plugin.json")).toThrow();
    write("package.json", { ...product, version: "2.0.1" });
    const changed = commit();
    expect(manifestAtRevision(root, changed, "package.json")).not.toBe(
      manifestAtRevision(root, old, "package.json"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

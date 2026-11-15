import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateStoreError } from "../../src/core/schema.ts";
import { createWorkspaceStore } from "../../src/core/store.ts";
import { expectRejected, expectThrown } from "../support/expect-error.ts";

const makeWorkspace = async () => realpath(await mkdtemp(join(tmpdir(), "forgix-store-unit-")));

describe("core/store", () => {
  test("resolvePath blocks traversal and outside paths while normalizing safe relative paths", async () => {
    const root = await makeWorkspace();
    try {
      const store = createWorkspaceStore(root);
      expect(store.resolvePath(".forgix/tasks/a.json")).toBe(
        join(root, ".forgix", "tasks", "a.json"),
      );
      for (const unsafe of ["", "../escape.json", "/etc/passwd", "a/\0b", ".."]) {
        expectThrown(
          () => store.resolvePath(unsafe),
          (error) => error instanceof StateStoreError && error.code === "state_path_invalid",
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("writes atomically, reads missing safely, and removes files cleanly", async () => {
    const root = await makeWorkspace();
    try {
      const store = createWorkspaceStore(root, { temporaryId: () => "tmp1" });
      await expectRejected(
        () => store.readText(".forgix/tasks/missing.json"),
        (error) => error instanceof StateStoreError && error.code === "state_not_found",
      );
      await store.ensureSafeDirectory(".forgix/tasks");
      await expectRejected(
        () => store.readText(".forgix/tasks/missing.json"),
        (error) => error instanceof StateStoreError && error.code === "state_not_found",
      );

      await store.writeTextAtomically(".forgix/tasks/item.json", '{"ok":true}\n');
      expect(await store.readText(".forgix/tasks/item.json")).toBe('{"ok":true}\n');
      if (process.platform !== "win32") {
        expect((await stat(join(root, ".forgix", "tasks", "item.json"))).mode & 0o777).toBe(0o600);
      }

      expect(await store.removeFile(".forgix/tasks/item.json")).toBe(true);
      expect(await store.removeFile(".forgix/tasks/item.json")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects symlinks in parent directories and target files", async () => {
    const root = await makeWorkspace();
    const outside = await makeWorkspace();
    try {
      await mkdir(join(root, ".forgix"), { recursive: true });
      await symlink(outside, join(root, ".forgix", "tasks"));
      const store = createWorkspaceStore(root);

      await expectRejected(
        () => store.writeTextAtomically(".forgix/tasks/pwn.json", "bad"),
        (error) => error instanceof StateStoreError && error.code === "state_path_invalid",
      );
      await expectRejected(
        () => readFile(join(outside, "pwn.json"), "utf8"),
        (error) => error instanceof Error && error.message.includes("ENOENT"),
      );
      await expectRejected(
        () => store.ensureSafeDirectory(".forgix/tasks"),
        (error) => error instanceof StateStoreError && error.code === "state_path_invalid",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  test("isGitignored and isGitignoredSync check .gitignore rules accurately", async () => {
    const root = await makeWorkspace();
    try {
      const store = createWorkspaceStore(root);
      expect(store.isGitignoredSync(".forgix/roadmap/")).toBe(false);
      expect(await store.isGitignored(".forgix/project.local.yaml")).toBe(false);

      await writeFile(
        join(root, ".gitignore"),
        "# comment\n/.forgix/roadmap/\n.forgix/project.local.yaml\n",
      );
      expect(store.isGitignoredSync(".forgix/roadmap/")).toBe(true);
      expect(store.isGitignoredSync(".forgix/roadmap/state.yaml")).toBe(true);
      expect(await store.isGitignored(".forgix/project.local.yaml")).toBe(true);
      expect(await store.isGitignored(".forgix/project.yaml")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

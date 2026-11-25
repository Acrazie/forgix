import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { runInvocation } from "../src/cli.ts";

const fixtureScripts = [
  "scripts/worktree.sh",
  "scripts/resolve-worktree-base.ts",
  "src/core/worktree-base.ts",
];

interface FixtureRepo {
  tempRoot: string;
  primary: string;
  env: NodeJS.ProcessEnv;
  git: (args: string[], cwd?: string) => string;
  runWorktreeAdd: (branch: string, cwd?: string, base?: string) => ReturnType<typeof spawnSync>;
  cleanup: () => void;
}

function createFixtureRepo(): FixtureRepo {
  const tempRoot = mkdtempSync(join(tmpdir(), "forgix-worktree-test-"));
  const bareOrigin = join(tempRoot, "origin.git");
  const primary = join(tempRoot, "repo");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };

  const git = (args: string[], cwd = primary) =>
    execFileSync("git", ["-C", cwd, ...args], { env, encoding: "utf8" }).trim();

  execFileSync("git", ["init", "--bare", "--initial-branch=main", bareOrigin], {
    env,
    encoding: "utf8",
  });
  execFileSync("git", ["clone", "--quiet", bareOrigin, primary], { env, encoding: "utf8" });

  git(["config", "user.name", "Worktree Test"]);
  git(["config", "user.email", "worktree@example.invalid"]);
  git(["symbolic-ref", "HEAD", "refs/heads/main"]);

  mkdirSync(join(primary, "scripts"), { recursive: true });
  mkdirSync(join(primary, "src/core"), { recursive: true });
  for (const path of fixtureScripts) {
    copyFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), join(primary, path));
  }
  chmodSync(join(primary, "scripts/worktree.sh"), 0o755);

  writeFileSync(
    join(primary, ".gitignore"),
    [
      ".worktrees/",
      ".env",
      ".env*.local",
      ".forgix/*.local.yaml",
      "*.pem",
      "*.key",
      "node_modules/",
      "dist/",
      ".artifacts/",
      "",
    ].join("\n"),
  );
  writeFileSync(join(primary, "README.md"), "ORIGINAL\n");

  git(["add", ".gitignore", "README.md", ...fixtureScripts]);
  git(["commit", "--quiet", "-m", "chore: initialize fixture repo"]);
  git(["push", "--quiet", "-u", "origin", "main"]);

  const runWorktreeAdd = (branch: string, cwd = primary, base?: string) =>
    spawnSync("bash", ["./scripts/worktree.sh", "add", branch, ...(base ? [base] : [])], {
      cwd,
      env,
      encoding: "utf8",
    });

  return {
    tempRoot,
    primary,
    env,
    git,
    runWorktreeAdd,
    cleanup: () => rmSync(tempRoot, { recursive: true, force: true }),
  };
}

function advanceRemote(repo: FixtureRepo, branch: string): string {
  const peer = join(repo.tempRoot, "peer");
  repo.git(["clone", "--quiet", "origin.git", peer], repo.tempRoot);
  repo.git(
    [
      "-c",
      "user.name=Peer",
      "-c",
      "user.email=peer@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "advance remote",
    ],
    peer,
  );
  repo.git(["push", "origin", `HEAD:refs/heads/${branch}`], peer);
  return repo.git(["rev-parse", "HEAD"], peer);
}

test("creates from the freshly fetched remote main without moving local main", () => {
  const repo = createFixtureRepo();
  try {
    const localMain = repo.git(["rev-parse", "main"]);
    const remoteMain = advanceRemote(repo, "main");
    expect(repo.runWorktreeAdd("topic").status).toBe(0);
    expect(repo.git(["rev-parse", "topic"])).toBe(remoteMain);
    expect(repo.git(["rev-parse", "main"])).toBe(localMain);
  } finally {
    repo.cleanup();
  }
});

test("uses the requested remote base and rejects it once deleted, even with a local branch", () => {
  const repo = createFixtureRepo();
  try {
    const remoteBase = advanceRemote(repo, "release/v1");
    repo.git(["branch", "release/v1"]);
    expect(repo.runWorktreeAdd("topic", repo.primary, "release/v1").status).toBe(0);
    expect(repo.git(["rev-parse", "topic"])).toBe(remoteBase);
    repo.git(["push", "origin", "--delete", "release/v1"], join(repo.tempRoot, "peer"));
    const refused = repo.runWorktreeAdd("refused", repo.primary, "release/v1");
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("Base branch origin/release/v1 does not exist.");
    expect(repo.git(["branch", "--list", "refused"])).toBe("");
    expect(existsSync(join(repo.primary, ".worktrees", "refused"))).toBe(false);
  } finally {
    repo.cleanup();
  }
});

test("failed fetch creates neither a branch nor a worktree despite a cached origin/main", () => {
  const repo = createFixtureRepo();
  try {
    repo.git(["remote", "set-url", "origin", join(repo.tempRoot, "missing.git")]);
    const refused = repo.runWorktreeAdd("refused");
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("Could not fetch origin");
    expect(repo.git(["branch", "--list", "refused"])).toBe("");
    expect(existsSync(join(repo.primary, ".worktrees", "refused"))).toBe(false);
  } finally {
    repo.cleanup();
  }
});

test("add never attaches an existing local branch as a fallback", () => {
  const repo = createFixtureRepo();
  try {
    repo.git(["branch", "topic"]);
    expect(repo.runWorktreeAdd("topic").status).not.toBe(0);
    expect(existsSync(join(repo.primary, ".worktrees", "topic"))).toBe(false);
  } finally {
    repo.cleanup();
  }
});

test("native worktree check accepts a fresh detached HEAD and refuses it after origin advances", async () => {
  const repo = createFixtureRepo();
  try {
    const worktree = join(repo.tempRoot, "native");
    repo.git(["worktree", "add", "--detach", worktree, "origin/main"]);
    const head = repo.git(["rev-parse", "HEAD"], worktree);
    const command = ["worktree", "check-base"];
    const options = { workspaceRoot: worktree };
    expect(await runInvocation(command, options)).toEqual({
      command: "worktree_check_base",
      status: "verified",
      data: { base: "origin/main", commit: head },
    });
    const remoteMain = advanceRemote(repo, "main");
    const readme = join(worktree, "README.md");
    writeFileSync(readme, "local change\n");
    await expect(runInvocation(command, options)).rejects.toThrow(
      `Worktree HEAD ${head} does not match origin/main ${remoteMain}`,
    );
    expect(repo.git(["rev-parse", "HEAD"], worktree)).toBe(head);
    expect(readFileSync(readme, "utf8")).toBe("local change\n");
  } finally {
    repo.cleanup();
  }
});

test("copies gitignored files listed in .worktreeinclude including nested paths and globs", () => {
  const repo = createFixtureRepo();
  try {
    writeFileSync(
      join(repo.primary, ".worktreeinclude"),
      [
        "# Local environment files",
        "",
        ".env",
        ".env*.local",
        ".forgix/config.local.yaml",
        "",
      ].join("\n"),
    );
    writeFileSync(join(repo.primary, ".env"), "SECRET=123\n");
    writeFileSync(join(repo.primary, ".env.local"), "LOCAL=true\n");
    writeFileSync(join(repo.primary, ".env.dev.local"), "DEV=true\n");
    mkdirSync(join(repo.primary, ".forgix"), { recursive: true });
    writeFileSync(join(repo.primary, ".forgix", "config.local.yaml"), "local: true\n");

    const result = repo.runWorktreeAdd("feat/copy-env");
    expect(result.status, String(result.stderr)).toBe(0);

    const worktreeDir = join(repo.primary, ".worktrees", "feat-copy-env");
    expect(readFileSync(join(worktreeDir, ".env"), "utf8")).toBe("SECRET=123\n");
    expect(readFileSync(join(worktreeDir, ".env.local"), "utf8")).toBe("LOCAL=true\n");
    expect(readFileSync(join(worktreeDir, ".env.dev.local"), "utf8")).toBe("DEV=true\n");
    expect(readFileSync(join(worktreeDir, ".forgix", "config.local.yaml"), "utf8")).toBe(
      "local: true\n",
    );
  } finally {
    repo.cleanup();
  }
});

test("succeeds non-fatally when .worktreeinclude is absent or listed files do not exist", () => {
  const repo = createFixtureRepo();
  try {
    const absentResult = repo.runWorktreeAdd("feat/no-include");
    expect(absentResult.status, String(absentResult.stderr)).toBe(0);
    expect(existsSync(join(repo.primary, ".worktrees", "feat-no-include"))).toBe(true);

    writeFileSync(
      join(repo.primary, ".worktreeinclude"),
      [".env.missing", ".env.*.nonexistent", ".forgix/missing.local.yaml", ""].join("\n"),
    );
    const missingFilesResult = repo.runWorktreeAdd("feat/missing-files");
    expect(missingFilesResult.status, String(missingFilesResult.stderr)).toBe(0);
    expect(existsSync(join(repo.primary, ".worktrees", "feat-missing-files"))).toBe(true);
  } finally {
    repo.cleanup();
  }
});

test("does not overwrite an existing file in the destination worktree", () => {
  const repo = createFixtureRepo();
  try {
    repo.git(["checkout", "--quiet", "-b", "base"]);
    writeFileSync(join(repo.primary, ".env.shared.local"), "BRANCH_VERSION\n");
    repo.git(["add", "-f", ".env.shared.local"]);
    repo.git(["commit", "--quiet", "-m", "test: add branch file"]);
    repo.git(["push", "--quiet", "origin", "base"]);
    repo.git(["checkout", "--quiet", "main"]);

    writeFileSync(join(repo.primary, ".worktreeinclude"), ".env.shared.local\n");
    writeFileSync(join(repo.primary, ".env.shared.local"), "PRIMARY_VERSION\n");

    const result = repo.runWorktreeAdd("feat/existing-dest", repo.primary, "base");
    expect(result.status, String(result.stderr)).toBe(0);

    const worktreeDir = join(repo.primary, ".worktrees", "feat-existing-dest");
    expect(readFileSync(join(worktreeDir, ".env.shared.local"), "utf8")).toBe("BRANCH_VERSION\n");
  } finally {
    repo.cleanup();
  }
});

test("resolves source files from the primary checkout when invoked from a linked worktree", () => {
  const repo = createFixtureRepo();
  try {
    const firstResult = repo.runWorktreeAdd("feat/first");
    expect(firstResult.status, String(firstResult.stderr)).toBe(0);

    writeFileSync(
      join(repo.primary, ".worktreeinclude"),
      [".env", ".forgix/config.local.yaml", ""].join("\n"),
    );
    writeFileSync(join(repo.primary, ".env"), "FROM_PRIMARY\n");
    mkdirSync(join(repo.primary, ".forgix"), { recursive: true });
    writeFileSync(join(repo.primary, ".forgix", "config.local.yaml"), "from: primary\n");

    const linkedCwd = join(repo.primary, ".worktrees", "feat-first");
    const secondResult = repo.runWorktreeAdd("feat/second", linkedCwd);
    expect(secondResult.status, String(secondResult.stderr)).toBe(0);

    const secondWorktreeDir = join(repo.primary, ".worktrees", "feat-second");
    expect(readFileSync(join(secondWorktreeDir, ".env"), "utf8")).toBe("FROM_PRIMARY\n");
    expect(readFileSync(join(secondWorktreeDir, ".forgix", "config.local.yaml"), "utf8")).toBe(
      "from: primary\n",
    );
  } finally {
    repo.cleanup();
  }
});

test("refuses tracked files, unignored files, traversal/external symlinks, and blocked patterns", () => {
  const repo = createFixtureRepo();
  try {
    const outsideFile = join(repo.tempRoot, "outside.txt");
    writeFileSync(outsideFile, "SECRET_OUTSIDE\n");

    writeFileSync(join(repo.primary, "README.md"), "MODIFIED_IN_PRIMARY\n");
    writeFileSync(join(repo.primary, "unignored.txt"), "UNIGNORED\n");
    writeFileSync(join(repo.primary, ".env"), "VALID_ENV\n");
    symlinkSync(outsideFile, join(repo.primary, ".env.symlink.local"));

    writeFileSync(join(repo.primary, "cert.pem"), "PEM\n");
    writeFileSync(join(repo.primary, "private.key"), "KEY\n");
    mkdirSync(join(repo.primary, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(repo.primary, "node_modules", "pkg", "index.js"), "module.exports = {};\n");
    mkdirSync(join(repo.primary, "dist"), { recursive: true });
    writeFileSync(join(repo.primary, "dist", "bundle.js"), "console.log(1);\n");
    mkdirSync(join(repo.primary, ".artifacts"), { recursive: true });
    writeFileSync(join(repo.primary, ".artifacts", "report.txt"), "artifact\n");

    writeFileSync(
      join(repo.primary, ".worktreeinclude"),
      [
        ".env",
        "README.md",
        "unignored.txt",
        "../outside.txt",
        ".env.symlink.local",
        "*.pem",
        "*.key",
        "node_modules/",
        "node_modules/pkg/index.js",
        "dist/",
        "dist/bundle.js",
        ".artifacts/",
        ".artifacts/report.txt",
        "",
      ].join("\n"),
    );

    const result = repo.runWorktreeAdd("feat/security-checks");
    expect(result.status, String(result.stderr)).toBe(0);

    const worktreeDir = join(repo.primary, ".worktrees", "feat-security-checks");
    expect(readFileSync(join(worktreeDir, ".env"), "utf8")).toBe("VALID_ENV\n");
    expect(readFileSync(join(worktreeDir, "README.md"), "utf8")).toBe("ORIGINAL\n");
    expect(existsSync(join(worktreeDir, "unignored.txt"))).toBe(false);
    expect(existsSync(join(worktreeDir, "outside.txt"))).toBe(false);
    expect(existsSync(join(repo.primary, ".worktrees", "outside.txt"))).toBe(false);
    expect(existsSync(join(worktreeDir, ".env.symlink.local"))).toBe(false);
    expect(existsSync(join(worktreeDir, "cert.pem"))).toBe(false);
    expect(existsSync(join(worktreeDir, "private.key"))).toBe(false);
    expect(existsSync(join(worktreeDir, "node_modules"))).toBe(false);
    expect(existsSync(join(worktreeDir, "dist"))).toBe(false);
    expect(existsSync(join(worktreeDir, ".artifacts"))).toBe(false);
  } finally {
    repo.cleanup();
  }
});

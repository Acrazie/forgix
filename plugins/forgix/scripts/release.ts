#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { confirm, intro, isCancel, note, outro, select, text } from "@clack/prompts";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allowedReleasePaths,
  validateVersions,
  captureFileSnapshots,
  compareVersions,
  createReleasePlan,
  incrementVersion,
  parsePorcelainPaths,
  parseStableVersion,
  recommendBump,
  replaceJsonVersion,
  replaceMarketplacePluginVersion,
  restoreFileSnapshots,
  requireCommand,
  semanticBase,
  ReleaseError,
  type ReleaseTarget,
  type VersionBump,
} from "./release-lib.ts";
import { git, notesMetadata, previousTag, renderNotes } from "./release-notes.ts";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = requireCommand("git", ["rev-parse", "--show-toplevel"], {
  cwd: pluginRoot,
}).stdout.trim();
const readJson = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8"));
async function run(command: string, args: string[], signal: AbortSignal): Promise<void> {
  await new Promise<void>((done, fail) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: false, signal });
    child.once("error", fail);
    child.once("close", (code) => {
      if (code === 0) done();
      else fail(new ReleaseError(`${command} ${args.join(" ")} failed.`));
    });
  });
}
function answer<T>(value: T | symbol): T {
  if (isCancel(value)) throw new ReleaseError("Preparation cancelled.");
  return value;
}

async function main(): Promise<void> {
  if (process.argv.length > 2)
    throw new ReleaseError(
      "Local publication has been retired. Use bun run release to prepare; resume CI with the existing tag as both workflow ref and input.",
    );
  if (process.platform === "win32")
    throw new ReleaseError("Release preparation supports Linux and macOS.");
  const branch = git(root, ["branch", "--show-current"]);
  if (!branch || branch === "main")
    throw new ReleaseError(
      "Prepare on a clean work branch, not main or detached HEAD. Merge preparation through a PR before tagging.",
    );
  if (git(root, ["status", "--porcelain=v1", "--untracked-files=all"]))
    throw new ReleaseError("Preparation requires a clean worktree.");
  intro("Forgix release preparation (no publication)");
  const target = answer(
    await select<ReleaseTarget>({
      message: "Release target",
      initialValue: "both",
      options: [
        { value: "both", label: "npm + plugins" },
        { value: "npm", label: "npm only" },
        { value: "plugin", label: "Plugins only" },
      ],
    }),
  );
  const preview = answer(
    await confirm({ message: "Preview only (restore every prepared file)?", initialValue: true }),
  );
  const pkg = await readJson("plugins/forgix/package.json");
  const codex = await readJson("plugins/forgix/.codex-plugin/plugin.json");
  let nextPackageVersion: string | undefined;
  if (target !== "plugin") {
    const base = previousTag(root, "npm");
    const commits = git(root, [
      "log",
      base ? `${base}..HEAD` : "HEAD",
      "--format=%s%n%b%x00",
    ]).split("\0");
    const recommended = pkg.version.startsWith("1.") ? "major" : recommendBump(commits);
    const bump = answer(
      await select<VersionBump | "custom">({
        message: "npm version (Node >=26 requires a major for the first migration release)",
        initialValue: recommended,
        options: [
          ...(["patch", "minor", "major"] as const).map((value) => ({
            value,
            label: `${value}: ${incrementVersion(pkg.version, value)}`,
          })),
          { value: "custom", label: "Custom stable version" },
        ],
      }),
    );
    nextPackageVersion =
      bump === "custom"
        ? answer(
            await text({
              message: "Next stable version",
              validate(value) {
                try {
                  parseStableVersion(value ?? "");
                  return compareVersions(value ?? "", pkg.version) > 0
                    ? undefined
                    : "Version must increase.";
                } catch {
                  return "Expected stable SemVer.";
                }
              },
            }),
          )
        : incrementVersion(pkg.version, bump);
  }
  const plan = createReleasePlan({
    target,
    currentPackageVersion: pkg.version,
    currentPluginVersion: codex.version,
    ...(nextPackageVersion ? { nextPackageVersion } : {}),
    now: new Date(),
  });
  if (git(root, ["tag", "--list", plan.tag]))
    throw new ReleaseError("Release tag already exists; resume CI, do not prepare it again.");
  const paths = [...allowedReleasePaths(target)].map((path) => resolve(root, path));
  const snapshots = await captureFileSnapshots(paths);
  const restore = () => restoreFileSnapshots(snapshots);
  const controller = new AbortController();
  const interrupted = () => controller.abort();
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  let retained = false;
  try {
    if (target !== "plugin") {
      const path = resolve(pluginRoot, "package.json");
      await writeFile(path, replaceJsonVersion(await readFile(path, "utf8"), plan.packageVersion));
      await run("bun", ["install", "--lockfile-only", "--ignore-scripts"], controller.signal);
    }
    if (target !== "npm") {
      await Promise.all(
        [
          [".codex-plugin/plugin.json", plan.pluginVersion],
          [".claude-plugin/plugin.json", semanticBase(plan.pluginVersion)],
          ["plugin.json", semanticBase(plan.pluginVersion)],
        ].map(async ([relative, version]) => {
          const path = resolve(pluginRoot, relative!);
          await writeFile(path, replaceJsonVersion(await readFile(path, "utf8"), version!));
        }),
      );
      const path = resolve(root, ".claude-plugin/marketplace.json");
      await writeFile(
        path,
        replaceMarketplacePluginVersion(
          await readFile(path, "utf8"),
          "forgix",
          semanticBase(plan.pluginVersion),
        ),
      );
    }
    validateVersions(root, plan.tag);
    const changelogPath = resolve(pluginRoot, "CHANGELOG.md");
    const changelog = await readFile(changelogPath, "utf8");
    if (changelog.includes(`## [${plan.tag}] - `))
      throw new ReleaseError("Changelog already contains this release.");
    const notes = renderNotes(
      root,
      notesMetadata(root, plan.tag, new Date().toISOString().slice(0, 10)),
    );
    if (!changelog.startsWith("# Changelog\n"))
      throw new ReleaseError("Expected canonical changelog header.");
    await writeFile(
      changelogPath,
      `# Changelog\n\n${notes}\n${changelog.slice("# Changelog\n".length).replace(/^\n+/, "")}`,
    );
    controller.signal.throwIfAborted();
    await run("bun", ["run", "check"], controller.signal);
    controller.signal.throwIfAborted();
    const changes = parsePorcelainPaths(
      git(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
    );
    if (changes.some((path) => !allowedReleasePaths(target).has(path)))
      throw new ReleaseError("Unexpected changed file during preparation; inspect worktree.");
    note(notes, "Prepared git-cliff release notes");
    note(
      `Target: ${target}\nTag after PR merge: ${plan.tag}\nCommit title: ${plan.commitMessage}\nFiles: ${changes.join(", ")}\nNo commit, push, tag, publication or local installation performed.`,
      "Preparation summary",
    );
    retained = !preview;
    outro(
      preview
        ? "Preview complete; prepared files restored."
        : "Prepared files retained. Review and ship the PR separately; tag only its validated main commit.",
    );
  } finally {
    process.removeListener("SIGINT", interrupted);
    process.removeListener("SIGTERM", interrupted);
    if (!retained) await restore();
  }
}

if (import.meta.main)
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

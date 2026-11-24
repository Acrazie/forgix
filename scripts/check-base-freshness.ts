import { execFileSync, spawnSync } from "node:child_process";

/**
 * Verifies that the current feature branch includes the latest `origin/main`
 * commits before pushing, preventing stale-base Trail/PR conflicts.
 */
function main(): void {
  const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (branch === "main" || branch === "HEAD") return;

  const fetch = spawnSync("git", ["fetch", "origin", "main", "--quiet"], {
    encoding: "utf8",
  });
  if (fetch.status !== 0) {
    console.warn("[check:base] Could not fetch origin/main; skipping freshness check.");
    return;
  }

  const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], {
    encoding: "utf8",
  });
  if (ancestor.status === 0) return;

  const behind = execFileSync("git", ["rev-list", "--count", "HEAD..origin/main"], {
    encoding: "utf8",
  }).trim();
  console.error(
    `Error: branch "${branch}" is ${behind} commit(s) behind origin/main. Rebase or merge origin/main before pushing.`,
  );
  process.exit(1);
}

main();

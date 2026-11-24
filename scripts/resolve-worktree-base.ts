import { resolveRemoteBase, WorktreeBaseError } from "../src/core/worktree-base.ts";

try {
  console.log(resolveRemoteBase(process.cwd(), process.argv[2] ?? "main"));
} catch (error) {
  if (!(error instanceof WorktreeBaseError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createTaskStateStore, validateTaskState } from "../src/task/index.ts";
import type { TaskState } from "../src/types.ts";
import { seedLegacyTask } from "../test/support/helpers-v6.ts";

export function loadLeanVectors(file: string): unknown {
  const cwd = fileURLToPath(new URL("../formal/lean/", import.meta.url));
  execFileSync("lake", ["build"], { cwd, stdio: "inherit" });
  return JSON.parse(
    execFileSync("lake", ["env", "lean", "--run", file], { cwd, encoding: "utf8" }),
  );
}

export async function seedAndProjectPlanV2(root: string, taskId: string, proposal: TaskState) {
  await seedLegacyTask(root, validateTaskState(proposal));
  const store = createTaskStateStore(root);
  const plan = await store.load(taskId);
  await store.project(taskId, {
    path: plan.shape!.projection!.path,
    digest: plan.contractDigest!,
    checkPolicy: async () => "repo-policy",
  });
  return { store, plan };
}

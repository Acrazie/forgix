import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { appendFileSync } from "node:fs";

export interface Observation {
  label: string;
  durationMs: number;
  status: number;
}

export interface ObserverDependencies {
  now?: () => number;
  run?: (command: string, args: string[]) => SpawnSyncReturns<Buffer>;
  report?: (observation: Observation) => void;
}

export function runObservedCommand(
  label: string,
  command: string,
  args: string[],
  dependencies: ObserverDependencies = {},
): number {
  const now = dependencies.now ?? performance.now.bind(performance);
  const run =
    dependencies.run ??
    ((childCommand, childArgs) =>
      spawnSync(childCommand, childArgs, { shell: false, stdio: "inherit" }));
  const startedAt = now();
  const result = run(command, args);
  const status = result.error ? 1 : (result.status ?? 1);
  const observation = { label, durationMs: now() - startedAt, status };

  console.log(`${label}: ${observation.durationMs.toFixed(1)} ms (status ${status})`);
  try {
    (dependencies.report ?? reportToGitHub)(observation);
  } catch (error) {
    console.warn(`Timing report unavailable: ${String(error)}`);
  }
  return status;
}

function reportToGitHub(observation: Observation): void {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  appendFileSync(
    summary,
    `### ${observation.label} timing\n\n| Duration | Exit status |\n| ---: | ---: |\n| ${observation.durationMs.toFixed(1)} ms | ${observation.status} |\n`,
  );
}

if (import.meta.main) {
  const [label, command, ...args] = process.argv.slice(2);
  if (!label || !command) {
    throw new Error("Usage: bun scripts/observe-command.ts <label> <command> [...args]");
  }
  process.exitCode = runObservedCommand(label, command, args);
}

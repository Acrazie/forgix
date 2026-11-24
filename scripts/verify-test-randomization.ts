import { spawnSync } from "node:child_process";
import { parseTestOrder } from "./test-order.ts";

const FIXTURE = "test/fixtures/order-dependent.fixture.test.ts";
const RECORDED_SEEDS = [1, 3] as const;

interface SeedResult {
  seed: number;
  status: number;
  order: string[];
}

function executeSeed(seed: number): SeedResult {
  const result = spawnSync(
    process.execPath,
    ["test", "--seed", String(seed), "--path-ignore-patterns", "never-match", FIXTURE],
    { encoding: "utf8", shell: false },
  );
  if (result.error) throw result.error;
  const output = `${result.stdout}\n${result.stderr}`;
  const order = parseTestOrder(output);
  if (!output.includes(`--seed=${seed}`) || order.length !== 2) {
    throw new Error(`Seed ${seed} did not produce reproducible randomization metadata.`);
  }
  return { seed, status: result.status ?? 1, order };
}

for (const seed of RECORDED_SEEDS) {
  const first = executeSeed(seed);
  const second = executeSeed(seed);
  if (first.status !== second.status || first.order.join("\0") !== second.order.join("\0")) {
    throw new Error(`Seed ${seed} did not reproduce the same test order and status.`);
  }
}

const outcomes = RECORDED_SEEDS.map(executeSeed);
if (!outcomes.some((outcome) => outcome.status === 0)) {
  throw new Error("Recorded seeds did not demonstrate the passing order.");
}
if (!outcomes.some((outcome) => outcome.status !== 0)) {
  throw new Error("Recorded seeds did not demonstrate the forced order dependency.");
}

console.log(
  outcomes
    .map(
      (outcome) =>
        `seed=${outcome.seed} status=${outcome.status} order=${outcome.order.join(" -> ")}`,
    )
    .join("\n"),
);

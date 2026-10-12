import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBaselineReport } from "../dist/forgix.mjs";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(pluginRoot, "docs", "baselines", "2026-07-18-p0-lifecycle.json");
const common = {
  source: "contract_fixture",
  falseSuccessDetections: 0,
  falseSuccessDetectionSource: "contract_tests",
};
const quick = [
  "new",
  "intaking",
  "discovering",
  "awaiting_profile_choice",
  "planning",
  "awaiting_approval",
  "executing",
  "assuring",
];
const plan = [
  "new",
  "intaking",
  "discovering",
  "awaiting_profile_choice",
  "planning",
  "awaiting_approval",
  "executing",
  "assuring",
];
const report = buildBaselineReport({
  baselineId: "p0-taskstate-v6-contract-fixture",
  capturedAt: "2026-08-13T00:00:00.000Z",
  contractVersion: "P0",
  source: "contract_fixture",
  limitations: [
    "contract_fixture_not_runtime",
    "token_telemetry_unavailable",
    "latency_telemetry_unavailable",
  ],
  traces: [
    {
      ...common,
      runId: "fixture-quick",
      preparationProfile: "quick",
      statuses: quick,
      outcome: "success",
      assurance: {
        checksRun: 1,
        evidenceReused: 0,
        reviewCalls: 0,
        reviewEscalations: 0,
        correctionCycles: 0,
      },
    },
    {
      ...common,
      runId: "fixture-plan",
      preparationProfile: "plan",
      statuses: plan,
      outcome: "success",
      assurance: {
        checksRun: 1,
        evidenceReused: 0,
        reviewCalls: 1,
        reviewEscalations: 0,
        correctionCycles: 0,
      },
    },
    {
      ...common,
      runId: "fixture-plan-block-resume",
      preparationProfile: "plan",
      outcome: "success",
      assurance: {
        checksRun: 1,
        evidenceReused: 1,
        reviewCalls: 1,
        reviewEscalations: 0,
        correctionCycles: 0,
      },
      statuses: [
        "new",
        "intaking",
        "discovering",
        "awaiting_profile_choice",
        "planning",
        "awaiting_approval",
        "executing",
        "blocked",
        "executing",
        "assuring",
      ],
    },
  ],
});
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(output);

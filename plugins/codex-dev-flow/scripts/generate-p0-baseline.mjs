import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBaselineReport } from "../dist/dev-flow.mjs";

const outputUrl = new URL("../docs/baselines/2026-07-18-p0-lifecycle.json", import.meta.url);
const report = buildBaselineReport({
  baselineId: "p0-contract-lifecycle-2026-07-18",
  capturedAt: "2026-07-18T00:00:00.000Z",
  contractVersion: "P0",
  source: "contract_fixture",
  limitations: [
    "contract_fixture_not_runtime",
    "token_telemetry_unavailable",
    "latency_telemetry_unavailable"
  ],
  traces: [
    {
      runId: "p0-quick-happy",
      mode: "quick",
      source: "contract_fixture",
      falseSuccessDetections: 0,
      falseSuccessDetectionSource: "contract_tests",
      statuses: ["new", "awaiting_mode_confirmation", "executing", "validating", "verifying", "finished_local"]
    },
    {
      runId: "p0-standard-happy",
      mode: "standard",
      source: "contract_fixture",
      falseSuccessDetections: 0,
      falseSuccessDetectionSource: "contract_tests",
      statuses: [
        "new", "awaiting_mode_confirmation", "discovering", "planning", "awaiting_approval",
        "executing", "validating", "reviewing", "verifying", "finished_local"
      ]
    },
    {
      runId: "p0-critical-gated-resume",
      mode: "critical",
      source: "contract_fixture",
      falseSuccessDetections: 0,
      falseSuccessDetectionSource: "contract_tests",
      statuses: [
        "new", "awaiting_mode_confirmation", "discovering", "planning", "awaiting_approval",
        "executing", "validating", "reviewing", "verifying", "awaiting_approval",
        "blocked", "awaiting_approval", "finished_local"
      ]
    }
  ]
});

await mkdir(dirname(fileURLToPath(outputUrl)), { recursive: true });
await writeFile(outputUrl, JSON.stringify(report, null, 2) + "\n", "utf8");

import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/release-smoke.sh", import.meta.url));
const artifact = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const producer = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const smoke = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function exercise(scenario: string, check: (cwd: string, status: number | null) => void): void {
  const cwd = mkdtempSync(join(tmpdir(), "forgix-release-smoke-"));
  try {
    writeFileSync(
      join(cwd, "buildkite-agent"),
      String.raw`#!/usr/bin/env bash
set -euo pipefail
[[ $1 == artifact ]]
shift
case "$1" in
  search)
    [[ $* == 'search .artifacts/forgix.tgz --step quality-gate --format %i %j\n' ]]
    printf '%s %s\n' "$ARTIFACT" "$PRODUCER"
    if [[ $SCENARIO == duplicate ]]; then printf '%s %s\n' "$ARTIFACT" "$PRODUCER"; fi
    ;;
  download)
    [[ $2 == .artifacts/forgix.tgz && $4 == --step && $5 == "$PRODUCER" ]]
    mkdir -p "$3/.artifacts"
    printf 'exact bytes' > "$3/$2"
    ;;
  upload)
    [[ $2 == .artifacts/runtime-smoke.json && -f smoke-executed ]]
    cp "$2" uploaded.json
    ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(cwd, "dagger"),
      String.raw`#!/usr/bin/env bash
set -euo pipefail
[[ $1 == call && $2 == runtime-smoke && $3 == --source=. && $4 == --tarball=* ]]
[[ $(cat "$(printf '%s' "$4" | cut -d= -f2)") == 'exact bytes' ]]
touch smoke-executed
[[ $SCENARIO != smoke-failure ]]
`,
      { mode: 0o755 },
    );
    const result = spawnSync("bash", [script], {
      cwd,
      env: {
        ...process.env,
        PATH: `${cwd}:${process.env.PATH}`,
        BUILDKITE_JOB_ID: smoke,
        ARTIFACT: artifact,
        PRODUCER: producer,
        SCENARIO: scenario,
      },
      encoding: "utf8",
    });
    check(cwd, result.status);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("uploads a receipt only after testing the exact producer's tarball", () => {
  exercise("success", (cwd, status) => {
    expect(status).toBe(0);
    expect(JSON.parse(readFileSync(join(cwd, "uploaded.json"), "utf8"))).toEqual({
      smokeJob: smoke,
      producerJob: producer,
      artifact,
      sha512: createHash("sha512").update("exact bytes").digest("hex"),
    });
  });
});

test("does not upload a receipt for ambiguous artifacts or failed smoke", () => {
  for (const scenario of ["duplicate", "smoke-failure"]) {
    exercise(scenario, (cwd, status) => {
      expect(status).toBe(1);
      expect(() => readFileSync(join(cwd, "uploaded.json"))).toThrow(/ENOENT/);
    });
  }
});

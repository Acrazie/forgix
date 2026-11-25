#!/usr/bin/env bash
set -euo pipefail

tarball=.artifacts/forgix.tgz
receipt=.artifacts/runtime-smoke.json
uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
witness=$(buildkite-agent artifact search "$tarball" --step quality-gate --format '%i %j\n')
if [[ ! $witness =~ ^($uuid)\ ($uuid)$ || ! ${BUILDKITE_JOB_ID:-} =~ ^$uuid$ ]]; then
  echo 'Expected one quality-gate tarball and valid Buildkite job IDs.' >&2
  exit 1
fi
read -r artifact producer <<< "$witness"

mkdir -p .artifacts
scratch=$(mktemp -d .artifacts/smoke.XXXXXX)
trap 'rm -rf "$scratch"' EXIT
buildkite-agent artifact download "$tarball" "$scratch" --step "$producer"
tested="$scratch/$tarball"
digest=$(sha512sum < "$tested")
dagger call runtime-smoke --source=. --tarball="$tested"

printf '{"smokeJob":"%s","producerJob":"%s","artifact":"%s","sha512":"%s"}\n' \
  "$BUILDKITE_JOB_ID" "$producer" "$artifact" "${digest%% *}" > "$receipt"
buildkite-agent artifact upload "$receipt"

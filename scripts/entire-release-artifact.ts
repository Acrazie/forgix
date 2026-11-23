// Pure checks for the release control plane; does not download or publish anything.
import { createHash } from "node:crypto";
import {
  isEntireWebhookBuild,
  selectWitnessArtifacts,
  type Artifact,
  type Build,
} from "./entire-release-preflight.ts";

interface Candidate {
  tag: string;
  tagObject: string;
  commit: string;
}

// The caller must provide the complete Buildkite result set for this tag, fetched
// from the approved pipeline. A partial or stale page cannot authorize a release.
export function selectReleaseBuild(builds: readonly Build[], candidate: Candidate): Build {
  if (
    !/^(npm-)?v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(candidate.tag) ||
    !/^[0-9a-f]{40}$/.test(candidate.tagObject) ||
    !/^[0-9a-f]{40}$/.test(candidate.commit) ||
    candidate.commit === candidate.tagObject
  ) {
    throw new Error("Invalid annotated npm release candidate.");
  }
  const matching = builds.filter(
    (build) => build.branch === candidate.tag && isEntireWebhookBuild(build),
  );
  const latest = Math.max(...matching.map((build) => build.number));
  const newest = matching.filter((build) => build.number === latest);
  const build = newest[0];
  if (
    !build?.id ||
    newest.length !== 1 ||
    !Number.isSafeInteger(latest) ||
    build.commit !== candidate.tagObject ||
    build.blocked !== false ||
    build.state !== "passed"
  ) {
    throw new Error("No current passing Buildkite webhook build for the exact tag object.");
  }
  return build;
}

export function requireReleaseJobs(build: Build) {
  const passedJob = (step: string): string => {
    const attempts = build.jobs.filter((job) => job.step_key === step && job.retried === false);
    const job = attempts[0];
    if (
      !job?.id ||
      attempts.length !== 1 ||
      job.state !== "passed" ||
      job.soft_failed !== false ||
      job.exit_status !== 0
    ) {
      throw new Error(`Buildkite required step is not unambiguously successful: ${step}.`);
    }
    return job.id;
  };
  return {
    producer: passedJob("quality-gate"),
    smokeJob: passedJob("runtime-smoke"),
    contractJob: passedJob("release-contract"),
  };
}

export function selectReleaseArtifacts(
  build: Build,
  producerArtifacts: Artifact[],
  smokeArtifacts: Artifact[],
) {
  const { producer, smokeJob, contractJob } = requireReleaseJobs(build);
  const [tarball, metadata] = selectWitnessArtifacts(producerArtifacts, producer);
  const receipts = smokeArtifacts.filter(({ path }) => path === ".artifacts/runtime-smoke.json");
  const receipt = receipts[0];
  if (
    !tarball ||
    !metadata ||
    !receipt?.id ||
    receipts.length !== 1 ||
    receipt.job_id !== smokeJob
  ) {
    throw new Error("Missing or ambiguous runtime smoke receipt.");
  }
  return { build: build.id, producer, smokeJob, contractJob, tarball, metadata, receipt };
}

export function verifyTestedTarball(
  selection: ReturnType<typeof selectReleaseArtifacts>,
  receipt: unknown,
  bytes: Uint8Array,
): string {
  const proof = receipt as {
    smokeJob?: unknown;
    producerJob?: unknown;
    artifact?: unknown;
    sha512?: unknown;
  } | null;
  const digest = createHash("sha512").update(bytes).digest();
  if (
    proof?.smokeJob !== selection.smokeJob ||
    proof.producerJob !== selection.producer ||
    proof.artifact !== selection.tarball.id ||
    proof.sha512 !== digest.toString("hex")
  ) {
    throw new Error("Smoke receipt does not bind the selected attempt and tarball bytes.");
  }
  return `sha512-${digest.toString("base64")}`;
}

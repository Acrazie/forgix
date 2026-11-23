import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  selectReleaseArtifacts,
  selectReleaseBuild,
  verifyTestedTarball,
} from "../scripts/entire-release-artifact.ts";

const candidate = { tag: "npm-v4.0.1", commit: "a".repeat(40), tagObject: "b".repeat(40) };
const jobs = ["quality-gate", "runtime-smoke", "release-contract"].map((key) => ({
  id: key,
  step_key: key,
  state: "passed",
  soft_failed: false,
  retried: false,
  exit_status: 0,
}));
const build = {
  id: "tag-build",
  number: 100,
  source: "webhook",
  branch: candidate.tag,
  commit: candidate.tagObject,
  state: "passed",
  blocked: false,
  pipeline: { repository: "entire://aws-eu-central-1.entire.io/et/forgix/forgix" },
  jobs,
};
const producer = [
  { id: "tarball", job_id: "quality-gate", path: ".artifacts/forgix.tgz" },
  { id: "metadata", job_id: "quality-gate", path: ".artifacts/release.json" },
];
const smoke = [{ id: "receipt", job_id: "runtime-smoke", path: ".artifacts/runtime-smoke.json" }];
const bytes = Buffer.from("tested bytes");
const digest = createHash("sha512").update(bytes).digest();
const proof = {
  smokeJob: "runtime-smoke",
  producerJob: "quality-gate",
  artifact: "tarball",
  sha512: digest.toString("hex"),
};

describe("release artifact handoff", () => {
  test("accepts the latest exact green webhook, not branch/API or a stale success", () => {
    expect(selectReleaseBuild([build], candidate)).toBe(build);
    for (const impostor of [
      { ...build, branch: "main", commit: candidate.commit },
      { ...build, source: "api" },
      { ...build, commit: candidate.commit },
      { ...build, blocked: true },
      { ...build, pull_request: { id: 12 } },
    ]) {
      expect(() => selectReleaseBuild([impostor], candidate)).toThrow(/exact tag object/);
    }
    for (const update of [{ state: "running" }, { state: "failed" }, { commit: "c".repeat(40) }]) {
      expect(() =>
        selectReleaseBuild([build, { ...build, number: 101, ...update }], candidate),
      ).toThrow(/exact tag object/);
    }
    expect(() => selectReleaseBuild([build, build], candidate)).toThrow(/exact tag object/);
  });

  test("requires all three current artifact jobs to have passed", () => {
    const selection = selectReleaseArtifacts(build, producer, smoke);
    expect(selection).toMatchObject({ build: "tag-build", contractJob: "release-contract" });
    for (const change of [
      { soft_failed: true },
      { state: "skipped" },
      { state: "canceled" },
      { retried: true },
      { exit_status: 1 },
    ]) {
      expect(() =>
        selectReleaseArtifacts(
          {
            ...build,
            jobs: jobs.map((job) => (job.id === "release-contract" ? { ...job, ...change } : job)),
          },
          producer,
          smoke,
        ),
      ).toThrow(/release-contract/);
    }
    expect(() => selectReleaseArtifacts(build, producer, [])).toThrow(/receipt/);
    expect(() => selectReleaseArtifacts(build, producer, [...smoke, ...smoke])).toThrow(/receipt/);
  });

  test("binds tested bytes to artifact and smoke IDs, including producer retries", () => {
    const selection = selectReleaseArtifacts(build, producer, smoke);
    expect(verifyTestedTarball(selection, proof, bytes)).toBe(
      `sha512-${digest.toString("base64")}`,
    );
    for (const change of [{ smokeJob: "different-job" }, { artifact: "other-tarball" }]) {
      expect(() => verifyTestedTarball(selection, { ...proof, ...change }, bytes)).toThrow(/bind/);
    }
    expect(() => verifyTestedTarball(selection, proof, Buffer.from("altered"))).toThrow(/bind/);

    const retried = {
      ...build,
      jobs: [
        ...jobs.map((job) =>
          job.id === "quality-gate" ? Object.assign({}, job, { retried: true }) : job,
        ),
        {
          id: "quality-retry",
          step_key: "quality-gate",
          state: "passed",
          soft_failed: false,
          retried: false,
          exit_status: 0,
        },
      ],
    };
    const newArtifacts = producer.map((item) =>
      Object.assign({}, item, { job_id: "quality-retry" }),
    );
    expect(() => selectReleaseArtifacts(retried, producer, smoke)).toThrow(/another job/);
    const newSelection = selectReleaseArtifacts(retried, newArtifacts, smoke);
    expect(() => verifyTestedTarball(newSelection, proof, bytes)).toThrow(/bind/);
  });
});

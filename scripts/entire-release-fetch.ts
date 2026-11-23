import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireReleaseJobs,
  selectReleaseArtifacts,
  selectReleaseBuild,
  verifyTestedTarball,
} from "./entire-release-artifact.ts";
import {
  API,
  PIPELINE,
  assertControlContext,
  assertReadScopes,
  readBuildkite,
  type Artifact,
  type Build,
} from "./entire-release-preflight.ts";
import { MIRROR_REPOSITORY, PACKAGE, type ReleaseSource } from "./entire-release-source.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function downloadArtifact(
  build: number,
  job: string,
  artifact: string,
  token: string,
  request: typeof fetch = fetch,
): Promise<Buffer> {
  if (
    !Number.isSafeInteger(build) ||
    build <= 0 ||
    !UUID.test(job) ||
    !UUID.test(artifact) ||
    !token
  ) {
    throw new Error("Invalid Buildkite artifact identity.");
  }
  const redirect = await request(
    `${API}${PIPELINE}/builds/${build}/jobs/${job}/artifacts/${artifact}/download`,
    {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    },
  );
  const location = redirect.headers.get("location");
  if (redirect.status !== 302 || !location) throw new Error("No Buildkite artifact download URL.");
  const url = new URL(location);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !(url.hostname === "buildkiteartifacts.com" || url.hostname.endsWith(".buildkiteartifacts.com"))
  ) {
    throw new Error("Unexpected Buildkite artifact storage origin.");
  }
  const response = await request(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.body) throw new Error("Buildkite artifact download failed.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 4 * 1024 * 1024) throw new Error("Buildkite artifact exceeds the download limit.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function list<T extends { id: string }>(
  path: string,
  query: URLSearchParams,
  token: string,
): Promise<T[]> {
  const results = new Map<string, T>();
  query.set("per_page", "100");
  const collect = async (page: number): Promise<T[]> => {
    if (page > 20) throw new Error("Buildkite result set exceeds the inspection limit.");
    query.set("page", String(page));
    // Sequential requests preserve the ordering supplied by Buildkite.
    const entries = await readBuildkite(`${path}?${query}`, token);
    if (!Array.isArray(entries)) throw new Error("Invalid Buildkite list response.");
    for (const entry of entries as T[]) {
      if (!entry?.id || results.has(entry.id)) throw new Error("Unstable Buildkite list result.");
      results.set(entry.id, entry);
    }
    return entries.length < 100 ? [...results.values()] : collect(page + 1);
  };
  return collect(1);
}

export function verifyPackage(
  candidate: ReleaseSource,
  bytes: Buffer,
  metadataJson: Buffer,
  integrity: string,
): void {
  const metadata = JSON.parse(metadataJson.toString("utf8"));
  const target = candidate.tag.startsWith("npm-") ? "npm" : "both";
  if (
    metadata?.tag !== candidate.tag ||
    metadata.sha !== candidate.commit ||
    metadata.target !== target ||
    metadata.version !== candidate.version ||
    metadata.integrity !== integrity
  ) {
    throw new Error("Buildkite release metadata does not match the candidate and tarball.");
  }
  const manifest = JSON.parse(
    execFileSync("tar", ["-xzOf", "-", "package/package.json"], {
      input: bytes,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 65_536,
    }),
  );
  if (
    manifest?.name !== PACKAGE ||
    manifest.version !== candidate.version ||
    manifest.private === true ||
    manifest.repository?.url !== MIRROR_REPOSITORY
  ) {
    throw new Error("Packed npm manifest does not match the candidate.");
  }
}

async function inspectArtifacts(candidate: ReleaseSource, token: string): Promise<void> {
  assertReadScopes(await readBuildkite("/access-token", token));
  const build = selectReleaseBuild(
    await list<Build>(`${PIPELINE}/builds`, new URLSearchParams({ branch: candidate.tag }), token),
    candidate,
  );
  const { producer, smokeJob } = requireReleaseJobs(build);
  const artifacts = (job: string) =>
    list<Artifact>(
      `${PIPELINE}/builds/${build.number}/jobs/${encodeURIComponent(job)}/artifacts`,
      new URLSearchParams(),
      token,
    );
  const [producerArtifacts, smokeArtifacts] = await Promise.all([
    artifacts(producer),
    artifacts(smokeJob),
  ]);
  const selected = selectReleaseArtifacts(build, producerArtifacts, smokeArtifacts);
  const download = ({ job, id }: { job: string; id: string }) =>
    downloadArtifact(build.number, job, id, token);
  const [bytes, meta, proof] = await Promise.all([
    download(selected.tarball),
    download(selected.metadata),
    download({ job: smokeJob, id: selected.receipt.id }),
  ]);
  const integrity = verifyTestedTarball(selected, JSON.parse(proof.toString("utf8")), bytes);
  verifyPackage(candidate, bytes, meta, integrity);
  const receipt = {
    ...candidate,
    build: build.number,
    buildId: build.id,
    producerJob: selected.producer,
    smokeJob: selected.smokeJob,
    contractJob: selected.contractJob,
    artifact: selected.tarball.id,
    integrity,
  };
  const output = process.env.RELEASE_OUTPUT;
  if (output) {
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, "forgix.tgz"), bytes, { flag: "wx" });
    writeFileSync(join(output, "evidence.json"), JSON.stringify(receipt) + "\n", { flag: "wx" });
  }
  console.log(JSON.stringify(receipt));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await (async () => {
    assertControlContext(process.env, true);
    const input = process.env.RELEASE_SOURCE;
    if (!input) return;
    await inspectArtifacts(JSON.parse(input), process.env.BUILDKITE_READ_TOKEN ?? "");
  })().catch(() => {
    console.error(
      "Read-only release artifact verification failed. Nothing was exported or published.",
    );
    process.exitCode = 1;
  });
}

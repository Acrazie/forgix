// Read-only control-plane checks. Never execute or publish candidate source.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REMOTE = "entire://aws-eu-central-1.entire.io/et/forgix/forgix";
const API = "https://api.buildkite.com/v2";
const PIPELINE = "/organizations/acrazie/pipelines/forgix";
const TAG = "npm-v4.0.0";
const SHA = /^[0-9a-f]{40}$/;

class PreflightError extends Error {}

interface TagIdentity {
  tagObject: string;
  commit: string;
}
interface Build {
  id: string;
  number: number;
  source: string;
  branch: string;
  commit: string;
  state: string;
  pipeline: { repository: string };
  pull_request?: { id?: number | null };
  jobs: {
    id: string;
    step_key?: string;
    state: string;
    soft_failed?: boolean;
    retried?: boolean;
  }[];
}
interface Artifact {
  id: string;
  job_id: string;
  path: string;
}

export function assertControlContext(env: NodeJS.ProcessEnv): void {
  if (
    env.GITHUB_REPOSITORY !== "Acrazie/forgix" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_WORKFLOW_REF !==
      "Acrazie/forgix/.github/workflows/publish-entire-npm.yml@refs/heads/main" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_RUN_ATTEMPT !== "1"
  ) {
    throw new PreflightError(
      "Preflight requires a new manual run of the control workflow on main.",
    );
  }
}

export function parseTag(output: string): TagIdentity {
  const refs = output
    .trim()
    .split("\n")
    .map((line) => line.split(/\s+/));
  const direct = refs.filter(([, ref]) => ref === `refs/tags/${TAG}`);
  const peeled = refs.filter(([, ref]) => ref === `refs/tags/${TAG}^{}`);
  const tagObject = direct[0]?.[0] ?? "";
  const commit = peeled[0]?.[0] ?? "";
  if (
    refs.length !== 2 ||
    direct.length !== 1 ||
    peeled.length !== 1 ||
    !SHA.test(tagObject) ||
    !SHA.test(commit) ||
    tagObject === commit
  ) {
    throw new PreflightError("Expected one annotated canonical witness tag and its peeled commit.");
  }
  return { tagObject, commit };
}

export function assertReadScopes(value: unknown, now = Date.now()): void {
  const token = value as { scopes?: string[]; expires_at?: string } | null;
  const scopes = token?.scopes;
  const expiry = Date.parse(token?.expires_at ?? "");
  if (
    !Array.isArray(scopes) ||
    !scopes.includes("read_builds") ||
    !scopes.includes("read_artifacts") ||
    scopes.some((scope) => !["read_builds", "read_artifacts"].includes(scope)) ||
    !Number.isFinite(expiry) ||
    expiry <= now
  ) {
    throw new PreflightError(
      "Buildkite token must be unexpired and limited to read_builds/read_artifacts.",
    );
  }
}

export async function readBuildkite(
  path: string,
  token: string,
  request: typeof fetch = fetch,
): Promise<unknown> {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..") || !token) {
    throw new PreflightError("Invalid Buildkite API request.");
  }
  const response = await request(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new PreflightError(`Buildkite read failed: HTTP ${response.status}.`);
  return response.json();
}

export function assertWitnesses(branch: Build, tag: Build, identity: TagIdentity): void {
  for (const build of [branch, tag]) {
    if (
      build.source !== "webhook" ||
      build.pull_request?.id ||
      ![REMOTE, "https://entire.com/et/forgix/forgix"].includes(build.pipeline?.repository) ||
      !Array.isArray(build.jobs)
    ) {
      throw new PreflightError("Witness is not a canonical Entire webhook build.");
    }
  }
  if (
    branch.number !== 81 ||
    branch.branch !== "main" ||
    branch.commit !== identity.commit ||
    tag.number !== 82 ||
    tag.branch !== TAG ||
    tag.commit !== identity.tagObject
  ) {
    throw new PreflightError(
      "Buildkite witnesses do not bind the branch and exact annotated tag object.",
    );
  }
}

async function inspectBuildkite(identity: TagIdentity): Promise<void> {
  const token = process.env.BUILDKITE_READ_TOKEN ?? "";
  assertReadScopes(await readBuildkite("/access-token", token));
  const branch = (await readBuildkite(`${PIPELINE}/builds/81`, token)) as Build;
  const tag = (await readBuildkite(`${PIPELINE}/builds/82`, token)) as Build;
  assertWitnesses(branch, tag, identity);
  const producers = tag.jobs.filter((job) => job.step_key === "quality-gate" && !job.retried);
  if (producers.length !== 1 || producers[0]?.state !== "passed" || producers[0].soft_failed) {
    throw new PreflightError(
      "Witness must have one successful, non-soft-failed quality-gate attempt.",
    );
  }
  const producer = producers[0];
  const artifacts = (await readBuildkite(
    `${PIPELINE}/builds/82/jobs/${encodeURIComponent(producer.id)}/artifacts?per_page=100`,
    token,
  )) as Artifact[];
  const selected = selectWitnessArtifacts(artifacts, producer.id);
  console.log(
    JSON.stringify(
      {
        publicationEnabled: false,
        tag: TAG,
        ...identity,
        branchWitness: { number: branch.number, id: branch.id, state: branch.state },
        tagWitness: { number: tag.number, id: tag.id, state: tag.state },
        artifacts: selected,
      },
      null,
      2,
    ),
  );
}

export function selectWitnessArtifacts(artifacts: Artifact[], job: string) {
  if (!Array.isArray(artifacts)) throw new PreflightError("Invalid Buildkite artifact response.");
  return [".artifacts/forgix.tgz", ".artifacts/release.json"].map((path) => {
    const matches = artifacts.filter((artifact) => artifact.path === path);
    if (matches.length !== 1 || matches[0]?.job_id !== job || !matches[0].id) {
      throw new PreflightError(
        "Witness artifact is missing, ambiguous, or belongs to another job.",
      );
    }
    return { id: matches[0].id, job, path };
  });
}

async function main(): Promise<void> {
  assertControlContext(process.env);
  if (process.argv[2] === "source") {
    if (!process.env.ENTIRE_TOKEN || !process.env.GITHUB_OUTPUT) {
      throw new PreflightError("Source check requires Entire OIDC and GitHub job outputs.");
    }
    const identity = parseTag(
      execFileSync(
        "git",
        ["ls-remote", "--tags", REMOTE, `refs/tags/${TAG}`, `refs/tags/${TAG}^{}`],
        { encoding: "utf8", timeout: 30_000 },
      ),
    );
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `tag-object=${identity.tagObject}\ncommit=${identity.commit}\n`,
    );
    console.log("Canonical annotated witness tag resolved; no source exported.");
  } else if (process.argv[2] === "buildkite") {
    const tagObject = process.env.WITNESS_TAG_OBJECT ?? "";
    const commit = process.env.WITNESS_COMMIT ?? "";
    if (!SHA.test(tagObject) || !SHA.test(commit) || tagObject === commit) {
      throw new PreflightError("Missing canonical witness identities.");
    }
    await inspectBuildkite({ tagObject, commit });
  } else {
    throw new PreflightError("Usage: node scripts/entire-release-preflight.ts <source|buildkite>");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error: unknown) => {
    // Third-party errors may contain credentials: do not forward their bodies or URLs.
    console.error(
      error instanceof PreflightError
        ? error.message
        : "Release preflight failed. No third-party error body logged; no publication attempted.",
    );
    process.exitCode = 1;
  });
}

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertControlContext } from "./entire-release-preflight.ts";
import { readReleaseApproval, type ReleaseSource } from "./entire-release-source.ts";

export const GITHUB = "https://github.com/Acrazie/forgix";
export const INTENTS = "refs/heads/npm-release-intents";
const SHA = /^[0-9a-f]{40}$/;

export interface ReleaseEvidence extends ReleaseSource {
  integrity: string;
  build: number;
  buildId: string;
  producerJob: string;
  smokeJob: string;
  contractJob: string;
  artifact: string;
}

export interface Intent {
  evidence: ReleaseEvidence;
  control: string;
  run: string;
  attempt: "1";
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 90_000,
  }).trim();
}

export function evidenceKey(evidence: ReleaseEvidence): string {
  return JSON.stringify([
    evidence.version,
    evidence.tag,
    evidence.tagObject,
    evidence.commit,
    evidence.integrity,
    evidence.build,
    evidence.buildId,
    evidence.producerJob,
    evidence.smokeJob,
    evidence.contractJob,
    evidence.artifact,
  ]);
}

export function releaseInputs(controlDir: string, artifactDir: string) {
  assertControlContext(process.env, true);
  if (process.env.PUBLISH_ENABLED !== "true")
    throw new Error("The production publisher is disabled.");
  const control = process.env.GITHUB_SHA ?? "";
  const run = process.env.GITHUB_RUN_ID ?? "";
  const approval = readReleaseApproval(controlDir, control);
  if (!approval || !/^[1-9]\d*$/.test(run))
    throw new Error("Missing approved release or invocation.");
  const path = join(artifactDir, "forgix.tgz");
  const evidence = JSON.parse(
    readFileSync(join(artifactDir, "evidence.json"), "utf8"),
  ) as ReleaseEvidence;
  const integrity = `sha512-${createHash("sha512").update(readFileSync(path)).digest("base64")}`;
  if (
    evidence.tag !== approval.tag ||
    evidence.version !== approval.version ||
    evidence.tagObject !== approval.tagObject ||
    evidence.commit !== approval.commit ||
    evidence.integrity !== integrity ||
    !Number.isSafeInteger(evidence.build) ||
    evidence.build < 1 ||
    ![
      evidence.buildId,
      evidence.producerJob,
      evidence.smokeJob,
      evidence.contractJob,
      evidence.artifact,
    ].every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id))
  )
    throw new Error("Tarball evidence does not match the approval and downloaded bytes.");
  const intent: Intent = { evidence, control, run, attempt: "1" };
  return { path, intent };
}

export function readIntent(repo: string, input: Intent): Intent | null {
  const path = `intents/${input.evidence.version}.json`;
  const history = git(repo, "log", "--format=%H", "HEAD", "--", path);
  if (!history) return null;
  if (!SHA.test(history)) throw new Error("Durable release intent has been modified.");
  const intent = JSON.parse(git(repo, "show", `HEAD:${path}`)) as Intent;
  if (
    evidenceKey(intent.evidence) !== evidenceKey(input.evidence) ||
    !SHA.test(intent.control) ||
    !/^[1-9]\d*$/.test(intent.run) ||
    intent.attempt !== "1"
  )
    throw new Error("Durable release intent does not match checked release bytes.");
  return intent;
}

export function provenanceInvocation(intent: Intent): string {
  return `${GITHUB}/actions/runs/${intent.run}/attempts/${intent.attempt}`;
}

export function assertNoUnresolvedVersion(repo: string, version: string): void {
  const history = git(repo, "log", "--format=", "--name-only", "HEAD", "--", "intents/");
  for (const path of new Set(history.split("\n").filter(Boolean))) {
    const id = /^intents\/(\d+\.\d+\.\d+)\.json$/.exec(path)?.[1];
    if (!id || !SHA.test(git(repo, "log", "--format=%H", "HEAD", "--", path))) {
      throw new Error("An older intent was modified.");
    }
    if (id === version) continue;
    const confirmation = `confirmations/${id}.json`;
    if (!SHA.test(git(repo, "log", "--format=%H", "HEAD", "--", confirmation))) {
      throw new Error("Reconcile the previous release before opening another intent.");
    }
    const old = JSON.parse(git(repo, "show", `HEAD:${path}`)) as Intent;
    const proof = JSON.parse(git(repo, "show", `HEAD:${confirmation}`));
    if (
      proof?.invocation !== provenanceInvocation(old) ||
      proof.integrity !== old.evidence.integrity
    ) {
      throw new Error("An older confirmation does not match its intent.");
    }
  }
}

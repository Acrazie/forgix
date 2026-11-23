import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import {
  assertControlContext,
  assertReadScopes,
  assertWitnesses,
  parseTag,
  readBuildkite,
  selectWitnessArtifacts,
} from "../scripts/entire-release-preflight.ts";

const commit = "a".repeat(40);
const tagObject = "b".repeat(40);
const tag = "npm-v4.0.0";
const refOutput = `${tagObject}\trefs/tags/${tag}\n${commit}\trefs/tags/${tag}^{}\n`;
const context = {
  GITHUB_REPOSITORY: "Acrazie/forgix",
  GITHUB_REF: "refs/heads/main",
  GITHUB_WORKFLOW_REF: "Acrazie/forgix/.github/workflows/publish-entire-npm.yml@refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_RUN_ATTEMPT: "1",
};
const tokenMetadata = {
  scopes: ["read_builds", "read_artifacts"],
  expires_at: "2026-12-01T00:00:00Z",
};
const now = Date.parse("2026-11-23T00:00:00Z");
const repository = "entire://aws-eu-central-1.entire.io/et/forgix/forgix";
const branchWitness = {
  id: "branch-build",
  number: 81,
  source: "webhook",
  branch: "main",
  commit,
  state: "passed",
  pipeline: { repository },
  jobs: [],
};
const tagWitness = {
  ...branchWitness,
  id: "tag-build",
  number: 82,
  branch: tag,
  commit: tagObject,
  state: "failed",
};

describe("Entire release control preflight", () => {
  test("requires unique artifacts bound to the exact producer job", () => {
    const artifacts = [".artifacts/forgix.tgz", ".artifacts/release.json"].map((path, index) => ({
      id: String(index + 1),
      job_id: "producer",
      path,
    }));
    expect(selectWitnessArtifacts(artifacts, "producer")).toHaveLength(2);
    expect(() => selectWitnessArtifacts(artifacts, "other-attempt")).toThrow(/another job/);
    expect(() => selectWitnessArtifacts(artifacts.slice(1), "producer")).toThrow(/missing/);
    expect(() => selectWitnessArtifacts([...artifacts, artifacts[0]], "producer")).toThrow(
      /ambiguous/,
    );
  });

  test("allows only a fresh dispatch of the exact main control workflow", () => {
    expect(() => assertControlContext(context)).not.toThrow();
    for (const [key, value] of Object.entries({
      GITHUB_REPOSITORY: "attacker/forgix",
      GITHUB_REF: "refs/heads/feature",
      GITHUB_WORKFLOW_REF: context.GITHUB_WORKFLOW_REF.replace("main", "feature"),
      GITHUB_EVENT_NAME: "pull_request_target",
      GITHUB_RUN_ATTEMPT: "2",
    })) {
      expect(() => assertControlContext({ ...context, [key]: value })).toThrow(/new manual run/);
    }
  });

  test("requires the exact annotated witness tag, not only its commit", () => {
    expect(parseTag(refOutput)).toEqual({ tagObject, commit });
    for (const output of [
      `${commit}\trefs/tags/${tag}\n`,
      refOutput.replace(tagObject, commit),
      refOutput + refOutput,
      refOutput.replace(tag, "npm-v4.0.1"),
      refOutput.replace(commit, "not-a-sha"),
    ]) {
      expect(() => parseTag(output)).toThrow(/annotated canonical witness/);
    }
  });

  test("requires bounded read-only token scopes and a future expiry", () => {
    expect(() => assertReadScopes(tokenMetadata, now)).not.toThrow();
    for (const metadata of [
      null,
      { ...tokenMetadata, scopes: ["read_builds"] },
      { ...tokenMetadata, scopes: [...tokenMetadata.scopes, "write_builds"] },
      { ...tokenMetadata, scopes: [...tokenMetadata.scopes, "read_user"] },
      { ...tokenMetadata, expires_at: null },
      { ...tokenMetadata, expires_at: "2026-11-22T00:00:00Z" },
    ]) {
      expect(() => assertReadScopes(metadata, now)).toThrow(/unexpired and limited/);
    }
  });

  test("binds server webhook metadata to the exact Entire tag object", () => {
    expect(() => assertWitnesses(branchWitness, tagWitness, { tagObject, commit })).not.toThrow();
    for (const witness of [
      { ...tagWitness, source: "api" },
      { ...tagWitness, commit },
      { ...tagWitness, branch: "main" },
      { ...tagWitness, pull_request: { id: 1 } },
      { ...tagWitness, pipeline: { repository: "https://github.com/Acrazie/forgix" } },
    ]) {
      expect(() => assertWitnesses(branchWitness, witness, { tagObject, commit })).toThrow();
    }
    // The known tag build failed. This is diagnostic evidence, never permission to publish.
    expect(tagWitness.state).toBe("failed");
  });

  test("reads only the fixed API origin, refuses redirects, and does not log response bodies", async () => {
    let called = false;
    const request = (async (url, options) => {
      called = true;
      expect(url).toBe("https://api.buildkite.com/v2/access-token");
      expect(options?.redirect).toBe("error");
      expect(options?.headers).toEqual({
        Authorization: "Bearer fixture",
        Accept: "application/json",
      });
      return Response.json(tokenMetadata);
    }) as typeof fetch;
    expect(await readBuildkite("/access-token", "fixture", request)).toEqual(tokenMetadata);
    expect(called).toBe(true);
    await Promise.all(
      ["https://attacker.invalid", "//attacker.invalid", "/../access-token"].map((path) =>
        expect(readBuildkite(path, "fixture", request)).rejects.toThrow(/Invalid/),
      ),
    );
    const denied = (async () => new Response("secret-body", { status: 403 })) as typeof fetch;
    await expect(readBuildkite("/access-token", "fixture", denied)).rejects.toThrow(
      "Buildkite read failed: HTTP 403.",
    );
  });

  test("requires protected main for a fresh approval run, not arbitrary pushes or reruns", () => {
    const approved = { ...context, GITHUB_EVENT_NAME: "push", GITHUB_REF_PROTECTED: "true" };
    expect(() => assertControlContext(approved, true)).not.toThrow();
    expect(() =>
      assertControlContext({ ...approved, GITHUB_REF_PROTECTED: "false" }, true),
    ).toThrow(/protected main/);
    expect(() => assertControlContext({ ...approved, GITHUB_RUN_ATTEMPT: "2" }, true)).toThrow(
      /protected main/,
    );
    expect(() =>
      assertControlContext({ ...approved, GITHUB_REF: "refs/heads/feature" }, true),
    ).toThrow(/protected main/);
    expect(() => assertControlContext(approved)).toThrow(/manual run/);
  });

  test("separates release writers from npm OIDC and keeps mutations disabled by default", () => {
    const raw = readFileSync(
      new URL("../.github/workflows/publish-entire-npm.yml", import.meta.url),
      "utf8",
    );
    const workflow = parse(raw);
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch", "push"]);
    expect(workflow.on.push).toEqual({ branches: ["main"], paths: ["release/entire-npm.json"] });
    expect(workflow.jobs.source.if).toContain("github.ref_protected");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.jobs.source.permissions).toEqual({ contents: "read", "id-token": "write" });
    expect(workflow.jobs.buildkite.permissions).toEqual({ contents: "read" });
    expect(workflow.jobs.source.environment).toBe("entire-release-read");
    expect(workflow.jobs.buildkite.environment).toBe("entire-release-read");
    for (const name of ["export-source", "record", "npm"]) {
      expect(workflow.jobs[name].if).toContain("vars.ENTIRE_NPM_PUBLISH_ENABLED == 'true'");
    }
    expect(workflow.jobs["export-source"].needs).toEqual(["source", "buildkite"]);
    expect(workflow.jobs.record.needs).toEqual(["source", "export-source"]);
    expect(workflow.jobs.recheck.needs).toBe("record");
    expect(workflow.jobs.npm.needs).toBe("recheck");
    expect(workflow.jobs.confirm.needs).toBe("npm");
    for (const job of [workflow.jobs.record, workflow.jobs.confirm]) {
      expect(job.permissions).toEqual({ contents: "read" });
      expect(job.environment).toBe("entire-release-write");
    }
    expect(raw).not.toContain("${{ github.token }}");
    expect(workflow.jobs.npm.permissions).toEqual({ contents: "read", "id-token": "write" });
    expect(workflow.jobs.npm.environment).toBe("npm-release");
    const publisher = JSON.stringify(workflow.jobs.npm);
    expect(publisher).not.toMatch(
      /secrets|NPM_TOKEN|ENTIRE_TOKEN|BUILDKITE_READ_TOKEN|ENTIRE_RELEASE_APP/,
    );
    const source = readFileSync(
      new URL("../scripts/entire-release-preflight.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/"POST"|"PUT"|"DELETE"|"PATCH"/);
  });

  test("mints scoped GitHub App tokens only in writer jobs and an isolated no-write probe", () => {
    const workflow = parse(
      readFileSync(new URL("../.github/workflows/publish-entire-npm.yml", import.meta.url), "utf8"),
    );
    const appJobs = Object.entries(workflow.jobs).flatMap(([name, job]) => {
      const typedJob = job as {
        environment?: string;
        steps?: { uses?: string; id?: string; with?: object }[];
      };
      const app =
        typedJob.steps?.filter((step) =>
          step.uses?.startsWith("actions/create-github-app-token@"),
        ) ?? [];
      if (app.length === 0) return [];
      expect(typedJob.environment).toBe("entire-release-write");
      expect(app).toHaveLength(1);
      expect(app[0]?.uses).toMatch(/@\w{40}$/);
      expect(app[0]?.id).toBe("writer");
      expect(app[0]?.with).toEqual({
        "client-id": "${{ vars.ENTIRE_RELEASE_APP_CLIENT_ID }}",
        "private-key": "${{ secrets.ENTIRE_RELEASE_APP_PRIVATE_KEY }}",
        owner: "Acrazie",
        repositories: "forgix",
        "permission-contents": "write",
      });
      return [name];
    });
    expect(appJobs).toEqual(["verify-writer", "record", "confirm"]);
    expect(workflow.on.workflow_dispatch.inputs.verify_writer).toMatchObject({
      type: "boolean",
      default: false,
    });
    expect(workflow.jobs.source.if).toContain("!inputs.verify_writer");
    const probe = workflow.jobs["verify-writer"];
    expect(probe.permissions).toEqual({});
    expect(probe.if).toContain("github.ref_protected");
    expect(probe.if).toContain("github.run_attempt == 1");
    expect(probe.if).toContain("inputs.verify_writer");
    expect(JSON.stringify(probe)).toContain("gh api --method GET /installation/repositories");
    expect(JSON.stringify(probe)).not.toMatch(/git push|npm publish|actions\/checkout/);
  });
});

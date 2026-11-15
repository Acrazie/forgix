import { validateVersions } from "../plugins/forgix/scripts/release-lib.ts";
import { readFileSync, cpSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { parse } from "yaml";
import {
  assertContext,
  assertUniqueNpmTag,
  registryVersion,
  verifyAudit,
} from "../scripts/release-ci.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const release = parse(read(".github/workflows/release.yml"));
const ci = parse(read(".github/workflows/ci.yml"));
const request = (response: Response) => (async () => response) as typeof fetch;
const sha = "a".repeat(40);
const evidence = {
  tag: "v2.0.0",
  sha,
  target: "both" as const,
  version: "2.0.0",
  pluginVersion: "2.0.0+codex.20261115120000",
  integrity: `sha512-${Buffer.from("digest").toString("base64")}`,
  notesSha256: "n",
};
const env = {
  GITHUB_REPOSITORY: "Acrazie/forgix",
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF: "refs/tags/v2.0.0",
  GITHUB_SHA: sha,
  GITHUB_WORKFLOW_REF: "Acrazie/forgix/.github/workflows/release.yml@refs/tags/v2.0.0",
};

function audit() {
  const statement = {
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [
      {
        name: "pkg:npm/%40acrasie/forgix@2.0.0",
        digest: { sha512: Buffer.from("digest").toString("hex") },
      },
    ],
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            repository: "https://github.com/Acrazie/forgix",
            ref: "refs/tags/v2.0.0",
            path: ".github/workflows/release.yml",
          },
        },
        resolvedDependencies: [
          {
            uri: "git+https://github.com/Acrazie/forgix@refs/tags/v2.0.0",
            digest: { gitCommit: sha },
          },
        ],
      },
    },
  };
  const result = (payload = statement) => ({
    invalid: [],
    missing: [],
    verified: [
      {
        name: "@acrasie/forgix",
        version: "2.0.0",
        attestationBundles: [
          {
            predicateType: statement.predicateType,
            bundle: {
              dsseEnvelope: { payload: Buffer.from(JSON.stringify(payload)).toString("base64") },
            },
          },
        ],
      },
    ],
  });
  return { statement, result };
}

describe("release trust and reconciliation contracts", () => {
  test("requires exact source, workflow, repo and tag for push or manual retry", () => {
    expect(() => assertContext("v2.0.0", sha, env)).not.toThrow();
    expect(() =>
      assertContext("v2.0.0", sha, { ...env, GITHUB_EVENT_NAME: "workflow_dispatch" }),
    ).not.toThrow();
    for (const change of [
      { GITHUB_REPOSITORY: "fork/forgix" },
      { GITHUB_REF: "refs/heads/main" },
      { GITHUB_REF: "refs/tags/v1.0.0" },
      { GITHUB_SHA: "b".repeat(40) },
      { GITHUB_EVENT_NAME: "pull_request" },
      { GITHUB_WORKFLOW_REF: "Acrazie/forgix/.github/workflows/ci.yml@refs/tags/v2.0.0" },
    ])
      expect(() => assertContext("v2.0.0", sha, { ...env, ...change })).toThrow();
  });
  test("refuses another family's ownership even if publication bytes would match", () => {
    expect(() => assertUniqueNpmTag("v2.0.0", ["v1.0.0", "v2.0.0"])).not.toThrow();
    expect(() => assertUniqueNpmTag("v2.0.0", ["npm-v2.0.0"])).toThrow(/owns/);
    expect(() => assertUniqueNpmTag("npm-v2.0.0", ["forgix-v2.0.0"])).toThrow(/owns/);
  });
  test("only 404 means absent npm version; invalid metadata and outages block", async () => {
    expect(await registryVersion("2.0.0", request(new Response("", { status: 404 })))).toBeNull();
    await Promise.all(
      [401, 403, 429, 500].map((status) =>
        expect(registryVersion("2.0.0", request(new Response("", { status })))).rejects.toThrow(
          /HTTP/,
        ),
      ),
    );
    await expect(
      registryVersion("2.0.0", request(Response.json({ name: "wrong", version: "2.0.0" }))),
    ).rejects.toThrow(/metadata/);
    expect(
      await registryVersion(
        "2.0.0",
        request(
          Response.json({
            name: "@acrasie/forgix",
            version: "2.0.0",
            dist: { integrity: "sha512-x" },
          }),
        ),
      ),
    ).not.toBeNull();
  });
  test("verified signatures alone never substitute for source-bound provenance", () => {
    const { statement, result } = audit();
    expect(() => verifyAudit(result(), evidence)).not.toThrow();
    expect(() => verifyAudit({ ...result(), verified: [] }, evidence)).toThrow(/provenance/);
    expect(() => verifyAudit({ ...result(), invalid: ["bad signature"] }, evidence)).toThrow(
      /signature/,
    );
    expect(() => verifyAudit(result(), { ...evidence, sha: "b".repeat(40) })).toThrow(/provenance/);
    expect(() => verifyAudit(result(), { ...evidence, tag: "npm-v2.0.0" })).toThrow(/provenance/);
    expect(() => verifyAudit(result(), { ...evidence, integrity: "sha512-ZGlmZmVyZW50" })).toThrow(
      /provenance/,
    );
    statement.predicate.buildDefinition.externalParameters.workflow.repository =
      "https://github.com/fork/forgix";
    expect(() => verifyAudit(result(statement), evidence)).toThrow(/provenance/);
  });
  test("validates all plugin manifests even for npm-only releases", () => {
    const root = mkdtempSync(join(tmpdir(), "forgix-release-manifests-"));
    try {
      for (const path of [
        "plugins/forgix/package.json",
        "plugins/forgix/.codex-plugin/plugin.json",
        "plugins/forgix/.claude-plugin/plugin.json",
        "plugins/forgix/plugin.json",
        ".claude-plugin/marketplace.json",
      ]) {
        mkdirSync(join(root, path, ".."), { recursive: true });
        cpSync(new URL(`../${path}`, import.meta.url), join(root, path));
      }
      expect(validateVersions(root, "npm-v1.0.1")).toMatch(/^1\.0\.1/);
      expect(() => validateVersions(root, "npm-v2.0.0")).toThrow(/npm manifest/);
      expect(() => validateVersions(root, "plugin-v1.0.1-codex.20261115120000")).toThrow(
        /plugin manifests/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("release workflow privilege boundaries", () => {
  test("serializes all tag families without cancelling active publications", () => {
    expect(release.on.push.tags).toEqual(["v*", "npm-v*", "plugin-v*"]);
    expect(release.concurrency).toEqual({
      group: "forgix-release",
      queue: "max",
      "cancel-in-progress": false,
    });
    expect(release.permissions).toEqual({ contents: "read" });
    expect(ci.on.workflow_call.inputs["release-tag"].default).toBe("");
  });
  test("only npm job gets OIDC and only GitHub job gets contents write", () => {
    expect(release.jobs.npm.environment).toBe("release");
    expect(release.jobs.npm.permissions).toEqual({ contents: "read", "id-token": "write" });
    expect(release.jobs.github.permissions).toEqual({ contents: "write" });
    expect(release.jobs.mirror.permissions).toEqual({ contents: "read", packages: "write" });
    expect(release.jobs.validate.uses).toBe("./.github/workflows/ci.yml");
    expect(release.jobs.mirror.with.versions).toBe("${{ needs.source.outputs.version }}");
    expect(release.jobs.github.if).toContain("needs.validate.result == 'success'");
    for (const name of ["npm", "github"]) {
      const job = release.jobs[name];
      expect(job.steps.some((s: { run?: string }) => s.run?.includes("bun install"))).toBe(false);
      expect(job.steps.some((s: { run?: string }) => s.run?.includes("run check"))).toBe(false);
      const checkout = job.steps.find((s: { uses?: string }) =>
        s.uses?.startsWith("actions/checkout@"),
      );
      expect(checkout.with["persist-credentials"]).toBe(false);
      expect(checkout.with.ref).toBe("${{ needs.source.outputs.sha }}");
    }
    expect(read(".github/workflows/release.yml")).not.toContain("NODE_AUTH_TOKEN");
    expect(read("plugins/forgix/scripts/release.ts")).not.toMatch(/run\("(?:git|gh)",/);
  });
  test("pins tools and promotes only the validated same-run artifact", () => {
    for (const job of Object.values(release.jobs) as { steps?: { uses?: string }[] }[])
      for (const step of job.steps ?? [])
        if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
    const steps = ci.jobs["quality-gate"].steps;
    expect(
      steps.find((s: { uses?: string }) => s.uses?.startsWith("orhun/git-cliff-action@")).with
        .version,
    ).toBe("v2.14.1");
    expect(steps.some((s: { run?: string }) => s.run?.includes("git diff --exit-code"))).toBe(true);
    expect(read("scripts/release-ci.ts")).toContain('"--ignore-scripts"');
    expect(read("scripts/release-ci.ts")).toContain("Refusing to regress npm latest");
    expect(release.jobs.summary.if).toBe("always()");
  });
});

import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadArtifact, verifyPackage } from "../scripts/entire-release-fetch.ts";
import { MIRROR_REPOSITORY, PACKAGE } from "../scripts/entire-release-source.ts";

const job = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const asset = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const json = (value: object) => Buffer.from(JSON.stringify(value));

test("downloads the exact artifact without forwarding the API credential", async () => {
  const target = "https://buildkiteartifacts.com/artifacts/fixture";
  const request = (async (input, options) => {
    if (input instanceof URL && input.href === target) {
      expect(options?.headers).toBeUndefined();
      expect(options?.redirect).toBe("error");
      return new Response("tested bytes");
    }
    expect(input).toBe(
      `https://api.buildkite.com/v2/organizations/acrazie/pipelines/forgix/builds/100/jobs/${job}/artifacts/${asset}/download`,
    );
    expect(options?.headers).toEqual({ Authorization: "Bearer fixture" });
    expect(options?.redirect).toBe("manual");
    return Response.redirect(target, 302);
  }) as typeof fetch;
  expect((await downloadArtifact(100, job, asset, "fixture", request)).toString()).toBe(
    "tested bytes",
  );
  const foreign = (async () =>
    Response.redirect("https://example.invalid/object", 302)) as typeof fetch;
  await expect(downloadArtifact(100, job, asset, "fixture", foreign)).rejects.toThrow(
    /storage origin/,
  );
  await expect(downloadArtifact(100, "../other", asset, "fixture", request)).rejects.toThrow(
    /identity/,
  );
});

test("reads the manifest from the exact archive and checks release metadata", () => {
  const dir = mkdtempSync(join(tmpdir(), "entire-release-test-"));
  try {
    const candidate = {
      tag: "npm-v4.0.1",
      version: "4.0.1",
      tagObject: "a".repeat(40),
      commit: "b".repeat(40),
    };
    const fixture = {
      name: PACKAGE,
      version: candidate.version,
      repository: { url: MIRROR_REPOSITORY },
    };
    mkdirSync(join(dir, "package"));
    const pack = (manifest: object) => {
      writeFileSync(join(dir, "package/package.json"), JSON.stringify(manifest));
      return execFileSync("tar", ["-czf", "-", "package/package.json"], { cwd: dir });
    };
    const integrity = "sha512-fixture";
    const metadata = {
      tag: candidate.tag,
      sha: candidate.commit,
      version: candidate.version,
      target: "npm",
      integrity,
    };
    expect(() => verifyPackage(candidate, pack(fixture), json(metadata), integrity)).not.toThrow();
    expect(() =>
      verifyPackage(candidate, pack(fixture), json({ ...metadata, sha: "" }), integrity),
    ).toThrow(/metadata/);
    expect(() =>
      verifyPackage(candidate, pack({ ...fixture, name: "other" }), json(metadata), integrity),
    ).toThrow(/manifest/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

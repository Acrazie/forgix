import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertNoUnresolvedVersion,
  GITHUB,
  git,
  provenanceInvocation,
  readIntent,
  type Intent,
} from "../scripts/entire-release-intent.ts";
import { verifyPublishedProvenance } from "../scripts/entire-release-publish.ts";
import { PACKAGE } from "../scripts/entire-release-source.ts";

const digest = Buffer.alloc(64, 1);
const intent: Intent = {
  evidence: {
    tag: "v4.0.1",
    version: "4.0.1",
    tagObject: "a".repeat(40),
    commit: "b".repeat(40),
    integrity: `sha512-${digest.toString("base64")}`,
    build: 101,
    buildId: "build",
    producerJob: "producer",
    smokeJob: "smoke",
    contractJob: "contract",
    artifact: "archive",
  },
  control: "c".repeat(40),
  run: "42",
  attempt: "1",
};

test("verified npm provenance must match the durable intent's exact runner invocation and bytes", () => {
  const predicateType = "https://slsa.dev/provenance/v1";
  const statement = {
    predicateType,
    subject: [{ digest: { sha512: digest.toString("hex") } }],
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            repository: GITHUB,
            ref: "refs/heads/main",
            path: ".github/workflows/publish-entire-npm.yml",
          },
        },
        resolvedDependencies: [
          { uri: `git+${GITHUB}@refs/heads/main`, digest: { gitCommit: intent.control } },
        ],
      },
      runDetails: { metadata: { invocationId: provenanceInvocation(intent) } },
    },
  };
  const payload = Buffer.from(JSON.stringify(statement)).toString("base64");
  const audit = {
    invalid: [],
    missing: [],
    verified: [
      {
        name: PACKAGE,
        version: intent.evidence.version,
        attestationBundles: [{ predicateType, bundle: { dsseEnvelope: { payload } } }],
      },
    ],
  };
  expect(() => verifyPublishedProvenance(audit, intent)).not.toThrow();
  for (const different of [
    { ...intent, run: "43" },
    { ...intent, control: "d".repeat(40) },
    { ...intent, evidence: { ...intent.evidence, integrity: "sha512-wrong" } },
  ])
    expect(() => verifyPublishedProvenance(audit, different)).toThrow(/exact invocation/);
  expect(() => verifyPublishedProvenance({ ...audit, verified: [] }, intent)).toThrow(
    /exact invocation/,
  );
});

test("a new version waits for a durable confirmation and rejects rewritten receipts", () => {
  const cwd = mkdtempSync(join(tmpdir(), "forgix-intents-"));
  const commit = (path: string, value: object) => {
    writeFileSync(join(cwd, path), JSON.stringify(value));
    git(cwd, "add", "--", path);
    git(cwd, "-c", "commit.gpgsign=false", "commit", "-m", "test ledger");
  };
  try {
    git(cwd, "init");
    git(cwd, "config", "user.name", "Fixture");
    git(cwd, "config", "user.email", "fixture@example.invalid");
    mkdirSync(join(cwd, "intents"));
    mkdirSync(join(cwd, "confirmations"));
    commit("intents/4.0.1.json", intent);
    expect(readIntent(cwd, intent)).toEqual(intent);
    expect(() => assertNoUnresolvedVersion(cwd, "4.0.2")).toThrow(/previous release/);
    commit("confirmations/4.0.1.json", {
      invocation: provenanceInvocation(intent),
      integrity: intent.evidence.integrity,
    });
    expect(() => assertNoUnresolvedVersion(cwd, "4.0.2")).not.toThrow();
    commit("intents/4.0.1.json", { ...intent, run: "43" });
    expect(() => readIntent(cwd, intent)).toThrow(/modified/);
    expect(() => assertNoUnresolvedVersion(cwd, "4.0.2")).toThrow(/modified/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

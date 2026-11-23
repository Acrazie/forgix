import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GITHUB,
  git,
  provenanceInvocation,
  readIntent,
  releaseInputs,
  type Intent,
} from "./entire-release-intent.ts";
import { compareVersions, PACKAGE } from "./entire-release-source.ts";

const REGISTRY = "https://registry.npmjs.org";
const PROVENANCE = "https://slsa.dev/provenance/v1";
const WORKFLOW = ".github/workflows/publish-entire-npm.yml";

interface Statement {
  predicateType?: string;
  subject?: { digest?: { sha512?: string } }[];
  predicate?: {
    buildDefinition?: {
      externalParameters?: { workflow?: { repository?: string; ref?: string; path?: string } };
      resolvedDependencies?: { uri?: string; digest?: { gitCommit?: string } }[];
    };
    runDetails?: { metadata?: { invocationId?: string } };
  };
}

interface Audit {
  invalid: unknown[];
  missing: unknown[];
  verified?: {
    name: string;
    version: string;
    attestationBundles?: {
      predicateType: string;
      bundle: { dsseEnvelope: { payload: string } };
    }[];
  }[];
}

export function verifyPublishedProvenance(audit: Audit, intent: Intent): void {
  const { version, integrity } = intent.evidence;
  const digest = Buffer.from(integrity.slice("sha512-".length), "base64").toString("hex");
  const invocation = provenanceInvocation(intent);
  const verified = audit.verified?.find((p) => p.name === PACKAGE && p.version === version);
  const matches = verified?.attestationBundles?.some(({ predicateType, bundle }) => {
    if (predicateType !== PROVENANCE) return false;
    const statement = JSON.parse(
      Buffer.from(bundle.dsseEnvelope.payload, "base64").toString("utf8"),
    ) as Statement;
    const definition = statement.predicate?.buildDefinition;
    const workflow = definition?.externalParameters?.workflow;
    return (
      statement.predicateType === PROVENANCE &&
      statement.subject?.some((subject) => subject.digest?.sha512 === digest) &&
      workflow?.repository === GITHUB &&
      workflow.ref === "refs/heads/main" &&
      workflow.path === WORKFLOW &&
      definition?.resolvedDependencies?.some(
        (entry) =>
          entry.uri === `git+${GITHUB}@refs/heads/main` &&
          entry.digest?.gitCommit === intent.control,
      ) &&
      statement.predicate?.runDetails?.metadata?.invocationId === invocation
    );
  });
  if (audit.invalid.length || audit.missing.length || !matches) {
    throw new Error(
      "npm provenance does not match the durable intent's exact invocation and bytes.",
    );
  }
}

async function registry(version: string) {
  const response = await fetch(`${REGISTRY}/${encodeURIComponent(PACKAGE)}/${version}`, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404 && version !== "latest") return null;
  if (!response.ok) throw new Error("npm registry lookup failed.");
  const result = (await response.json()) as {
    name: string;
    version: string;
    dist?: { integrity?: string };
  };
  if (
    result.name !== PACKAGE ||
    !/^\d+\.\d+\.\d+$/.test(result.version) ||
    (version !== "latest" && result.version !== version)
  )
    throw new Error("Invalid npm registry identity.");
  return result;
}

function npm(cwd: string, ...args: string[]): string {
  return execFileSync("npm", [...args, `--registry=${REGISTRY}`], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
    env: { ...process.env, NPM_CONFIG_USERCONFIG: "/dev/null" },
  }).trim();
}

function assertGithubRefs(cwd: string, intent: Intent): void {
  const ref = `refs/tags/entire-source/${intent.evidence.tag}`;
  const fetch = (name: string) => git(cwd, "ls-remote", "--refs", `${GITHUB}.git`, name);
  if (
    fetch("refs/heads/main") !== `${intent.control}\trefs/heads/main` ||
    fetch(ref) !== `${intent.evidence.commit}\t${ref}`
  ) {
    throw new Error("The reviewed approval or the exact mirror ref is no longer current.");
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("Missing GitHub job output.");
  if (
    process.env.NODE_AUTH_TOKEN ||
    process.env.NPM_TOKEN ||
    !process.env.ACTIONS_ID_TOKEN_REQUEST_URL ||
    !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  )
    throw new Error("npm publishing requires OIDC only.");
  const { path, intent } = releaseInputs(cwd, resolve(process.env.RELEASE_HANDOFF ?? ""));
  assertGithubRefs(cwd, intent);
  const directory = mkdtempSync(join(tmpdir(), "forgix-npm-publisher-"));
  try {
    const ledger = join(directory, "ledger");
    git(
      cwd,
      "clone",
      "--quiet",
      "--single-branch",
      "--branch",
      "npm-release-intents",
      `${GITHUB}.git`,
      ledger,
    );
    const recorded = readIntent(ledger, intent);
    if (!recorded) throw new Error("No durable intent: refusing npm publication.");
    const { version, integrity } = intent.evidence;
    const existing = await registry(version);
    if (!existing) {
      if (recorded.run !== intent.run || recorded.control !== intent.control) {
        throw new Error("Prior unconfirmed intent. Refusing to retry automatically.");
      }
      const latest = await registry("latest");
      if (!latest || compareVersions(version, latest.version) <= 0)
        throw new Error("Refusing to regress npm latest.");
      assertGithubRefs(cwd, intent);
      npm(directory, "publish", path, "--ignore-scripts", "--provenance", "--access", "public");
    }
    if ((await registry(version))?.dist?.integrity !== integrity) {
      throw new Error("npm published integrity does not match the durable intent.");
    }
    writeFileSync(
      join(directory, "package.json"),
      '{"name":"forgix-provenance-check","version":"0.0.0","private":true}',
    );
    npm(
      directory,
      "install",
      `${PACKAGE}@${version}`,
      "--ignore-scripts",
      "--no-bin-links",
      "--no-audit",
      "--no-fund",
    );
    verifyPublishedProvenance(
      JSON.parse(npm(directory, "audit", "signatures", "--json", "--include-attestations")),
      recorded,
    );
    appendFileSync(output, `invocation=${provenanceInvocation(recorded)}\n`);
    console.log(`npm integrity and provenance verified for ${PACKAGE}@${version}.`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch(() => {
    console.error(
      "Publication could not be confirmed. Check the durable intent and registry; do not blindly retry.",
    );
    process.exitCode = 1;
  });
}

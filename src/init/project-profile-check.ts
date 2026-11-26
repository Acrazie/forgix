import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";
import { canonicalize, sha256Hex } from "../core/digest.js";
import { validateSchema } from "../core/schema.js";
import type { WorkspaceStore } from "../core/store.js";
import {
  PROJECT_PROFILE_RELATIVE_PATH,
  isRecord,
  type InitCheckFinding,
  type SafeReadResult,
} from "./shared.js";

export interface ProjectProfileCheckSummary {
  status: "ok" | "missing" | "invalid" | "stale";
  staleDecisionKeys?: string[];
  missingSourceRefs?: string[];
  domainDocumentationStale?: boolean;
}

interface SourceFingerprintRef {
  sourceRef: string;
  value: string;
}

interface DecisionFingerprints {
  key: string;
  sourceFingerprints: SourceFingerprintRef[];
}

interface ProfileCheckResult {
  summary: ProjectProfileCheckSummary;
  findings: InitCheckFinding[];
}

function extractFingerprints(raw: unknown): SourceFingerprintRef[] {
  if (!Array.isArray(raw)) return [];
  const results: SourceFingerprintRef[] = [];
  for (const item of raw) {
    if (isRecord(item) && typeof item.sourceRef === "string" && typeof item.value === "string") {
      results.push({ sourceRef: item.sourceRef, value: item.value });
    }
  }
  return results;
}

function collectProfileFingerprints(content: Record<string, unknown>): {
  decisions: DecisionFingerprints[];
  domainDoc: SourceFingerprintRef[];
  allSourceRefs: string[];
} {
  const decisions: DecisionFingerprints[] = [];
  const refSet = new Set<string>();

  if (Array.isArray(content.decisions)) {
    for (const entry of content.decisions) {
      if (!isRecord(entry) || typeof entry.key !== "string") continue;
      const fps = extractFingerprints(entry.sourceFingerprints);
      decisions.push({ key: entry.key, sourceFingerprints: fps });
      for (const fp of fps) refSet.add(fp.sourceRef);
    }
  }

  const domainDoc = isRecord(content.domainDocumentation)
    ? extractFingerprints(content.domainDocumentation.sourceFingerprints)
    : [];
  for (const fp of domainDoc) refSet.add(fp.sourceRef);

  return { decisions, domainDoc, allSourceRefs: [...refSet] };
}

async function hashWorkspaceSourceRef(
  store: WorkspaceStore,
  sourceRef: string,
): Promise<string | undefined> {
  try {
    const resolved = store.resolvePath(sourceRef);
    const rel = relative(store.workspaceRoot, resolved);
    if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return undefined;
    const prefixPaths: string[] = [];
    let cursor = store.workspaceRoot;
    for (const segment of rel.split(sep)) {
      cursor = join(cursor, segment);
      prefixPaths.push(cursor);
    }
    const stats = await Promise.all(prefixPaths.map((p) => lstat(p)));
    if (stats.some((st) => st.isSymbolicLink()) || !stats.at(-1)?.isFile()) return undefined;
    const canonical = await realpath(resolved);
    if (canonical !== resolved) return undefined;
    const bytes = await readFile(canonical);
    return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  } catch {
    return undefined;
  }
}

function evaluateFingerprintFreshness(
  decisions: readonly DecisionFingerprints[],
  domainDoc: readonly SourceFingerprintRef[],
  observedMap: ReadonlyMap<string, string | undefined>,
): {
  staleDecisionKeys: string[];
  missingSourceRefs: string[];
  domainDocumentationStale: boolean;
} {
  const staleDecisions = new Set<string>();
  const missingRefs = new Set<string>();

  for (const decision of decisions) {
    for (const fp of decision.sourceFingerprints) {
      const observed = observedMap.get(fp.sourceRef);
      if (observed === undefined) {
        missingRefs.add(fp.sourceRef);
        staleDecisions.add(decision.key);
      } else if (fp.value.startsWith("sha256:") && observed !== fp.value) {
        staleDecisions.add(decision.key);
      }
    }
  }

  let domainDocumentationStale = false;
  for (const fp of domainDoc) {
    const observed = observedMap.get(fp.sourceRef);
    if (observed === undefined) {
      missingRefs.add(fp.sourceRef);
      domainDocumentationStale = true;
    } else if (fp.value.startsWith("sha256:") && observed !== fp.value) {
      domainDocumentationStale = true;
    }
  }

  return {
    staleDecisionKeys: [...staleDecisions].toSorted(),
    missingSourceRefs: [...missingRefs].toSorted(),
    domainDocumentationStale,
  };
}

function profileFailure(
  status: "missing" | "invalid",
  code: string,
  message: string,
): { ok: false; result: ProfileCheckResult } {
  return {
    ok: false,
    result: {
      summary: { status },
      findings: [{ path: PROJECT_PROFILE_RELATIVE_PATH, code, message }],
    },
  };
}

function validateProfileIntegrity(
  parsed: Record<string, unknown>,
): { ok: true; content: Record<string, unknown> } | { ok: false; result: ProfileCheckResult } {
  const canonical = canonicalize(parsed);
  const content = isRecord(canonical.content) ? canonical.content : {};
  if (canonical.contentDigest !== sha256Hex(content)) {
    return profileFailure(
      "invalid",
      "project_profile_invalid",
      `${PROJECT_PROFILE_RELATIVE_PATH} contentDigest does not match canonical content.`,
    );
  }
  if (isRecord(canonical.approval)) {
    const { receiptDigest, ...receiptBase } = canonical.approval;
    const receiptMismatch =
      canonical.approval.profileId !== canonical.profileId ||
      canonical.approval.revision !== canonical.revision ||
      canonical.approval.contentDigest !== canonical.contentDigest ||
      receiptDigest !== sha256Hex(receiptBase);
    if (receiptMismatch) {
      return profileFailure(
        "invalid",
        "project_profile_invalid",
        `${PROJECT_PROFILE_RELATIVE_PATH} approval receipt is not bound to current content.`,
      );
    }
  }
  return { ok: true, content };
}

function parseProjectProfileProbe(
  probe: SafeReadResult,
): { ok: true; content: Record<string, unknown> } | { ok: false; result: ProfileCheckResult } {
  if (!probe.ok) return profileFailure("invalid", probe.conflict.code, probe.conflict.message);
  if (probe.content === undefined) {
    return profileFailure(
      "missing",
      "project_profile_missing",
      `${PROJECT_PROFILE_RELATIVE_PATH} does not exist. Run $forgix init or $forgix sync to create it.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(probe.content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "malformed YAML";
    return profileFailure(
      "invalid",
      "project_profile_invalid",
      `${PROJECT_PROFILE_RELATIVE_PATH} contains malformed YAML: ${detail}`,
    );
  }
  if (!isRecord(parsed) || !validateSchema("project-profile", parsed).valid) {
    return profileFailure(
      "invalid",
      "project_profile_invalid",
      `${PROJECT_PROFILE_RELATIVE_PATH} failed schema validation.`,
    );
  }
  return validateProfileIntegrity(parsed);
}

export async function checkProjectProfileDrift(
  store: WorkspaceStore,
  probe: SafeReadResult,
): Promise<ProfileCheckResult> {
  const parsed = parseProjectProfileProbe(probe);
  if (!parsed.ok) return parsed.result;

  const { decisions, domainDoc, allSourceRefs } = collectProfileFingerprints(parsed.content);
  const hashes = await Promise.all(
    allSourceRefs.map(async (ref) => [ref, await hashWorkspaceSourceRef(store, ref)] as const),
  );
  const freshness = evaluateFingerprintFreshness(decisions, domainDoc, new Map(hashes));
  const details: string[] = [];
  if (freshness.staleDecisionKeys.length > 0) {
    details.push(`stale decisions: ${freshness.staleDecisionKeys.join(", ")}`);
  }
  if (freshness.missingSourceRefs.length > 0) {
    details.push(`missing sources: ${freshness.missingSourceRefs.join(", ")}`);
  }
  if (freshness.domainDocumentationStale) {
    details.push("domain documentation fingerprints stale");
  }
  if (details.length === 0) return { summary: { status: "ok" }, findings: [] };

  return {
    summary: {
      status: "stale",
      staleDecisionKeys: freshness.staleDecisionKeys,
      missingSourceRefs: freshness.missingSourceRefs,
      ...(freshness.domainDocumentationStale ? { domainDocumentationStale: true } : {}),
    },
    findings: [
      {
        path: PROJECT_PROFILE_RELATIVE_PATH,
        code: "project_profile_stale",
        message: `${PROJECT_PROFILE_RELATIVE_PATH} is stale (${details.join("; ")}).`,
      },
    ],
  };
}

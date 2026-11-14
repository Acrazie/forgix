import { createHash } from "node:crypto";
import type { ProjectProfileContent } from "./project-profile.js";

export interface DomainDocumentationPaths {
  glossaryPath: string;
  rulesPath: string;
  adrDirectory: string;
  contextMapPath?: string;
}

export interface DomainDestinationInput {
  policy?: Partial<DomainDocumentationPaths>;
  profile?: ProjectProfileContent["domainDocumentation"];
  detected?: readonly DomainDocumentationPaths[];
}

export interface DomainSemanticPatch {
  schemaVersion: 1;
  operationId: string;
  kind: "upsert_glossary" | "upsert_rule" | "append_decision";
  destinationPath: string;
  ownedIdentity: string;
  sourceFingerprint: string;
  content: string;
}

const DEFAULT_PATHS: DomainDocumentationPaths = {
  glossaryPath: "docs/domain/glossary.md",
  rulesPath: "docs/domain/rules.md",
  adrDirectory: "docs/adr",
};
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]{0,255}$/;

export function resolveDomainDestinations(input: DomainDestinationInput): DomainDocumentationPaths {
  const detected = input.detected ?? [];
  if (detected.length > 1) throw new Error("Domain documentation destination is ambiguous.");
  const detectedPaths = detected[0];
  const profile = input.profile;
  const contextMapPath =
    input.policy?.contextMapPath ?? profile?.contextMapPath ?? detectedPaths?.contextMapPath;
  const resolved: DomainDocumentationPaths = {
    glossaryPath:
      input.policy?.glossaryPath ??
      profile?.glossaryPath ??
      detectedPaths?.glossaryPath ??
      DEFAULT_PATHS.glossaryPath,
    rulesPath:
      input.policy?.rulesPath ??
      profile?.rulesPath ??
      detectedPaths?.rulesPath ??
      DEFAULT_PATHS.rulesPath,
    adrDirectory:
      input.policy?.adrDirectory ??
      profile?.adrDirectory ??
      detectedPaths?.adrDirectory ??
      DEFAULT_PATHS.adrDirectory,
    ...(contextMapPath ? { contextMapPath } : {}),
  };
  for (const path of Object.values(resolved)) assertPortablePath(path);
  return resolved;
}

export function compileDomainSemanticPatches(
  patches: readonly Omit<DomainSemanticPatch, "schemaVersion">[],
  gateApproved: boolean,
): DomainSemanticPatch[] {
  if (!gateApproved) throw new Error("Domain projection requires current GATE approval.");
  const operationIds = new Set<string>();
  const identities = new Set<string>();
  return patches.map((patch) => {
    if (!ID.test(patch.operationId) || !ID.test(patch.ownedIdentity))
      throw new Error("Domain semantic patch identity is invalid.");
    if (
      operationIds.has(patch.operationId) ||
      identities.has(`${patch.destinationPath}:${patch.ownedIdentity}`)
    )
      throw new Error("Domain semantic patch identity is duplicated.");
    operationIds.add(patch.operationId);
    identities.add(`${patch.destinationPath}:${patch.ownedIdentity}`);
    assertPortablePath(patch.destinationPath);
    if (!/^sha256:[a-f0-9]{64}$/.test(patch.sourceFingerprint))
      throw new Error(`Domain semantic patch ${patch.operationId} source fingerprint is invalid.`);
    if (!patch.content.trim() || patch.content.length > 65_536 || patch.content.includes("\u0000"))
      throw new Error(`Domain semantic patch ${patch.operationId} content is invalid.`);
    return { ...structuredClone(patch), schemaVersion: 1 };
  });
}

export function applyOwnedMarkdownPatch(source: string, patch: DomainSemanticPatch): string {
  const fingerprint = `sha256:${createHash("sha256").update(source).digest("hex")}`;
  if (fingerprint !== patch.sourceFingerprint)
    throw new Error(`Domain semantic patch ${patch.operationId} source is stale.`);
  const start = `<!-- forgix:${patch.ownedIdentity}:start -->`;
  const end = `<!-- forgix:${patch.ownedIdentity}:end -->`;
  const block = `${start}\n${patch.content.trim()}\n${end}`;
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  if ((startIndex === -1) !== (endIndex === -1) || (startIndex !== -1 && endIndex < startIndex))
    throw new Error(`Domain owned section ${patch.ownedIdentity} is malformed.`);
  if (startIndex === -1) return `${source.trimEnd()}${source.trim() ? "\n\n" : ""}${block}\n`;
  const after = endIndex + end.length;
  return `${source.slice(0, startIndex)}${block}${source.slice(after)}`;
}

function assertPortablePath(path: string): void {
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").includes(".."))
    throw new Error(`Domain documentation path ${path || "<empty>"} is not portable.`);
}

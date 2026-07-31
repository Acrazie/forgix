import { dependencyClosure, validateDependencyGraph, type DependencyGraph } from "./shape-dependencies.js";

export type ShapeSourceFingerprintKind = "git_blob" | "content" | "command" | "external";

export interface ShapeSourceFingerprint {
  id: string;
  kind: ShapeSourceFingerprintKind;
  value: string;
  provenanceRef: string;
  dependencyNodeId: string;
  inputDigest?: string;
  observedAt?: string;
  expiresAt?: string;
}

export interface ShapeEvidenceItem {
  id: string;
  fact: string;
  provenanceRefs: string[];
  sourceFingerprintIds: string[];
  dependencyNodeId: string;
}

export type ObservedFingerprintValue = string | { value: string; inputDigest?: string };

export interface ReconcileShapeFreshnessInput {
  graph: DependencyGraph;
  fingerprints: readonly ShapeSourceFingerprint[];
  evidence: readonly ShapeEvidenceItem[];
  observedValues: Readonly<Record<string, ObservedFingerprintValue>>;
  now?: string;
}

export interface ShapeFreshnessResult {
  staleFingerprintIds: string[];
  staleEvidenceIds: string[];
  reusedEvidenceIds: string[];
  invalidatedNodeIds: string[];
  refreshTargetIds: string[];
}

const TOKEN = /^[^\r\n\0]{1,1024}$/;

export function isSourceFingerprintFresh(
  fingerprint: ShapeSourceFingerprint,
  observed: ObservedFingerprintValue,
  now = new Date().toISOString()
): boolean {
  validateSourceFingerprint(fingerprint);
  const observation = typeof observed === "string" ? { value: observed } : observed;
  if (!observation || observation.value !== fingerprint.value) return false;
  if (fingerprint.kind === "command" && observation.inputDigest !== fingerprint.inputDigest) return false;
  if (fingerprint.kind === "external" && fingerprint.expiresAt !== undefined) {
    const nowEpoch = Date.parse(now);
    const expiresEpoch = Date.parse(fingerprint.expiresAt);
    if (!Number.isFinite(nowEpoch) || !Number.isFinite(expiresEpoch)) throw new Error("Freshness timestamp is invalid.");
    if (nowEpoch >= expiresEpoch) return false;
  }
  return true;
}

export function reconcileShapeFreshness(input: ReconcileShapeFreshnessInput): ShapeFreshnessResult {
  const graph = validateDependencyGraph(input.graph);
  const fingerprints = new Map<string, ShapeSourceFingerprint>();
  for (const fingerprint of input.fingerprints) {
    validateSourceFingerprint(fingerprint);
    if (fingerprints.has(fingerprint.id)) throw new Error(`Duplicate source fingerprint ${fingerprint.id}.`);
    fingerprints.set(fingerprint.id, fingerprint);
  }

  const staleFingerprintIds = [...fingerprints.values()]
    .filter((fingerprint) => {
      const observed = input.observedValues[fingerprint.id];
      return observed === undefined || !isSourceFingerprintFresh(fingerprint, observed, input.now);
    })
    .map((fingerprint) => fingerprint.id)
    .sort();

  const staleSet = new Set(staleFingerprintIds);
  const staleEvidenceIds: string[] = [];
  const reusedEvidenceIds: string[] = [];
  const staleRoots = new Set<string>();
  const evidenceIds = new Set<string>();
  const graphNodes = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const fingerprint of fingerprints.values()) {
    if (graphNodes.get(fingerprint.dependencyNodeId)?.kind !== "source") {
      throw new Error(`Source fingerprint ${fingerprint.id} requires a source dependency node.`);
    }
  }

  for (const item of input.evidence) {
    validateEvidence(item, fingerprints, graphNodes);
    if (evidenceIds.has(item.id)) throw new Error(`Duplicate evidence item ${item.id}.`);
    evidenceIds.add(item.id);
    if (item.sourceFingerprintIds.some((id) => staleSet.has(id))) {
      staleEvidenceIds.push(item.id);
      staleRoots.add(item.dependencyNodeId);
      for (const sourceId of item.sourceFingerprintIds.filter((id) => staleSet.has(id))) {
        staleRoots.add(fingerprints.get(sourceId)!.dependencyNodeId);
      }
    } else {
      reusedEvidenceIds.push(item.id);
    }
  }

  return {
    staleFingerprintIds,
    staleEvidenceIds: staleEvidenceIds.sort(),
    reusedEvidenceIds: reusedEvidenceIds.sort(),
    invalidatedNodeIds: staleRoots.size ? dependencyClosure(graph, [...staleRoots]) : [],
    refreshTargetIds: staleEvidenceIds.map((id) => `refresh:${id}`).sort()
  };
}

function validateSourceFingerprint(fingerprint: ShapeSourceFingerprint): void {
  if (!fingerprint || !TOKEN.test(fingerprint.id) || !TOKEN.test(fingerprint.value)
    || !TOKEN.test(fingerprint.provenanceRef) || !TOKEN.test(fingerprint.dependencyNodeId)) {
    throw new Error("Source fingerprint is malformed.");
  }
  if (!["git_blob", "content", "command", "external"].includes(fingerprint.kind)) {
    throw new Error(`Source fingerprint ${fingerprint.id} kind is invalid.`);
  }
  if (fingerprint.kind === "command" && !TOKEN.test(fingerprint.inputDigest ?? "")) {
    throw new Error(`Command fingerprint ${fingerprint.id} requires inputDigest.`);
  }
  if (fingerprint.kind === "external") {
    if (!fingerprint.observedAt || !Number.isFinite(Date.parse(fingerprint.observedAt))) {
      throw new Error(`External fingerprint ${fingerprint.id} requires observedAt.`);
    }
    if (fingerprint.expiresAt !== undefined && !Number.isFinite(Date.parse(fingerprint.expiresAt))) {
      throw new Error(`External fingerprint ${fingerprint.id} expiresAt is invalid.`);
    }
  }
}

function validateEvidence(
  item: ShapeEvidenceItem,
  fingerprints: ReadonlyMap<string, ShapeSourceFingerprint>,
  graphNodes: ReadonlyMap<string, { kind: string }>
): void {
  if (!item || !TOKEN.test(item.id) || !TOKEN.test(item.fact) || !TOKEN.test(item.dependencyNodeId)) {
    throw new Error("Evidence item is malformed.");
  }
  if (!Array.isArray(item.provenanceRefs) || !item.provenanceRefs.length || item.provenanceRefs.some((ref) => !TOKEN.test(ref))) {
    throw new Error(`Evidence item ${item.id} requires provenance.`);
  }
  if (!Array.isArray(item.sourceFingerprintIds) || !item.sourceFingerprintIds.length) {
    throw new Error(`Evidence item ${item.id} requires source fingerprints.`);
  }
  if (item.sourceFingerprintIds.some((id) => !fingerprints.has(id))) {
    throw new Error(`Evidence item ${item.id} references unknown source fingerprint.`);
  }
  if (graphNodes.get(item.dependencyNodeId)?.kind !== "evidence") {
    throw new Error(`Evidence item ${item.id} requires an evidence dependency node.`);
  }
}

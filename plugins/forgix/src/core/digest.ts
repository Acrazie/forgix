import { createHash } from "node:crypto";
import type { DependencyGraph, DependencyNode, DependencyNodeKind } from "../types.js";

export type { DependencyGraph, DependencyNode, DependencyNodeKind };

export const DEPENDENCY_NODE_KINDS = Object.freeze([
  "decision",
  "product",
  "terminology",
  "domain_rule",
  "domain_scenario",
  "technical_decision",
  "source",
  "evidence",
  "criterion",
  "task",
  "risk",
  "validation",
  "guide",
  "projection",
  "assurance_subject",
  "assurance_operation",
] as const satisfies readonly DependencyNodeKind[]);

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]{0,255}$/;
const MAX_NODES = 4096;
const MAX_EDGES_PER_NODE = 128;

export function canonicalize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .toSorted(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, canonicalize(entry)] as const);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function sha256Prefixed(value: unknown): string {
  return `sha256:${sha256Hex(value)}`;
}

export interface HygieneScanOptions {
  allowEmails?: boolean;
  allowAbsolutePaths?: boolean;
}

const SECRET_RULES: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: "aws_access_key", pattern: /AKIA[0-9A-Z]{16}/ },
  { code: "github_token", pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { code: "github_pat_token", pattern: /github_pat_[A-Za-z0-9_]{20,}/ },
  { code: "api_secret_token", pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/ },
  { code: "private_key", pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
  {
    code: "credential_assignment",
    pattern: /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+/i,
  },
];

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

const ABSOLUTE_PATH_RULES: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: "file_uri", pattern: /file:\/\/\//i },
  { code: "home_tilde_path", pattern: /(?:^|[\s"'(=])~[\\/]/ },
  {
    code: "local_absolute_path",
    pattern: /(?:^|[\s"'(=])\/(?:Users|home|private|tmp|Volumes|var\/folders)\//,
  },
  { code: "windows_absolute_path", pattern: /(?:^|[\s"'(=])[A-Za-z]:[\\/]/ },
];

function collectStrings(value: unknown, output: string[], seen: Set<unknown>): void {
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output, seen);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    output.push(key);
    collectStrings(entry, output, seen);
  }
}

export function scanHygieneViolations(value: unknown, options: HygieneScanOptions = {}): string[] {
  const strings: string[] = [];
  collectStrings(value, strings, new Set());
  const violations = new Set<string>();

  for (const text of strings) {
    for (const rule of SECRET_RULES) {
      if (rule.pattern.test(text)) violations.add(rule.code);
    }
    if (!options.allowEmails && EMAIL_PATTERN.test(text)) {
      violations.add("pii_email");
    }
    if (!options.allowAbsolutePaths) {
      for (const rule of ABSOLUTE_PATH_RULES) {
        if (rule.pattern.test(text)) violations.add(rule.code);
      }
    }
  }

  return [...violations].toSorted();
}

export function assertCleanHygiene(value: unknown, options: HygieneScanOptions = {}): void {
  const violations = scanHygieneViolations(value, options);
  if (violations.length > 0) {
    throw new Error(`Hygiene violations detected: ${violations.join(", ")}.`);
  }
}

export function validateDependencyGraph(input: DependencyGraph): DependencyGraph {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.nodes)) {
    throw new Error("Dependency graph must use schemaVersion 1 and contain nodes.");
  }
  if (input.nodes.length > MAX_NODES) {
    throw new Error(`Dependency graph exceeds ${MAX_NODES} nodes.`);
  }

  const nodes = new Map<string, DependencyNode>();
  for (const candidate of input.nodes) {
    if (!candidate || !ID_PATTERN.test(candidate.id)) {
      throw new Error("Dependency node id is invalid.");
    }
    if (!(DEPENDENCY_NODE_KINDS as readonly string[]).includes(candidate.kind)) {
      throw new Error(`Dependency node ${candidate.id} kind is invalid.`);
    }
    if (nodes.has(candidate.id)) {
      throw new Error(`Duplicate dependency node ${candidate.id}.`);
    }
    if (!Array.isArray(candidate.dependsOn) || candidate.dependsOn.length > MAX_EDGES_PER_NODE) {
      throw new Error(`Dependency node ${candidate.id} dependencies are invalid.`);
    }
    if (new Set(candidate.dependsOn).size !== candidate.dependsOn.length) {
      throw new Error(`Dependency node ${candidate.id} contains duplicate dependencies.`);
    }
    if (candidate.dependsOn.some((id) => !ID_PATTERN.test(id))) {
      throw new Error(`Dependency node ${candidate.id} contains an invalid dependency id.`);
    }
    if (candidate.dependsOn.includes(candidate.id)) {
      throw new Error(`Dependency node ${candidate.id} cannot depend on itself.`);
    }
    nodes.set(candidate.id, {
      id: candidate.id,
      kind: candidate.kind,
      dependsOn: [...candidate.dependsOn],
    });
  }

  for (const node of nodes.values()) {
    for (const dependency of node.dependsOn) {
      if (!nodes.has(dependency)) {
        throw new Error(`Dependency node ${node.id} references unknown dependency ${dependency}.`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Dependency graph contains a cycle at ${id}.`);
    visiting.add(id);
    for (const dependency of nodes.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of nodes.keys()) visit(id);

  return {
    schemaVersion: 1,
    nodes: [...nodes.values()].toSorted((left, right) => left.id.localeCompare(right.id)),
  };
}

export function dependencyClosure(graph: DependencyGraph, roots: readonly string[]): string[] {
  const validated = validateDependencyGraph(graph);
  const known = new Set(validated.nodes.map((node) => node.id));
  const uniqueRoots = [...new Set(roots)];
  for (const root of uniqueRoots) {
    if (!known.has(root)) {
      throw new Error(`Dependency closure root ${root} does not exist.`);
    }
  }

  const dependants = new Map<string, string[]>();
  for (const node of validated.nodes) {
    for (const dependency of node.dependsOn) {
      const current = dependants.get(dependency) ?? [];
      current.push(node.id);
      dependants.set(dependency, current);
    }
  }

  const output = new Set<string>();
  const queue = [...uniqueRoots];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (output.has(current)) continue;
    output.add(current);
    for (const dependant of dependants.get(current) ?? []) queue.push(dependant);
  }
  return [...output].toSorted();
}

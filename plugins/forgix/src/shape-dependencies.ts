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
] as const);

export type DependencyNodeKind = (typeof DEPENDENCY_NODE_KINDS)[number];

export interface DependencyNode {
  id: string;
  kind: DependencyNodeKind;
  dependsOn: string[];
}

export interface DependencyGraph {
  schemaVersion: 1;
  nodes: DependencyNode[];
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/#@+~=-]{0,255}$/;
const MAX_NODES = 4096;
const MAX_EDGES_PER_NODE = 128;

export function validateDependencyGraph(input: DependencyGraph): DependencyGraph {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.nodes)) {
    throw new Error("Dependency graph must use schemaVersion 1 and contain nodes.");
  }
  if (input.nodes.length > MAX_NODES)
    throw new Error(`Dependency graph exceeds ${MAX_NODES} nodes.`);

  const nodes = new Map<string, DependencyNode>();
  for (const candidate of input.nodes) {
    if (!candidate || !ID_PATTERN.test(candidate.id))
      throw new Error("Dependency node id is invalid.");
    if (!(DEPENDENCY_NODE_KINDS as readonly string[]).includes(candidate.kind)) {
      throw new Error(`Dependency node ${candidate.id} kind is invalid.`);
    }
    if (nodes.has(candidate.id)) throw new Error(`Duplicate dependency node ${candidate.id}.`);
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
    if (!known.has(root)) throw new Error(`Dependency closure root ${root} does not exist.`);
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
  while (queue.length) {
    const current = queue.shift() as string;
    if (output.has(current)) continue;
    output.add(current);
    for (const dependant of dependants.get(current) ?? []) queue.push(dependant);
  }
  return [...output].toSorted();
}

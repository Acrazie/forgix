import type {
  LocalProjectProfile,
  ProjectInitState,
  ProjectProfileProposal,
} from "../../src/profile/index.ts";

const CAPTURED_AT = "2026-08-03T12:00:00.000Z";
const SOURCE_DIGEST = `sha256:${"a".repeat(64)}`;
type ProjectProfileCandidate = Omit<ProjectProfileProposal, "contentDigest"> & {
  contentDigest?: string;
};

export function projectProfileInput(
  overrides: Partial<ProjectProfileProposal> = {},
): ProjectProfileCandidate {
  const base = {
    schemaVersion: 1 as const,
    profileId: "forgix",
    revision: 1,
    content: {
      project: { id: "forgix", name: "Forgix" },
      stack: [
        {
          id: "typescript",
          role: "plugin runtime",
          version: "7",
          sourceRefs: ["package.json"],
        },
      ],
      topology: {
        rootServiceId: "plugin",
        services: [
          {
            id: "plugin",
            responsibility: "Forgix runtime and skills",
            dependencies: [],
            contracts: ["Codex plugin manifest", "Node.js CLI"],
            sourceRefs: ["plugins/forgix/package.json"],
          },
        ],
      },
      decisions: [
        decision("stack", "stack", "Use TypeScript on Node.js 26 with Bun tooling."),
        decision("source-layout", "source_structure", "Runtime lives in src; tests mirror layers."),
        decision(
          "architecture-boundary",
          "architecture",
          "Deterministic core with agentic skill orchestration.",
        ),
        decision(
          "dependency-direction",
          "dependency_direction",
          "Skills call exported runtime primitives.",
        ),
        decision("naming", "naming", "Use descriptive camelCase symbols and kebab-case files."),
        decision("errors", "error_handling", "Expose typed errors with stable codes."),
        decision("tests", "testing", "Use bun:test unit and integration layers."),
        decision("quality", "quality", "Full Gate requires format, lint, types, tests, and size."),
      ],
      diagramRefs: [],
    },
  };
  return deepMerge(base, overrides) as ProjectProfileCandidate;
}

export function localProfileInput(root: string): LocalProjectProfile {
  return {
    schemaVersion: 1,
    profileId: "forgix",
    servicePaths: [{ serviceId: "plugin", path: root }],
    preferences: [{ key: "editor.compact-output", value: "true" }],
  };
}

export function projectInitState(overrides: Partial<ProjectInitState> = {}): ProjectInitState {
  return {
    schemaVersion: 1,
    sessionId: "init-forgix",
    profileId: "forgix",
    revision: 1,
    status: "discovering",
    decisions: [],
    staleDecisionKeys: [],
    updatedAt: CAPTURED_AT,
    ...overrides,
  };
}

function decision(
  key: string,
  category: ProjectProfileProposal["content"]["decisions"][number]["category"],
  value: string,
) {
  return {
    key,
    category,
    value,
    rationale: `Durable ${category} convention.`,
    provenance: {
      kind: "repository" as const,
      sourceRefs: ["AGENTS.md"],
      capturedAt: CAPTURED_AT,
    },
    sourceFingerprints: [{ sourceRef: "AGENTS.md", value: SOURCE_DIGEST }],
    dependsOn: [],
  };
}

function deepMerge(base: unknown, incoming: unknown): unknown {
  if (
    typeof base === "object" &&
    base !== null &&
    !Array.isArray(base) &&
    typeof incoming === "object" &&
    incoming !== null &&
    !Array.isArray(incoming)
  ) {
    const result = { ...(base as Record<string, unknown>) };
    for (const [key, value] of Object.entries(incoming)) {
      result[key] = deepMerge(result[key], value);
    }
    return result;
  }
  return incoming === undefined ? base : incoming;
}

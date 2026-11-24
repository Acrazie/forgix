import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_SUBSCRIPTION_CONFIG } from "../../src/core/config.ts";
import { canonicalize, sha256Hex } from "../../src/core/digest.ts";
import { applyTaskGateDecision, validateTaskState } from "../../src/task/index.ts";
import type {
  AssuranceContract,
  CanonicalChangeContract,
  DesignState,
  DependencyGraph,
  ProductBaselineDimension,
  PreparationProfile,
  RiskLevel,
  ShapeState,
  TaskState,
  TaskStatus,
} from "../../src/types.ts";

export interface BuildTaskStateOptions {
  taskId?: string;
  status?: TaskStatus;
  profile?: PreparationProfile;
  risk?: RiskLevel;
  objective?: string;
  includeAssurance?: boolean;
  blockedFrom?: Exclude<TaskStatus, "new" | "blocked" | "cancelled" | "failed">;
}

const DEFAULT_CREATED_AT = "2026-08-01T00:00:00.000Z";
const DEFAULT_GATE_AT = "2026-08-01T00:05:00.000Z";

export function computeContractDigest(
  contract: Omit<CanonicalChangeContract, "digest"> & { digest?: string },
): string {
  return sha256Hex(canonicalize({ ...contract, digest: "" }));
}

export function makeProductDesign(objective = "Implement task lifecycle test"): DesignState {
  const keys: ProductBaselineDimension["key"][] = [
    "objective",
    "users_value",
    "scope",
    "success",
    "risks_constraints",
  ];
  const nodes = keys.map((key) => ({
    id: `product:${key}`,
    kind: "product" as const,
    dependsOn: [] as string[],
  }));
  const dimensions: ProductBaselineDimension[] = keys.map((key) => ({
    key,
    status: "resolved",
    value: key === "objective" ? objective : `${key}: verified baseline`,
    provenance: { sourceRefs: ["request"], freshnessRefs: ["request:v1"] },
    dependencyNodeId: `product:${key}`,
  }));
  return {
    schemaVersion: 1,
    graph: { schemaVersion: 1, nodes },
    productBaseline: { schemaVersion: 1, dimensions },
    glossaryDeltas: [],
    domainRules: [],
  };
}

function makeAssuranceContract(
  sourceDigest = "shape:contract:v1",
  policyDigest = "policy:snapshot:v1",
): AssuranceContract {
  const base: Omit<AssuranceContract, "digest"> = {
    schemaVersion: 1,
    sourceDigest,
    subjects: [{ id: "criterion.main", kind: "criterion" }],
    operations: [
      {
        id: "check:test",
        kind: "command",
        dependsOn: [],
        covers: ["criterion.main"],
        cost: "low",
        scopeRefs: ["scope:workspace"],
        fingerprintMode: "scoped",
        readOnly: true,
        concurrencySafe: true,
        conditional: false,
        checkIdentity: {
          executable: "bun",
          argv: ["test"],
          logicalCwd: ".",
          environment: {},
          toolFingerprintRefs: ["tool:bun"],
        },
        successPredicate: { exitCodes: [0] },
      },
    ],
    evidencePreference: ["check:test"],
    reviewBudget: {
      maxInputTokens: 4000,
      maxOutputTokens: 1000,
      maxCalls: 1,
      maxConcurrency: 1,
    },
    policyDigest,
  };
  return {
    ...base,
    digest: sha256Hex(canonicalize(base)),
  };
}

export function makeShapeState(options?: {
  taskId?: string;
  profile?: PreparationProfile;
  risk?: RiskLevel;
  objective?: string;
  includeContract?: boolean;
  includeAssurance?: boolean;
}): ShapeState {
  const taskId = options?.taskId ?? "task-v6";
  const profile = options?.profile ?? "quick";
  const risk = options?.risk ?? "low";
  const objective = options?.objective ?? `Complete ${taskId}`;
  const includeContract = options?.includeContract ?? true;

  const nodes: DependencyGraph["nodes"] = [
    { id: "source.main", kind: "source", dependsOn: [] },
    { id: "evidence.main", kind: "evidence", dependsOn: ["source.main"] },
  ];

  if (includeContract) {
    nodes.push(
      { id: "criterion.main", kind: "criterion", dependsOn: ["evidence.main"] },
      { id: "validation.main", kind: "validation", dependsOn: ["evidence.main"] },
      { id: "task.main", kind: "task", dependsOn: ["criterion.main"] },
    );
  }

  let contract: CanonicalChangeContract | undefined;
  if (includeContract) {
    const baseContract: Omit<CanonicalChangeContract, "digest"> = {
      schemaVersion: 1,
      artifactId: `artifact:${taskId}`,
      revision: 1,
      profile,
      risk,
      productBaselineRef: "design:product-baseline:1",
      scope: [objective],
      nonGoals: ["Do not alter unrelated modules"],
      acceptanceCriteria: [
        {
          id: "criterion.main",
          description: "Target behavior passes automated verification.",
          validationIds: ["validation.main"],
          dependencyNodeId: "criterion.main",
        },
      ],
      tasks: [
        {
          id: "task.main",
          description: `Implement ${taskId}`,
          criterionIds: ["criterion.main"],
          dependsOnTaskIds: [],
          dependencyNodeId: "task.main",
        },
      ],
      validations: [
        {
          id: "validation.main",
          description: "Run bun test",
          criterionIds: ["criterion.main"],
          command: "bun test",
          dependencyNodeId: "validation.main",
        },
      ],
      risks: [],
      ...(options?.includeAssurance
        ? { assuranceContract: makeAssuranceContract(`artifact:${taskId}:1`) }
        : {}),
    };
    contract = {
      ...baseContract,
      digest: computeContractDigest(baseContract),
    };
  }

  return {
    schemaVersion: 1,
    risk,
    productBaselineRef: "design:product-baseline:1",
    discoveryTargets: [
      {
        id: "target.main",
        question: "Which module owns the behavior?",
        createdBecause: "Scope grounding",
        createdAt: DEFAULT_CREATED_AT,
        materialImpacts: ["scope", "validation"],
        candidateSourceRefs: ["repo:src/main.ts"],
        status: "resolved",
        evidenceIds: ["evidence.main"],
        dependencyNodeId: "evidence.main",
      },
    ],
    sourceFingerprints: [
      {
        id: "fp.main",
        kind: "content",
        value: "sha256:source-v1",
        provenanceRef: "repo:src/main.ts",
        dependencyNodeId: "source.main",
      },
    ],
    evidence: [
      {
        id: "evidence.main",
        fact: "Behavior is verified by test suite.",
        provenanceRefs: ["repo:src/main.ts"],
        sourceFingerprintIds: ["fp.main"],
        dependencyNodeId: "evidence.main",
        expectedValue: "sha256:source-v1",
        observedValue: "sha256:source-v1",
      },
    ],
    technicalDecisions: [],
    preparationProfileChoice: {
      schemaVersion: 1,
      status: "selected",
      recommendation: profile,
      recommendationBasis: "Fixture default.",
      checkpoint: {
        changeShape: "localized",
        surfaceCategories: ["core"],
        materialFacts: ["Verified in fixture"],
      },
      selectedProfile: profile,
      selectionEvidenceRef: `user:profile:${profile}`,
    },
    ...(contract ? { contract } : {}),
    dependencyGraph: {
      schemaVersion: 1,
      nodes: nodes.toSorted((a, b) => a.id.localeCompare(b.id)),
    },
  };
}

export function makeNewTaskState(options?: {
  taskId?: string;
  risk?: RiskLevel;
  objective?: string;
}): TaskState {
  const taskId = options?.taskId ?? "task-v6";
  const raw: TaskState = {
    schemaVersion: 6,
    taskId,
    status: "new",
    revision: 0,
    risk: options?.risk ?? "low",
    design: makeProductDesign(options?.objective ?? `Implement ${taskId}`),
    configSnapshot: {
      schemaVersion: 1,
      subscription: structuredClone(DEFAULT_SUBSCRIPTION_CONFIG),
    },
    policySnapshot: {
      schemaVersion: 1,
      requirements: {},
      prohibitions: {},
      bounds: {},
      locks: [],
    },
    issues: [],
    history: [
      {
        sequence: 1,
        at: DEFAULT_CREATED_AT,
        type: "task.created",
        refs: [{ kind: "task", ref: taskId }],
      },
    ],
  };
  return validateTaskState(raw);
}

export function makeAwaitingApprovalTaskState(options?: {
  taskId?: string;
  profile?: PreparationProfile;
  risk?: RiskLevel;
  objective?: string;
  includeAssurance?: boolean;
}): TaskState {
  const taskId = options?.taskId ?? "task-v6";
  const objective = options?.objective;
  const shape = makeShapeState({
    taskId,
    profile: options?.profile ?? "quick",
    risk: options?.risk ?? "low",
    ...(objective !== undefined ? { objective } : {}),
    includeContract: true,
    includeAssurance: options?.includeAssurance ?? true,
  });
  const base = makeNewTaskState({
    taskId,
    risk: options?.risk ?? "low",
    ...(objective !== undefined ? { objective } : {}),
  });
  const contractDigest = shape.contract!.digest;
  const raw: TaskState = {
    ...base,
    status: "awaiting_approval",
    revision: 4,
    shape,
    contractDigest,
    history: [
      ...base.history,
      {
        sequence: 2,
        at: "2026-08-01T00:01:00.000Z",
        type: "state.transition",
        from: "new",
        to: "intaking",
        revision: 1,
        sourceFingerprint: "fp:1",
      },
      {
        sequence: 3,
        at: "2026-08-01T00:02:00.000Z",
        type: "state.transition",
        from: "intaking",
        to: "discovering",
        revision: 2,
        sourceFingerprint: "fp:2",
      },
      {
        sequence: 4,
        at: "2026-08-01T00:03:00.000Z",
        type: "state.transition",
        from: "discovering",
        to: "planning",
        revision: 3,
        sourceFingerprint: "fp:3",
      },
      {
        sequence: 5,
        at: "2026-08-01T00:04:00.000Z",
        type: "state.transition",
        from: "planning",
        to: "awaiting_approval",
        revision: 4,
        sourceFingerprint: "fp:4",
        contractDigest,
      },
    ],
  };
  return validateTaskState(raw);
}

export function makeTaskState(options?: BuildTaskStateOptions): TaskState {
  const taskId = options?.taskId ?? "task-v6";
  const status = options?.status ?? "new";
  if (status === "new") {
    return makeNewTaskState(options);
  }

  if (status === "awaiting_approval") {
    return makeAwaitingApprovalTaskState(options);
  }

  if (status === "executing" || status === "assuring") {
    const gated = makeAwaitingApprovalTaskState(options);
    const { state: executing } = applyTaskGateDecision(gated, {
      decision: "approve",
      decidedAt: DEFAULT_GATE_AT,
    });
    if (status === "executing") {
      return executing;
    }
    const lastSeq = executing.history.at(-1)?.sequence ?? 1;
    return validateTaskState({
      ...executing,
      status: "assuring",
      revision: executing.revision + 1,
      assurance: {
        schemaVersion: 1,
        evidenceIndex: [],
      },
      history: [
        ...executing.history,
        {
          sequence: lastSeq + 1,
          at: "2026-08-01T00:06:00.000Z",
          type: "state.transition",
          from: "executing",
          to: "assuring",
          revision: executing.revision + 1,
          sourceFingerprint: "fp:executing",
        },
      ],
    });
  }

  const base = makeNewTaskState(options);
  if (status === "intaking") {
    return validateTaskState({
      ...base,
      status: "intaking",
      revision: 1,
      history: [
        ...base.history,
        {
          sequence: 2,
          at: "2026-08-01T00:01:00.000Z",
          type: "state.transition",
          from: "new",
          to: "intaking",
          revision: 1,
          sourceFingerprint: "fp:1",
        },
      ],
    });
  }

  if (
    status === "discovering" ||
    status === "planning" ||
    status === "awaiting_profile_choice" ||
    status === "awaiting_shape_decision" ||
    status === "awaiting_intake_decision"
  ) {
    const shape = makeShapeState({
      taskId,
      profile: options?.profile ?? "quick",
      risk: options?.risk ?? "low",
      ...(options?.objective !== undefined ? { objective: options.objective } : {}),
      includeContract: false,
    });
    const transitions: TaskState["history"] = [
      ...base.history,
      {
        sequence: 2,
        at: "2026-08-01T00:01:00.000Z",
        type: "state.transition",
        from: "new",
        to: "intaking",
        revision: 1,
        sourceFingerprint: "fp:1",
      },
      {
        sequence: 3,
        at: "2026-08-01T00:02:00.000Z",
        type: "state.transition",
        from: "intaking",
        to: "discovering",
        revision: 2,
        sourceFingerprint: "fp:2",
      },
    ];
    if (status === "discovering") {
      return validateTaskState({
        ...base,
        status: "discovering",
        revision: 2,
        shape,
        history: transitions,
      });
    }
    return validateTaskState({
      ...base,
      status,
      revision: 3,
      shape,
      history: [
        ...transitions,
        {
          sequence: 4,
          at: "2026-08-01T00:03:00.000Z",
          type: "state.transition",
          from: "discovering",
          to: status,
          revision: 3,
          sourceFingerprint: "fp:3",
        },
      ],
    });
  }

  if (status === "blocked") {
    const resumeTo = options?.blockedFrom ?? "planning";
    const prior = makeTaskState({ ...options, status: resumeTo });
    const lastSeq = prior.history.at(-1)?.sequence ?? 1;
    return validateTaskState({
      ...prior,
      status: "blocked",
      revision: prior.revision + 1,
      resumeTo,
      resumeReason: "Awaiting operator input",
      history: [
        ...prior.history,
        {
          sequence: lastSeq + 1,
          at: "2026-08-01T00:04:00.000Z",
          type: "state.transition",
          from: resumeTo,
          to: "blocked",
          revision: prior.revision + 1,
          sourceFingerprint: "fp:blocked",
        },
      ],
    });
  }

  // cancelled or failed from awaiting_approval / planning
  const gated = makeAwaitingApprovalTaskState(options);
  const lastSeq = gated.history.at(-1)?.sequence ?? 1;
  return validateTaskState({
    ...gated,
    status,
    revision: gated.revision + 1,
    history: [
      ...gated.history,
      {
        sequence: lastSeq + 1,
        at: "2026-08-01T00:05:00.000Z",
        type: "state.transition",
        from: "awaiting_approval",
        to: status,
        revision: gated.revision + 1,
        sourceFingerprint: "fp:terminal",
        terminalSource: "awaiting_approval",
      },
    ],
  });
}

export async function seedLegacyTask(root: string, state: TaskState): Promise<void> {
  const directory = join(root, ".forgix", "tasks");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${state.taskId}.json`), JSON.stringify(state));
}

import { StateStoreError } from "../core/schema.js";
import type { ProductBaselineDimension, RiskLevel, TaskState } from "../types.js";
import { createTaskStateStore } from "./index.js";

interface RoadmapIntake {
  taskId: string;
  workItemId: string;
  roadmapDigest: string;
  now: string;
  objective: string;
  scopeIn: string[];
  scopeOut: string[];
  acceptanceCriteria: string[];
  risk: RiskLevel;
}

function baselineDimensions(intake: RoadmapIntake): ProductBaselineDimension[] {
  const values: Record<ProductBaselineDimension["key"], string | undefined> = {
    objective: intake.objective,
    users_value: undefined,
    scope: JSON.stringify({ in: intake.scopeIn, out: intake.scopeOut }),
    success: intake.acceptanceCriteria.join("\n"),
    risks_constraints: undefined,
  };
  const keys = Object.keys(values) as Array<keyof typeof values>;
  return keys.map((key) => {
    const value = values[key];
    const dimension: ProductBaselineDimension = {
      key,
      status: value ? "resolved" : "missing",
      provenance: {
        sourceRefs: [`roadmap:${intake.workItemId}`],
        freshnessRefs: [intake.roadmapDigest],
      },
      dependencyNodeId: `product:${key}`,
    };
    if (value) dimension.value = value;
    return dimension;
  });
}

async function initializeRoadmapTask(
  workspaceRoot: string,
  intake: RoadmapIntake,
  configSnapshot: TaskState["configSnapshot"],
  policySnapshot: TaskState["policySnapshot"],
) {
  const { taskId } = intake;
  const dimensions = baselineDimensions(intake);
  const state: TaskState = {
    schemaVersion: 6,
    taskId,
    status: "new",
    revision: 0,
    risk: intake.risk,
    configSnapshot,
    policySnapshot,
    design: {
      schemaVersion: 1,
      graph: {
        schemaVersion: 1,
        nodes: dimensions.map(({ dependencyNodeId }) => ({
          id: dependencyNodeId,
          kind: "product",
          dependsOn: [],
        })),
      },
      productBaseline: { schemaVersion: 1, dimensions },
      glossaryDeltas: [],
      domainRules: [],
    },
    issues: [],
    history: [
      { sequence: 1, at: intake.now, type: "task.created", refs: [{ kind: "task", ref: taskId }] },
    ],
  };
  await createTaskStateStore(workspaceRoot).save(taskId, state, {
    create: true,
    expectedRevision: 0,
  });
}

export function roadmapTaskInitializer(
  resolveConfig: (root: string) => TaskState["configSnapshot"],
  policy: TaskState["policySnapshot"] = {
    schemaVersion: 1,
    requirements: {},
    prohibitions: {},
    bounds: {},
    locks: [],
  },
) {
  return {
    create: (root: string, intake: RoadmapIntake) =>
      initializeRoadmapTask(root, intake, resolveConfig(root), policy),
    async exists(root: string, taskId: string) {
      try {
        await createTaskStateStore(root).load(taskId);
        return true;
      } catch (error) {
        if (error instanceof StateStoreError && error.code === "state_not_found") return false;
        throw error;
      }
    },
  };
}

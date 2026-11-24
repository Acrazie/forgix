import { resolveGitWorktree } from "../core/build-authorization.js";
import { StateStoreError } from "../core/schema.js";
import { createWorkspaceStore } from "../core/store.js";
import {
  computeRoadmapCandidateDigest,
  createPublishedRoadmapStore,
  createRoadmapRuntimeStore,
  createRoadmapStore,
  prepareLocalWorkItemRun,
  RoadmapError,
  transitionRoadmapWorkItemStatus,
  type PublishedRoadmap,
  type RoadmapRuntimeState,
  type RoadmapState,
  type RoadmapWorkItemRuntimeState,
} from "./index.js";
import { reservationEntry } from "./reservations.js";
import { createRunWorktree, hasBranch, hasWorktreePath, worktreeIdentity } from "./run-worktree.js";

interface PrepareInput {
  workItemId: string;
  dryRun: boolean;
}
interface PrepareOptions {
  now?: string;
  baseBranch?: string;
  worktreeRoot?: string;
}
type Roadmap = RoadmapState | PublishedRoadmap;
type Coordinate = RoadmapWorkItemRuntimeState &
  Required<Pick<RoadmapWorkItemRuntimeState, "branch" | "worktreePath" | "reservation">>;
type Intake = Pick<
  RoadmapState["workItems"][number],
  "objective" | "scopeIn" | "scopeOut" | "acceptanceCriteria" | "risk"
> & { taskId: string; workItemId: string; roadmapDigest: string; now: string };
interface TaskInitializer {
  exists(worktree: string, taskId: string): Promise<boolean>;
  create(worktree: string, intake: Intake): Promise<void>;
}
type Phase = "reserved" | "resume" | "reconcile";

function refuse(message: string): never {
  throw new RoadmapError("roadmap_invalid", message);
}

function coordinate(entry: RoadmapWorkItemRuntimeState, digest: string): Coordinate {
  if (entry.reservation?.roadmapDigest !== digest || !entry.branch || !entry.worktreePath)
    return refuse("Existing Roadmap reservation is inconsistent; preserve it and reconcile.");
  return {
    ...entry,
    branch: entry.branch,
    worktreePath: entry.worktreePath,
    reservation: entry.reservation,
  };
}

async function inspect(root: string, entry: Coordinate, task: TaskInitializer): Promise<Phase> {
  const { branch, worktreePath, reservation } = entry;
  const path = createWorkspaceStore(root).resolvePath(worktreePath);
  const pending = reservation.handoffPending && ["Ready", "In Progress"].includes(entry.status);
  if (!hasWorktreePath(path)) {
    return pending && !reservation.worktreeIdentity && !hasBranch(root, branch)
      ? "reserved"
      : "reconcile";
  }
  const identity = await worktreeIdentity(root, path, branch);
  if (!identity || (reservation.worktreeIdentity && reservation.worktreeIdentity !== identity))
    return "reconcile";
  if (await task.exists(path, reservation.taskId)) return "resume";
  return pending && reservation.worktreeIdentity === identity ? "reserved" : "reconcile";
}

function startTransition(roadmap: Roadmap, workItemId: string, now: string, resuming = false) {
  const transition =
    "contentDigest" in roadmap
      ? undefined
      : transitionRoadmapWorkItemStatus(roadmap, workItemId, "In Progress", { updatedAt: now });
  const allowed = resuming ? ["Ready", "In Progress"] : ["Ready"];
  if (transition && !allowed.includes(transition.previousStatus))
    return refuse(`Local Work Item must be ${allowed.join(" or ")}; reconcile before setup.`);
  return transition;
}

async function markStarted(root: string, roadmap: Roadmap, entry: Coordinate, now: string) {
  const transition = startTransition(roadmap, entry.id, now, true);
  const state = transition ? await createRoadmapStore(root).save(transition.state) : roadmap;
  entry.status = "In Progress";
  entry.updatedAt = now;
  return { state, featureStatus: transition?.featureStatus };
}

async function initialize(
  root: string,
  roadmap: Roadmap,
  runtime: RoadmapRuntimeState,
  entry: Coordinate,
  task: TaskInitializer,
  now: string,
) {
  if (resolveGitWorktree(root) !== root) refuse("Prepare from the originating Git worktree root.");
  const item = roadmap.workItems.find(({ id }) => id === entry.id);
  if (!item) return refuse("Reserved Work Item is missing from the Roadmap.");
  const store = createRoadmapRuntimeStore(root);
  const started = await markStarted(root, roadmap, entry, now);
  await store.save(runtime);
  const { branch, worktreePath, reservation } = entry;
  const path = createWorkspaceStore(root).resolvePath(worktreePath);
  if (!reservation.worktreeIdentity) {
    const identity = await createRunWorktree(root, worktreePath, branch, reservation.baseBranch);
    if (!identity) return { ...started, phase: "reconcile" as const };
    reservation.worktreeIdentity = identity;
    await store.save(runtime);
  }
  if ((await worktreeIdentity(root, path, branch)) !== reservation.worktreeIdentity)
    return { ...started, phase: "reconcile" as const };
  // Once task creation is attempted, missing TaskState is ambiguous and cannot be recreated.
  delete reservation.handoffPending;
  await store.save(runtime);
  await task.create(path, {
    ...item,
    taskId: reservation.taskId,
    workItemId: entry.id,
    roadmapDigest: reservation.roadmapDigest,
    now,
  });
  return { ...started, phase: "resume" as const };
}

async function startRun(
  root: string,
  roadmap: Roadmap,
  runtime: RoadmapRuntimeState,
  input: PrepareInput,
  task: TaskInitializer,
  options: PrepareOptions,
  now: string,
) {
  const { workItemId, dryRun } = input;
  const seed = prepareLocalWorkItemRun(roadmap, workItemId, {
    ...options,
    maxRisk: "all",
    runtimeState: runtime,
  });
  startTransition(roadmap, workItemId, now);
  const entry = coordinate(
    reservationEntry(runtime, workItemId, seed.workspace, now),
    runtime.roadmapDigest,
  );
  if (dryRun)
    return {
      status: "ok",
      data: { ...seed, dryRun, state: roadmap, taskId: entry.reservation.taskId },
    };
  const path = createWorkspaceStore(root).resolvePath(entry.worktreePath);
  if (
    hasWorktreePath(path) ||
    hasBranch(root, entry.branch) ||
    runtime.workItemStates.some(
      ({ branch, worktreePath }) => branch === entry.branch || worktreePath === entry.worktreePath,
    )
  ) {
    refuse("Roadmap coordinate is occupied; preserve it and reconcile before preparing.");
  }
  runtime.workItemStates = [...runtime.workItemStates.filter(({ id }) => id !== workItemId), entry];
  await createRoadmapRuntimeStore(root).save(runtime);
  const started = await initialize(root, roadmap, runtime, entry, task, now);
  return {
    status: started.phase === "reconcile" ? "blocked" : "saved",
    data: {
      ...seed,
      ...started,
      featureStatus: started.featureStatus ?? seed.featureStatusAfterStart,
      dryRun,
      reservation: entry,
      taskId: entry.reservation.taskId,
    },
  };
}

async function inspectExisting(
  root: string,
  roadmap: Roadmap,
  runtime: RoadmapRuntimeState,
  entry: Coordinate,
  dryRun: boolean,
  task: TaskInitializer,
  now: string,
) {
  let phase: Phase;
  try {
    phase = await inspect(root, entry, task);
  } catch (error) {
    if (!(error instanceof StateStoreError)) throw error;
    phase = "reconcile";
  }
  const initializeNow = !dryRun && phase === "reserved";
  if (initializeNow) phase = (await initialize(root, roadmap, runtime, entry, task, now)).phase;
  return {
    status: phase === "reconcile" ? "blocked" : initializeNow ? "saved" : "ok",
    data: { existing: true, phase, dryRun, reservation: entry, taskId: entry.reservation.taskId },
  };
}

async function prepareLocked(
  root: string,
  input: PrepareInput,
  task: TaskInitializer,
  options: PrepareOptions,
  runtimeStore: ReturnType<typeof createRoadmapRuntimeStore>,
) {
  const session = createRoadmapStore(root);
  const published = createPublishedRoadmapStore(root);
  const roadmap = (await published.exists()) ? await published.load() : await session.load();
  const digest =
    "contentDigest" in roadmap ? roadmap.contentDigest : computeRoadmapCandidateDigest(roadmap);
  const now = options.now ?? new Date().toISOString();
  const runtime: RoadmapRuntimeState = (await runtimeStore.exists())
    ? await runtimeStore.load()
    : {
        schemaVersion: 1,
        roadmapDigest: digest,
        updatedAt: now,
        workItemStates: [],
        checkpointReceipts: [],
      };
  if (runtime.roadmapDigest !== digest)
    refuse("Roadmap and runtime revisions disagree; reconcile before preparing work.");
  const previous = runtime.workItemStates.find(({ id }) => id === input.workItemId);
  if (previous?.reservation) {
    const entry = coordinate(previous, digest);
    runtime.workItemStates[runtime.workItemStates.indexOf(previous)] = entry;
    return inspectExisting(root, roadmap, runtime, entry, input.dryRun, task, now);
  }
  return startRun(root, roadmap, runtime, input, task, options, now);
}

export async function prepareRoadmapRun(
  workspaceRoot: string,
  input: PrepareInput,
  task: TaskInitializer,
  options: PrepareOptions = {},
) {
  if (process.env.FORGIX_ROADMAP_SETUP === "1")
    refuse("Roadmap preparation cannot be re-entered from its Git checkout.");
  const store = createRoadmapRuntimeStore(workspaceRoot);
  return new Promise<Awaited<ReturnType<typeof prepareLocked>>>((resolve, reject) => {
    const attempt = () => {
      let acquired = false;
      void store
        .withLock(() => {
          acquired = true;
          return prepareLocked(store.workspaceRoot, input, task, options, store);
        })
        .then(resolve, (error: unknown) => {
          if (!acquired && error instanceof StateStoreError && error.code === "state_conflict")
            setTimeout(attempt, 50);
          else reject(error);
        });
    };
    attempt();
  });
}

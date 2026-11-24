import { sha256Hex } from "../core/digest.js";
import type {
  RoadmapBoardStatus,
  RoadmapRuntimeState,
  RoadmapWorkItemRuntimeState,
  WorkItemWorkspaceSpec,
} from "./index.js";

export function trackerStatus(
  existing: RoadmapWorkItemRuntimeState | undefined,
  reported: RoadmapBoardStatus | undefined,
): RoadmapBoardStatus {
  return existing?.reservation ? existing.status : (reported ?? existing?.status ?? "Backlog");
}

export function reservationEntry(
  runtime: RoadmapRuntimeState,
  workItemId: string,
  workspace: WorkItemWorkspaceSpec,
  now: string,
): RoadmapWorkItemRuntimeState {
  return {
    ...runtime.workItemStates.find(({ id }) => id === workItemId),
    id: workItemId,
    status: "Ready",
    updatedAt: now,
    branch: workspace.branch,
    worktreePath: workspace.worktreePath,
    reservation: {
      taskId: `roadmap-${sha256Hex({ digest: runtime.roadmapDigest, workItemId }).slice(0, 24)}`,
      roadmapDigest: runtime.roadmapDigest,
      baseBranch: workspace.baseBranch,
      handoffPending: true,
    },
  };
}

export function retainsActiveReservations(
  current: RoadmapRuntimeState,
  next: RoadmapRuntimeState,
): boolean {
  return current.workItemStates.every((entry) => {
    if (!entry.reservation || (entry.status === "Done" && !entry.reservation.handoffPending))
      return true;
    const { handoffPending, worktreeIdentity, ...coordinate } = entry.reservation;
    const updated = next.workItemStates.find(({ id }) => id === entry.id);
    if (!updated?.reservation) return false;
    const {
      handoffPending: nextPending,
      worktreeIdentity: nextIdentity,
      ...nextCoordinate
    } = updated.reservation;
    return (
      next.roadmapDigest === current.roadmapDigest &&
      updated.branch === entry.branch &&
      updated.worktreePath === entry.worktreePath &&
      (!nextPending || handoffPending === true) &&
      (worktreeIdentity === undefined || worktreeIdentity === nextIdentity) &&
      sha256Hex(nextCoordinate) === sha256Hex(coordinate)
    );
  });
}

export function preservePublishedRuntime(
  current: RoadmapRuntimeState,
  next: RoadmapRuntimeState,
): RoadmapRuntimeState {
  if (current.roadmapDigest !== next.roadmapDigest) return next;
  const existing = new Map(current.workItemStates.map((entry) => [entry.id, entry]));
  return {
    ...next,
    workItemStates: next.workItemStates.map((entry) =>
      mergePublishedEntry(entry, existing.get(entry.id)),
    ),
    checkpointReceipts: current.checkpointReceipts,
  };
}

function mergePublishedEntry(
  published: RoadmapWorkItemRuntimeState,
  existing: RoadmapWorkItemRuntimeState | undefined,
): RoadmapWorkItemRuntimeState {
  const merged = { ...published, ...existing };
  const { externalIssueNumber, externalIssueUrl } = published;
  if (externalIssueNumber !== undefined && externalIssueNumber !== merged.externalIssueNumber) {
    merged.externalIssueNumber = externalIssueNumber;
    delete merged.externalIssueUrl;
  }
  if (externalIssueUrl !== undefined) merged.externalIssueUrl = externalIssueUrl;
  return merged;
}

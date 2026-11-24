import { InvocationError } from "../core/schema.js";
import type {
  PublishedVerificationCheckpoint,
  PublishedWorkItem,
  RecordCheckpointResultInput,
  RoadmapCheckpointReceipt,
  RoadmapSharedContract,
  RoadmapVerificationCheckpoint,
  RoadmapWorkItem,
} from "./index.js";

type SelectableCheckpoint = RoadmapVerificationCheckpoint | PublishedVerificationCheckpoint;
type SelectableWorkItem = RoadmapWorkItem | PublishedWorkItem;

export function currentCheckpointIds(
  receipts: readonly RoadmapCheckpointReceipt[],
  currentDigest: string,
): ReadonlySet<string> {
  return new Set(
    receipts
      .filter(
        (receipt) =>
          receipt.status === "Passed" &&
          receipt.roadmapDigest === currentDigest &&
          receipt.observedRoadmapDigest === currentDigest,
      )
      .map((receipt) => receipt.checkpointId),
  );
}

interface VerifyCheckpointContext {
  sharedContracts?: readonly RoadmapSharedContract[];
  workItems?: readonly SelectableWorkItem[];
}

export function verifyCheckpointVerification(
  checkpoint: SelectableCheckpoint,
  checksRun: readonly string[],
  context?: VerifyCheckpointContext,
): { passed: boolean; missingChecks: string[] } {
  const normalizedRun = new Set(checksRun.map((c) => c.trim()).filter(Boolean));
  const missingChecks = checkpoint.checks.filter((required) => !normalizedRun.has(required.trim()));
  missingChecks.push(...missingFormalChecks(checkpoint, normalizedRun, context));
  return { passed: missingChecks.length === 0, missingChecks };
}

function missingFormalChecks(
  checkpoint: SelectableCheckpoint,
  checksRun: ReadonlySet<string>,
  context?: VerifyCheckpointContext,
): string[] {
  if (!context?.sharedContracts || !context.workItems) return [];
  const dependencies = new Set(checkpoint.dependsOnWorkItemIds);
  const touched = new Set(
    context.workItems
      .filter(({ id }) => dependencies.has(id))
      .flatMap((item) => (item.providesContractIds ?? []).concat(item.consumesContractIds ?? [])),
  );
  const formalExecuted = [...checksRun].some((run) =>
    /\b(?:tla-tlc|lean4|tlc|lake|apalache|verify-formal-kernel)\b/i.test(run),
  );
  return context.sharedContracts
    .filter(
      (contract) =>
        touched.has(contract.id) &&
        (contract.kind === "formal-spec" ||
          /\b(?:tla-tlc|lean4|tlc|lake|apalache)\b/i.test(contract.verificationHint)),
    )
    .filter((contract) => !formalExecuted && !checksRun.has(contract.verificationHint.trim()))
    .map((contract) => contract.verificationHint.trim() || `formal-spec:${contract.id}`);
}

export function normalizeCheckpointPatch(
  patch: Record<string, unknown>,
  now?: string,
): RecordCheckpointResultInput {
  if (patch.status !== "Passed" && patch.status !== "Failed") {
    throw new InvocationError("Checkpoint status must be Passed or Failed.");
  }
  const verifiedAt = typeof patch.verifiedAt === "string" ? patch.verifiedAt : now;
  return {
    checkpointId: typeof patch.checkpointId === "string" ? patch.checkpointId : "",
    observedRoadmapDigest:
      typeof patch.observedRoadmapDigest === "string" ? patch.observedRoadmapDigest : "",
    status: patch.status,
    ...(verifiedAt !== undefined ? { verifiedAt } : {}),
    verifierContext: typeof patch.verifierContext === "string" ? patch.verifierContext : "",
    checksRun: Array.isArray(patch.checksRun)
      ? patch.checksRun.filter((c): c is string => typeof c === "string")
      : [],
    summary: typeof patch.summary === "string" ? patch.summary : "",
    ...(Array.isArray(patch.offendingIds)
      ? {
          offendingIds: patch.offendingIds.filter((id): id is string => typeof id === "string"),
        }
      : {}),
  };
}

import {
  attestContractComplete,
  evaluateContractCompleteness,
  validateShapeState,
  type CanonicalChangeContract,
} from "./shape.js";
import type { TaskState } from "./types.js";

export type GatePreflightRoute =
  | "discovering"
  | "planning"
  | "awaiting_intake_decision"
  | "awaiting_shape_decision"
  | "blocked";

export type GatePreflightResult =
  | { ready: true; contractDigest: string }
  | { ready: false; route: GatePreflightRoute; reason: string };

export type GateIntent =
  | { kind: "approved" }
  | { kind: "change_requested"; instruction: string }
  | { kind: "rejected" }
  | { kind: "view" }
  | { kind: "invalid"; reason: "empty" | "ambiguous" | "instruction_required" };

export type GateCard = readonly [string, string, string, string, string];

export function preflightGate(state: TaskState): GatePreflightResult {
  if (state.status !== "awaiting_approval" || !state.shape || !state.shape.contract) {
    return { ready: false, route: "blocked", reason: "gate_state_invalid" };
  }
  if (state.shape.activeTechnicalDecisionId) {
    return {
      ready: false,
      route: "awaiting_shape_decision",
      reason: "technical_decision_open",
    };
  }
  try {
    validateShapeState(state.shape);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    return {
      ready: false,
      route: /stale|fresh|evidence|source/.test(message) ? "discovering" : "blocked",
      reason: /stale|fresh|evidence|source/.test(message)
        ? "shape_evidence_stale"
        : "shape_state_invalid",
    };
  }
  const completeness = evaluateContractCompleteness(state.shape);
  if (!completeness.complete) {
    const evidenceFailure = completeness.reasons.some((reason) =>
      /discovery|evidence|source|fresh/.test(reason),
    );
    return {
      ready: false,
      route: evidenceFailure ? "discovering" : "planning",
      reason: evidenceFailure ? "shape_evidence_stale" : "contract_incomplete",
    };
  }
  if (state.contractDigest !== state.shape.contract.digest) {
    return { ready: false, route: "planning", reason: "contract_digest_mismatch" };
  }
  const expectedReceipt = attestContractComplete(state.shape);
  const persistedReceipt = state.shape.evaluatorReceipts.find(
    (receipt) => receipt.evaluator === "planning",
  );
  if (
    !persistedReceipt ||
    persistedReceipt.receiptDigest !== expectedReceipt.receiptDigest ||
    persistedReceipt.inputDigest !== expectedReceipt.inputDigest
  ) {
    return { ready: false, route: "planning", reason: "planning_receipt_stale" };
  }
  return { ready: true, contractDigest: state.contractDigest };
}

export function renderGateCard(state: TaskState): string {
  const preflight = preflightGate(state);
  if (!preflight.ready) throw new Error(`GATE preflight failed: ${preflight.reason}.`);
  const contract = state.shape!.contract!;
  const objective = oneLine(
    state.design.productBaseline.dimensions.find((item) => item.key === "objective")?.value ??
      "Objectif non disponible",
    512,
  );
  const lines: GateCard = [
    `Objectif : ${objective}`,
    `Plan : ${contract.tasks.length} tâches · ${contract.acceptanceCriteria.length} critères · ${contract.validations.length} validations`,
    `Risque : ${contract.risk} · ${contract.risks.length} contrôles`,
    `Contrat : ${preflight.contractDigest.slice(0, 8)}…`,
    "[Approuver] [Modifier] [Rejeter] [Voir]",
  ];
  return lines.join("\n");
}

export function renderGateContract(state: TaskState): string {
  const preflight = preflightGate(state);
  if (!preflight.ready) throw new Error(`GATE preflight failed: ${preflight.reason}.`);
  return JSON.stringify(canonical(state.shape!.contract!), null, 2);
}

export function parseGateIntent(value: string): GateIntent {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized) return { kind: "invalid", reason: "empty" };
  if (/^(?:approuver|approve)$/i.test(normalized)) return { kind: "approved" };
  if (/^(?:rejeter|reject)$/i.test(normalized)) return { kind: "rejected" };
  if (/^(?:voir|view)$/i.test(normalized)) return { kind: "view" };
  const change = /^(?:modifier|change)\s*:(.*)$/is.exec(normalized);
  if (change) {
    const instruction = oneLine(change[1] ?? "", 1024).trim();
    return instruction
      ? { kind: "change_requested", instruction }
      : { kind: "invalid", reason: "instruction_required" };
  }
  if (/^(?:modifier|change)$/i.test(normalized)) {
    return { kind: "invalid", reason: "instruction_required" };
  }
  return { kind: "invalid", reason: "ambiguous" };
}

function oneLine(value: string, maximum: number): string {
  return value
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .replaceAll("\0", " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function canonical(value: CanonicalChangeContract): unknown {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalValue(item)]),
  );
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

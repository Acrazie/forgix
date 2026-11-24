import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CONFIG,
  type PolicyInput,
  applyPolicy,
  resolveConfig,
} from "../src/core/config.ts";
import {
  type DependencyGraph,
  canonicalize,
  dependencyClosure,
  sha256Hex,
  validateDependencyGraph,
} from "../src/core/digest.ts";
import {
  type RoadmapBoardStatus,
  type RoadmapCheckpointScopeType,
  type RoadmapPriority,
  type RoadmapSharedContractStatus,
  type RoadmapState,
  computeRoadmapCandidateDigest,
  invalidateDependentsOnContractChange,
  publishRoadmap,
  recordCheckpointResult,
  selectEligibleWorkItems,
  transitionRoadmapWorkItemStatus,
  validateRoadmapState,
} from "../src/roadmap/index.ts";
import {
  MACRO_PHASES,
  TASK_STATUSES,
  applyTaskGateDecision,
  deriveMacroPhase,
  evaluateAutonomousGateEligibility,
  preflightGate,
  validateTaskState,
} from "../src/task/index.ts";
import type {
  CanonicalChangeContract,
  DesignState,
  MacroPhase,
  ProductBaselineDimension,
  RiskLevel,
  ShapeState,
  TaskState,
  TaskStatus,
} from "../src/types.ts";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

export const REQUIRED_FORMAL_FILES = [
  "formal/tla/TaskLifecycleV6.tla",
  "formal/tla/TaskLifecycleV6.cfg",
  "formal/tla/RoadmapParallel.tla",
  "formal/tla/RoadmapParallel.cfg",
  "formal/lean/lean-toolchain",
  "formal/lean/lakefile.toml",
  "formal/lean/ForgixKernel/Invariants.lean",
] as const;

export const REQUIRED_LEAN_THEOREMS = [
  "selective_invalidation_preserves_done",
  "selective_invalidation_preserves_independent",
  "selective_invalidation_marks_fresh_in_closure",
  "selective_invalidation_idempotent",
  "existing_contract_always_covered",
  "planned_contract_requires_ancestor",
  "planned_contract_requires_wave_monotonicity",
  "verified_contract_requires_ancestor",
  "verified_contract_requires_wave_monotonicity",
  "contract_coverage_sound",
  "autonomous_rejects_high_risk",
  "autonomous_rejects_critical_risk",
  "autonomous_rejects_open_question",
  "autonomous_rejects_unresolved_decision",
  "autonomous_rejects_missing_issue_ref",
  "autonomous_rejects_unready_preflight",
  "autonomous_rejects_missing_proof_floor",
  "model_inspection_below_proof_floor",
  "user_observation_below_proof_floor",
  "formal_verifiers_meet_proof_floor",
  "autonomous_eligible_characterization",
  "layer_precedence_strict_chain",
  "policy_prohibition_blocks_forbidden_value",
  "policy_lock_monotonic_against_divergent_override",
] as const;

export const REQUIRED_TASK_TLA_INVARIANTS = [
  "TypeOK",
  "Safety",
  "SafetyReceiptRequired",
  "SafetyAutonomousEligibility",
  "SafetyAssureImmutability",
  "SafetyBlockedResumeTarget",
  "SafetyTerminalSourceRecorded",
  "Liveness",
] as const;

export const REQUIRED_ROADMAP_TLA_INVARIANTS = [
  "TypeOK",
  "Safety",
  "BoundedParallelism",
  "WorktreeIsolation",
  "DependencyOrderSafety",
  "SharedContractCoverageSafety",
  "CheckpointGateSafety",
  "SelectiveInvalidationPreservesDone",
  "Liveness",
] as const;

export type FormalVerifierKind =
  | "command"
  | "runtime-evidence"
  | "tla-tlc"
  | "lean4"
  | "model-inspection"
  | "user-observation";

export interface FormalScanViolation {
  file: string;
  code: string;
  message: string;
}

export interface FormalVerificationReport {
  valid: boolean;
  checkedFiles: string[];
  violations: FormalScanViolation[];
}

export interface DifferentialConformanceSummary {
  passed: boolean;
  transitionPairsChecked: number;
  macroPhaseVectorsChecked: number;
  gateVectorsChecked: number;
  dagClosureVectorsChecked: number;
  contractCoverageVectorsChecked: number;
  parallelRoadmapVectorsChecked: number;
  policyMonotonicityVectorsChecked: number;
  failures: string[];
}

const TOKEN_SORRY = ["sor", "ry"].join("");
const TOKEN_ADMIT = ["ad", "mit"].join("");
const TOKEN_UNSAFE = ["un", "safe"].join("");
const TOKEN_AXIOM = ["ax", "iom"].join("");
const TOKEN_DEADLOCK_OFF = ["CHECK_DEADLOCK", "FALSE"].join("\\s+");
const TOKEN_DEADLOCK_ON = ["CHECK_DEADLOCK", "TRUE"].join("\\s+");

const LEAN_ESCAPE_RULES: ReadonlyArray<{ code: string; pattern: RegExp; message: string }> = [
  {
    code: "lean_proof_hole_sorry",
    pattern: new RegExp(`\\b${TOKEN_SORRY}\\b`),
    message: "Lean 4 proof hole token is forbidden in formal kernel",
  },
  {
    code: "lean_proof_hole_admit",
    pattern: new RegExp(`\\b${TOKEN_ADMIT}\\b`),
    message: `Lean 4 proof ${TOKEN_ADMIT} token is forbidden in formal kernel`,
  },
  {
    code: "lean_unsafe_declaration",
    pattern: new RegExp(`\\b${TOKEN_UNSAFE}\\b`),
    message: "Lean 4 unverified declaration modifier is forbidden in formal kernel",
  },
  {
    code: "lean_unapproved_axiom",
    pattern: new RegExp(`\\b${TOKEN_AXIOM}\\b`),
    message: "Lean 4 unapproved postulate declaration is forbidden in formal kernel",
  },
  {
    code: "lean_implemented_by_override",
    pattern: /\bimplemented_by\b/,
    message: "Lean 4 runtime replacement attribute is forbidden in formal kernel",
  },
  {
    code: "lean_extern_override",
    pattern: /@\[[^\]]*\bextern\b/,
    message: "Lean 4 external FFI attribute is forbidden in formal kernel",
  },
];

function walkFiles(dir: string, extensions: ReadonlySet<string>): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".lake" || entry.name === "build") continue;
        visit(fullPath);
      } else if (entry.isFile()) {
        const dotIndex = entry.name.lastIndexOf(".");
        const ext = dotIndex >= 0 ? entry.name.slice(dotIndex) : "";
        if (extensions.has(ext)) results.push(fullPath);
      }
    }
  };
  visit(dir);
  return results.toSorted();
}

export function scanLeanContentForEscapeHatches(
  file: string,
  content: string,
  options: { requireCoreTheorems?: boolean } = {},
): FormalScanViolation[] {
  const violations: FormalScanViolation[] = [];
  for (const rule of LEAN_ESCAPE_RULES) {
    if (rule.pattern.test(content)) {
      violations.push({ file, code: rule.code, message: rule.message });
    }
  }
  if (options.requireCoreTheorems) {
    for (const theoremName of REQUIRED_LEAN_THEOREMS) {
      const theoremPattern = new RegExp(`\\btheorem\\s+${theoremName}\\b`);
      if (!theoremPattern.test(content)) {
        violations.push({
          file,
          code: "lean_missing_theorem",
          message: `Missing required Lean 4 theorem '${theoremName}'`,
        });
      }
    }
  }
  return violations;
}

export function scanTlaContentForEscapeHatches(
  file: string,
  content: string,
  requiredIdentifiers: readonly string[] = [],
): FormalScanViolation[] {
  const violations: FormalScanViolation[] = [];
  if (!/----+\s*MODULE\s+[A-Za-z0-9_]+\s*----+/.test(content)) {
    violations.push({
      file,
      code: "tla_missing_module_header",
      message: "TLA+ specification must declare a valid MODULE header",
    });
  }
  if (!/====+/.test(content)) {
    violations.push({
      file,
      code: "tla_missing_module_footer",
      message: "TLA+ specification must end with a === footer",
    });
  }
  if (new RegExp(TOKEN_DEADLOCK_OFF, "i").test(content)) {
    violations.push({
      file,
      code: "tla_deadlock_disabled",
      message: "Disabling deadlock checking is forbidden in TLA+ specifications",
    });
  }
  for (const ident of requiredIdentifiers) {
    const pattern = new RegExp(`\\b${ident}\\b`);
    if (!pattern.test(content)) {
      violations.push({
        file,
        code: "tla_missing_invariant",
        message: `Missing required TLA+ definition or status '${ident}'`,
      });
    }
  }
  return violations;
}

export function scanTlaCfgContentForEscapeHatches(
  file: string,
  content: string,
  minimumBounds: Readonly<Record<string, number>> = {},
): FormalScanViolation[] {
  const violations: FormalScanViolation[] = [];
  if (new RegExp(TOKEN_DEADLOCK_OFF, "i").test(content)) {
    violations.push({
      file,
      code: "tla_cfg_deadlock_disabled",
      message: "TLA+ configuration must not disable deadlock checks",
    });
  }
  if (!new RegExp(`^\\s*${TOKEN_DEADLOCK_ON}\\s*$`, "m").test(content)) {
    violations.push({
      file,
      code: "tla_cfg_deadlock_not_enabled",
      message: "TLA+ configuration must explicitly set CHECK_DEADLOCK TRUE",
    });
  }
  if (/^\s*(?:ACTION_)?CONSTRAINT\b/m.test(content)) {
    violations.push({
      file,
      code: "tla_cfg_unapproved_constraint",
      message: "Unapproved CONSTRAINT or ACTION_CONSTRAINT state-space pruning is forbidden",
    });
  }
  if (!/^\s*SPECIFICATION\s+Spec\b/m.test(content)) {
    violations.push({
      file,
      code: "tla_cfg_missing_specification",
      message: "TLA+ configuration must bind SPECIFICATION Spec",
    });
  }
  if (!/^\s*INVARIANT\s+Safety\b/m.test(content)) {
    violations.push({
      file,
      code: "tla_cfg_missing_safety_invariant",
      message: "TLA+ configuration must check INVARIANT Safety",
    });
  }
  if (!/^\s*PROPERTY\s+Liveness\b/m.test(content)) {
    violations.push({
      file,
      code: "tla_cfg_missing_liveness_property",
      message: "TLA+ configuration must check PROPERTY Liveness",
    });
  }

  for (const [constantName, minVal] of Object.entries(minimumBounds)) {
    const match = new RegExp(`\\b${constantName}\\s*=\\s*(-?\\d+)\\b`).exec(content);
    if (!match || match[1] === undefined) {
      violations.push({
        file,
        code: "tla_cfg_missing_constant_bound",
        message: `Missing required CONSTANT bound '${constantName}' (minimum ${minVal})`,
      });
      continue;
    }
    const parsed = Number(match[1]);
    if (!Number.isInteger(parsed) || parsed < minVal) {
      violations.push({
        file,
        code: "tla_cfg_weakened_constant_bound",
        message: `CONSTANT '${constantName}' bound ${parsed} is below minimum contract baseline ${minVal}`,
      });
    }
  }
  return violations;
}

export function verifyFormalKernelFiles(rootDir = REPO_ROOT): FormalVerificationReport {
  const violations: FormalScanViolation[] = [];
  const checkedFiles: string[] = [];

  for (const relPath of REQUIRED_FORMAL_FILES) {
    const absPath = join(rootDir, relPath);
    if (!existsSync(absPath)) {
      violations.push({
        file: relPath,
        code: "formal_file_missing",
        message: `Required formal specification file '${relPath}' is missing`,
      });
    } else {
      checkedFiles.push(relPath);
    }
  }

  const pkgPath = join(rootDir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { files?: string[] };
    const publishedFiles = pkg.files ?? [];
    if (publishedFiles.some((entry) => entry === "formal" || entry.startsWith("formal/"))) {
      violations.push({
        file: "package.json",
        code: "formal_leaked_into_tarball",
        message: "formal/ directory must remain excluded from package.json#files",
      });
    }
  }

  const leanFiles = walkFiles(join(rootDir, "formal", "lean"), new Set([".lean"]));
  if (leanFiles.length === 0) {
    violations.push({
      file: "formal/lean",
      code: "formal_lean_empty",
      message: "No .lean files found under formal/lean",
    });
  }
  for (const absPath of leanFiles) {
    const relPath = relative(rootDir, absPath).split(sep).join("/");
    if (!checkedFiles.includes(relPath)) checkedFiles.push(relPath);
    const content = readFileSync(absPath, "utf8");
    const isCoreInvariants = relPath === "formal/lean/ForgixKernel/Invariants.lean";
    violations.push(
      ...scanLeanContentForEscapeHatches(relPath, content, {
        requireCoreTheorems: isCoreInvariants,
      }),
    );
  }

  const tlaFiles = walkFiles(join(rootDir, "formal", "tla"), new Set([".tla", ".cfg"]));
  if (tlaFiles.length === 0) {
    violations.push({
      file: "formal/tla",
      code: "formal_tla_empty",
      message: "No .tla or .cfg files found under formal/tla",
    });
  }
  for (const absPath of tlaFiles) {
    const relPath = relative(rootDir, absPath).split(sep).join("/");
    if (!checkedFiles.includes(relPath)) checkedFiles.push(relPath);
    const content = readFileSync(absPath, "utf8");
    if (relPath.endsWith(".tla")) {
      const requiredIds =
        relPath === "formal/tla/TaskLifecycleV6.tla"
          ? [...TASK_STATUSES, ...REQUIRED_TASK_TLA_INVARIANTS]
          : relPath === "formal/tla/RoadmapParallel.tla"
            ? [...REQUIRED_ROADMAP_TLA_INVARIANTS]
            : ["Safety", "Liveness"];
      violations.push(...scanTlaContentForEscapeHatches(relPath, content, requiredIds));
    } else if (relPath.endsWith(".cfg")) {
      const bounds: Record<string, number> =
        relPath === "formal/tla/RoadmapParallel.cfg"
          ? { MaxWorkItems: 3, MaxParallel: 2 }
          : relPath === "formal/tla/TaskLifecycleV6.cfg"
            ? { MaxRevisions: 4 }
            : {};
      violations.push(...scanTlaCfgContentForEscapeHatches(relPath, content, bounds));
    }
  }

  return {
    valid: violations.length === 0,
    checkedFiles: checkedFiles.toSorted(),
    violations,
  };
}

// ============================================================================
// Executable Formal Specification Kernel Reference Model
// ============================================================================

const FORMAL_RESUMABLE_STATUSES: ReadonlySet<TaskStatus> = new Set([
  "intaking",
  "discovering",
  "awaiting_shape_decision",
  "awaiting_profile_choice",
  "planning",
  "awaiting_intake_decision",
  "awaiting_approval",
  "executing",
  "assuring",
]);

const FORMAL_TRANSITION_TABLE: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  new: ["intaking", "blocked", "cancelled", "failed"],
  intaking: ["discovering", "awaiting_intake_decision", "blocked", "cancelled", "failed"],
  discovering: [
    "awaiting_shape_decision",
    "awaiting_profile_choice",
    "planning",
    "awaiting_intake_decision",
    "blocked",
    "cancelled",
    "failed",
  ],
  awaiting_shape_decision: [
    "discovering",
    "planning",
    "awaiting_intake_decision",
    "blocked",
    "cancelled",
    "failed",
  ],
  awaiting_profile_choice: [
    "planning",
    "discovering",
    "awaiting_intake_decision",
    "blocked",
    "cancelled",
    "failed",
  ],
  planning: [
    "discovering",
    "awaiting_shape_decision",
    "awaiting_intake_decision",
    "awaiting_approval",
    "blocked",
    "cancelled",
    "failed",
  ],
  awaiting_intake_decision: [
    "intaking",
    "discovering",
    "planning",
    "blocked",
    "cancelled",
    "failed",
  ],
  awaiting_approval: [
    "executing",
    "planning",
    "discovering",
    "intaking",
    "awaiting_intake_decision",
    "blocked",
    "cancelled",
    "failed",
  ],
  executing: ["assuring", "planning", "awaiting_approval", "blocked", "cancelled", "failed"],
  assuring: ["executing", "planning", "awaiting_approval", "blocked", "cancelled", "failed"],
  blocked: [...Array.from(FORMAL_RESUMABLE_STATUSES), "cancelled", "failed"],
  cancelled: [],
  failed: [],
};

const FORMAL_ACTIVE_PHASE: Readonly<Partial<Record<TaskStatus, MacroPhase>>> = {
  new: "INTAKE",
  intaking: "INTAKE",
  awaiting_intake_decision: "INTAKE",
  discovering: "SHAPE",
  awaiting_shape_decision: "SHAPE",
  awaiting_profile_choice: "SHAPE",
  planning: "SHAPE",
  awaiting_approval: "GATE",
  executing: "BUILD",
  assuring: "ASSURE",
};

export function formalCanTransition(from: TaskStatus, to: TaskStatus): boolean {
  return FORMAL_TRANSITION_TABLE[from].includes(to);
}

export function formalDeriveMacroPhase(input: {
  status: TaskStatus;
  resumeTo?: TaskStatus;
  terminalSource?: TaskStatus;
  terminalResumeTo?: TaskStatus;
}): MacroPhase | null {
  const direct = FORMAL_ACTIVE_PHASE[input.status];
  if (direct) return direct;
  if (input.status === "blocked") {
    return input.resumeTo ? (FORMAL_ACTIVE_PHASE[input.resumeTo] ?? null) : null;
  }
  const effectiveSource =
    input.terminalSource === "blocked" ? input.terminalResumeTo : input.terminalSource;
  return effectiveSource ? (FORMAL_ACTIVE_PHASE[effectiveSource] ?? null) : null;
}

export function formalIsDeterministicVerifier(kind: FormalVerifierKind): boolean {
  return (
    kind === "command" || kind === "runtime-evidence" || kind === "tla-tlc" || kind === "lean4"
  );
}

export function formalEvaluateProofFloor(
  criteriaVerifiers: readonly (readonly FormalVerifierKind[])[],
): boolean {
  if (criteriaVerifiers.length === 0) return false;
  return criteriaVerifiers.every((verifiers) => verifiers.some(formalIsDeterministicVerifier));
}

export function formalEvaluateAutonomousGate(input: {
  risk: RiskLevel;
  hasOpenQuestion: boolean;
  hasUnresolvedDecision: boolean;
  hasValidIssueRef: boolean;
  preflightReady: boolean;
  proofFloorMet: boolean;
}): boolean {
  const riskAllowed = input.risk === "low" || input.risk === "medium";
  return (
    riskAllowed &&
    !input.hasOpenQuestion &&
    !input.hasUnresolvedDecision &&
    input.hasValidIssueRef &&
    input.preflightReady &&
    input.proofFloorMet
  );
}

export function formalCheckExecutionSafety(input: {
  status: TaskStatus;
  risk: RiskLevel;
  contractDigest: string | null;
  receiptActor: "none" | "user" | "autonomous_policy";
  receiptDigest: string | null;
  hasOpenQuestion: boolean;
  hasUnresolvedDecision: boolean;
  hasValidIssueRef: boolean;
  proofFloorMet: boolean;
}): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  if (input.status === "executing" || input.status === "assuring") {
    if (input.receiptActor !== "user" && input.receiptActor !== "autonomous_policy") {
      violations.push("missing_approval_receipt");
    }
    if (!input.contractDigest || input.receiptDigest !== input.contractDigest) {
      violations.push("contract_digest_mismatch");
    }
  }
  if (input.receiptActor === "autonomous_policy") {
    if (input.risk !== "low" && input.risk !== "medium") {
      violations.push("autonomous_risk_exceeded");
    }
    if (input.hasOpenQuestion) {
      violations.push("autonomous_open_question");
    }
    if (input.hasUnresolvedDecision) {
      violations.push("autonomous_unresolved_decision");
    }
    if (!input.hasValidIssueRef) {
      violations.push("autonomous_missing_issue_ref");
    }
    if (!input.proofFloorMet) {
      violations.push("autonomous_proof_floor_violated");
    }
  }
  return { safe: violations.length === 0, violations };
}

export function formalDependencyClosure(
  nodes: readonly { id: string; dependsOn: readonly string[] }[],
  roots: readonly string[],
): string[] {
  const knownIds = new Set(nodes.map((node) => node.id));
  for (const root of roots) {
    if (!knownIds.has(root)) {
      throw new Error(`Unknown root '${root}'`);
    }
  }
  const closure = new Set<string>(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (closure.has(node.id)) continue;
      if (node.dependsOn.some((dep) => closure.has(dep))) {
        closure.add(node.id);
        changed = true;
      }
    }
  }
  return [...closure].toSorted();
}

export function formalSelectiveContractInvalidation(input: {
  workItems: readonly {
    id: string;
    featureId: string;
    status: RoadmapBoardStatus;
    blockedBy: readonly string[];
    consumesContractIds: readonly string[];
  }[];
  checkpoints: readonly {
    id: string;
    scopeType: RoadmapCheckpointScopeType;
    targetIds: readonly string[];
    dependsOnWorkItemIds: readonly string[];
  }[];
  changedContractIds: readonly string[];
}): {
  invalidatedWorkItemIds: string[];
  invalidatedCheckpointIds: string[];
  preservedDoneIds: string[];
  preservedIndependentIds: string[];
} {
  const changed = new Set(input.changedContractIds);
  const invalidated = new Set<string>();
  const preservedDone: string[] = [];

  for (const item of input.workItems) {
    const consumesChanged = item.consumesContractIds.some((id) => changed.has(id));
    if (consumesChanged) {
      if (item.status === "Done") {
        preservedDone.push(item.id);
      } else {
        invalidated.add(item.id);
      }
    }
  }

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const item of input.workItems) {
      if (invalidated.has(item.id)) continue;
      if (item.blockedBy.some((dep) => invalidated.has(dep))) {
        if (item.status === "Done") {
          if (!preservedDone.includes(item.id)) preservedDone.push(item.id);
        } else {
          invalidated.add(item.id);
          progressed = true;
        }
      }
    }
  }

  const invalidatedFeatures = new Set<string>();
  const preservedIndependent: string[] = [];
  for (const item of input.workItems) {
    if (invalidated.has(item.id)) {
      invalidatedFeatures.add(item.featureId);
    } else if (item.status !== "Done") {
      preservedIndependent.push(item.id);
    }
  }

  const invalidatedCheckpointIds: string[] = [];
  for (const cp of input.checkpoints) {
    const touchesItem = cp.dependsOnWorkItemIds.some((id) => invalidated.has(id));
    const touchesFeature =
      cp.scopeType === "feature" && cp.targetIds.some((id) => invalidatedFeatures.has(id));
    if (touchesItem || touchesFeature) {
      invalidatedCheckpointIds.push(cp.id);
    }
  }

  return {
    invalidatedWorkItemIds: [...invalidated],
    invalidatedCheckpointIds,
    preservedDoneIds: preservedDone.toSorted(),
    preservedIndependentIds: preservedIndependent.toSorted(),
  };
}

export function formalCheckSharedContractCoverage(input: {
  workItems: readonly {
    id: string;
    wave: number;
    blockedBy: readonly string[];
    providesContractIds: readonly string[];
    consumesContractIds: readonly string[];
  }[];
  contracts: readonly {
    id: string;
    status: RoadmapSharedContractStatus;
  }[];
}): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const contractsById = new Map(input.contracts.map((c) => [c.id, c]));
  const providerByContract = new Map<string, { id: string; wave: number }>();

  for (const item of input.workItems) {
    for (const provided of item.providesContractIds) {
      if (!contractsById.has(provided)) {
        violations.push(`unknown_provided_contract:${item.id}:${provided}`);
        continue;
      }
      if (providerByContract.has(provided)) {
        violations.push(`duplicate_contract_provider:${provided}`);
        continue;
      }
      providerByContract.set(provided, { id: item.id, wave: item.wave });
    }
  }

  const itemsById = new Map(input.workItems.map((item) => [item.id, item]));
  const ancestorsOf = (startId: string): Set<string> => {
    const visited = new Set<string>();
    const stack = [...(itemsById.get(startId)?.blockedBy ?? [])];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      for (const parent of itemsById.get(current)?.blockedBy ?? []) {
        stack.push(parent);
      }
    }
    return visited;
  };

  for (const item of input.workItems) {
    const ancestors = ancestorsOf(item.id);
    for (const consumed of item.consumesContractIds) {
      const contract = contractsById.get(consumed);
      if (!contract) {
        violations.push(`unknown_consumed_contract:${item.id}:${consumed}`);
        continue;
      }
      if (contract.status === "existing") continue;
      const provider = providerByContract.get(consumed);
      if (!provider) {
        violations.push(`missing_contract_provider:${item.id}:${consumed}`);
        continue;
      }
      if (provider.id === item.id || !ancestors.has(provider.id)) {
        violations.push(`unblocked_contract_provider:${item.id}:${consumed}:${provider.id}`);
      }
      if (item.wave < provider.wave) {
        violations.push(`wave_inversion:${item.id}:${consumed}:${provider.id}`);
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

const FORMAL_PRIORITY_RANK: Readonly<Record<RoadmapPriority, number>> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

const FORMAL_RISK_RANK: Readonly<Record<RiskLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function formalSelectParallelWave(input: {
  workItems: readonly {
    id: string;
    wave: number;
    priority: RoadmapPriority;
    risk: RiskLevel;
    status: RoadmapBoardStatus;
    blockedBy: readonly string[];
  }[];
  checkpoints: readonly {
    id: string;
    scopeType: RoadmapCheckpointScopeType;
    targetIds: readonly string[];
    dependsOnWorkItemIds: readonly string[];
    passed: boolean;
  }[];
  maxParallel: number;
  maxRisk: RiskLevel;
}): { eligibleIds: string[]; readyCheckpointIds: string[] } {
  const byId = new Map(input.workItems.map((item) => [item.id, item]));
  const readyCheckpointIds: string[] = [];

  for (const cp of input.checkpoints) {
    if (cp.passed) continue;
    const depsDone = cp.dependsOnWorkItemIds.every((id) => byId.get(id)?.status === "Done");
    if (depsDone) readyCheckpointIds.push(cp.id);
  }

  const waveBlocked = (wave: number): boolean => {
    if (wave <= 1) return false;
    return input.checkpoints.some((cp) => {
      if (cp.scopeType !== "wave" || cp.passed) return false;
      return cp.targetIds.some((target) => {
        const match = /^(?:wave[-_]?)?(\d+)$/i.exec(target.trim());
        return Boolean(match && Number(match[1]) < wave);
      });
    });
  };

  const candidates = input.workItems.filter((item) => {
    if (item.status !== "Ready") return false;
    if (FORMAL_RISK_RANK[item.risk] > FORMAL_RISK_RANK[input.maxRisk]) return false;
    if (item.blockedBy.some((dep) => byId.get(dep)?.status !== "Done")) return false;
    if (waveBlocked(item.wave)) return false;
    return true;
  });

  candidates.sort((a, b) => {
    if (a.wave !== b.wave) return a.wave - b.wave;
    const prioDiff = FORMAL_PRIORITY_RANK[a.priority] - FORMAL_PRIORITY_RANK[b.priority];
    if (prioDiff !== 0) return prioDiff;
    return a.id.localeCompare(b.id);
  });

  return {
    eligibleIds: candidates.slice(0, Math.max(0, input.maxParallel)).map((item) => item.id),
    readyCheckpointIds,
  };
}

export function formalEvaluatePolicyMonotonicity(input: {
  layers: readonly { source: string; values: Readonly<Record<string, unknown>> }[];
  requirements: Readonly<Record<string, unknown>>;
  prohibitions: Readonly<Record<string, unknown>>;
}): {
  effective: Record<string, unknown>;
  provenance: Record<string, string>;
  allowed: boolean;
  violatedPath?: string;
} {
  const effective: Record<string, unknown> = {};
  const provenance: Record<string, string> = {};

  for (const layer of input.layers) {
    for (const [path, val] of Object.entries(layer.values)) {
      effective[path] = val;
      provenance[path] = layer.source;
    }
  }

  for (const [path, reqVal] of Object.entries(input.requirements)) {
    if (effective[path] !== reqVal) {
      return { effective, provenance, allowed: false, violatedPath: path };
    }
  }

  for (const [path, forbVal] of Object.entries(input.prohibitions)) {
    if (effective[path] === forbVal) {
      return { effective, provenance, allowed: false, violatedPath: path };
    }
  }

  return { effective, provenance, allowed: true };
}

// ============================================================================
// Differential Conformance Oracle Runner (Formal Kernel <-> Production Runtime)
// ============================================================================

function makeMinimalDesign(): DesignState {
  const keys: ProductBaselineDimension["key"][] = [
    "objective",
    "users_value",
    "scope",
    "success",
    "risks_constraints",
  ];
  return {
    schemaVersion: 1,
    graph: {
      schemaVersion: 1,
      nodes: keys.map((key) => ({ id: `product:${key}`, kind: "product" as const, dependsOn: [] })),
    },
    productBaseline: {
      schemaVersion: 1,
      dimensions: keys.map((key) => ({
        key,
        status: "resolved" as const,
        value: `${key} verified`,
        provenance: { sourceRefs: ["spec"], freshnessRefs: ["spec:v1"] },
        dependencyNodeId: `product:${key}`,
      })),
    },
    glossaryDeltas: [],
    domainRules: [],
  };
}

function makeMinimalContract(risk: RiskLevel = "low"): CanonicalChangeContract {
  const base: Omit<CanonicalChangeContract, "digest"> = {
    schemaVersion: 1,
    artifactId: "artifact:formal-oracle",
    revision: 1,
    profile: "quick",
    risk,
    productBaselineRef: "design:product-baseline:1",
    scope: ["Verify differential conformance"],
    nonGoals: ["None"],
    acceptanceCriteria: [
      {
        id: "criterion.1",
        description: "Invariants hold",
        validationIds: ["validation.1"],
        dependencyNodeId: "criterion.1",
      },
    ],
    tasks: [
      {
        id: "task.1",
        description: "Execute conformance check",
        criterionIds: ["criterion.1"],
        dependsOnTaskIds: [],
        dependencyNodeId: "task.1",
      },
    ],
    validations: [
      {
        id: "validation.1",
        description: "Run bun test",
        criterionIds: ["criterion.1"],
        command: "bun test",
        dependencyNodeId: "validation.1",
      },
    ],
    risks: [],
  };
  return {
    ...base,
    digest: sha256Hex(canonicalize({ ...base, digest: "" })),
  };
}

function makeMinimalShape(risk: RiskLevel = "low", includeContract = true): ShapeState {
  const contract = includeContract ? makeMinimalContract(risk) : undefined;
  return {
    schemaVersion: 1,
    risk,
    productBaselineRef: "design:product-baseline:1",
    discoveryTargets: [],
    sourceFingerprints: [
      {
        id: "fp.1",
        kind: "content",
        value: "sha256:v1",
        provenanceRef: "repo:formal",
        dependencyNodeId: "source.1",
      },
    ],
    evidence: [
      {
        id: "ev.1",
        fact: "Verified",
        provenanceRefs: ["repo:formal"],
        sourceFingerprintIds: ["fp.1"],
        dependencyNodeId: "evidence.1",
        expectedValue: "sha256:v1",
        observedValue: "sha256:v1",
      },
    ],
    technicalDecisions: [],
    ...(contract ? { contract } : {}),
    dependencyGraph: {
      schemaVersion: 1,
      nodes: [
        { id: "criterion.1", kind: "criterion", dependsOn: ["evidence.1"] },
        { id: "evidence.1", kind: "evidence", dependsOn: ["source.1"] },
        { id: "source.1", kind: "source", dependsOn: [] },
        { id: "task.1", kind: "task", dependsOn: ["criterion.1"] },
        { id: "validation.1", kind: "validation", dependsOn: ["evidence.1"] },
      ],
    },
  };
}

export function buildReachableTaskStateForStatus(
  status: TaskStatus,
  risk: RiskLevel = "low",
): TaskState {
  const shape = makeMinimalShape(risk, true);
  const contractDigest = shape.contract!.digest;
  const base: TaskState = {
    schemaVersion: 6,
    taskId: "formal-task",
    status: "new",
    revision: 0,
    risk,
    design: makeMinimalDesign(),
    configSnapshot: { schemaVersion: 1 },
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
        at: "2026-11-18T00:00:00.000Z",
        type: "task.created",
        refs: [{ kind: "task", ref: "formal-task" }],
      },
    ],
  };

  if (status === "new") return validateTaskState(base);

  const pathMap: Record<Exclude<TaskStatus, "new">, TaskStatus[]> = {
    intaking: ["intaking"],
    awaiting_intake_decision: ["intaking", "awaiting_intake_decision"],
    discovering: ["intaking", "discovering"],
    awaiting_shape_decision: ["intaking", "discovering", "awaiting_shape_decision"],
    awaiting_profile_choice: ["intaking", "discovering", "awaiting_profile_choice"],
    planning: ["intaking", "discovering", "planning"],
    awaiting_approval: ["intaking", "discovering", "planning", "awaiting_approval"],
    executing: ["intaking", "discovering", "planning", "awaiting_approval", "executing"],
    assuring: ["intaking", "discovering", "planning", "awaiting_approval", "executing", "assuring"],
    blocked: ["intaking", "blocked"],
    cancelled: ["intaking", "cancelled"],
    failed: ["intaking", "failed"],
  };

  if (status === "executing" || status === "assuring") {
    const awaiting = buildReachableTaskStateForStatus("awaiting_approval", risk);
    const approved = applyTaskGateDecision(awaiting, {
      decision: "approve",
      decidedAt: "2026-11-18T00:05:00.000Z",
    }).state;
    if (status === "executing") return approved;
    return validateTaskState({
      ...approved,
      status: "assuring",
      revision: approved.revision + 1,
      assurance: { schemaVersion: 1, evidenceIndex: [] },
      history: [
        ...approved.history,
        {
          sequence: approved.history.length + 1,
          at: "2026-11-18T00:06:00.000Z",
          type: "state.transition",
          from: "executing",
          to: "assuring",
          revision: approved.revision + 1,
          sourceFingerprint: "fp:exec",
        },
      ],
    });
  }

  if (status === "blocked") {
    const intaking = buildReachableTaskStateForStatus("intaking", risk);
    return validateTaskState({
      ...intaking,
      status: "blocked",
      revision: intaking.revision + 1,
      resumeTo: "intaking",
      resumeReason: "Wait for operator",
      history: [
        ...intaking.history,
        {
          sequence: intaking.history.length + 1,
          at: "2026-11-18T00:02:00.000Z",
          type: "state.transition",
          from: "intaking",
          to: "blocked",
          revision: intaking.revision + 1,
          sourceFingerprint: "fp:block",
        },
      ],
    });
  }

  if (status === "cancelled" || status === "failed") {
    const intaking = buildReachableTaskStateForStatus("intaking", risk);
    return validateTaskState({
      ...intaking,
      status,
      revision: intaking.revision + 1,
      history: [
        ...intaking.history,
        {
          sequence: intaking.history.length + 1,
          at: "2026-11-18T00:02:00.000Z",
          type: "state.transition",
          from: "intaking",
          to: status,
          revision: intaking.revision + 1,
          sourceFingerprint: "fp:term",
          terminalSource: "intaking",
        },
      ],
    });
  }

  const steps = pathMap[status];
  const current: TaskState = structuredClone(base);
  let prev: TaskStatus = "new";
  for (const nextStatus of steps) {
    const nextRev = current.revision + 1;
    const seq = current.history.length + 1;
    current.status = nextStatus;
    current.revision = nextRev;
    current.shape = shape;
    current.contractDigest = contractDigest;
    current.history.push({
      sequence: seq,
      at: `2026-11-18T00:0${nextRev}:00.000Z`,
      type: "state.transition",
      from: prev,
      to: nextStatus,
      revision: nextRev,
      sourceFingerprint: `fp:${nextRev}`,
      ...(nextStatus === "awaiting_approval" ? { contractDigest } : {}),
    });
    prev = nextStatus;
  }
  return validateTaskState(current);
}

export function runDifferentialConformanceOracle(): DifferentialConformanceSummary {
  const failures: string[] = [];
  let transitionPairsChecked = 0;
  let macroPhaseVectorsChecked = 0;
  let gateVectorsChecked = 0;
  let dagClosureVectorsChecked = 0;
  let contractCoverageVectorsChecked = 0;
  let parallelRoadmapVectorsChecked = 0;
  let policyMonotonicityVectorsChecked = 0;

  // 1. Exhaustive 13x13 TaskStatus transition matrix conformance
  for (const fromStatus of TASK_STATUSES) {
    const sourceState = buildReachableTaskStateForStatus(fromStatus, "low");
    for (const toStatus of TASK_STATUSES) {
      transitionPairsChecked += 1;
      const formalAllowed = formalCanTransition(fromStatus, toStatus);

      let candidate: TaskState = {
        ...structuredClone(sourceState),
        status: toStatus,
        revision: sourceState.revision + 1,
        history: [
          ...sourceState.history,
          {
            sequence: sourceState.history.length + 1,
            at: "2026-11-18T00:10:00.000Z",
            type: "state.transition",
            from: fromStatus,
            to: toStatus,
            revision: sourceState.revision + 1,
            sourceFingerprint: "fp:matrix",
            ...(toStatus === "cancelled" || toStatus === "failed"
              ? {
                  terminalSource: fromStatus,
                  ...(fromStatus === "blocked" ? { terminalResumeTo: "intaking" as const } : {}),
                }
              : {}),
          },
        ],
      };

      if (toStatus === "blocked") {
        candidate = {
          ...candidate,
          resumeTo: fromStatus === "new" ? "intaking" : fromStatus,
          resumeReason: "Blocked for conformance check",
        };
      } else {
        delete candidate.resumeTo;
        delete candidate.resumeReason;
      }

      if (toStatus === "executing" || toStatus === "assuring") {
        const approvedTemplate = buildReachableTaskStateForStatus("executing", "low");
        candidate = {
          ...candidate,
          shape: structuredClone(approvedTemplate.shape!),
          contractDigest: approvedTemplate.contractDigest!,
          planApproval: {
            ...structuredClone(approvedTemplate.planApproval!),
            stateRevision: sourceState.revision,
          },
          ...(toStatus === "assuring"
            ? { assurance: { schemaVersion: 1, evidenceIndex: [] } }
            : {}),
        };
        const { receiptDigest: _ignored, ...restReceipt } = candidate.planApproval!;
        candidate.planApproval = {
          ...restReceipt,
          receiptDigest: sha256Hex(canonicalize(restReceipt)),
        };
      }

      let runtimeAllowed = false;
      try {
        validateTaskState(candidate);
        runtimeAllowed = true;
      } catch {
        runtimeAllowed = false;
      }

      if (formalAllowed !== runtimeAllowed) {
        failures.push(
          `Transition mismatch for ${fromStatus} -> ${toStatus}: formal=${formalAllowed}, runtime=${runtimeAllowed}`,
        );
      }
    }
  }

  // 2. Macro-phase derivation conformance
  for (const status of TASK_STATUSES) {
    macroPhaseVectorsChecked += 1;
    const state = buildReachableTaskStateForStatus(status, "low");
    const runtimePhase = deriveMacroPhase(state);
    const formalPhase = formalDeriveMacroPhase({
      status,
      ...(state.resumeTo !== undefined ? { resumeTo: state.resumeTo } : {}),
      ...(status === "cancelled" || status === "failed" ? { terminalSource: "intaking" } : {}),
    });
    if (formalPhase !== runtimePhase || !MACRO_PHASES.includes(runtimePhase)) {
      failures.push(
        `MacroPhase mismatch for ${status}: formal=${String(formalPhase)}, runtime=${runtimePhase}`,
      );
    }
  }

  // 3. Autonomous Gate & Plan Approval Receipt safety vectors
  const risks: RiskLevel[] = ["low", "medium", "high", "critical"];
  for (const risk of risks) {
    for (const hasOpenQuestion of [false, true]) {
      for (const hasUnresolvedDecision of [false, true]) {
        for (const hasValidIssueRef of [false, true]) {
          for (const proofFloorMet of [false, true]) {
            gateVectorsChecked += 1;
            const state = buildReachableTaskStateForStatus("awaiting_approval", risk);
            if (hasOpenQuestion) {
              state.design.activeQuestion = {
                schemaVersion: 1,
                id: "q.1",
                decisionKey: "scope.q",
                kind: "product",
                owner: "intake",
                subjectIds: ["product:objective"],
                prerequisiteIds: [],
                prompt: "Clarify scope?",
                mode: "elicitation",
                priorRole: "intaking",
                selectionReason: "Blocking ambiguity",
                directConsequences: ["Alters scope"],
                freeFormAllowed: true,
                clarificationCount: 0,
              };
            }
            if (hasUnresolvedDecision && state.shape) {
              state.shape.technicalDecisions = [
                {
                  schemaVersion: 1,
                  id: "td.1",
                  decisionKey: "arch.1",
                  targetId: "target.1",
                  materialityReason: "Cross-cutting",
                  evidenceIds: ["ev.1"],
                  options: [
                    { id: "opt.a", label: "Option A", impact: "Low" },
                    { id: "opt.b", label: "Option B", impact: "High" },
                  ],
                  recommendedOptionId: "opt.a",
                  recommendationBasis: "Evidence",
                  confidence: "high",
                  adrQualified: true,
                  affectedDependencyRootIds: ["source.1"],
                  priorRole: "discovering",
                  status: "active",
                },
              ];
            }
            if (!proofFloorMet && state.shape?.contract) {
              state.shape.contract.validations = [];
              state.shape.contract.digest = sha256Hex(
                canonicalize({ ...state.shape.contract, digest: "" }),
              );
              state.contractDigest = state.shape.contract.digest;
            }

            const preflight = preflightGate(state);
            const formalEligible = formalEvaluateAutonomousGate({
              risk,
              hasOpenQuestion,
              hasUnresolvedDecision,
              hasValidIssueRef,
              preflightReady: preflight.ready,
              proofFloorMet,
            });
            const runtimeEligibility = evaluateAutonomousGateEligibility(state, {
              issueRef: hasValidIssueRef ? "local:wi-formal" : "",
            });

            if (formalEligible !== runtimeEligibility.eligible) {
              failures.push(
                `Autonomous gate mismatch (risk=${risk}, openQ=${hasOpenQuestion}, unresD=${hasUnresolvedDecision}, issueRef=${hasValidIssueRef}, floor=${proofFloorMet}): formal=${formalEligible}, runtime=${runtimeEligibility.eligible}`,
              );
            }
          }
        }
      }
    }
  }

  // 4. DAG Selective Transitive Dependency Closure vectors
  const dagGraph: DependencyGraph = {
    schemaVersion: 1,
    nodes: [
      { id: "source.auth", kind: "source", dependsOn: [] },
      { id: "source.billing", kind: "source", dependsOn: [] },
      { id: "evidence.auth", kind: "evidence", dependsOn: ["source.auth"] },
      { id: "evidence.billing", kind: "evidence", dependsOn: ["source.billing"] },
      { id: "criterion.auth", kind: "criterion", dependsOn: ["evidence.auth"] },
      {
        id: "task.join",
        kind: "task",
        dependsOn: ["criterion.auth", "evidence.billing"],
      },
      { id: "validation.independent", kind: "validation", dependsOn: ["evidence.billing"] },
    ],
  };
  const validatedGraph = validateDependencyGraph(dagGraph);
  const rootSets: ReadonlyArray<readonly string[]> = [
    ["source.auth"],
    ["source.billing"],
    ["evidence.auth"],
    ["criterion.auth"],
    ["source.auth", "source.billing"],
  ];
  for (const roots of rootSets) {
    dagClosureVectorsChecked += 1;
    const formalClosure = formalDependencyClosure(validatedGraph.nodes, roots);
    const runtimeClosure = dependencyClosure(validatedGraph, roots);
    if (JSON.stringify(formalClosure) !== JSON.stringify(runtimeClosure)) {
      failures.push(
        `DAG closure mismatch for roots [${roots.join(", ")}]: formal=${JSON.stringify(formalClosure)} vs runtime=${JSON.stringify(runtimeClosure)}`,
      );
    }
  }

  // 5. Shared Contract Coverage & Selective Invalidation vectors
  const baseRoadmap: RoadmapState = {
    schemaVersion: 1,
    sessionId: "formal-roadmap",
    phase: "convergence",
    codebaseKind: "existing",
    projectMode: "create",
    visualFormat: "tree",
    updatedAt: "2026-11-18T00:00:00.000Z",
    productVisionPath: "docs/product-vision.md",
    productVisionSummary: "Formal verification roadmap",
    themes: [{ id: "theme-formal", title: "Formal", summary: "Formal lane" }],
    sharedContracts: [
      {
        id: "contract-auth",
        title: "Auth Token Contract",
        kind: "interface",
        status: "verified",
        summary: "Auth token claims",
        invariants: ["Token carries sub and exp"],
        verificationHint: "bun test",
      },
      {
        id: "contract-billing",
        title: "Billing Webhook Contract",
        kind: "schema",
        status: "planned",
        summary: "Webhook payload schema",
        invariants: ["Signature header present"],
        verificationHint: "bun test",
      },
    ],
    features: [
      {
        id: "feat-1",
        title: "Core Wave 1",
        summary: "Wave 1 foundation",
        priority: "P0",
        risk: "low",
        wave: 1,
        scopeIn: ["Core"],
        scopeOut: ["None"],
      },
      {
        id: "feat-2",
        title: "Consumer Wave 2",
        summary: "Wave 2 integration",
        priority: "P1",
        risk: "medium",
        wave: 2,
        scopeIn: ["Consumer"],
        scopeOut: ["None"],
      },
    ],
    workItems: [
      {
        id: "wi-1",
        featureId: "feat-1",
        title: "Auth provider",
        objective: "Provide auth contract",
        scopeIn: ["src/auth"],
        scopeOut: ["None"],
        acceptanceCriteria: ["Passes auth unit tests"],
        risk: "low",
        priority: "P0",
        wave: 1,
        blockedBy: [],
        providesContractIds: ["contract-auth"],
        consumesContractIds: [],
        status: "Done",
      },
      {
        id: "wi-2",
        featureId: "feat-1",
        title: "Billing provider",
        objective: "Provide billing contract",
        scopeIn: ["src/billing"],
        scopeOut: ["None"],
        acceptanceCriteria: ["Passes billing unit tests"],
        risk: "low",
        priority: "P1",
        wave: 1,
        blockedBy: [],
        providesContractIds: ["contract-billing"],
        consumesContractIds: [],
        status: "Ready",
      },
      {
        id: "wi-3",
        featureId: "feat-2",
        title: "Checkout consumer",
        objective: "Consume auth and billing contracts",
        scopeIn: ["src/checkout"],
        scopeOut: ["None"],
        acceptanceCriteria: ["Passes checkout tests"],
        risk: "medium",
        priority: "P1",
        wave: 2,
        blockedBy: ["wi-1", "wi-2"],
        providesContractIds: [],
        consumesContractIds: ["contract-auth", "contract-billing"],
        status: "Ready",
      },
    ],
    verificationCheckpoints: [
      {
        id: "cp-wave-1",
        title: "Wave 1 Gate",
        scopeType: "wave",
        targetIds: ["wave-1"],
        dependsOnWorkItemIds: ["wi-1", "wi-2"],
        checks: ["bun test"],
        independentVerifierRequired: true,
        status: "passed",
      },
    ],
  };

  contractCoverageVectorsChecked += 1;
  const formalCoverageValid = formalCheckSharedContractCoverage({
    workItems: baseRoadmap.workItems.map((w) => ({
      id: w.id,
      wave: w.wave ?? 1,
      blockedBy: w.blockedBy,
      providesContractIds: w.providesContractIds ?? [],
      consumesContractIds: w.consumesContractIds ?? [],
    })),
    contracts: (baseRoadmap.sharedContracts ?? []).map((c) => ({ id: c.id, status: c.status })),
  });
  const candidateDigest = computeRoadmapCandidateDigest(baseRoadmap);
  const auditedRoadmap: RoadmapState = {
    ...baseRoadmap,
    phase: "synthesis",
    candidateDigest,
    audit: {
      candidateDigest,
      auditedAt: "2026-11-18T00:01:00.000Z",
      auditorContext: "formal-auditor",
      findings: [],
      passed: true,
    },
    approval: {
      approved: true,
      approvedAt: "2026-11-18T00:02:00.000Z",
      digest: candidateDigest,
      actor: "operator",
    },
  };
  validateRoadmapState(auditedRoadmap);
  if (!formalCoverageValid.valid) {
    failures.push("Valid roadmap rejected by formal contract coverage oracle");
  }

  // Check selective invalidation preserves Done (wi-1), preserves independent Ready (wi-2), and invalidates consumer (wi-3) + checkpoint (cp-wave-1)
  contractCoverageVectorsChecked += 1;
  const formalInvalidation = formalSelectiveContractInvalidation({
    workItems: auditedRoadmap.workItems.map((w) => ({
      id: w.id,
      featureId: w.featureId,
      status: w.status ?? "Backlog",
      blockedBy: w.blockedBy,
      consumesContractIds: w.consumesContractIds ?? [],
    })),
    checkpoints: (auditedRoadmap.verificationCheckpoints ?? []).map((cp) => ({
      id: cp.id,
      scopeType: cp.scopeType,
      targetIds: cp.targetIds,
      dependsOnWorkItemIds: cp.dependsOnWorkItemIds,
    })),
    changedContractIds: ["contract-auth"],
  });
  const runtimeInvalidation = invalidateDependentsOnContractChange(auditedRoadmap, [
    "contract-auth",
  ]);
  if (
    JSON.stringify(formalInvalidation.invalidatedWorkItemIds) !==
      JSON.stringify(runtimeInvalidation.invalidatedWorkItemIds) ||
    JSON.stringify(formalInvalidation.invalidatedCheckpointIds) !==
      JSON.stringify(runtimeInvalidation.invalidatedCheckpointIds)
  ) {
    failures.push("Selective contract invalidation mismatch between formal kernel and runtime");
  }

  // 6. Parallel Roadmap Wave & Verification Checkpoint Gating vectors
  let simRoadmap: RoadmapState = structuredClone(auditedRoadmap);
  for (const w of simRoadmap.workItems) {
    w.status = w.wave === 1 ? "Ready" : "Backlog";
  }
  for (const cp of simRoadmap.verificationCheckpoints ?? []) {
    cp.status = "pending";
  }
  const simDigest = computeRoadmapCandidateDigest(simRoadmap);
  simRoadmap = {
    ...simRoadmap,
    candidateDigest: simDigest,
    audit: { ...simRoadmap.audit!, candidateDigest: simDigest },
    approval: { ...simRoadmap.approval!, digest: simDigest },
  };
  const published = publishRoadmap(simRoadmap);
  let simRuntime = published.runtime;

  // Step A: Wave 1 parallel selection (MaxParallel = 2)
  parallelRoadmapVectorsChecked += 1;
  const formalStepA = formalSelectParallelWave({
    workItems: simRoadmap.workItems.map((w) => ({
      id: w.id,
      wave: w.wave ?? 1,
      priority: w.priority,
      risk: w.risk,
      status: w.status ?? "Backlog",
      blockedBy: w.blockedBy,
    })),
    checkpoints: (simRoadmap.verificationCheckpoints ?? []).map((cp) => ({
      id: cp.id,
      scopeType: cp.scopeType,
      targetIds: cp.targetIds,
      dependsOnWorkItemIds: cp.dependsOnWorkItemIds,
      passed: false,
    })),
    maxParallel: 2,
    maxRisk: "medium",
  });
  const runtimeStepA = selectEligibleWorkItems(simRoadmap, { limit: 2, maxRisk: "medium" });
  if (
    JSON.stringify(formalStepA.eligibleIds) !==
    JSON.stringify(runtimeStepA.eligible.map((e) => e.workItem.id))
  ) {
    failures.push("Parallel roadmap Wave 1 selection mismatch");
  }

  // Step B: Complete Wave 1 items; Wave 2 item (wi-3) is promoted to Ready, but blocked by pending cp-wave-1
  parallelRoadmapVectorsChecked += 1;
  simRoadmap = transitionRoadmapWorkItemStatus(simRoadmap, "wi-1", "Done").state;
  simRoadmap = transitionRoadmapWorkItemStatus(simRoadmap, "wi-2", "Done").state;
  for (const ws of simRuntime.workItemStates) {
    ws.status = ws.id === "wi-1" || ws.id === "wi-2" ? "Done" : "Ready";
  }

  const formalStepB = formalSelectParallelWave({
    workItems: simRoadmap.workItems.map((w) => ({
      id: w.id,
      wave: w.wave ?? 1,
      priority: w.priority,
      risk: w.risk,
      status: w.status ?? "Backlog",
      blockedBy: w.blockedBy,
    })),
    checkpoints: (simRoadmap.verificationCheckpoints ?? []).map((cp) => ({
      id: cp.id,
      scopeType: cp.scopeType,
      targetIds: cp.targetIds,
      dependsOnWorkItemIds: cp.dependsOnWorkItemIds,
      passed: false,
    })),
    maxParallel: 2,
    maxRisk: "medium",
  });
  const runtimeStepB = selectEligibleWorkItems(simRoadmap, {
    limit: 2,
    maxRisk: "medium",
    runtimeState: simRuntime,
  });
  if (
    JSON.stringify(formalStepB.eligibleIds) !==
      JSON.stringify(runtimeStepB.eligible.map((e) => e.workItem.id)) ||
    JSON.stringify(formalStepB.readyCheckpointIds) !==
      JSON.stringify(runtimeStepB.readyCheckpoints.map((c) => c.checkpoint.id))
  ) {
    failures.push("Parallel roadmap Checkpoint gating mismatch before checkpoint pass");
  }

  parallelRoadmapVectorsChecked += 1;
  simRuntime = recordCheckpointResult(simRuntime, {
    observedRoadmapDigest: simRuntime.roadmapDigest,
    checkpointId: "cp-wave-1",
    status: "Passed",
    verifierContext: "independent-verifier",
    checksRun: ["bun test"],
    summary: "Wave 1 verified",
  });
  const formalStepC = formalSelectParallelWave({
    workItems: simRoadmap.workItems.map((w) => ({
      id: w.id,
      wave: w.wave ?? 1,
      priority: w.priority,
      risk: w.risk,
      status: w.status ?? "Backlog",
      blockedBy: w.blockedBy,
    })),
    checkpoints: (simRoadmap.verificationCheckpoints ?? []).map((cp) => ({
      id: cp.id,
      scopeType: cp.scopeType,
      targetIds: cp.targetIds,
      dependsOnWorkItemIds: cp.dependsOnWorkItemIds,
      passed: true,
    })),
    maxParallel: 2,
    maxRisk: "medium",
  });
  const runtimeStepC = selectEligibleWorkItems(simRoadmap, {
    limit: 2,
    maxRisk: "medium",
    runtimeState: simRuntime,
  });
  if (
    JSON.stringify(formalStepC.eligibleIds) !==
    JSON.stringify(runtimeStepC.eligible.map((e) => e.workItem.id))
  ) {
    failures.push("Parallel roadmap Wave 2 unlock mismatch after checkpoint pass");
  }

  // 7. Policy Precedence Monotonicity vectors
  const policyCases: ReadonlyArray<{
    localMode: "auto" | "required";
    flagHarness: "codex" | "claude" | "antigravity";
    policy: PolicyInput;
  }> = [
    {
      localMode: "required",
      flagHarness: "codex",
      policy: {
        schemaVersion: 1,
        requirements: { "worktree.mode": "required" },
        prohibitions: { harness: "claude" },
        bounds: {},
        locks: ["worktree.mode"],
      },
    },
    {
      localMode: "auto",
      flagHarness: "codex",
      policy: {
        schemaVersion: 1,
        requirements: { "worktree.mode": "required" },
        prohibitions: {},
        bounds: {},
        locks: ["worktree.mode"],
      },
    },
    {
      localMode: "required",
      flagHarness: "claude",
      policy: {
        schemaVersion: 1,
        requirements: { "worktree.mode": "required" },
        prohibitions: { harness: "claude" },
        bounds: {},
        locks: ["harness"],
      },
    },
  ];

  for (const testCase of policyCases) {
    policyMonotonicityVectorsChecked += 1;
    const formalResult = formalEvaluatePolicyMonotonicity({
      layers: [
        { source: "defaults", values: { "worktree.mode": "auto", merge: "never" } },
        { source: "repo", values: { "worktree.mode": "required", harness: "codex" } },
        { source: "local", values: { "worktree.mode": testCase.localMode } },
        { source: "flags", values: { harness: testCase.flagHarness } },
      ],
      requirements: testCase.policy.requirements,
      prohibitions: testCase.policy.prohibitions,
    });

    const resolved = resolveConfig([
      { source: "defaults", value: DEFAULT_CONFIG },
      { source: "repo", value: { worktree: { mode: "required" }, harness: "codex" } },
      { source: "local", value: { worktree: { mode: testCase.localMode } } },
      { source: "flags", value: { harness: testCase.flagHarness } },
    ]);

    let runtimeAllowed = false;
    try {
      applyPolicy(resolved, testCase.policy);
      runtimeAllowed = true;
    } catch {
      runtimeAllowed = false;
    }

    if (
      formalResult.allowed !== runtimeAllowed ||
      resolved.provenance["worktree.mode"] !== formalResult.provenance["worktree.mode"] ||
      resolved.provenance.harness !== formalResult.provenance.harness
    ) {
      failures.push(
        `Policy monotonicity mismatch (localMode=${testCase.localMode}, flagHarness=${testCase.flagHarness}): formal=${formalResult.allowed}, runtime=${runtimeAllowed}`,
      );
    }
  }

  return {
    passed: failures.length === 0,
    transitionPairsChecked,
    macroPhaseVectorsChecked,
    gateVectorsChecked,
    dagClosureVectorsChecked,
    contractCoverageVectorsChecked,
    parallelRoadmapVectorsChecked,
    policyMonotonicityVectorsChecked,
    failures,
  };
}

function main(): void {
  const fileReport = verifyFormalKernelFiles(REPO_ROOT);
  if (!fileReport.valid) {
    const details = fileReport.violations
      .map((v) => `[${v.code}] ${v.file}: ${v.message}`)
      .join("\n");
    throw new Error(`Formal Specification Kernel verification failed:\n${details}`);
  }
  const conformance = runDifferentialConformanceOracle();
  if (!conformance.passed) {
    throw new Error(`Differential Conformance Oracle failed:\n${conformance.failures.join("\n")}`);
  }
  console.log(
    `Formal Specification Kernel verified (${fileReport.checkedFiles.length} files, ${conformance.transitionPairsChecked} state transitions, ${conformance.gateVectorsChecked} gate vectors).`,
  );
}

if (import.meta.main) main();

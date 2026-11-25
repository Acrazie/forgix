namespace ForgixKernel.Invariants

/-!
# Forgix Formal Specification Kernel — Algebraic & Functional Invariants

This module formalizes four core invariants of the Forgix V6 workflow engine:
1. Selective transitive `Dependency closure` invalidation over DAGs.
2. `Shared Contract` coverage (`consumes` subset of `provides` + `blockedBy`).
3. `Autonomous Gate` eligibility (`low`/`medium` risk, zero open questions, `Autonomous Proof Floor`).
4. `Policy` precedence monotonicity (local overlays and CLI flags cannot weaken repository policy locks).
-/

-- ============================================================================
-- 1. Selective Transitive Dependency Closure Invalidation
-- ============================================================================

inductive NodeStatus where
  | fresh : NodeStatus
  | invalidated : NodeStatus
  | done : NodeStatus
  deriving DecidableEq, Repr

def invalidateNode (inClosure : Bool) (status : NodeStatus) : NodeStatus :=
  match status with
  | NodeStatus.done => NodeStatus.done
  | NodeStatus.fresh => if inClosure then NodeStatus.invalidated else NodeStatus.fresh
  | NodeStatus.invalidated => NodeStatus.invalidated

def directDependents (edges : List (Nat × Nat)) (root : Nat) : List Nat :=
  (edges.filter (fun edge => Nat.beq edge.fst root)).map Prod.snd

def inNodeList (target : Nat) (nodes : List Nat) : Bool :=
  nodes.any (fun n => Nat.beq n target)

theorem selective_invalidation_preserves_done (inClosure : Bool) :
    invalidateNode inClosure NodeStatus.done = NodeStatus.done := by
  rfl

theorem selective_invalidation_preserves_independent (status : NodeStatus) :
    invalidateNode false status = status := by
  cases status <;> rfl

theorem selective_invalidation_marks_fresh_in_closure :
    invalidateNode true NodeStatus.fresh = NodeStatus.invalidated := by
  rfl

theorem selective_invalidation_idempotent (inClosure : Bool) (status : NodeStatus) :
    invalidateNode inClosure (invalidateNode inClosure status) = invalidateNode inClosure status := by
  cases inClosure <;> cases status <;> rfl

-- ============================================================================
-- 2. Shared Contract Coverage (`consumes` subset of `provides` + `blockedBy`)
-- ============================================================================

inductive ContractStatus where
  | planned : ContractStatus
  | existing : ContractStatus
  | verified : ContractStatus
  deriving DecidableEq, Repr

def isContractCovered
    (status : ContractStatus)
    (providedByBlockedByAncestor : Bool)
    (waveMonotonic : Bool) : Bool :=
  match status with
  | ContractStatus.existing => true
  | ContractStatus.planned => providedByBlockedByAncestor && waveMonotonic
  | ContractStatus.verified => providedByBlockedByAncestor && waveMonotonic

theorem existing_contract_always_covered (anc : Bool) (w : Bool) :
    isContractCovered ContractStatus.existing anc w = true := by
  rfl

theorem planned_contract_requires_ancestor (w : Bool) :
    isContractCovered ContractStatus.planned false w = false := by
  rfl

theorem planned_contract_requires_wave_monotonicity :
    isContractCovered ContractStatus.planned true false = false := by
  rfl

theorem verified_contract_requires_ancestor (w : Bool) :
    isContractCovered ContractStatus.verified false w = false := by
  rfl

theorem verified_contract_requires_wave_monotonicity :
    isContractCovered ContractStatus.verified true false = false := by
  rfl

theorem contract_coverage_sound
    (anc : Bool)
    (w : Bool)
    (h : isContractCovered ContractStatus.planned anc w = true) :
    anc = true ∧ w = true := by
  cases anc with
  | false => cases h
  | true =>
    cases w with
    | false => cases h
    | true => exact And.intro rfl rfl

-- ============================================================================
-- 3. Autonomous Gate Eligibility & Autonomous Proof Floor
-- ============================================================================

inductive RiskLevel where
  | low : RiskLevel
  | medium : RiskLevel
  | high : RiskLevel
  | critical : RiskLevel
  deriving DecidableEq, Repr

inductive VerifierKind where
  | command : VerifierKind
  | runtimeEvidence : VerifierKind
  | tlaTlc : VerifierKind
  | lean4 : VerifierKind
  | modelInspection : VerifierKind
  | userObservation : VerifierKind
  deriving DecidableEq, Repr

def isAutonomousRiskAllowed (r : RiskLevel) : Bool :=
  match r with
  | RiskLevel.low => true
  | RiskLevel.medium => true
  | RiskLevel.high => false
  | RiskLevel.critical => false

def isDeterministicVerifier (v : VerifierKind) : Bool :=
  match v with
  | VerifierKind.command => true
  | VerifierKind.runtimeEvidence => true
  | VerifierKind.tlaTlc => true
  | VerifierKind.lean4 => true
  | VerifierKind.modelInspection => false
  | VerifierKind.userObservation => false

def criterionMeetsProofFloor (verifiers : List VerifierKind) : Bool :=
  verifiers.any isDeterministicVerifier

def allCriteriaMeetProofFloor (criteriaVerifiers : List (List VerifierKind)) : Bool :=
  !criteriaVerifiers.isEmpty && criteriaVerifiers.all criterionMeetsProofFloor

def isAutonomousGateEligible
    (risk : RiskLevel)
    (hasOpenQuestion : Bool)
    (hasUnresolvedDecision : Bool)
    (hasValidIssueRef : Bool)
    (preflightReady : Bool)
    (proofFloorMet : Bool) : Bool :=
  isAutonomousRiskAllowed risk &&
  (!hasOpenQuestion) &&
  (!hasUnresolvedDecision) &&
  hasValidIssueRef &&
  preflightReady &&
  proofFloorMet

theorem autonomous_rejects_high_risk
    (q : Bool) (d : Bool) (i : Bool) (p : Bool) (pf : Bool) :
    isAutonomousGateEligible RiskLevel.high q d i p pf = false := by
  rfl

theorem autonomous_rejects_critical_risk
    (q : Bool) (d : Bool) (i : Bool) (p : Bool) (pf : Bool) :
    isAutonomousGateEligible RiskLevel.critical q d i p pf = false := by
  rfl

theorem autonomous_rejects_open_question
    (r : RiskLevel) (d : Bool) (i : Bool) (p : Bool) (pf : Bool) :
    isAutonomousGateEligible r true d i p pf = false := by
  cases r <;> rfl

theorem autonomous_rejects_unresolved_decision
    (r : RiskLevel) (q : Bool) (i : Bool) (p : Bool) (pf : Bool) :
    isAutonomousGateEligible r q true i p pf = false := by
  cases r <;> cases q <;> rfl

theorem autonomous_rejects_missing_issue_ref
    (r : RiskLevel) (q : Bool) (d : Bool) (p : Bool) (pf : Bool) :
    isAutonomousGateEligible r q d false p pf = false := by
  cases r <;> cases q <;> cases d <;> rfl

theorem autonomous_rejects_unready_preflight
    (r : RiskLevel) (q : Bool) (d : Bool) (i : Bool) (pf : Bool) :
    isAutonomousGateEligible r q d i false pf = false := by
  cases r <;> cases q <;> cases d <;> cases i <;> rfl

theorem autonomous_rejects_missing_proof_floor
    (r : RiskLevel) (q : Bool) (d : Bool) (i : Bool) (p : Bool) :
    isAutonomousGateEligible r q d i p false = false := by
  cases r <;> cases q <;> cases d <;> cases i <;> cases p <;> rfl

theorem model_inspection_below_proof_floor :
    isDeterministicVerifier VerifierKind.modelInspection = false := by
  rfl

theorem user_observation_below_proof_floor :
    isDeterministicVerifier VerifierKind.userObservation = false := by
  rfl

theorem formal_verifiers_meet_proof_floor :
    isDeterministicVerifier VerifierKind.tlaTlc = true ∧
    isDeterministicVerifier VerifierKind.lean4 = true := by
  exact And.intro rfl rfl

theorem autonomous_eligible_characterization (r : RiskLevel) :
    isAutonomousGateEligible r false false true true true = isAutonomousRiskAllowed r := by
  cases r <;> rfl

-- ============================================================================
-- 4. Policy Precedence Monotonicity
-- ============================================================================

inductive ConfigLayer where
  | defaults : ConfigLayer
  | user : ConfigLayer
  | repo : ConfigLayer
  | localOverlay : ConfigLayer
  | flags : ConfigLayer
  deriving DecidableEq, Repr

def layerPrecedence (layer : ConfigLayer) : Nat :=
  match layer with
  | ConfigLayer.defaults => 0
  | ConfigLayer.user => 1
  | ConfigLayer.repo => 2
  | ConfigLayer.localOverlay => 3
  | ConfigLayer.flags => 4

def enforcePolicyRequirement (requiredVal : Nat) (effectiveVal : Nat) : Bool :=
  Nat.beq requiredVal effectiveVal

def enforcePolicyProhibition (forbiddenVal : Nat) (effectiveVal : Nat) : Bool :=
  !(Nat.beq forbiddenVal effectiveVal)

def evaluatePolicyGate
    (requiredVal : Nat)
    (forbiddenVal : Nat)
    (effectiveVal : Nat) : Bool :=
  enforcePolicyRequirement requiredVal effectiveVal &&
  enforcePolicyProhibition forbiddenVal effectiveVal

theorem layer_precedence_strict_chain :
    layerPrecedence ConfigLayer.defaults < layerPrecedence ConfigLayer.user ∧
    layerPrecedence ConfigLayer.user < layerPrecedence ConfigLayer.repo ∧
    layerPrecedence ConfigLayer.repo < layerPrecedence ConfigLayer.localOverlay ∧
    layerPrecedence ConfigLayer.localOverlay < layerPrecedence ConfigLayer.flags := by
  decide

theorem policy_prohibition_blocks_forbidden_value (forb : Nat) :
    enforcePolicyProhibition forb forb = false := by
  simp [enforcePolicyProhibition]

theorem policy_lock_monotonic_against_divergent_override
    (req : Nat)
    (forb : Nat)
    (overrideVal : Nat)
    (hDivergent : Nat.beq req overrideVal = false) :
    evaluatePolicyGate req forb overrideVal = false := by
  simp [evaluatePolicyGate, enforcePolicyRequirement, hDivergent]

end ForgixKernel.Invariants

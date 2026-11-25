import Lean

namespace Forgix.Assure

open Lean

set_option warningAsError true

structure Operation where
  id : String
  verifierDigest : String
  covers : List String
  conditional : Bool := false
  deriving ToJson

inductive Verdict where
  | passed | failed | notApplicable
  deriving DecidableEq, BEq

instance : ToJson Verdict where
  toJson
    | .passed => toJson "passed"
    | .failed => toJson "failed"
    | .notApplicable => toJson "not_applicable"

structure Evidence where
  operationId : String
  verifierDigest : String
  snapshot : String
  recordedAt : Nat
  result : Verdict
  subjectIds : List String
  activationEvidence : Bool := false
  deriving ToJson

def matchesOperation (op : Operation) (proof : Evidence) : Bool :=
  proof.operationId == op.id && proof.verifierDigest == op.verifierDigest

def latestFrom (best : Option Evidence) (history : List Evidence) : Option Evidence :=
  match history with
  | [] => best
  | proof :: rest =>
    if best.any (fun prev => proof.recordedAt < prev.recordedAt) then
      latestFrom best rest
    else
      latestFrom (some proof) rest

def latestFor (op : Operation) (history : List Evidence) : Option Evidence :=
  latestFrom none (history.filter (matchesOperation op))

def justifiedInactive (op : Operation) (proof : Evidence) : Bool :=
  proof.result == .notApplicable && op.conditional && proof.activationEvidence

def validRecord (operations : List Operation) (proof : Evidence) : Bool :=
  operations.any fun op =>
    proof.operationId == op.id &&
      !proof.subjectIds.isEmpty && proof.subjectIds.all op.covers.contains &&
      (proof.result != .notApplicable || justifiedInactive op proof)

def provesOperation (snapshot : String) (op : Operation) (proof : Evidence) : Bool :=
  (proof.snapshot == snapshot && op.covers.all proof.subjectIds.contains) &&
    (proof.result == .passed || justifiedInactive op proof)

def provesCriterion (snapshot criterion : String) (proof : Evidence) : Bool :=
  proof.snapshot == snapshot && decide (proof.result = .passed) && proof.subjectIds.contains criterion

-- Only the evidence requirements: assumes the approved contract, identity, and other
-- receipt prerequisites have already been verified. Fingerprints are opaque values.
def evidenceReady (snapshot : String) (operations : List Operation) (criteria : List String)
    (history : List Evidence) : Bool :=
  (history.all (validRecord operations) &&
    criteria.all (fun criterion => operations.any fun op =>
      (latestFor op history).any (provesCriterion snapshot criterion))) &&
    operations.all (fun op => (latestFor op history).any (provesOperation snapshot op))

private theorem latestFrom_mem (best : Option Evidence) (history : List Evidence)
    (proof : Evidence) (h : latestFrom best history = some proof) :
    best = some proof ∨ proof ∈ history := by
  induction history generalizing best with
  | nil => exact Or.inl h
  | cons next rest ih =>
    simp only [latestFrom] at h
    split at h
    · rcases ih best h with hbest | hmem
      · exact Or.inl hbest
      · exact Or.inr (List.mem_cons_of_mem _ hmem)
    · rcases ih (some next) h with hnext | hmem
      · cases hnext
        exact Or.inr (List.mem_cons_self _ _)
      · exact Or.inr (List.mem_cons_of_mem _ hmem)

theorem ready_requires_current_operation_evidence (snapshot : String)
    (operations : List Operation) (criteria : List String) (history : List Evidence)
    (ready : evidenceReady snapshot operations criteria history = true) :
    ∀ op ∈ operations, ∃ proof ∈ history,
      latestFor op history = some proof ∧ matchesOperation op proof = true ∧
        proof.snapshot = snapshot ∧
        (∀ subject ∈ op.covers, subject ∈ proof.subjectIds) ∧
        (proof.result == .passed || justifiedInactive op proof) = true := by
  intro op hop
  have allOk := (Bool.and_eq_true_iff.mp ready).2
  have opOk := List.all_eq_true.mp allOk op hop
  cases selected : latestFor op history with
  | none => simp [selected, Option.any] at opOk
  | some proof =>
    have matched := latestFrom_mem none (history.filter (matchesOperation op)) proof selected
    have member := List.mem_filter.mp (matched.resolve_left (by simp))
    have valid : provesOperation snapshot op proof = true := by
      simpa [selected, Option.any] using opOk
    have accepted := Bool.and_eq_true_iff.mp valid
    have coverage := Bool.and_eq_true_iff.mp accepted.1
    exact ⟨proof, member.1, rfl, member.2, of_decide_eq_true (by simpa using coverage.1),
      fun subject h => List.contains_iff_mem.mp (List.all_eq_true.mp coverage.2 subject h),
      accepted.2⟩

theorem ready_requires_passed_criterion (snapshot : String)
    (operations : List Operation) (criteria : List String) (history : List Evidence)
    (ready : evidenceReady snapshot operations criteria history = true) :
    ∀ criterion ∈ criteria, ∃ op ∈ operations, ∃ proof,
      latestFor op history = some proof ∧ proof.snapshot = snapshot ∧
        proof.result = .passed ∧ criterion ∈ proof.subjectIds := by
  intro criterion hcriterion
  have h := (Bool.and_eq_true_iff.mp (Bool.and_eq_true_iff.mp ready).1).2
  obtain ⟨op, hop, hproof⟩ := List.any_eq_true.mp (List.all_eq_true.mp h criterion hcriterion)
  cases selected : latestFor op history with
  | none => simp [selected, Option.any] at hproof
  | some proof =>
    have proofOk : provesCriterion snapshot criterion proof = true := by
      simpa [selected, Option.any] using hproof
    have fields := Bool.and_eq_true_iff.mp proofOk
    have current := Bool.and_eq_true_iff.mp fields.1
    exact ⟨op, hop, proof, selected, of_decide_eq_true (by simpa using current.1),
      of_decide_eq_true current.2, List.contains_iff_mem.mp fields.2⟩

/-- info: 'Forgix.Assure.ready_requires_current_operation_evidence' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms ready_requires_current_operation_evidence

/-- info: 'Forgix.Assure.ready_requires_passed_criterion' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms ready_requires_passed_criterion

end Forgix.Assure

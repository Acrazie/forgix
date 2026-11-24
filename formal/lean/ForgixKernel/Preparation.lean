import Lean

set_option warningAsError true

namespace Forgix.Shape

structure Evidence where
  expected : Option String
  observed : Option String
  sources : List (Option String)
  deriving Lean.ToJson

-- Resolved fingerprint lookups are optional. Explicit evidence overrides the
-- fallback to source fingerprints, matching the task-state validator.
def fresh (evidence : Evidence) : Bool :=
  match evidence.expected, evidence.observed with
  | none, _ => true
  | some expected, some observed => decide (observed = expected)
  | some expected, none =>
    evidence.sources.all (fun source => source.all (fun value => decide (value = expected)))

theorem fresh_requires_matching_observation (sources : List (Option String))
    (expected observed : String)
    (accepted : fresh ⟨some expected, some observed, sources⟩ = true) :
    observed = expected :=
  of_decide_eq_true accepted

theorem fresh_requires_matching_known_sources (sources : List (Option String))
    (expected : String) (accepted : fresh ⟨some expected, none, sources⟩ = true) :
    ∀ value, some value ∈ sources → value = expected := by
  intro value member
  have allOk := List.all_eq_true.mp accepted (some value) member
  exact of_decide_eq_true allOk

/-- info: 'Forgix.Shape.fresh_requires_matching_observation' does not depend on any axioms -/
#guard_msgs in
#print axioms fresh_requires_matching_observation
/-- info: 'Forgix.Shape.fresh_requires_matching_known_sources' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms fresh_requires_matching_known_sources

end Forgix.Shape

namespace Forgix.ProjectInit

structure Source where
  ref : String
  expected : String
  deriving Lean.ToJson

structure Decision where
  key : String
  dependsOn : List String
  sources : List Source
  deriving Lean.ToJson

abbrev Observations := List (String × String)
abbrev Edges := List (String × String)

def observed (observations : Observations) (source : Source) : Option String :=
  (observations.find? (fun entry => entry.1 == source.ref)).map Prod.snd

def stale (observations : Observations) (decision : Decision) : Bool :=
  decision.sources.any (fun source =>
    (observed observations source).any (fun actual => decide (actual ≠ source.expected)))

theorem stale_requires_observed_change (observations : Observations) (decision : Decision)
    (isStale : stale observations decision = true) :
    ∃ source ∈ decision.sources, ∃ actual,
      observed observations source = some actual ∧ actual ≠ source.expected := by
  obtain ⟨source, member, mismatch⟩ := List.any_eq_true.mp isStale
  cases resolved : observed observations source with
  | none => simp [resolved, Option.any] at mismatch
  | some actual =>
    exact ⟨source, member, actual, resolved,
      of_decide_eq_true (by simpa [resolved, Option.any] using mismatch)⟩

/-- info: 'Forgix.ProjectInit.stale_requires_observed_change' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms stale_requires_observed_change

-- Each edge points from a decision to one of its dependencies.
def inClosure (edges : Edges) (roots : List String) : Nat → String → Bool
  | 0, key => roots.contains key
  | hops + 1, key =>
    roots.contains key || edges.any (fun edge =>
      decide (edge.1 = key) && inClosure edges roots hops edge.2)

def reachesStale (edges : Edges) (roots : List String) : Nat → String → Prop
  | 0, key => key ∈ roots
  | hops + 1, key =>
    key ∈ roots ∨ ∃ edge ∈ edges, edge.1 = key ∧ reachesStale edges roots hops edge.2

theorem closure_exact (edges : Edges) (roots : List String) (hops : Nat) (key : String) :
    inClosure edges roots hops key = true ↔ reachesStale edges roots hops key := by
  induction hops generalizing key with
  | zero => simp [inClosure, reachesStale, List.contains_iff_mem]
  | succ hops ih =>
    simp [inClosure, reachesStale, List.contains_iff_mem, List.any_eq_true, ih]

def staleKeys (decisions : List Decision) (observations : Observations) : List String :=
  (decisions.filter (stale observations)).map Decision.key

def missingRefs (decisions : List Decision) (observations : Observations) : List String :=
  ((decisions.flatMap Decision.sources).filter (fun source =>
    (observed observations source).isNone)).map Source.ref

def decisionEdges (decisions : List Decision) : Edges :=
  decisions.flatMap (fun decision => decision.dependsOn.map (fun dep => (decision.key, dep)))

def invalidatedKeys (decisions : List Decision) (observations : Observations) : List String :=
  let invalidated := inClosure (decisionEdges decisions) (staleKeys decisions observations)
  (decisions.map Decision.key).filter (invalidated decisions.length)

theorem invalidation_exact (decisions : List Decision) (observations : Observations)
    (key : String) :
    key ∈ invalidatedKeys decisions observations ↔
      key ∈ decisions.map Decision.key ∧
        reachesStale (decisionEdges decisions) (staleKeys decisions observations)
          decisions.length key := by
  simp only [invalidatedKeys, List.mem_filter, closure_exact]

/-- info: 'Forgix.ProjectInit.invalidation_exact' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms invalidation_exact

end Forgix.ProjectInit

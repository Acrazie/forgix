import Lean

namespace Forgix.Gate

set_option warningAsError true

structure Context where
  preflightReady : Bool
  contractDigest : String
  requiresReview : Bool
  currentReview : Option String

def reviewMatches (context : Context) (supplied : Option String) : Bool :=
  !context.requiresReview || context.currentReview.any fun current =>
    decide (supplied = some current)

-- Interactive approval with a mandatory contract digest. Preflight is supplied
-- by the caller; the model begins at the approval boundary, not at SHAPE.
def approve (context : Context) (contract review : Option String) : Option String :=
  if context.preflightReady &&
    decide (contract = some context.contractDigest) && reviewMatches context review
  then some context.contractDigest
  else none

theorem approval_binds_current_contract_and_review (context : Context)
    (contract review : Option String) (receiptContract : String)
    (approved : approve context contract review = some receiptContract) :
    context.preflightReady = true ∧
      contract = some context.contractDigest ∧ receiptContract = context.contractDigest ∧
      (context.requiresReview = true →
        ∃ current, context.currentReview = some current ∧ review = some current) := by
  unfold approve at approved
  split at approved
  · rename_i checks
    have ok := Bool.and_eq_true_iff.mp checks
    have bound := Bool.and_eq_true_iff.mp ok.1
    refine ⟨bound.1, of_decide_eq_true bound.2, (Option.some.inj approved).symm, ?_⟩
    intro required
    cases current : context.currentReview with
    | none => simp [reviewMatches, required, current, Option.any] at ok
    | some digest =>
      exact ⟨digest, rfl, by simpa [reviewMatches, required, current, Option.any] using ok.2⟩
  · contradiction

/-- info: 'Forgix.Gate.approval_binds_current_contract_and_review' depends on axioms: [propext] -/
#guard_msgs in
#print axioms approval_binds_current_contract_and_review

end Forgix.Gate

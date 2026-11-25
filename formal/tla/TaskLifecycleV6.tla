---- MODULE TaskLifecycleV6 ----
EXTENDS Naturals, Sequences, TLC

CONSTANTS
  MaxRevisions,
  RiskLevels

ASSUME MaxRevisions \in Nat /\ MaxRevisions >= 4
ASSUME RiskLevels = {"low", "medium", "high", "critical"}

Statuses == {
  "new",
  "intaking",
  "discovering",
  "awaiting_shape_decision",
  "awaiting_profile_choice",
  "planning",
  "awaiting_intake_decision",
  "awaiting_approval",
  "executing",
  "assuring",
  "blocked",
  "cancelled",
  "failed"
}

ResumableStatuses == {
  "intaking",
  "discovering",
  "awaiting_shape_decision",
  "awaiting_profile_choice",
  "planning",
  "awaiting_intake_decision",
  "awaiting_approval",
  "executing",
  "assuring"
}

TerminalStatuses == {"cancelled", "failed"}

Digests == {"none", "digest_v1", "digest_v2"}

Actors == {"none", "user", "autonomous_policy"}

VARIABLES
  status,
  revision,
  risk,
  openQuestions,
  proofFloorMet,
  contractDigest,
  receiptActor,
  receiptDigest,
  resumeTo,
  resumeState,
  terminalSource,
  assuranceCompleted

vars == <<
  status,
  revision,
  risk,
  openQuestions,
  proofFloorMet,
  contractDigest,
  receiptActor,
  receiptDigest,
  resumeTo,
  resumeState,
  terminalSource,
  assuranceCompleted
>>

CanRevisionStep == revision < MaxRevisions

AutonomousRiskAllowed(r) == r \in {"low", "medium"}

AutonomousEligible ==
  /\ status = "awaiting_approval"
  /\ AutonomousRiskAllowed(risk)
  /\ openQuestions = 0
  /\ proofFloorMet = TRUE
  /\ contractDigest /= "none"

ValidApprovalReceipt ==
  /\ receiptActor \in {"user", "autonomous_policy"}
  /\ contractDigest /= "none"
  /\ receiptDigest = contractDigest

TypeOK ==
  /\ status \in Statuses
  /\ revision \in 0..MaxRevisions
  /\ risk \in RiskLevels
  /\ openQuestions \in 0..2
  /\ proofFloorMet \in BOOLEAN
  /\ contractDigest \in Digests
  /\ receiptActor \in Actors
  /\ receiptDigest \in Digests
  /\ resumeTo \in (ResumableStatuses \cup {"none"})
  /\ resumeState \in {"none", "waiting", "requested", "approval_required"}
  /\ (resumeState /= "none") = (status = "blocked")
  /\ terminalSource \in (Statuses \cup {"none"})
  /\ assuranceCompleted \in BOOLEAN

Init ==
  /\ status = "new"
  /\ revision = 0
  /\ risk \in RiskLevels
  /\ openQuestions \in 0..1
  /\ proofFloorMet \in BOOLEAN
  /\ contractDigest = "none"
  /\ receiptActor = "none"
  /\ receiptDigest = "none"
  /\ resumeTo = "none"
  /\ resumeState = "none"
  /\ terminalSource = "none"
  /\ assuranceCompleted = FALSE

StartIntake ==
  /\ status = "new"
  /\ CanRevisionStep
  /\ status' = "intaking"
  /\ revision' = revision + 1
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

RequestIntakeDecision ==
  /\ status \in {"intaking", "discovering", "awaiting_shape_decision", "awaiting_profile_choice", "planning", "awaiting_approval"}
  /\ CanRevisionStep
  /\ openQuestions > 0
  /\ status' = "awaiting_intake_decision"
  /\ revision' = revision + 1
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

ResolveIntakeDecision ==
  /\ status = "awaiting_intake_decision"
  /\ CanRevisionStep
  /\ status' = "intaking"
  /\ revision' = revision + 1
  /\ openQuestions' = 0
  /\ UNCHANGED <<risk, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

BeginDiscovery ==
  /\ status = "intaking"
  /\ CanRevisionStep
  /\ openQuestions = 0
  /\ status' = "discovering"
  /\ revision' = revision + 1
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

ResolveOpenQuestionsInIntake ==
  /\ status = "intaking"
  /\ openQuestions > 0
  /\ openQuestions' = 0
  /\ UNCHANGED <<status, revision, risk, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

RequestShapeDecision ==
  /\ status \in {"discovering", "planning"}
  /\ CanRevisionStep
  /\ status' = "awaiting_shape_decision"
  /\ revision' = revision + 1
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

ResolveShapeDecision ==
  /\ status = "awaiting_shape_decision"
  /\ CanRevisionStep
  /\ status' = "discovering"
  /\ revision' = revision + 1
  /\ openQuestions' = 0
  /\ UNCHANGED <<risk, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

RequestProfileChoice ==
  /\ status = "discovering"
  /\ CanRevisionStep
  /\ status' = "awaiting_profile_choice"
  /\ revision' = revision + 1
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

SelectProfile ==
  /\ status \in {"discovering", "awaiting_profile_choice"}
  /\ CanRevisionStep
  /\ openQuestions = 0
  /\ status' = "planning"
  /\ revision' = revision + 1
  /\ contractDigest' = "digest_v1"
  /\ proofFloorMet' = TRUE
  /\ UNCHANGED <<risk, openQuestions, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

SubmitForApproval ==
  /\ status = "planning"
  /\ CanRevisionStep
  /\ openQuestions = 0
  /\ contractDigest /= "none"
  /\ status' = "awaiting_approval"
  /\ revision' = revision + 1
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

ApproveHumanGate ==
  /\ status = "awaiting_approval"
  /\ CanRevisionStep
  /\ openQuestions = 0
  /\ contractDigest /= "none"
  /\ status' = "executing"
  /\ revision' = revision + 1
  /\ receiptActor' = "user"
  /\ receiptDigest' = contractDigest
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

ApproveAutonomousGate ==
  /\ AutonomousEligible
  /\ CanRevisionStep
  /\ status' = "executing"
  /\ revision' = revision + 1
  /\ receiptActor' = "autonomous_policy"
  /\ receiptDigest' = contractDigest
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

RequestContractChange ==
  /\ status = "awaiting_approval"
  /\ CanRevisionStep
  /\ status' = "planning"
  /\ revision' = revision + 1
  /\ contractDigest' = "digest_v2"
  /\ receiptActor' = "none"
  /\ receiptDigest' = "none"
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, resumeTo, resumeState, terminalSource, assuranceCompleted>>

RejectGate ==
  /\ status = "awaiting_approval"
  /\ CanRevisionStep
  /\ status' = "cancelled"
  /\ revision' = revision + 1
  /\ receiptActor' = "none"
  /\ receiptDigest' = "none"
  /\ terminalSource' = "awaiting_approval"
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, resumeTo, resumeState, assuranceCompleted>>

ReplanFromExecution ==
  /\ status \in {"executing", "assuring"}
  /\ assuranceCompleted = FALSE
  /\ CanRevisionStep
  /\ status' = "planning"
  /\ revision' = revision + 1
  /\ contractDigest' = "digest_v2"
  /\ receiptActor' = "none"
  /\ receiptDigest' = "none"
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, resumeTo, resumeState, terminalSource, assuranceCompleted>>

EnterAssuring ==
  /\ status = "executing"
  /\ CanRevisionStep
  /\ ValidApprovalReceipt
  /\ status' = "assuring"
  /\ revision' = revision + 1
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

CompleteAssure ==
  /\ status = "assuring"
  /\ assuranceCompleted = FALSE
  /\ ValidApprovalReceipt
  /\ assuranceCompleted' = TRUE
  /\ UNCHANGED <<status, revision, risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource>>

BlockTask ==
  /\ status \in ResumableStatuses
  /\ assuranceCompleted = FALSE
  /\ CanRevisionStep
  /\ status' = "blocked"
  /\ revision' = revision + 1
  /\ resumeTo' = status
  /\ resumeState' = "waiting"
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, terminalSource, assuranceCompleted>>

(* Reconciliation may discover a different contract while the task is blocked. *)
InvalidateBlockedApproval ==
  /\ status = "blocked"
  /\ resumeTo \in {"executing", "assuring"}
  /\ ValidApprovalReceipt
  /\ contractDigest' \in Digests \ {"none", contractDigest}
  /\ UNCHANGED <<status, revision, risk, openQuestions, proofFloorMet, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

(* External prerequisites are ready and a resume has been requested. *)
RequestResume ==
  /\ status = "blocked"
  /\ resumeState = "waiting"
  /\ resumeState' = "requested"
  /\ UNCHANGED <<status, revision, risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, terminalSource, assuranceCompleted>>

ResumePending == status = "blocked" /\ resumeState = "requested"

ApprovalRequired == resumeTo \in {"executing", "assuring"} /\ ~ValidApprovalReceipt

ResumeTask ==
  /\ ResumePending
  /\ CanRevisionStep
  /\ ~ApprovalRequired
  /\ status' = resumeTo
  /\ revision' = revision + 1
  /\ resumeTo' = "none"
  /\ resumeState' = "none"
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, terminalSource, assuranceCompleted>>

RefuseResume ==
  /\ ResumePending
  /\ ApprovalRequired
  /\ resumeState' = "approval_required"
  /\ UNCHANGED <<status, revision, risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, terminalSource, assuranceCompleted>>

HandleResume == ResumeTask \/ RefuseResume

BlockedWait ==
  /\ status = "blocked"
  /\ ~ResumePending
  /\ UNCHANGED vars

CancelTask ==
  /\ status \in (Statuses \ TerminalStatuses)
  /\ assuranceCompleted = FALSE
  /\ CanRevisionStep
  /\ status' = "cancelled"
  /\ revision' = revision + 1
  /\ terminalSource' = IF status = "blocked" THEN resumeTo ELSE status
  /\ resumeTo' = "none"
  /\ resumeState' = "none"
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, assuranceCompleted>>

FailTask ==
  /\ status \in (Statuses \ TerminalStatuses)
  /\ assuranceCompleted = FALSE
  /\ CanRevisionStep
  /\ status' = "failed"
  /\ revision' = revision + 1
  /\ terminalSource' = IF status = "blocked" THEN resumeTo ELSE status
  /\ resumeTo' = "none"
  /\ resumeState' = "none"
  /\ UNCHANGED <<risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, assuranceCompleted>>

RecoverRevisionBudget ==
  /\ status \notin TerminalStatuses
  /\ assuranceCompleted = FALSE
  /\ revision = MaxRevisions
  /\ revision' = MaxRevisions - 1
  /\ UNCHANGED <<status, risk, openQuestions, proofFloorMet, contractDigest, receiptActor, receiptDigest, resumeTo, resumeState, terminalSource, assuranceCompleted>>

TerminalStutter ==
  /\ (status \in TerminalStatuses \/ assuranceCompleted = TRUE)
  /\ UNCHANGED vars

Next ==
  \/ StartIntake
  \/ ResolveOpenQuestionsInIntake
  \/ RequestIntakeDecision
  \/ ResolveIntakeDecision
  \/ BeginDiscovery
  \/ RequestShapeDecision
  \/ ResolveShapeDecision
  \/ RequestProfileChoice
  \/ SelectProfile
  \/ SubmitForApproval
  \/ ApproveHumanGate
  \/ ApproveAutonomousGate
  \/ RequestContractChange
  \/ RejectGate
  \/ ReplanFromExecution
  \/ EnterAssuring
  \/ CompleteAssure
  \/ BlockTask
  \/ InvalidateBlockedApproval
  \/ RequestResume
  \/ HandleResume
  \/ BlockedWait
  \/ CancelTask
  \/ FailTask
  \/ RecoverRevisionBudget
  \/ TerminalStutter

Fairness ==
  /\ WF_vars(StartIntake)
  /\ WF_vars(ResolveOpenQuestionsInIntake)
  /\ WF_vars(ResolveIntakeDecision)
  /\ WF_vars(BeginDiscovery)
  /\ WF_vars(ResolveShapeDecision)
  /\ WF_vars(SelectProfile)
  /\ WF_vars(SubmitForApproval)
  /\ WF_vars(ApproveHumanGate)
  /\ WF_vars(ApproveAutonomousGate)
  /\ WF_vars(EnterAssuring)
  /\ WF_vars(CompleteAssure)
  /\ WF_vars(HandleResume)
  /\ WF_vars(RecoverRevisionBudget)

Spec == Init /\ [][Next]_vars /\ Fairness

SafetyReceiptRequired ==
  (status \in {"executing", "assuring"}) => ValidApprovalReceipt

SafetyAutonomousEligibility ==
  (receiptActor = "autonomous_policy") =>
    /\ AutonomousRiskAllowed(risk)
    /\ openQuestions = 0
    /\ proofFloorMet = TRUE

SafetyAssureImmutability ==
  (assuranceCompleted = TRUE) =>
    /\ status = "assuring"
    /\ ValidApprovalReceipt

SafetyBlockedResumeTarget ==
  (status = "blocked") => (resumeTo \in ResumableStatuses)

SafetyResumeRefusal ==
  (resumeState = "approval_required") => ApprovalRequired

SafetyTerminalSourceRecorded ==
  (status \in TerminalStatuses) => (terminalSource \in (Statuses \ TerminalStatuses))

Safety ==
  /\ TypeOK
  /\ SafetyReceiptRequired
  /\ SafetyAutonomousEligibility
  /\ SafetyAssureImmutability
  /\ SafetyBlockedResumeTarget
  /\ SafetyResumeRefusal
  /\ SafetyTerminalSourceRecorded

Liveness ==
  ResumePending ~> (status /= "blocked" \/ resumeState = "approval_required")

====

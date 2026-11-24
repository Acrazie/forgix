---- MODULE RoadmapParallel ----
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS
  MaxWorkItems,
  MaxParallel

ASSUME MaxWorkItems \in Nat /\ MaxWorkItems >= 3
ASSUME MaxParallel \in Nat /\ MaxParallel >= 2

WorkItems == 1..MaxWorkItems

BoardStatuses == {"Backlog", "Ready", "InProgress", "Done"}

ContractStatuses == {"planned", "verified"}

CheckpointStatuses == {"Pending", "Passed"}

WaveOf(w) ==
  IF w \in {1, 2} THEN 1 ELSE 2

BlockedBy(w) ==
  CASE w = 1 -> {}
    [] w = 2 -> {}
    [] w = 3 -> {1, 2}
    [] OTHER -> {1}

ProvidesContract(w) ==
  CASE w = 1 -> "contract_auth"
    [] w = 2 -> "contract_billing"
    [] OTHER -> "none"

ConsumesContract(w) ==
  CASE w = 3 -> "contract_auth"
    [] OTHER -> "none"

Wave1Items == {w \in WorkItems : WaveOf(w) = 1}

VARIABLES
  itemStatus,
  activeWorktrees,
  contractStatus,
  checkpointStatus,
  invalidationCount

vars == <<
  itemStatus,
  activeWorktrees,
  contractStatus,
  checkpointStatus,
  invalidationCount
>>

AllDependenciesDone(w) ==
  \A dep \in BlockedBy(w) : itemStatus[dep] = "Done"

UpstreamCheckpointPassed(w) ==
  (WaveOf(w) > 1) => (checkpointStatus = "Passed")

CanStartWorkItem(w) ==
  /\ itemStatus[w] = "Ready"
  /\ Cardinality(activeWorktrees) < MaxParallel
  /\ w \notin activeWorktrees
  /\ AllDependenciesDone(w)
  /\ UpstreamCheckpointPassed(w)

TypeOK ==
  /\ itemStatus \in [WorkItems -> BoardStatuses]
  /\ activeWorktrees \subseteq WorkItems
  /\ contractStatus \in [{"contract_auth", "contract_billing"} -> ContractStatuses]
  /\ checkpointStatus \in CheckpointStatuses
  /\ invalidationCount \in 0..1

Init ==
  /\ itemStatus = [w \in WorkItems |-> IF BlockedBy(w) = {} /\ WaveOf(w) = 1 THEN "Ready" ELSE "Backlog"]
  /\ activeWorktrees = {}
  /\ contractStatus = [c \in {"contract_auth", "contract_billing"} |-> "planned"]
  /\ checkpointStatus = "Pending"
  /\ invalidationCount = 0

PromoteReady(w) ==
  /\ itemStatus[w] = "Backlog"
  /\ AllDependenciesDone(w)
  /\ UpstreamCheckpointPassed(w)
  /\ itemStatus' = [itemStatus EXCEPT ![w] = "Ready"]
  /\ UNCHANGED <<activeWorktrees, contractStatus, checkpointStatus, invalidationCount>>

StartWorkItem(w) ==
  /\ CanStartWorkItem(w)
  /\ itemStatus' = [itemStatus EXCEPT ![w] = "InProgress"]
  /\ activeWorktrees' = activeWorktrees \cup {w}
  /\ UNCHANGED <<contractStatus, checkpointStatus, invalidationCount>>

CompleteWorkItem(w) ==
  /\ itemStatus[w] = "InProgress"
  /\ w \in activeWorktrees
  /\ itemStatus' = [itemStatus EXCEPT ![w] = "Done"]
  /\ activeWorktrees' = activeWorktrees \ {w}
  /\ contractStatus' =
       IF ProvidesContract(w) /= "none"
       THEN [contractStatus EXCEPT ![ProvidesContract(w)] = "verified"]
       ELSE contractStatus
  /\ UNCHANGED <<checkpointStatus, invalidationCount>>

PassWave1Checkpoint ==
  /\ checkpointStatus = "Pending"
  /\ \A w \in Wave1Items : itemStatus[w] = "Done"
  /\ contractStatus["contract_auth"] = "verified"
  /\ contractStatus["contract_billing"] = "verified"
  /\ checkpointStatus' = "Passed"
  /\ UNCHANGED <<itemStatus, activeWorktrees, contractStatus, invalidationCount>>

SelectiveContractInvalidation ==
  /\ invalidationCount = 0
  /\ itemStatus[1] = "Done"
  /\ itemStatus[3] \in {"Backlog", "Ready"}
  /\ contractStatus' = [contractStatus EXCEPT !["contract_auth"] = "verified"]
  /\ itemStatus' = [
       w \in WorkItems |->
         IF ConsumesContract(w) = "contract_auth" /\ itemStatus[w] /= "Done"
         THEN "Backlog"
         ELSE itemStatus[w]
     ]
  /\ activeWorktrees' = activeWorktrees \ {w \in WorkItems : ConsumesContract(w) = "contract_auth" /\ itemStatus[w] /= "Done"}
  /\ checkpointStatus' = checkpointStatus
  /\ invalidationCount' = invalidationCount + 1

RoadmapCompleteStutter ==
  /\ \A w \in WorkItems : itemStatus[w] = "Done"
  /\ checkpointStatus = "Passed"
  /\ activeWorktrees = {}
  /\ UNCHANGED vars

Next ==
  \/ \E w \in WorkItems : PromoteReady(w)
  \/ \E w \in WorkItems : StartWorkItem(w)
  \/ \E w \in WorkItems : CompleteWorkItem(w)
  \/ PassWave1Checkpoint
  \/ SelectiveContractInvalidation
  \/ RoadmapCompleteStutter

Fairness ==
  /\ \A w \in WorkItems : WF_vars(PromoteReady(w))
  /\ \A w \in WorkItems : WF_vars(StartWorkItem(w))
  /\ \A w \in WorkItems : WF_vars(CompleteWorkItem(w))
  /\ WF_vars(PassWave1Checkpoint)

Spec == Init /\ [][Next]_vars /\ Fairness

BoundedParallelism ==
  Cardinality(activeWorktrees) <= MaxParallel

WorktreeIsolation ==
  \A w \in WorkItems : (w \in activeWorktrees) <=> (itemStatus[w] = "InProgress")

DependencyOrderSafety ==
  \A w \in WorkItems :
    (itemStatus[w] \in {"InProgress", "Done"}) => AllDependenciesDone(w)

SharedContractCoverageSafety ==
  \A w \in WorkItems :
    (ConsumesContract(w) /= "none") =>
      (\E provider \in BlockedBy(w) :
        /\ ProvidesContract(provider) = ConsumesContract(w)
        /\ WaveOf(provider) <= WaveOf(w))

CheckpointGateSafety ==
  \A w \in WorkItems :
    (WaveOf(w) > 1 /\ itemStatus[w] \in {"InProgress", "Done"}) =>
      /\ checkpointStatus = "Passed"
      /\ \A u \in Wave1Items : itemStatus[u] = "Done"

SelectiveInvalidationPreservesDone ==
  \A w \in WorkItems :
    (ProvidesContract(w) = "contract_auth" /\ itemStatus[w] = "Done") =>
      (w \notin activeWorktrees)

Safety ==
  /\ TypeOK
  /\ BoundedParallelism
  /\ WorktreeIsolation
  /\ DependencyOrderSafety
  /\ SharedContractCoverageSafety
  /\ CheckpointGateSafety
  /\ SelectiveInvalidationPreservesDone

Liveness ==
  <>(\A w \in WorkItems : itemStatus[w] = "Done" /\ checkpointStatus = "Passed" /\ activeWorktrees = {})

====

# ADR 0036: Formal Verification Lane with TLA+ and Lean 4

## Status

The Full Gate runs the TypeScript conformance suite against a TypeScript
reference model; it does not run Lean or TLC.
The [workflow pilots](../../formal/lean/README.md) run Lean and compare generated
cases against TypeScript for INIT, SHAPE, GATE, and ASSURE. The checks run
locally on demand and in the non-blocking `formal-lean` Buildkite step, which
skips tag and scheduled builds.

The advisory `formal-tla` Buildkite step checks `TaskLifecycleV6` and
`RoadmapParallel` with TLC. It skips tag and scheduled builds and is not part
of the Full Gate. Run the same checks locally with
`dagger call formal-tla --source=.` from the repository root.

The `TaskLifecycleV6` pilot also runs directly in TLC. From `formal/tla`, using
the release `tla2tools.jar` (v1.7.4 for this pilot):

```sh
java -jar /path/to/tla2tools.jar -workers 1 -config TaskLifecycleV6.cfg TaskLifecycleV6.tla
```

## Context

Unit and integration tests verify sampled execution paths, and static linters enforce
local syntactic or type constraints, but neither can exhaustively prove the absence of
race conditions across concurrent agent worktrees or mathematically guarantee invariants
over arbitrary DAGs and state machines. As Forgix scales to autonomous multi-item roadmap
execution (`$forgix run-roadmap --parallel M`), subtle bugs in state-machine transitions,
transitive dependency invalidation, or policy precedence can silently corrupt workflow
guarantees.

Furthermore, when AI agents are asked to work with formal methods without strict harness
controls, they frequently exploit formal escape hatches—such as inserting `sorry` or
custom `axiom`s in Lean 4, shrinking state-space bounds (`MaxParallel = 1`) or disabling
deadlock checks (`CHECK_DEADLOCK FALSE`) in TLA+ `.cfg` files, or mutating the theorem
statement itself to make a failing proof trivial.

## Decision

### Complementary Dual-Formal architecture (`TLA+` + `Lean 4`)

Adopt a dual formal-verification model—both for Forgix's own core (`formal/`, excluded
from the published npm tarball) and as first-class verifier kinds (`tla-tlc` and `lean4`)
available to target repositories in `.forgix/project.yaml`, `.forgix/roadmap.yaml`, and
`ASSURE`:

- **TLA+ (`formal/tla/`, checked via `TLC` / `Apalache`) owns concurrency, protocol
  dynamics, and temporal properties**:
  - Models multi-agent interleavings, crash/resume protocols, and asynchronous state
    transitions.
  - In Forgix, `formal/tla/` specifies `TaskState` V6 crash-recovery transitions and
    concurrent `$forgix run-roadmap --parallel M` execution across isolated worktrees,
    `.forgix/roadmap/runtime.yaml` reconciliation, `Shared Contract` invalidation, and
    `Verification Checkpoint` gating. Each model declares its own safety invariants and
    liveness property for its configured state space.
- **Lean 4 (`formal/lean/`, checked via `lake build`) owns pure functional algorithms,
  algebraic invariants, and infinite-domain proofs**:
  - Proves universal theorems over arbitrary graphs and configurations.
  - In Forgix, `formal/lean/` formalizes DAG acyclicity and selective transitive
    `Dependency closure` invalidation, `Shared Contract` coverage (`consumes` $\subseteq$
    `provides` + `blockedBy`), `Autonomous Gate` eligibility predicates, and `Policy`
    precedence monotonicity (proving that local overlays or CLI flags can never weaken a
    repository policy lock).

### `Differential Conformance Oracle` between `formal/` and TypeScript

Keep the distributed `dist/forgix.mjs` CLI bundle a zero-dependency Node.js ESM
artifact. Lean and TLC are verification tools, not runtime requirements.

The longer-term direction is to replay both Lean-generated cases and TLA+
traces against production TypeScript. Such replay can detect divergence only
on exercised cases. Today, the advisory Lean step replays generated cases;
the local TLC pilot does not replay traces against TypeScript. Making either
check blocking in the Full Gate is a separate decision requiring defined
coverage, ownership, and activation criteria. This pilot does not authorize it.

### Formal `Protected Surface` and anti-cheating `Escape Hatch` guards

Prevent agents from gaming formal verification during `BUILD` and `ASSURE`:

1. **Specification lock (`Protected Surface`)**: Once a `Work Item` or `Change Contract`
   is approved at `GATE`, theorem statements (`theorem`, `def` signatures in `.lean`) and
   temporal specifications/bounds (`INVARIANT`, `PROPERTY`, `CONSTANT` bounds in `.tla`
   and `.cfg`) are locked as `Protected Surface`s unless the approved contract explicitly
   authorizes specification changes.
2. **Lean 4 `Escape Hatch` ban**: The `ASSURE` diff and artifact scanner rejects any proof
   containing `sorry`, `admit`, `unsafe`, or unapproved `axiom` declarations.
3. **TLA+ `Escape Hatch` ban**: The `ASSURE` scanner rejects `.cfg` or `.tla` changes that
   set `CHECK_DEADLOCK FALSE`, introduce unapproved `CONSTRAINT` / `ACTION_CONSTRAINT`
   state-pruning clauses, or reduce `CONSTANT` concurrency/cardinality bounds below the
   contract baseline.

### TaskState V6: local progress on resume

`blocked` may wait indefinitely for human input or an external dependency. Forgix
does not interpret silence as consent, cancellation, or failure. In the model,
`RequestResume` represents both ready prerequisites and a resume request.
Once pending, the request must eventually resolve: the model resumes the
recorded target when permitted or records `approval_required` without changing
the blocked status or target. There is no automatic reroute. Cancellation or
failure can end a pending request but is not forced by fairness.

TLC found a counterexample to the old global completion property: repeated
block and resume transitions, with the model restoring one revision step at the
bound, could postpone submission forever. Requiring every task to reach a
terminal outcome would also rule out legitimate indefinite waits. The new
property checks only pending requests; weak fairness applies to internal
handling, not to the arrival of a request. Existing fairness assumptions
outside this pilot, including fair human approval at GATE, remain in the
model. The pilot therefore does not verify indefinite human silence at GATE.

Receipt safety is checked against the contract digest visible in the model.
An optional transition stands for reconciliation discovering a changed
digest. The model does not guarantee detection, check that reconciliation
precedes resume, or model fingerprint calculation or concurrent runtime
writes. The [lifecycle contract](../lifecycle-contract.md#guards) requires
`approval_current` for BUILD resume; the model also applies its receipt check
to ASSURE without defining a new runtime rule.

The property covers one pending request at a time and ends at its disposition.
Renewing a receipt, retrying after refusal, and showing a diagnostic to the
user are outside the model. The configured revision bound and its recovery
step are also model abstractions, not runtime revision behavior.

## Considered Options

- **Relying solely on randomized unit tests (`bun:test`)**: rejected for core state, DAG,
  and concurrency protocols because sampled inputs miss multi-worktree interleaving bugs
  and edge-case dependency graphs.
- **Using only Lean 4 or only TLA+**: rejected because proving concurrent interleavings
  and temporal liveness deductively in Lean 4 is disproportionately expensive compared to
  exhaustive `TLC` model checking, whereas TLA+ finite-state checking is less suited than
  Lean 4 for proving functional algorithms and generating fast executable conformance
  oracles over rich recursive data types.
- **Compiling Lean 4 into WebAssembly/C inside `dist/forgix.mjs`**: rejected to preserve
  the small, inspectable, zero-dependency Node.js ESM distribution and artifact size
  budget.

## Consequences

- Proofs and model checks give evidence about their stated properties, not
  blanket guarantees for the TypeScript runtime. Both tools stay out of the
  distributed CLI.
- Projects using Forgix can declare `tla-tlc` and `lean4` verifiers on high-risk
  `Shared Contract`s and `Work Item`s, backed by built-in `ASSURE` guards against formal
  escape hatches (`sorry`, `axiom`, and `.cfg` bound weakening).

## Definition of Done

1. **Design approved.** Independent review covers the resume contract, receipt
   safety, model boundaries, and actual CI coverage. A human approves the exact
   reviewed design revision. This does not authorize implementation or
   publication.
2. **Implementation verified.** Under a separate mandate, run the TLC command
   above with the existing bounds, invariants, and deadlock check. Confirm no
   errors. Add `-dump dot,actionlabels graph.dot` to export the state graph.
   Confirm a reachable blocked waiting loop compatible with fairness. For
   every exported `ResumeTask` edge, check that the destination status equals
   the source's `resumeTo`. For every `RefuseResume` edge, check that status
   stays `blocked`, `resumeTo` is unchanged, and the outcome is
   `approval_required`. Require reachable success and stale-receipt refusal
   edges for both BUILD and ASSURE so those checks cannot pass without
   exercising either target. On disposable copies, removing
   `~ApprovalRequired` from `ResumeTask` must violate safety; removing
   `RefuseResume` from `HandleResume` must violate liveness. Run
   `bun test test/unit/formal-kernel.test.ts` to check the existing scanner
   and TypeScript oracle. Record versions, revisions, outcomes and limits.
   The pilot changes only the model and this ADR; production behavior,
   configuration bounds, Lean and CI stay unchanged. TLC is not validation
   of TypeScript resume or reconciliation.
3. **Review change delivered.** After a human validates the implementation and
   evidence and explicitly authorizes publication, use the repository's
   [Human-Reviewed workflow](../git-workflow.md#risk-tiers). Record the
   review URL, head revision, and required remote check results. Pending or
   failed checks are not full delivery. Merge is separate.

## Review state

Independent Goldfish review completed. Revalidation covered receipt safety and
reconciliation limits, fairness, post-refusal scope, current versus target CI,
and the delivery gates. A final targeted review checked the resume and refusal
edge criteria. No material finding remains open in that scope. The review was
static; it did not verify runtime conformance or remote CI.

Reviewed body SHA-256:
`7a87b32651c8ea1cfbc030c395f9e1de78cab772d4d7afbab3aabb4b7a3773a5`.
The digest includes all bytes before the `## Review state` heading.
Human approval of this design revision was recorded on 2026-11-22.

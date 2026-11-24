# ADR 0040: Bind BUILD Authorization Across Entry Points

## Status

Proposed for independent review. GATE-issued v2 receipts, renewed human approval
for unverifiable receipts, hook policy and the durable Roadmap handoff are
settled design directions. No runtime change is approved by this revision.

## Context and boundary

[GATE](../lifecycle-contract.md#gate) authorizes BUILD for the exact Change
Contract. Historical state writes did not consistently reserve receipt issuance
to GATE; old v1 receipt shape and digest cannot distinguish those writes from
GATE issuance. Native hooks also derive task exemptions from executing state.
A hook and a resumed task must not disagree about whether a task can use its
approved Protected Surface paths or Escape Hatches.

[ADR 0039](0039-project-task-next-actions-from-persisted-state.md) owns advisory
task routing, not write authority. [ADR 0041](0041-bind-assure-completion-to-verified-inputs.md)
owns ASSURE completion and evidence. This ADR does not add a sandbox, expand the
set of intercepted tools or paths, or claim to defend against direct edits to
runtime-owned local files. Host-native human intent remains required; a receipt
proves issuance by the runtime GATE operation under this trust model, not the
identity of an independently authenticated human.

## Decision

### Issue and verify one BUILD authorization

Only the locked human GATE approval path issues an embedded v2 Plan Approval
Receipt and its matching `awaiting_approval` to `executing` transition in one atomic
TaskState write. Keep TaskState V6. V2 is legal only for approval by `user` with
no autonomous issue reference. Reuse the historical field bindings and bind v2
to the canonical worktree root resolved by the runtime at issuance. The approved
state identity, receipt and matching transition must agree on task, artifact,
contract, prior revision and state fingerprint. Keep the approval transition
verifiable for as long as the receipt can authorize BUILD; a history counter
cannot stand in for the transition. Change and reject keep their existing format.

All new v2 approvals require `--approve --digest=<contract-digest-from-ready-view>`,
including for legacy Quick and Plan. An omitted or stale digest refuses issuance;
legacy TaskState remains readable. This changes legacy approval syntax when
0040 takes effect, not the preceding advisory behavior in ADR 0039. Goldfish
also requires Codex and the review digest from that view. Recheck against the
locked current state before issuing the pair. An unrelated revision change may
retain the shown contract only if the exact contract and applicable review
digests still match and all current preflight rules pass. The receipt captures
the actual locked pre-GATE revision and fingerprint; later validation checks
that fingerprint against the retained approval transition, not today's state.

Every human GATE view must display the exact Protected Surface paths and Escape
Hatch allowances bound by that digest, including any kind-wide or substring
allowance, or explicitly state that there are none. The host presents these
alongside the canonical plan before requesting approval. The digest prevents
substitution after presentation; it does not replace disclosure of the grant.

`task save` may preserve an existing receipt and approval transition unchanged,
or invalidate them on a legal return to SHAPE. It may not install or resurrect
approval proof, replace its worktree binding, or enter BUILD from GATE. Returning
from a blocked state to an already approved BUILD may reuse valid current proof;
a blocked resume target never supplies authorization. Apply the same rules to
creation and updates.

Put read-only mechanical receipt and contract verification in one core module
shared by task and hooks, without peer-domain imports. Validate the receipt
digest and retained pair, recompute the canonical contract digest, and compare
the runtime-observed canonical worktree root. Task owns persistence and
issuance. First BUILD entry, resume, Goldfish `check-build` and `record-write`,
and task-derived hook exemptions use the same proof verdict.

### Native hook policy

Use the canonical Git worktree containing the native event's working directory,
not an unrelated invocation root, to find runtime-owned TaskState. Reuse the
CLI's safe file resolution: no symlink escapes, and the file name and task ID
must agree. Resolve each recognized target to its owning worktree and classify
its protected-path policy even if it cannot inherit the current task exemption.
For a target outside the event worktree, resolve active-task status and apply
severity in the target's worktree, without carrying exemptions from the event
worktree. A clean caller in A does not downgrade a protected write into B with
an unverified task: B's `balanced` or `strict` still denies, `warn` warns.
Task exceptions apply only when both the event and target belong to the task's
canonical worktree. If a diff cannot be partitioned by owning worktree, apply no task
Escape Hatch exemptions to it, including kind-wide or substring allowances.

Recognize worktree-local `executing`, `awaiting_approval`, and `blocked` targeting
`executing` independently of receipt validity. Only an unambiguous, currently
`executing` task with valid proof grants exemptions. More than one recognized
task in the worktree, a malformed or unreadable candidate in its owned task
store, or an indeterminate canonical binding does not qualify as “no task.”
Treat it as unverified; do not borrow exemptions from a sole task in a different
worktree. When a recognized protected write cannot establish its context, deny
in `balanced` and `strict`, warn in `warn`. A clean lookup with no recognized
task preserves outside-task behavior. Preserve the destructive-command policy
and existing post-tool severity; unverified tasks get no post-tool exemptions.
Expected verification errors must produce the policy result, not the generic
fail-open response. Do not claim coverage of tools or paths the hooks do not
recognize.

A mechanical receipt is not enough for Goldfish's first protected write. Before
granting a native pre-write exemption, apply the same live check as `check-build`
while no first-write record matches the current receipt and worktree. Share the
bounded manifest byte check and reviewed contract/capsule binding with the task
path; do not reread arbitrary or unapproved sources. Stale or inaccessible
sources mean unverified BUILD and the same host stop/SHAPE recovery. The existing
trusted host protocol records only a real successful native write; `task save`
must not supply or alter first-write proof. Once matching proof exists, do not
re-run the first-write check just because BUILD changed reviewed files. Do not
claim the hook makes filesystem reads and the host write atomic or authenticates
native evidence independent of the trusted host.

Before a matching first-write record from an earlier operation exists, the
Goldfish post-tool hook applies no Escape Hatch exemptions, even to a first
edit that passed the pre-write check. Do not rehash already-edited source bytes
to reconstruct a pre-write verdict. The first operation must pass the ordinary
post-tool policy without exemptions; an existing `warn` remains advisory.
A blocking post result does not undo the edit, grant proof or permit continuation:
do not record that operation as the first verified write; stop and reconcile.
Record proof only after a real successful native write and an explicit completed,
non-blocking post-check verdict correlated with that operation. An empty or
permissive response, a missing callback, a parse/runtime error, or a fail-open
fallback is not a completed check. The host must not record proof from it;
stop and reconcile before continuing Goldfish BUILD. Ordinary fail-open hook
behavior outside proof recording is unchanged.
Later operations may use matching proof only if native event ordering shows it
preceded the operation. When ordering cannot be established, apply no exemption
rather than reusing a later proof for an earlier event.

### Historical state and rollback

Read v1 human and autonomous receipts as history, never as BUILD authority.
Read-only status and resume report the missing proof without modifying TaskState.
To continue, use the legal return to SHAPE, preserve worktree and history,
reconcile the same task, then obtain fresh human GATE approval. Do not mutate
a historical receipt in place or auto-adopt a different task. Already-completed
ASSURE remains outside this migration; it does not grant new writes.

Older binaries cannot read states containing v2, including a SHAPE state that
retains a v2 approval in history. Do not resume such data with an older binary
or downgrade the records; restore a compatible binary. Do not claim the new
hook policy under mixed binaries. Managed activation must bind the skill and
actual registered native hooks to the same v2-capable installed bundle, rather
than accepting independent PATH fallbacks. Verify both resolved entry points and
v2 capability before enabling BUILD, exercising the native launch paths in the
host. A missing, stale or mismatched entry point blocks activation, with a
diagnostic and instructions to restore a compatible installation. Suspend
Forgix BUILD during rollback until compatible CLI and hooks are restored.
Existing TaskState is not bulk rewritten.

### Roadmap handoff, not authority

Eligibility and an issue reference do not authorize autonomous GATE. This
revision uses normal human GATE for local and published Work Items, including
eligible items. Retain the autonomous CLI syntax for an explicit refusal;
restore autonomous issuance only in a separate trusted-runner design.
Update Roadmap guidance and public docs; unattended runners pause before BUILD.

Reuse the canonical gitignored Roadmap runtime register in the originating
checkout, for local and published items. A Work Item reservation stores task
ID, branch, worktree path and the Roadmap digest at reservation; its identity is
immutable while active and independent of later edits to the register header.
Keep it as a resume coordinate, never approval. A changed Roadmap digest blocks
continuation until explicit operator reconciliation; tracker data cannot rebind
the reservation. Older runtimes that cannot decode it must not manage it.

Every writer of the canonical register, including status changes, tracker sync,
checkpoints, publication and invalidation, must use one shared lock with a fresh
read and validated update. Preserve active reservations when merging unrelated
changes; refuse replacements or updates that would remove, overwrite or silently
rebind one. Rechecking only the preparation command does not suffice.

Checkpoint recording must carry the Roadmap digest selected when verification
started. Under the lock, require it to match the current authoritative Roadmap
revision and the applicable checkpoint inputs; refuse stale results without
relabelling or opening a downstream wave. A lock and fresh read at recording
time do not authenticate old verification against newly published work.

Checkpoint consumers, including `select-ready`, must use a coherent published
Roadmap/runtime snapshot and accept only a receipt for the current digest and
applicable checkpoint inputs. If publication is in progress or interrupted and
digests disagree, block the affected downstream work rather than accepting a
matching checkpoint ID from the old register. Taking a read lock alone does not
repair data left mismatched after a crash.

Persist the verifier-observed digest separately from the register's
`roadmapDigest` on each new checkpoint receipt. The new evidence field is
optional for reading old records, required for new writes and mandatory for
a receipt to unblock work. Both digests must match the current revision.
Historical receipts without that field remain readable as history, even if
their stamped digest is current; do not copy that digest into the new field.
Reverify only checkpoints needed to unblock pending downstream work. Until
then, report that the checkpoint requires fresh verification. The normal
per-checkpoint slot may be superseded only by a valid new result; the migration
backup retains the original historical receipt.

Activation is an operational compatibility boundary for **all** Roadmap writers,
not just BUILD entry points. Before any reservation is created, suspend Roadmap
writes, stop in-flight jobs, and confirm every managed writer uses the compatible
bundle and common lock. Keep a consistent register backup while writes are frozen.
Resume writes only after this check. During rollback or a mixed-version window,
keep the reservation-aware register untouched and suspend all Roadmap mutations,
including publish, checkpoint, sync and status operations. Restore compatible
writers and reconcile the register and worktrees before resuming. Do not point
an old writer at the live register or overwrite new reservations with a stale
backup. An unmanaged old process can still replace the file: the new schema
and lock cannot constrain it, and operation with unmanaged writers is unsupported.

Expose a read-only Work Item resume lookup even for `In Progress`, independent of
`select-ready`. The preparation operation uses that same lookup under lock, and
for new eligible work persists exactly one coordinate before marking it
`In Progress`, before first task initialization, and before returning it to
the host. Neither dry run nor selection reserves anything. Serialize the
mechanical initializer for that coordinate and create its task only if absent;
a concurrent preparation returns the existing reference, not a second start.
Do not hold a lock across a model turn or human approval.

On retry, if only the reservation exists and its expected targets are absent,
continue initial setup at the same coordinate. With matching branch, registered
Git worktree and matching TaskState present, return that exact task for ordinary
resume. A branch without its matching worktree, or a worktree without TaskState,
may resume setup only if ownership of that partial state is verifiable from
runtime records; otherwise report the partial state for operator reconciliation.
An existing task is never overwritten or initialized twice. A missing
reservation for existing `In Progress` work, identity mismatch, missing or
different target, or a conflicting existing file does not authorize replacement.
Preserve the file/worktree, report the saved coordinate and stop. Recovery may
reuse a verified partial setup; it never starts elsewhere automatically.

## Definition of Done

- **Design approved:** Independent review covers authorization across CLI/store
  and native hooks, legacy migration and rollback, and concurrent or interrupted
  runner handoff. Resolve material findings and obtain human approval of this
  exact revision. This does not authorize implementation or publication.
- **Implementation verified:** Under a separate mandate, scope the write set to
  the shared core verifier, task store and Goldfish guard, hook context/results,
  CLI and Roadmap runner, embedded receipt and Roadmap runtime schemas and types,
  host skill and affected public contracts, targeted tests and tracked CLI build.
  Keep ASSURE proof rules, hook modes, unrelated envelopes, formal eligibility,
  publication and Protected Surface policy unchanged. Record final revision,
  exact results and material limits after the final edit:
  - Genuine v2 survives restart. Reject missing or stale shown digests for all
    contract formats, including concurrent replacement of a legacy view. Verify
    the human presentation lists every digest-bound Protected Surface path and
    Escape Hatch allowance for legacy, Plan v2 and Goldfish. V1
    human/autonomous, missing, injected, changed, mismatched, wrong-worktree or
    stale proof cannot authorize BUILD. Blocked
    resume and Goldfish write checks obey the same rule. Exercise fresh GATE
    recovery without disturbing worktree contents, and old-binary refusal of v2.
  - In a recognized but unverified BUILD, neither CLI nor hooks may grant task
    exemptions. Exercise protected writes and Escape Hatch checks, valid path
    exemptions, `balanced` and `strict` denial, `warn` diagnostics, multiple
    worktrees, ambiguity, malformed/unreadable candidates and outside-task
    non-regression. Verify mixed-target exemption containment, including clean
    caller A to unverified target B, and both mixed-version directions. Capture actual native pre-write and relevant post-tool-use or
    post-invocation events per supported harness. For Goldfish, change reviewed
    sources after GATE and before the first write: both paths refuse. A legitimate
    first edit touching a reviewed source gets no post-tool exemption and is not
    judged by a post-edit rehash. Test ordinary post-check success, blocking
    results, missing or fail-open verdicts, delayed callbacks and later use of
    correctly ordered first-write proof.
  - Exercise local and published dispatch, racing initialization, stale tracker,
    checkpoint and publication writes, digest drift, and restart at the same
    coordinate. Cover reservation-only, branch-only, worktree without task and
    intact task. Verify a stale checkpoint from revision A cannot satisfy
    revision B, including a prior Passed receipt during and after interrupted
    publication. Verify a legacy Passed receipt whose digest already equals B still
    cannot release a B dependency; a fresh B result can, and unrelated checkpoints
    are not rerun. Demonstrate the full writer freeze during migration and rollback,
    including the old publish case, and only permit compatible writers to resume.
    Unattended runs stop without approval; conflicting targets block without
    duplication. Tracker sync never grants authority.
  - Run Full Gate, packed CLI tests and applicable native scenarios. Do not
    weaken formal eligibility tests when runtime issuance is suspended.
- **PR delivered:** After human validation of the implementation and explicit
  publication approval, use Human-Reviewed delivery. Record the review URL,
  tested head and required remote results. No merge.

<!-- EGM review metadata: start -->

## Review state

Digest domain: SHA-256 of UTF-8 bytes before the opening review metadata marker.
Independent EGM review and fresh targeted revalidations completed. Substantive
revision `1c9ce0b73e3e85cefa570ef442d3fbba5fbe2a90e296be695ed41a79bdc599c7` has no open material design findings and is ready for
human design approval. Earlier independent coverage is retained only for
unchanged contracts.

Reviewed CLI and native hook authorization, v1 recovery, managed compatibility
and rollback, first-write freshness and post-proof handling, Roadmap reservation
and recovery, and checkpoint recording, consumption and migration. The final
targeted review confirmed legacy matching-digest receipts cannot unblock work and
that re-verification is limited to dependencies that block pending work.

Source baseline: `3411060` with uncommitted implementation. Final targeted source
manifest SHA-256: `95b7d61ea243203f904ea0efea36b1982ecd9f1bb4fcd9bc9390ba81adafdc4a`, over the schema, Roadmap and CLI
sources named by the checkpoint review (sorted repository paths; rows contain
file SHA-256, two spaces, path and LF).

Static design review only. No native execution or implementation verification.
No risk acceptance recorded.

**Human design approval (2026-11-22):** The user explicitly approved substantive
revision `1c9ce0b73e3e85cefa570ef442d3fbba5fbe2a90e296be695ed41a79bdc599c7` in chat. Approval covers the design only; no implementation
or publication is authorized.

<!-- EGM review metadata: end -->

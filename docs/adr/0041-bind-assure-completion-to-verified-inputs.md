# ADR 0041: Bind ASSURE Completion to Verified Inputs

## Status

Accepted.

Resolved decisions:

- **Historical compatibility**: Newly sealed runtime receipts use `schemaVersion: 2`. Structurally matched historical v1 pairs (`schemaVersion: 1` receipt + matching `assure.completed` event) remain readable and are classified as `historical` (never silently promoted to `verified`). Single-half or mismatched pairs are classified as `incomplete`, preserved unchanged on read, and offer no writes.
- **Verifier-input freshness**: Explicit bounded guarantee — before sealing a v2 receipt under the task write lock, the runtime directly observes the live Git worktree snapshot and SHA-256 digests of any declared external artifacts (`externalArtifacts`), failing closed when any input is unobservable (without claiming filesystem isolation against concurrent external edits).

## Decision and scope

Preserve [ADR 0031](0031-make-assure-the-success-boundary.md): successful ASSURE
keeps status `assuring`. Under the task write lock, the runtime owns the canonical
completion index, Assurance Receipt and matching `assure.completed` event;
publish together or not at all. A save payload may submit evidence, not create,
replace or remove completion proof. Read-only validation and resume do not
manufacture completion. Task guidance offers no writes once durable completion
is established by this contract.

With only one half of a completion pair or a mismatch, preserve the source state
unchanged, offer no writes, and report incomplete completion. Do not backfill
proof on read. A structurally matched historical pair shows consistency, not
runtime issuance or independently observed freshness. Decide how to represent
such historical records separately from newly verified completion and whether
new proof needs a receipt-version discriminator. No historical assurance claim
may silently acquire a stronger guarantee.

### Evidence contract to resolve

The runtime must observe the actual worktree before sealing a receipt, rather
than trusting a claimed snapshot in the save payload. Specify the observable
input set and verification mechanism before implementation. Equal worktree
fingerprints around an operation do not prove what that operation read if inputs
change and revert while it runs. Choose either input isolation for operations
that require that guarantee or an explicitly bounded guarantee that does not
claim isolation. The TaskState lock is not a lock on external editors.

Include generated and external inputs that materially affect the verifier.
The packed runtime test may consume an ignored tarball or an explicitly supplied
artifact; a repository tree hash alone does not bind it to the run. Define
artifact identity, its relationship to the verified source, and what fails
closed when an input is unobservable. Keep presence, provenance and freshness
separate.

## Definition of Done

- **Design approved:** Decide historical compatibility and the verifier-input
  guarantee. Independent review covers atomic publication, read-only recovery,
  snapshot freshness, concurrent edits and generated artifacts. Human approves
  the exact revision.
- **Implementation verified:** With separate authorization, show the store
  refuses injected proof, never publishes half a pair under interruption, never
  synthesizes a receipt on read, and does not advertise or accept task writes
  after verified completion. Cover historical pairs and single-half cases,
  changed and reverted inputs, and a stale or substituted packed artifact.
  Preserve formal eligibility models; adapt runtime-facing conformance tests to
  exercise actual persistence. Record final revision, exact results and limits,
  Full Gate, packed CLI and applicable native validation.
- **PR delivered:** Human validates the implementation and authorizes
  publication. Use Human-Reviewed delivery. Record the review URL, head and
  required checks. No merge.

No implementation or publication is authorized by this draft.

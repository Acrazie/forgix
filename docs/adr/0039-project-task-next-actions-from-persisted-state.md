# ADR 0039: Project Task Next Actions from TaskState

## Status

Proposed. This revision narrows the previously reviewed design to task guidance.
It does not approve the current worktree implementation.

## Context

[ADR 0035](0035-declarative-software-factory-and-self-improving-telemetry.md)
makes the Next-Action Envelope the routing interface for thin skills. Task hints
have omitted required command arguments, and resume has not returned the same
guidance as a task transition. Fix the advisory contract without making the
projection an authorization check or a verifier.

## Decision

Keep the envelope's JSON fields and string-template representation.
Template text, required arguments and membership can change. Derive task
guidance from TaskState and reuse deterministic command prerequisites; do not
add filesystem or host checks to the envelope computation. Do not expose
`--autonomous` through generic task guidance: a task-only projection cannot
identify an authorized Work Item run. Do not change Roadmap or profile envelopes,
TaskState schemas, or execution policy here.

If TaskState exists, `resume` returns the same envelope as other task commands
for the same state. A missing task retains routing-only output. Resume does not
write TaskState; normal routing, including the quota cache, is unchanged.
For an existing task, use `task validate <id>` to obtain the latest state and
persisted revision before preparing a `task save` payload. Use the read revision,
not the proposed revision, as `--expected-revision`; reconcile a conflict instead
of retrying the stale payload. First save keeps the existing bootstrap path and
uses expected revision `0` when required; it does not require a successful read of
a nonexistent task. Historical Plan adoption remains explicit.

For GATE, the host requests human **approval** only after a fresh, ready
`task gate <id> --view`. A live refusal overrides state-derived approval hints;
a blocked view does not prevent requesting a change or rejection where those
actions are available. For
changed Goldfish sources, return to affected SHAPE work before asking again.
For a stale approval view, obtain a new ready view and fresh intent, not an
automatic retry. Preserve the existing Plan v2 contract digest, Goldfish Codex
harness and paired digest requirements, and historical approval syntax.

Before projection, the host verifies permission for the exact canonical preview
and destination. `--authorize=<contract-digest>` binds content and does not prove
permission. This ADR does not change the CLI's mechanical checks or the host's
authority. An offered action is never a grant of BUILD or delivery permission.

### Explicit exclusions

- [ADR 0040](0040-bind-build-authorization-across-entrypoints.md) owns GATE receipt
  provenance, enforcement in the CLI and native hooks, and Roadmap handoff.
  Removing a generic hint here does not disable the autonomous execution path.
- [ADR 0041](0041-bind-assure-completion-to-verified-inputs.md) owns durable ASSURE
  completion and evidence verification. This ADR leaves ASSURE roles and action
  availability unchanged. Do not infer `terminal` from receipt presence or add a
  completion-specific write filter here. The earlier criterion “completed ASSURE
  offers no TaskState writes” moves to ADR 0041 and must be verified there.
- Neither follow-up is required to verify the narrowed guidance design. A local
  change that derives terminal guidance from receipt presence is outside this
  ADR's implementation boundary and must not be shipped under it.

## Definition of Done

- **Design approved:** Independent review covers template compatibility, resume
  parity, live GATE precedence and the exclusions. The human approves this exact
  revision; that does not authorize implementation or publication.
- **Implementation verified:** Under a separate mandate, scope runtime changes
  to task envelope projection, deterministic preflight/phase helpers, CLI
  routing, the host skill and focused regression tests. Rebuild the tracked CLI.
  Replay first save from missing state, revision-bound updates, and Goldfish/Plan
  GATE templates. Retain historical syntax. Verify stale revision refusal without
  a TaskState write and that blocked GATE still permits change/reject, not approval.
  Verify the generic task envelope omits `--autonomous` while Roadmap and profile
  envelopes are unchanged. Compare resume and
  transition envelopes, preserve routing-only missing-task behavior and verify
  resume leaves existing TaskState bytes unchanged. In a supported native host,
  demonstrate that a stale approval or source-drift refusal cannot prompt for
  approval until the live view is ready again, and that projection still depends
  on host permission. Verify no receipt, hook or ASSURE completion rule changed.
  Record source revision, exact commands and observed results after final edits;
  run the repository Full Gate and packed CLI runtime tests.
- **PR delivered:** After human validation of the actual implementation and
  explicit publication approval, use the repository Human-Reviewed delivery
  path. Record the review URL, tested head and required remote results. No merge.

<!-- EGM review metadata: start -->

## Review state

Digest domain: SHA-256 of the UTF-8 bytes before the opening review metadata
marker. The combined draft at `70e028496f216446fffe4b195a323567dee26a0cf2ba17d336308d7d7ca20e3a`
was split; its authorization and ASSURE findings transferred to ADRs 0040 and 0041.

Fresh-context review of the split confirmed independent scope and found two
contract ambiguities: approval-only live readiness and first-save bootstrap.
After correction, fresh-context revalidation of
`4704cffac7f4f76d9b3d385813670509fb6c5f3f6560619b483e77787a153986` found no open material design findings. Ready for human approval of
this revision, not implementation-verified. ADRs 0040 and 0041 were inspected
for scope only, not readiness.

Source baseline: worktree on `3411060` with uncommitted implementation. Selected
source manifest SHA-256: `7c98cd30895d9529112d65031493f7da9ed13e6b1cdb72afd8bd31297bf8e6ff` (sorted repository paths; rows
contain SHA-256, two spaces, path, LF). Static review only.

The current worktree is not approved: the generic autonomous hint, receipt-only
terminal guidance and glossary claim, blocked save read prerequisite, and host
live GATE precedence still need implementation against this ADR.

**Human design approval (2026-11-22):** The user explicitly approved substantive
revision `4704cffac7f4f76d9b3d385813670509fb6c5f3f6560619b483e77787a153986` in chat. Approval covers this ADR's narrowed design only;
it does not approve the current implementation, authorize implementation or
publication, or approve ADRs 0040 and 0041.

<!-- EGM review metadata: end -->

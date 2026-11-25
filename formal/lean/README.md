# Lean 4 workflow pilots

With Bun and Lake on PATH, using the version in [lean-toolchain](lean-toolchain),
run either check from the repository root:

```sh
bun scripts/verify-assure-lean.ts
bun scripts/verify-gate-lean.ts
bun scripts/verify-preparation-lean.ts
```

These opt-in checks run `lake build`, generate JSON cases with Lean, and replay
them against production TypeScript. Neither the Full Gate nor the distributed
plugin needs Lean. The comparison detects divergence on the generated cases;
it does not prove TypeScript conformance for all inputs.

Buildkite runs the same checks in the advisory `formal-lean` step on non-tag,
non-scheduled builds. A failure is reported but does not block the build.
Run the same Linux job locally with a compatible Dagger engine:

```sh
dagger call formal-lean --source=.
```

## ASSURE evidence

The cases exercise receipt eligibility in the production task-state validator
on an approved Plan v2. [Assure.lean](ForgixKernel/Assure.lean) proves two necessary conditions for its
evidence predicate: every operation has evidence for its current definition and
snapshot that covers all its subjects; every acceptance criterion has passing,
current evidence. A conditional operation can have justified non-applicability,
but that verdict does not cover an acceptance criterion.

The model takes normalized records. It filters by operation ID and verifier
fingerprint, picks the latest record by timestamp (last entry wins ties), and
then checks the snapshot. It never falls back to an older pass when the selected
record is stale or failed. Fingerprints are opaque; their calculation, schema
validation, human observations, issue resolution, and receipt persistence are
outside the model.

## GATE approval

[Gate.lean](ForgixKernel/Gate.lean) proves that the interactive approval model
can emit a receipt only if preflight is ready, the supplied contract digest is
current, and the supplied review-view digest is current when Contract Review requires
one. The resulting receipt carries the current contract digest. The review-view
digest is checked at approval, not stored in the receipt.

The cases exercise the production GATE decision function for a projected Plan
v2 and three Contract Review states. In the reviewed case, accepting a major
changes the review-view digest without changing the contract digest; the
previous view must still fail. Preflight computation, legacy approval without a
digest, autonomous GATE, source rechecks under the task lock, and persistence
are outside this model.

## SHAPE evidence freshness

[Preparation.lean](ForgixKernel/Preparation.lean) proves that an accepted
explicit observation matches its expected fingerprint. Without an explicit
observation, every available referenced fingerprint must match the expectation.
The cases exercise both the production task validator and GATE preflight.

A missing source fingerprint alone is not a mismatch in the current SHAPE
validator. The model does not prove that Discovery was sufficient, that files
were actually read, or that the plan is implementable.

## INIT profile reconciliation

The same Lean module proves that a stale decision has an observed fingerprint
mismatch and that invalidation selects exactly the known decisions that reach
a stale root (including the root) along dependency paths up to the number of
decisions. That bound covers the simple paths of a valid profile DAG.
The cases compare stale roots, the invalidated closure, missing sources, and
overall freshness against the production profile reconciler. A missing source
is reported separately and prevents a current result without adding a stale
root. Domain documentation, local overlays, approval, and publication are
outside this pilot.

# ADR 0007: Collect Opt-In Local Benchmark Feedback

## Status

Accepted.

## Context

Codex Dev Flow is valuable only when its reliability and avoided rework justify its
orchestration cost. Running equivalent tasks with multiple models or comparing Dev Flow
against an additional vanilla Codex execution would multiply token usage and defeat that
goal. Automatic production telemetry would also create privacy, consent, and operational
costs disproportionate to early local dogfooding.

The maintainer still needs structured evidence about user satisfaction, contract
conformance, perceived plugin value, and common deviations.

## Decision

New runs may opt into local benchmark feedback with the public invocation flag:

```text
$dev-flow --benchmark [quick|standard|critical] <objective>
```

The flag is disabled by default, accepted only when creating a task, persisted with that
task, retained automatically across resume, and exposed by status. It never triggers a
second task, another model, an A/B comparison, or an upload.

After `finished_local`, `finished`, or `failed`, Dev Flow offers three deterministic
questions without a model call:

1. satisfaction from 1 to 5;
2. conformance to the expressed need: yes, partially, or no;
3. Dev Flow value: useful, neutral, or counterproductive.

Each question permits an optional free-form clarification, followed by an optional
general comment. The lifecycle result is already final: feedback cannot change task
status, evidence, or handoff. No questionnaire is offered for `blocked`,
`ready_for_handoff`, or `cancelled`.

A benchmark record is written atomically only after all three required answers exist.
Closing the session before completion creates no benchmark record and contributes no
benchmark data.

Deterministic deviation checks compare:

- Quick against the canonical request, Intake Brief, guardrails, and bounded scope;
- Standard and Critical against the current approved Change Artifact and Approvals.

They record structured facts such as unexpected file additions/deletions, unplanned
surfaces, uncovered criteria, skipped or failed checks, unapproved scope changes, and
handoff mismatch. A new file is a deviation only when the authoritative contract did not
permit it.

Completed records live under:

```text
.codex/benchmarks/<task-id>.json
```

The directory is gitignored and excluded from product-diff analysis. Records contain
allowlisted metadata, questionnaire answers, deterministic deviation signals, task and
artifact references, plugin/policy versions, duration, and token/call metrics when
available. They contain no prompt, transcript, code, diff, secret, or automatic upload.

The deterministic command below summarizes completed records without a model:

```bash
npx codex-dev-flow benchmark summary
```

## Consequences

- Maintainer can dogfood one real task and retain comparable feedback without paying for
  duplicate executions.
- Non-response is intentionally absent rather than treated as negative or positive
  evidence.
- Public flag and record format become compatibility surfaces requiring parser, schema,
  state, privacy, and migration tests.
- User comments remain local but still require length bounds and deterministic secret
  redaction before persistence.
- Benchmark collection stays outside the six lifecycle phases and cannot weaken truthful
  terminality.

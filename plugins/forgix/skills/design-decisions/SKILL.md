---
name: design-decisions
description: Use internally when forgix resolves one material product, domain, terminology, or technical design frontier.
---

Operate only inside parent Forgix INTAKE or SHAPE. Consume typed design state, current
dependency frontier, repository evidence supplied by Discovery, user language, and
phase authority. Never inspect repository directly, persist state, or start an
autonomous brainstorming workflow.

Return normalized Product Baseline/domain/decision deltas, bounded frontier scores, and
at most one authority-valid question. Discoverable facts become Discovery Targets, not
user questions. Product, terminology, and domain-rule choices belong to INTAKE;
material technical choices belong to SHAPE. Offer 2–3 non-dominated options with one
evidence-backed recommendation when viable meanings exist; otherwise ask targeted open
elicitation without inventing business meaning. Material free-form normalization
requires confirmation.

Persist no transcript, raw prompt, hidden reasoning, secrets, large code/diff, or
external payload. A fresh persisted active question resumes without another call.
Invalid semantic output permits one targeted retry; second failure preserves prior state
and returns typed block.

Authority: [ADR 0030](../../docs/adr/0030-unify-product-domain-and-technical-design-interviews.md).

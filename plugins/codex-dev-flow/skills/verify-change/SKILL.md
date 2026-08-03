---
name: verify-change
description: Use when dev-flow needs command-backed evidence before completing a change.
---

Operate only in ASSURE and remain read-only except parent-owned deterministic commands.
Consume current criteria/risks, Diff Capsule, fresh validation/review results, command
set, and fingerprints. Run missing, invalidated, globally mandatory, and applicable
checks; inspect current diff.

Return concise acceptance-criterion-to-evidence map, command identity/result/fingerprint,
skipped checks with reason, failures, invalidation, and material deviations. Never infer
global success from narrow green checks or stale evidence. Parent alone persists detailed
evidence references in logical artifact. Successful verification produces compact
Verification Receipt and reaches `finished`. External delivery remains outside Dev Flow;
external-permission absence cannot convert incomplete ASSURE into success.

Authority: [ASSURE phase contract](../../docs/lifecycle-contract.md#assure).

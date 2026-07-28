# ADR 0004: Scale Assurance Lanes by Applicable Risk

## Status

Accepted.

## Context

Repeating full repository discovery during review and running every specialist review
lane for every change wastes quota. Removing independent review from Critical changes,
however, would weaken assurance and could hide false success.

## Decision

ASSURE consumes a compact Diff Capsule derived from approved criteria, applicable risks,
changed surfaces, dependency impact, and fresh validation evidence.

Standard runs one structured review over changed and impacted surfaces. Critical keeps
independent read-only review, but activates specialist lanes according to applicable
risk. A lane may be omitted only with a structured, evidence-backed non-applicability
decision. Ambiguous applicability activates the lane.

Findings retain deterministic fingerprints. A resolved finding is not reconsidered
unless its affected code or supporting assumptions changed. Verification reuses fresh
evidence and reruns missing, invalidated, or globally mandatory checks.

Known deterministic failures block expensive reviewer calls until corrected.

## Consequences

- Review tokens track changed risk surface more closely than repository size.
- Critical independence remains while irrelevant specialist work decreases.
- Risk-to-lane rules and non-applicability evidence become testable policy.
- Incorrectly classifying a lane as irrelevant is a new risk; ambiguity therefore fails
  toward review, not omission.
- Diff and evidence invalidation must share fingerprints with Context Capsule state.

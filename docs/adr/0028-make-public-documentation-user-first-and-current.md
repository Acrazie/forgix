# ADR 0028: Make Public Documentation User-First and Current

## Status

Accepted and implemented.

## Context

The repository root README and packaged plugin README served different audiences and had
drifted. The root explained installation while the packaged README opened with lifecycle
internals. Neither gave one complete path from installation through Project INIT to a
first verified task. Public pages also mixed available behavior with accepted target
design, and completed plans plus superseded ADRs remained in the published package.

Project INIT introduced another naming collision: `$dev-flow init` performs agentic
project discovery and interview, while `npx codex-dev-flow init` runs a deterministic
plugin Configuration wizard. A user-first explanation must distinguish them without a
breaking command rename.

## Decision

Public documentation uses four layers:

```text
README -> practical guide -> normative contracts -> decision records
```

- Root and packaged README files lead with value, requirements, installation, Project
  INIT, a first task, current commands, generated files, configuration, and safety.
- `docs/getting-started.md` owns the end-to-end walkthrough, resume paths, and common
  failures.
- Normative contracts own exact lifecycle, schema, authority, privacy, and transaction
  rules. README prose links to those rules instead of reproducing all internals.
- ADRs explain durable trade-offs. Clearly labeled target documents may describe
  unimplemented design, but README files describe only behavior users can invoke now.

The two README files share tested user-journey invariants but need not be byte-identical.
The root may add repository development and quality sections. Relative links adapt to
each location.

Canonical interface names are:

- **Project INIT** for agentic `$dev-flow init`; and
- **Configuration wizard** for deterministic `npx codex-dev-flow init`.

README diagrams use portable ASCII. The practical guide may use Mermaid for relationships
that benefit from a rendered graph. Generated screenshots and binary diagrams are not
required.

Documentation that is fully superseded, describes completed delivery sequencing, or is
an obsolete implementation plan may be removed after all current references and package
manifests are updated. Documents that still define runtime behavior remain until their
replacement is implemented atomically.

## Consequences

- New users can install the plugin, initialize a project, and start a task without first
  learning TaskState internals.
- npm package, marketplace, and repository entry points teach the same workflow.
- Current capability and future target remain visibly separate.
- Command-name compatibility is preserved while the two INIT concepts become explicit.
- README alignment and relative links become automated distribution checks.
- Removing dead history reduces package noise but intentionally trades exhaustive local
  design archaeology for current, authoritative documentation; Git history remains the
  archive.

# ADR 0032: Keep the Public Website in the Product Repository

## Status

Accepted as an architectural decision; implementation and deployment are pending.

## Decision

Keep the English public website in a root `site/` workspace, outside the publishable
plugin package. The website and plugin share the root Bun installation and lockfile
defined by ADR 0022, while retaining separate build and deployment responsibilities.

The website targets experienced developers first and teams second. Its purpose is to
help visitors install the plugin and complete a first verified workflow. It presents
current capabilities, a real demonstration, installation entry points, and limitations;
it links to the canonical practical guide rather than maintaining a second walkthrough.
This preserves the documentation ownership established by ADR 0028.

## Considered Alternative

A separate repository would isolate website tooling and editorial delivery, but would
require cross-repository coordination to keep product claims and installation guidance
current. No independent editorial team or lifecycle currently justifies that cost.

## Consequences

Product and presentation changes can be reviewed together. Website dependencies affect
the shared dependency graph, so quality-tool scope and CI responsibilities must remain
explicit. Website files must remain outside plugin distribution artifacts.

This repository-level decision lives outside the packaged plugin documentation: adding
website architecture records to the plugin's distribution would change its allowlisted
manifest and size budget without benefiting runtime users.

Publish static output at `https://dev-flow.acrazie.dev` on the owner's Netcup VPS through
Dokploy. Automatic deployment follows successful validation of relevant changes on
`main`; unrelated plugin changes should not cause deployment. Infrastructure changes
and production activation require separate authorization. This decision does not imply
that a domain, Dokploy application, or deployment pipeline has been configured.

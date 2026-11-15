# Forgix

![Forgix](assets/logo.svg)

Turn a software objective into an approved, implemented, and verified change.

Forgix is a development workflow plugin for **Codex**, **Claude Code**, and **Antigravity**.
Use it when a software change needs decisions, implementation, and evidence—not just an answer.

- **Clarify the objective** against the repository and resolve material product and technical decisions.
- **Approve the plan** before implementation begins.
- **Build and verify** with fresh evidence tied to the approved change.

## Requirements

An agent host with plugin support, Node.js 24 or newer, Git, and Linux or macOS.
Windows is unsupported. Bun is not required to use the plugin.

## Start in your repository

After installing Forgix, create or reconcile your project's engineering conventions with
**Project INIT**. It inspects the repository and requires explicit Profile Approval before
publishing the shared profile.

### Codex

```text
$forgix init
$forgix Add rate limiting to the public authentication endpoints
```

### Claude Code

```text
/forgix:forgix init
/forgix:forgix Add rate limiting to the public authentication endpoints
```

### Antigravity

```text
/forgix init
/forgix Add rate limiting to the public authentication endpoints
```

Run INIT first, then start your objective. Forgix guides clarification, shaping, approval,
implementation, and assurance. The optional CLI Configuration wizard is separate from
Project INIT; see the guide below for operating preferences.

## You stay in control

- Implementation requires explicit GATE approval.
- Success requires fresh verification evidence.
- Local configuration cannot weaken repository policy.
- Commit, push, pull request, registry publication, and release are never implicitly authorized.

## Guides

- [Installation, migration, configuration, and command reference](docs/getting-started.md)
- [Lifecycle and safety contract](docs/lifecycle-contract.md)
- [Technical repository README](https://github.com/Acrazie/forgix#readme)

# Public Website: Approved Scope and Implementation Plan

> **Extracted (Superseded in-repo):** The `site/` scaffold has been extracted to standalone `/Users/acrazie/Fluidise/forgix-site` per [ADR 0035](../adr/0035-require-node-26-and-extract-website.md). Ongoing website planning and implementation live in `/Users/acrazie/Fluidise/forgix-site/PLAN.md`.

## Approved Scope

Build an English static showcase for experienced developers, with team benefits as a
secondary message. Success means a visitor can understand the plugin's value, install
it, and follow the canonical guide to a first verified task. Traffic alone is not proof
of adoption.

Include the problem, available workflow, one real small-feature demonstration,
installation entry points, supported environments, limitations, and links to the
canonical guide. Preserve the existing brand. Exclude a backend, blog, duplicated
manual, fabricated testimonials, and unmeasured productivity claims.

Produce a dedicated demonstration showing clarification of an ambiguous feature,
approval, native Codex implementation, and verification evidence. Do not publish
secrets or private project data. Distinguish verified results from illustrative content.

The approved repository and hosting boundaries are recorded in ADR 0032. The user
confirmed Astro, Tailwind, Bun, site-only Node 26, and a central animated demonstration.
The library choice below is a technical recommendation, not authorization to begin
implementation or make production changes.

## Selected Technical Direction

Use Astro in static-output mode, Astro components, semantic HTML, Tailwind CSS 4 through
`@tailwindcss/vite`, and native CSS for custom tokens and simple transitions. Do not use
the older `@astrojs/tailwind` integration. Recommend Motion's vanilla JavaScript API for
the central workflow demonstration, with no React requirement. Use `motion/mini` when
standard CSS property animations suffice; only use the hybrid `motion` entry point if
the approved sequence genuinely requires its timeline features. Do not install GSAP or
Three.js alongside Motion. No SSR adapter or CMS is needed.
Astro provides component ownership, asset handling and static production output without
requiring a hydrated application. Handwritten HTML would avoid a dependency but make
reusable presentation and build-time content checks less coherent. A React application
or Next.js would introduce unnecessary runtime and framework surface.

Keep Bun 1.4.2 as the repository installer and script runner. Use Node 26 for website
checks and builds only, subject to a successful compatibility proof; retain Node 24
for plugin and existing repository lanes. Pin an available Node 26 patch version during
implementation. Do not silently fall back to Node 24 or migrate the plugin if this proof
fails. Invoke Astro through Node explicitly where necessary: a Bun script runner does
not itself prove that the build executed on Node 26.
Add `site` explicitly to the root workspaces and retain one root `bun.lock`.
Use `astro check` before `astro build`, with `@astrojs/check` and a declared compatible
TypeScript dependency in the site workspace. The repository currently pins TypeScript
7.0.2: compatibility with Astro's checker must be demonstrated, not assumed. If the
checker requires a different TypeScript version, isolate it in the site workspace under
the same lockfile; do not downgrade the plugin or root tooling.

Select and pin compatible stable dependency versions during the first implementation
task, after checking package metadata and running the checker. No dependencies are
installed by this planning change.

Serve `site/dist/` from a minimal static-server container, with no Node process at
runtime. Keep the Docker build context at the repository root for the shared lockfile.
Use `site/Dockerfile` and explicitly copied build inputs; avoid copying credentials or
the entire development checkout into the final image.

## Information and File Ownership

- `site/src/pages/index.astro` owns the initial single-page visitor journey.
- `site/src/layouts/` owns document metadata, global navigation and page shell.
- `site/src/components/` owns repeated or behaviorally distinct presentation units.
- `site/src/styles/` owns native CSS tokens, layout and motion rules.
- `site/src/content/` owns website copy and sanitized demonstration evidence.
- Existing brand assets remain the visual authority; reuse selected assets without
  redesigning the plugin identity or copying the whole brand directory.
- Installation and walkthrough instructions remain owned by canonical plugin docs.
  The website links to them. Any displayed command excerpt must be checked against
  its canonical source rather than maintained as an independent instruction set.
- `site/Dockerfile` and static-server configuration own the container boundary.
- Root scripts and CI own repository orchestration, not the plugin workspace.

Page sequence: concrete value and installation action; problem and control boundaries;
the available workflow; the real demonstration; installation requirements and guide
entry point; limitations and secondary team benefits; repository and contribution links.
Essential content must remain usable without JavaScript. Any copy control needs keyboard
support and visible success/failure feedback. No analytics or tracking is included.

### Central Demonstration and Dependency Admission

Present the verified workflow as readable steps with progressive visual emphasis, not
as an invented live agent execution. Offer keyboard-accessible playback, pause and
replay. Do not run an endless decorative loop. Reduced-motion mode and JavaScript-free
rendering show the full readable evidence without animated transitions. Suspend active
playback when the demonstration is offscreen or the document is hidden; clean up
animation controls and observers when the component is removed.

Prefer transform and opacity animations; avoid layout animation and per-frame framework
state updates. Load animation code only for the demonstration and measure actual output
and main-thread cost, rather than claiming performance from package names.

shadcn/ui remains conditional: add selected components only if a specific accessible
interaction cannot be served cleanly by native HTML and Astro. Its React implementation
requires an explicit React island and bundle-cost review; no blanket component kit
installation is planned. TanStack remains conditional on a concrete data/table/state
need, none currently identified. A Three.js scene would require a separate scope
decision because no approved content needs 3D.

## Proposed Delivery Sequence

1. Inspect existing brand assets, canonical documentation, workspace tooling, package
   boundaries, and Dokploy deployment options. Consult current documentation before
   selecting or configuring a framework. Propose the smallest suitable static stack
   and obtain approval of the implementation plan.
2. Produce and verify the demonstration. Review every public claim against available
   behavior and preserve separate authority for commit, push, PR, and release actions.
3. Implement `site/` with the shared root installation, explicit website checks and
   build, responsive layouts, accessible navigation, and reduced-motion support.
   Keep plugin behavior and distribution unchanged.
4. Define deployment inputs and relevant-change detection, including shared lockfile,
   build configuration, and any canonical content consumed by the website. Unrelated
   plugin source changes must not trigger website deployment. A passing authoritative
   validation gate must precede automatic deployment from `main`.
5. After separate infrastructure authorization, configure Dokploy, DNS and TLS for
   `dev-flow.acrazie.dev`; verify rollback procedure and public delivery.

## Acceptance Evidence

- A clean root install and production website build succeed.
- Repository checks remain valid; plugin distribution excludes website artifacts.
- Installation links and commands agree with canonical documentation.
- The demonstration has reproducible steps and recorded verification results.
- Keyboard navigation, narrow layouts, contrast and reduced motion are checked.
- Relevant-change detection is tested for positive and negative cases.
- Public HTTPS delivery, assets and installation navigation are verified after rollout.

Report local validation, CI, PR delivery, deployment and public verification separately.
No production readiness claim may rely only on a local build.

## Implementation Tasks and Proof

| Task | Change                                                                                                             | Required proof                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1   | Add private Astro workspace and explicit root `site:check` / `site:build` commands; resolve checker compatibility. | Frozen root install, Astro diagnostics and static build succeed; plugin checks retain their current TypeScript version.                                                                          |
| T2   | Produce the dedicated demonstration and review public copy against current commands and supported platforms.       | Recorded initial request, clarification, approval and verification; sanitized evidence; command/source consistency checks.                                                                       |
| T3   | Build the English single-page site from the existing brand and real evidence.                                      | Desktop and 320px mobile inspection, keyboard navigation, reduced-motion check, no-JavaScript content, working installation and guide links.                                                     |
| T4   | Integrate website checks with repository tooling and the authoritative CI gate.                                    | Full repository gate remains green; website failure makes the aggregate gate fail; plugin package contains no site files.                                                                        |
| T5   | Add static container and deployment preparation, without activating production.                                    | Container build and HTTP smoke test when Docker is available; no secrets in layers; asset and 404 behavior checked.                                                                              |
| T6   | Implement gated, relevant-change-only deployment after resolving artifact transport below.                         | Negative test for plugin-source-only changes; positive tests for site, consumed brand assets, lockfile, root manifest and build/deploy configuration; failed gate and untrusted PR never deploy. |
| T7   | Activate production only after separate infrastructure approval.                                                   | DNS/TLS, public HTTPS, asset loading, exact artifact identity and rollback verified.                                                                                                             |

Order: T1 and T2 precede T3; T3 precedes T4 and T5; T4 and T5 precede T6;
T6 and infrastructure approval precede T7. Do not fabricate completed proof to unblock
a dependent task.

## Quality-Tool Boundaries

The staged-file adapter does not currently classify `.astro`, and root Oxfmt/Oxlint
coverage must not be presented as validation of Astro templates. Add explicit template
checking through Astro. Inspect formatter support before adding a second formatter;
only if needed, scope an Astro-capable formatter to templates rather than reformatting
the repository. Keep generated `site/.astro/` and `site/dist/` outside lint/format inputs.
Cover any change to staged-file routing with its existing tests.

Add a website quality lane to the existing CI and include it in the aggregate `Full Gate`.
Keep plugin runtime smoke and release validation intact. Deployment credentials are
available only to the post-validation protected production job, never PR jobs. Production
operations must be serialized; an obsolete run must not overwrite a newer deployment.

The website lane sets up Node 26 separately; existing lanes remain on Node 24. Include
animation controls, no-JavaScript rendering, reduced-motion behavior and offscreen/hidden
pause behavior in T3 proof. Record compressed JavaScript output and a production-page
performance baseline; remove unnecessary hydration or animation dependencies before
considering the implementation complete. Tailwind produces build-time CSS, not a client
styling runtime.

## Deployment Invariant and Open Infrastructure Choice

Only the exact artifact built from a successfully validated commit may reach production.
Dokploy's documented `application.deploy` request accepts an application ID; the checked
documentation does not establish commit pinning for a Git-backed deployment. A generic
webhook followed by a fresh checkout of moving `main` is therefore not sufficient proof.
Disable direct push-triggered deployment when the gated pipeline is activated.

Recommended transport: CI builds a static container for the validated commit and publishes
it to a container registry; Dokploy deploys an immutable image digest, with the previous
digest retained for rollback. Registry choice, credentials, installed Dokploy support for
digest selection, VPS architecture and current domain configuration must be confirmed
before T6/T7. Do not create a registry, credentials, or Dokploy application in this phase.
If immutable image selection is unsupported, return with a verified alternative rather
than weakening the invariant to a mutable tag or branch webhook.

## Documentation Evidence

Context7 documentation consulted on 2026-10-04:

- [Astro configuration](https://docs.astro.build/en/reference/configuration-reference/):
  static output and production output directory.
- [Astro TypeScript](https://docs.astro.build/en/guides/typescript/): builds do not replace
  `astro check`; the checker needs its own package and TypeScript dependency.
- [Astro prerequisites](https://docs.astro.build/en/install-and-setup/): supported even
  Node versions, minimum Node 22.12.0; this is not proof of checker compatibility with
  the selected Node 26 patch or repository TypeScript 7.
- [Tailwind with Astro](https://tailwindcss.com/docs/installation/framework-guides/astro):
  the Tailwind 4 Vite integration and global CSS import.
- [Motion animate](https://motion.dev/docs/animate): vanilla mini and hybrid animation
  APIs; hybrid sequencing must not be assumed available in the mini entry point.
- [Dokploy auto deploy](https://docs.dokploy.com/docs/core/auto-deploy): push/webhook
  triggers and application deployment API.
- [Dokploy production guide](https://docs.dokploy.com/docs/core/applications/going-production):
  container registry delivery and deployment from CI.

These sources support the direction, not a claim that the local stack or installed
Dokploy instance has already been tested.

## Implementation Evidence: Foundation

The initial workspace resolves Astro 7.3.5, Tailwind 4.3.3, Motion 14.0.0,
`@astrojs/check` 0.9.10 and site-local TypeScript 6.0.2. The checker declares TypeScript
5/6 peers and fails with TypeScript 7's missing programmatic API. Bun's native isolated
linker fixes peer resolution without custom checker code: `bunfig.toml` makes this
required layout reproducible. Root and plugin TypeScript remain 7.0.2.

Node 26.8.1 is present locally and pinned for the website CI lane. The machine's default
Bun is 1.3.14, so installation and authoritative repository checks use the pinned Bun
1.4.2 through `npm exec`, without a global tool upgrade or installing Git hooks.
The foundation page is explicitly a noindex scaffold, not the finished public website.

The website ADR moved to root `docs/adr/` because packaged plugin ADRs change its
allowlisted distribution manifest and size budget. Website architecture is repository
policy, not plugin runtime content; no plugin budget was relaxed.

The user confirmed the dedicated task-filter example and the clear indigo/yellow,
asymmetric introduction with a large central demonstration. The real example still
requires clarified behavior and recorded lifecycle evidence before public claims.

Local foundation proof: the frozen Bun 1.4.2 install and Node 26.8.1 static build pass;
Astro reports zero errors, warnings and hints. Repository formatting, linting, root and
plugin typechecking and 23 tool tests pass. The full gate is not green: the existing
seed-order verification fails in this worktree with Bun 1.4.2 (the main checkout's
corresponding check passes), and a separate package check observes 276215 packed bytes
against a 276057-byte limit. Do not treat either failure as proven unrelated to the
new dependency layout. No budget or test was weakened; the rebuilt tracked plugin
artifact was restored to its original contents. These compatibility issues require
investigation before delivery.

### Gate Corrections

The seed-order failure was a parser defect: when Bun omits a very short test's duration,
the old regex consumed subsequent summary lines as part of the test name. The parser
now stops at a line boundary; regression tests cover optional duration, CRLF, source
snippets and preserved order. Real fixture ordering and exit status remain checked.

The package overflow came from Bun's isolated virtual-store paths embedded by esbuild.
An initial experiment preserving symlinks kept the same module count but resolved a
different transitive package, so it was rejected. Native esbuild minification removes
layout-specific generated names and comments without changing module resolution or size
budgets. The trade-off is a less readable generated bundle; source remains readable.
The regenerated distribution and packed runtime require fresh smoke checks.

Final corrected-bundle proof: full gate with Bun 1.4.2 passes (23 tool tests and 179
plugin tests), as does the Node 26 website check/build. The packed artifact passes all
four runtime smoke tests under Node 24. Packed size is 229327 bytes, below the unchanged
276057-byte limit. Metafiles contain the same 195 real module inputs before and after
minification, with no duplicates. The distribution regression test rejects embedded
Bun virtual-store paths. This is local validation, not a claim of green CI.

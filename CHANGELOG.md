# Changelog

## [v4.5.0] - 2026-11-26

<!-- forgix-release: {"tag":"v4.5.0","date":"2026-11-26","base":"v4.4.0"} -->

### Changes (since v4.4.0)


### Bug fixes

- **init:** harden sync harness resolution, profile checks, and safety guards ([78de639](https://entire.com/et/forgix/forgix/commit/78de639637b31cc8dc6abe9963641c1a39b58240))

- **init:** refine sync pin repair, legacy rules opt-out, and path containment ([906544f](https://entire.com/et/forgix/forgix/commit/906544f3aba317349026c99b8e3db1eca0973066))

- **release:** harden OIDC exchange, merge/mirror guards, and branch cleanup ([3b47e6a](https://entire.com/et/forgix/forgix/commit/3b47e6a6e4af578fa0b5abaea360d819cdced379))

- **release:** tighten merge deletion, downgrade, lease, and temp-dir guards ([180b99c](https://entire.com/et/forgix/forgix/commit/180b99c51abb73586fa5b04140c34c49341c32d7))

- **release:** force-add allowlisted ignored dist bundle during release prep ([8d09a20](https://entire.com/et/forgix/forgix/commit/8d09a20f1e1d0f9cf84012b2e72d9a057cfcfe72))


### Documentation

- **specs:** add $forgix sync technical specification ([48044a9](https://entire.com/et/forgix/forgix/commit/48044a9b531bd1d5cbf335e488d10a0ee54c1f60))

- **release:** add automated release spec, ADR 0043, and workflow updates ([0786764](https://entire.com/et/forgix/forgix/commit/0786764180605cb4e9c76398a5fdf80b9ea899fe))

- **release:** replace unpacked relative ADR 0043 link in maintainer runbook ([17e78c8](https://entire.com/et/forgix/forgix/commit/17e78c8446f1a12b287052a805773a6f9ec4cde2))


### Features

- **init:** add $forgix sync and stateless config drift checks ([6c981ac](https://entire.com/et/forgix/forgix/commit/6c981acf8ca3174378ffea059d85b388134ce6b5))

- **release:** add automated release scripts, mirror HTTPS auth, and tests ([c03ab2f](https://entire.com/et/forgix/forgix/commit/c03ab2fb852495c9be19947219c36538883b13f1))


### Maintenance

- **release:** wire automated release phases in Buildkite and Dagger ([0d9a134](https://entire.com/et/forgix/forgix/commit/0d9a13452e35f2a239bd6d1909f21fd654a0093e))

## [v4.4.0] - 2026-11-26

<!-- forgix-release: {"tag":"v4.4.0","date":"2026-11-26","base":"v4.3.2"} -->

### Changes (since v4.3.2)


### Bug fixes

- **init:** emit formatter-clean markdown and sort AGENTS index ([c99f4d0](https://entire.com/et/forgix/forgix/commit/c99f4d0e995899c52381e9dcf3835ceb12174336))

- **init:** render Antigravity rule globs as comma-separated string ([8cefe91](https://entire.com/et/forgix/forgix/commit/8cefe91355fd3ca6e8cd7e670311bdbbcec42d76))

- **hooks:** read nested content fields in loadHookProjectSummary ([012f458](https://entire.com/et/forgix/forgix/commit/012f458cb871f5506c3554d59f43b818ff8b03cc))

- **init:** enforce diagram checks, sync publish status, and split diff preview ([8b12533](https://entire.com/et/forgix/forgix/commit/8b125330417160349ede28b070767a0b6b56c404))

- **init:** preflight projections before writes and balance diff preview budget ([c01f91a](https://entire.com/et/forgix/forgix/commit/c01f91a4125b4dfc54bf87ef16d9bebbfab6e104))


### Documentation

- **init:** document single-approval init flow and add ADR 0042 ([910e1bf](https://entire.com/et/forgix/forgix/commit/910e1bf05467ef1a3a438d25e55820489f6bce5f))

- **init:** fix getting-started flowchart, README, and adoptPaths guidance ([f7421f1](https://entire.com/et/forgix/forgix/commit/f7421f174591491c1e995c8ac23a30124398f95a))


### Features

- **init:** simplify init approval, profile publish, and adoption ([c39215e](https://entire.com/et/forgix/forgix/commit/c39215e8f8d20c824f66720971d50e393e88bb74))


### Maintenance

- **forgix:** initialize project profile and factory bootstrap ([365785b](https://entire.com/et/forgix/forgix/commit/365785bc8dd536147abbc32c6399202a02863230))

- **build:** rebuild dist/forgix.mjs for formatter-clean init output ([ebdc6d2](https://entire.com/et/forgix/forgix/commit/ebdc6d2e927653507794b47870ff6e8d253cacd0))

- **budget:** remove deleted project-init-state schema from manifest ([5ee801b](https://entire.com/et/forgix/forgix/commit/5ee801b6fd8917149ffd26c5d6e69b828ed49d87))

## [v4.3.2] - 2026-11-25

<!-- forgix-release: {"tag":"v4.3.2","date":"2026-11-25","base":"v4.3.1"} -->

### Changes (since v4.3.1)

No user-facing changes.

## [v4.3.1] - 2026-11-25

<!-- forgix-release: {"tag":"v4.3.1","date":"2026-11-25","base":"v4.2.0"} -->

### Changes (since v4.2.0)


### Bug fixes

- **release:** land release commit via Entire Trail merge before tagging ([28877f4](https://entire.com/et/forgix/forgix/commit/28877f49fd167bf1916553d9fb6b4ecb5ea80cfc))

- **release:** wait for Buildkite CI before merging release Trail ([d870578](https://entire.com/et/forgix/forgix/commit/d870578c85167a73fbb6ae78d0515b2064d9056f))


### Features

- **release:** simplify plugin and npm release to one step ([220730c](https://entire.com/et/forgix/forgix/commit/220730c3378b16349bba343c9c17ea80ec5def20))

## [v4.2.0] - 2026-11-24

<!-- forgix-release: {"tag":"v4.2.0","date":"2026-11-24","npmBase":"v4.1.0","pluginBase":"v4.1.0"} -->

### npm + plugins (since v4.1.0)


### Bug fixes

- **formal:** align verify-assure-lean with ADR 0041 ([b526709](https://entire.com/et/forgix/forgix/commit/b526709a642e0bc082b26ef8898e618eb404446f))

- **scripts:** preserve relative symlinks verbatim during GitHub mirror sync ([f1789aa](https://entire.com/et/forgix/forgix/commit/f1789aa75b8e3420e5f281a0508a90f6c1ebbac0))

- **scripts:** force-stage gitignored dist/forgix.mjs in GitHub mirror sync ([c072820](https://entire.com/et/forgix/forgix/commit/c0728202cf219f1f3ea67c560b9497462bd70348))


### Documentation

- **diagrams:** update workflow SVGs for Factory as Code, Contract Review, and retro ([3007e7f](https://entire.com/et/forgix/forgix/commit/3007e7f38e7bdf5fb6824fc93512c339a8c1eea5))

- **install:** simplify Antigravity URL install and managed BUILD setup ([378ea15](https://entire.com/et/forgix/forgix/commit/378ea15a27e2667183e08f1f3bb31c6f087cb9bc))


### Features

- **init:** add Factory as Code setup for rules, agents, skills, and policies ([eded14d](https://entire.com/et/forgix/forgix/commit/eded14d8b6e621a2db553c014e3990e29f76e441))

- **review:** rename Goldfish to Contract Review with review-contract skill and multi-host ([54ac5de](https://entire.com/et/forgix/forgix/commit/54ac5de0760f6d418eb22bd904e5d78bff29f894))

- **retro:** add retro-factory self-improvement loop and ASSURE reminder ([ae5cb90](https://entire.com/et/forgix/forgix/commit/ae5cb90d58025c2875ef07b9de4d2078aab9a7e8))

- **hooks:** auto-pin installed CLI bundle without manual FORGIX_CLI_PATH ([7f730fc](https://entire.com/et/forgix/forgix/commit/7f730fc52b46176b3d45ec717f9e3cbabaf8cb9a))

- **scripts:** add GitHub mirror sync script preserving .github workflows ([27cffe2](https://entire.com/et/forgix/forgix/commit/27cffe22818981a62143990ced3b84833030a832))

- **scripts:** support --push-branch for protected GitHub mirror branches ([9b7de64](https://entire.com/et/forgix/forgix/commit/9b7de64cec156a58c61b3f452899da5447f202a4))


### Maintenance

- **hooks:** run check:dupes in pre-push hook ([23533a1](https://entire.com/et/forgix/forgix/commit/23533a19385812c21313d3baeaa967316be1ffe2))

- **init:** reconcile forgix bootstrap hooks and config ([3ab3e4e](https://entire.com/et/forgix/forgix/commit/3ab3e4e851b36c36907a7edd134239185b17c5d4))


### Refactoring

- **formal:** share Plan v2 seeding helper across Lean verifiers ([9273fca](https://entire.com/et/forgix/forgix/commit/9273fca6db4f2f68a43ddd639efbf99fa50d744c))

- **scripts:** simplify parseMirrorArgs flag lookup ([650a743](https://entire.com/et/forgix/forgix/commit/650a7435f3d43c855e79ce80359ba5ccde867e86))

## [v4.1.0] - 2026-11-23

<!-- forgix-release: {"tag":"v4.1.0","date":"2026-11-23","npmBase":"npm-v4.0.0","pluginBase":"plugin-v3.0.3-codex.20261122085011"} -->

### npm (since npm-v4.0.0)


### Bug fixes

- **ci:** install git in runtime-smoke container ([2a286a6](https://entire.com/et/forgix/forgix/commit/2a286a67d973b3c30508aa233f8cbe8e2b7e528a))


### Documentation

- **adr:** include ASSURE completion draft ([e991077](https://entire.com/et/forgix/forgix/commit/e991077eeb673d4a001cc16dfec41f54911bcc46))

- **readme:** add Forgix workflow and SHAPE/GATE diagrams ([c3b4c87](https://entire.com/et/forgix/forgix/commit/c3b4c876c68dade46c362a46c61f4f3ef2573e5f))

- **readme:** use raw GitHub URLs for workflow diagrams ([68874ab](https://entire.com/et/forgix/forgix/commit/68874ab1f194f73072bfebafe4d79f3b3bf3f756))

- **readme:** ship workflow diagram SVGs and use relative README paths ([bcaccce](https://entire.com/et/forgix/forgix/commit/bcaccceefc8a178737344fa5afb1cab7f0ff909d))


### Features

- **lifecycle:** bind BUILD authorization across entry points ([62db03b](https://entire.com/et/forgix/forgix/commit/62db03bad803d6b1de0502044d39a0cf121d2654))

- **assure:** bind ASSURE completion to verified inputs (ADR 0041) ([d6537d5](https://entire.com/et/forgix/forgix/commit/d6537d5b8f9bb6c9a963a94cf3534bb4c9fca6a6))


### Maintenance

- add advisory TLA+ model checks to Buildkite ([7128e37](https://entire.com/et/forgix/forgix/commit/7128e3753304c805ad4f8183337b575a21afb3c3))

- **release:** hand off tested npm artifacts to GitHub ([6ca427b](https://entire.com/et/forgix/forgix/commit/6ca427bd4176fd917489bdfb2aece1299a397fb6))

### Plugins (since plugin-v3.0.3-codex.20261122085011)


### Bug fixes

- **ci:** install git in runtime-smoke container ([2a286a6](https://entire.com/et/forgix/forgix/commit/2a286a67d973b3c30508aa233f8cbe8e2b7e528a))


### Documentation

- **adr:** include ASSURE completion draft ([e991077](https://entire.com/et/forgix/forgix/commit/e991077eeb673d4a001cc16dfec41f54911bcc46))

- **readme:** add Forgix workflow and SHAPE/GATE diagrams ([c3b4c87](https://entire.com/et/forgix/forgix/commit/c3b4c876c68dade46c362a46c61f4f3ef2573e5f))

- **readme:** use raw GitHub URLs for workflow diagrams ([68874ab](https://entire.com/et/forgix/forgix/commit/68874ab1f194f73072bfebafe4d79f3b3bf3f756))

- **readme:** ship workflow diagram SVGs and use relative README paths ([bcaccce](https://entire.com/et/forgix/forgix/commit/bcaccceefc8a178737344fa5afb1cab7f0ff909d))


### Features

- **lifecycle:** bind BUILD authorization across entry points ([62db03b](https://entire.com/et/forgix/forgix/commit/62db03bad803d6b1de0502044d39a0cf121d2654))

- **assure:** bind ASSURE completion to verified inputs (ADR 0041) ([d6537d5](https://entire.com/et/forgix/forgix/commit/d6537d5b8f9bb6c9a963a94cf3534bb4c9fca6a6))


### Maintenance

- add advisory TLA+ model checks to Buildkite ([7128e37](https://entire.com/et/forgix/forgix/commit/7128e3753304c805ad4f8183337b575a21afb3c3))

- **release:** hand off tested npm artifacts to GitHub ([6ca427b](https://entire.com/et/forgix/forgix/commit/6ca427bd4176fd917489bdfb2aece1299a397fb6))

## [npm-v4.0.0] - 2026-11-22

<!-- forgix-release: {"tag":"npm-v4.0.0","date":"2026-11-22","npmBase":"v3.0.3","pluginBase":null} -->

### npm (since v3.0.3)


### Bug fixes

- **worktree:** require a fresh remote base ([7201c3d](https://entire.com/et/forgix/forgix/commit/7201c3dde6bd47654ed743f8b276279bada27bb4))

- **lifecycle:** add rules entire agents ([8f28b51](https://entire.com/et/forgix/forgix/commit/8f28b51ad14cd8e9a7191f8c7448b041eb82a509))

- **formal:** verify local task resume progress ([9e80593](https://entire.com/et/forgix/forgix/commit/9e805938f302a4b1d51dc8132c054565ec639637))


### Documentation

- use entire:// URL for git clone in installation docs ([94d4eb8](https://entire.com/et/forgix/forgix/commit/94d4eb80da097891da602171eeeabd8f4e28229b))

- **init:** add agent-first ADR 0037, design spec, and glossary ([957e58c](https://entire.com/et/forgix/forgix/commit/957e58cc90a4b9b47b604f57fee17f610d4eecfb))

- **golden-rules:** add Golden Rules contract, ADR 0038, and glossary terms ([56d35c9](https://entire.com/et/forgix/forgix/commit/56d35c9d3bf46077c312c178ec0452206d41ad08))


### Features

- **plan:** render versioned design documents ([6139ae1](https://entire.com/et/forgix/forgix/commit/6139ae13026e28e6c86e5b28eaad541f359f1290))

- **review:** add Goldfish design review before approval ([f09c4a5](https://entire.com/et/forgix/forgix/commit/f09c4a59dd6788344d56e8878a290a979b317747))

- **BREAKING:** **init:** replace terminal init wizard with agent-first bootstrap and hooks ([e4fc71d](https://entire.com/et/forgix/forgix/commit/e4fc71df600852fcb29fb49be7f60ab38545aa81))


### Maintenance

- **fallow:** add dead-code reporting and import guardrail ([955962a](https://entire.com/et/forgix/forgix/commit/955962a236295d6ca226339fe7842d3d1ba864a9))

- **formal:** add Lean workflow conformance pilots ([bd54629](https://entire.com/et/forgix/forgix/commit/bd54629c49bf54824ca0144a307be62a3a739d86))

- **formal:** run Lean workflow pilots in advisory lane ([6782501](https://entire.com/et/forgix/forgix/commit/678250143791b4a87edfbac1fb4c3f5f69092c3b))

- **quality:** enforce Fallow quality ratchets, diff gate, and canary tests ([7c5af00](https://entire.com/et/forgix/forgix/commit/7c5af00edd9edf8d809fc6ec3bd819e6cb7dec21))

- optimize Dagger caching and Buildkite parallelism ([26822a8](https://entire.com/et/forgix/forgix/commit/26822a89a46eb3a752c812f3f3cd772a6271bea6))

- Merge branch 'main' into add_golden_rules_plugin ([7babcfb](https://entire.com/et/forgix/forgix/commit/7babcfb116c84939c571afa3684acd816544663c))


### Refactoring

- **src:** isolate domains, remove inline escape hatch, and enforce lint ceilings ([665ffe9](https://entire.com/et/forgix/forgix/commit/665ffe92524dd15d1578c6c74230c6a8748e7af5))

## [plugin-v3.0.3-codex.20261122085011] - 2026-11-22

<!-- forgix-release: {"tag":"plugin-v3.0.3-codex.20261122085011","date":"2026-11-22","npmBase":null,"pluginBase":"v3.0.3"} -->

### Plugins (since v3.0.3)


### Bug fixes

- **worktree:** require a fresh remote base ([7201c3d](https://entire.com/et/forgix/forgix/commit/7201c3dde6bd47654ed743f8b276279bada27bb4))

- **lifecycle:** add rules entire agents ([8f28b51](https://entire.com/et/forgix/forgix/commit/8f28b51ad14cd8e9a7191f8c7448b041eb82a509))

- **formal:** verify local task resume progress ([9e80593](https://entire.com/et/forgix/forgix/commit/9e805938f302a4b1d51dc8132c054565ec639637))


### Documentation

- use entire:// URL for git clone in installation docs ([94d4eb8](https://entire.com/et/forgix/forgix/commit/94d4eb80da097891da602171eeeabd8f4e28229b))

- **init:** add agent-first ADR 0037, design spec, and glossary ([957e58c](https://entire.com/et/forgix/forgix/commit/957e58cc90a4b9b47b604f57fee17f610d4eecfb))

- **golden-rules:** add Golden Rules contract, ADR 0038, and glossary terms ([56d35c9](https://entire.com/et/forgix/forgix/commit/56d35c9d3bf46077c312c178ec0452206d41ad08))


### Features

- **plan:** render versioned design documents ([6139ae1](https://entire.com/et/forgix/forgix/commit/6139ae13026e28e6c86e5b28eaad541f359f1290))

- **review:** add Goldfish design review before approval ([f09c4a5](https://entire.com/et/forgix/forgix/commit/f09c4a59dd6788344d56e8878a290a979b317747))

- **BREAKING:** **init:** replace terminal init wizard with agent-first bootstrap and hooks ([e4fc71d](https://entire.com/et/forgix/forgix/commit/e4fc71df600852fcb29fb49be7f60ab38545aa81))


### Maintenance

- **fallow:** add dead-code reporting and import guardrail ([955962a](https://entire.com/et/forgix/forgix/commit/955962a236295d6ca226339fe7842d3d1ba864a9))

- **formal:** add Lean workflow conformance pilots ([bd54629](https://entire.com/et/forgix/forgix/commit/bd54629c49bf54824ca0144a307be62a3a739d86))

- **formal:** run Lean workflow pilots in advisory lane ([6782501](https://entire.com/et/forgix/forgix/commit/678250143791b4a87edfbac1fb4c3f5f69092c3b))

- **quality:** enforce Fallow quality ratchets, diff gate, and canary tests ([7c5af00](https://entire.com/et/forgix/forgix/commit/7c5af00edd9edf8d809fc6ec3bd819e6cb7dec21))

- optimize Dagger caching and Buildkite parallelism ([26822a8](https://entire.com/et/forgix/forgix/commit/26822a89a46eb3a752c812f3f3cd772a6271bea6))

- Merge branch 'main' into add_golden_rules_plugin ([7babcfb](https://entire.com/et/forgix/forgix/commit/7babcfb116c84939c571afa3684acd816544663c))


### Refactoring

- **src:** isolate domains, remove inline escape hatch, and enforce lint ceilings ([665ffe9](https://entire.com/et/forgix/forgix/commit/665ffe92524dd15d1578c6c74230c6a8748e7af5))

## [v3.0.3] - 2026-11-18

<!-- forgix-release: {"tag":"v3.0.3","date":"2026-11-18","npmBase":"v3.0.2","pluginBase":"v3.0.2"} -->

### npm + plugins (since v3.0.2)


### Bug fixes

- **ci:** pass resolved remote tag SHA into Dagger npm-publish ([47e8eb4](https://entire.com/et/forgix/forgix/commit/47e8eb40742e846d8775655fae671df0f38661ff))

## [v3.0.2] - 2026-11-18

<!-- forgix-release: {"tag":"v3.0.2","date":"2026-11-18","npmBase":"v3.0.1","pluginBase":"v3.0.1"} -->

### npm + plugins (since v3.0.1)


### Bug fixes

- **ci:** accept annotated tag object SHA in Buildkite context ([a061a4f](https://entire.com/et/forgix/forgix/commit/a061a4fbfd80a681985793ed3afbba436b6f6431))

## [v3.0.1] - 2026-11-18

<!-- forgix-release: {"tag":"v3.0.1","date":"2026-11-18","npmBase":"v3.0.0","pluginBase":"v3.0.0"} -->

### npm + plugins (since v3.0.0)

No user-facing changes.

## [v3.0.0] - 2026-11-18

<!-- forgix-release: {"tag":"v3.0.0","date":"2026-11-18","npmBase":"v2.0.0","pluginBase":"v2.0.0"} -->

### npm + plugins (since v2.0.0)


### Bug fixes

- **cli:** remove unnecessary type assertion in roadmap view ([c39a14c](https://entire.com/et/forgix/forgix/commit/c39a14ce592faba2c9e735bbe6b562dc2dfc19d7))

- **workflow:** use ulid:<accountId> from entire api /api/v1/me for trail assignee ([5b8453b](https://entire.com/et/forgix/forgix/commit/5b8453b5ba9df6ae55ff617281d2935fd62586d9))

- **test:** clear VP_GIT_HOOKS in prepare-hooks test ([01f4d9e](https://entire.com/et/forgix/forgix/commit/01f4d9e59f7f49c72513655f90cd09e852fe3857))

- **formal:** interpolate proof token in formal scanner message ([af094a0](https://entire.com/et/forgix/forgix/commit/af094a075f685c100222e310514f88efa1e94bdd))

- **lifecycle:** remove type assertions and escape-hatch tokens from lifecycle and CLI ([6f9aaac](https://entire.com/et/forgix/forgix/commit/6f9aaac3735a27e069c84e5521b4106e75aa6efd))


### Documentation

- **readme:** add branded coastal banner ([#63](https://entire.com/et/forgix/forgix/trails/63)) ([0180c34](https://entire.com/et/forgix/forgix/commit/0180c348feed2ac1156938353c6fd8d343db0731))

- **workflow:** add entire branch protection design and trail workflow ([4ab0cc7](https://entire.com/et/forgix/forgix/commit/4ab0cc7d101ae660b886a945da7050b959ace4db))

- remove repo GitHub references and point to Entire ([da6f653](https://entire.com/et/forgix/forgix/commit/da6f653f11a193ee995bd96e1e47d0a1a74d6e29))

- **plugin:** replace repo GitHub references with Entire and Buildkite ([7cb86b9](https://entire.com/et/forgix/forgix/commit/7cb86b93872a3896007db4a6c5149daa934aacb3))

- **skills:** update roadmap ideation and autonomous execution for repo-first design ([5da98a3](https://entire.com/et/forgix/forgix/commit/5da98a31555eaaabcd3445d8f50a8cce3ce71bbf))

- **roadmap:** update ADRs 0033/0034 and glossary for repo-first design ([0fe7440](https://entire.com/et/forgix/forgix/commit/0fe74401239344c94f85f4c439c4fdb9b227f463))

- **workflow:** auto-assign Entire Trails and hydrate worktree deps ([23fd8e9](https://entire.com/et/forgix/forgix/commit/23fd8e928e72d2c0a2383eb4d48a46e19ff32564))

- **ci:** add Dagger CI/CD migration design ([66ead42](https://entire.com/et/forgix/forgix/commit/66ead42b8e2bf5447af49859d21d20c8e8301355))

- add remove-dead-code spec ([94b0571](https://entire.com/et/forgix/forgix/commit/94b0571b31b5e7b2cee25f41a4ab237fd36d4ba6))

- **workflow:** add risk-tiered shipping, worktreeinclude, and agent reflexes ([adfd6db](https://entire.com/et/forgix/forgix/commit/adfd6dbc60c8e425777c899a2274584d86bef3c9))

- **ci:** add Renovate Bot design document ([f60fc0f](https://entire.com/et/forgix/forgix/commit/f60fc0f286ee46cb9a10413f8f88260298dba758))

- **agents:** require local dagger check before push ([3b4c084](https://entire.com/et/forgix/forgix/commit/3b4c0846a56efa94bbfd806340cc84d28a7ecd6b))

- **adr:** add ADRs 0035/0036 and Factory-as-Code glossary ([8a016bc](https://entire.com/et/forgix/forgix/commit/8a016bcbe970e26f837f72f5000457be7ed126cc))


### Features

- **schemas:** add roadmap, roadmap-runtime, and updated session/config schemas ([c98685e](https://entire.com/et/forgix/forgix/commit/c98685e70e90f89f30f24242bb39f19d7bdf087f))

- **roadmap:** implement repo-first roadmap domain, contracts, stores, and checkpoints ([554ab58](https://entire.com/et/forgix/forgix/commit/554ab58e5d9420d358c947b9832328899ccdea28))

- **cli:** wire repo-first roadmap subcommands ([843e4bf](https://entire.com/et/forgix/forgix/commit/843e4bfb30e8d4acd8339f0058de4f57815bc411))

- **roadmap:** add local-first roadmap status transitions and execution support ([4f2a54e](https://entire.com/et/forgix/forgix/commit/4f2a54e6725cd04bfcf572cb230ddd2008a3deaf))

- **worktree:** add .worktreeinclude allowlist and copy support ([1030a97](https://entire.com/et/forgix/forgix/commit/1030a9725e48db7c0081aea4c5b0be859480b5d3))

- **ci:** add Renovate Bot sync and install Dagger in Buildkite ([e64e705](https://entire.com/et/forgix/forgix/commit/e64e7059c6f6eda3759e99dc9fdf0b431be12eb7))

- **formal:** add TLA+ and Lean 4 formal kernel and differential conformance oracle ([cc98264](https://entire.com/et/forgix/forgix/commit/cc98264b1afa999b655b28b05c8139c60bf394e3))

- **lifecycle:** add next-action envelopes, autonomous proof floor, telemetry CLI, and skill budget ([814f1fd](https://entire.com/et/forgix/forgix/commit/814f1fdbcb82cd0356e513fddfa4eb770e986197))

- **core:** add factory runner config, surface guardrails, formal verifiers, and telemetry store ([7368505](https://entire.com/et/forgix/forgix/commit/7368505df64502b6bc72b1219687497c8bd4ef31))

- **cli:** wire guardrails check, gitignore telemetry, and mark ADRs 0035/0036 implemented ([dc62bec](https://entire.com/et/forgix/forgix/commit/dc62becc5f92f89ecf595f5a02f19b3eaf01b640))


### Maintenance

- **entire:** enable entire session tracking ([27ecffc](https://entire.com/et/forgix/forgix/commit/27ecffc232a7012ca70cafc54af9243aa3c2b002))

- **entire:** keep only codex and antigravity integrations ([5e13b37](https://entire.com/et/forgix/forgix/commit/5e13b3772a95e78fece05481986ff2dba55270a7))

- **ci:** migrate CI and npm release from GitHub to Buildkite ([a15c177](https://entire.com/et/forgix/forgix/commit/a15c177ac5f54a2e001c0a6c7f7e3958d254f4ed))

- fix lint scoping, formatting, and plan status ([1021e62](https://entire.com/et/forgix/forgix/commit/1021e62b9c5ec9a8f3db7d6658309e899e349fa5))

- **buildkite:** load NPM_TOKEN from buildkite-agent secret ([d9063b3](https://entire.com/et/forgix/forgix/commit/d9063b324adc6eac1516d8e601f836eb0616bcd7))

- Merge branches 'swarm-skills-docs-f84c01bd' and 'swarm-schemas-bec6c91e' into ai_agent_planning ([bb8e3c3](https://entire.com/et/forgix/forgix/commit/bb8e3c3da944643e50f25c9735a47706e59bafc5))

- **roadmap:** cover repo-first roadmap domain, stores, and CLI ([fa4e7fd](https://entire.com/et/forgix/forgix/commit/fa4e7fd55f16e84a9469430b8a93e94878c1ac91))

- Merge branches 'swarm-cli-d491b43f' and 'swarm-tests-90b6aa8d' into ai_agent_planning ([7a04256](https://entire.com/et/forgix/forgix/commit/7a042568db6d794e8caa38dc4ec5e872e823c428))

- Merge branch 'swarm-cli-d491b43f' into ai_agent_planning ([c7b6d7c](https://entire.com/et/forgix/forgix/commit/c7b6d7c8b24e5286dced2a0aca8c498f0fccc483))

- **git:** add base-branch freshness check and worktree rule ([e4fe8f8](https://entire.com/et/forgix/forgix/commit/e4fe8f806449d7f4d83dab81c28b1f44125359a9))

- **dagger:** migrate Buildkite CI/CD execution to Dagger ([edb11bd](https://entire.com/et/forgix/forgix/commit/edb11bdf9964a99633cc9fc331c164ba42710895))

- Merge branch 'main' into remove_dead_code ([018afae](https://entire.com/et/forgix/forgix/commit/018afae36ba27d10f06a95dd51ef4f361351c2ee))

- Merge branch 'main' into migrate_to_dagger ([ed83783](https://entire.com/et/forgix/forgix/commit/ed83783aabda98a3f415802ab183814a27c7cd02))

- Simplify README onboarding and clarify workflow ([aeda38a](https://entire.com/et/forgix/forgix/commit/aeda38ad0a0673c345dbadfe317601faf9518484))

- restore checks with Entire hook chaining ([24394cd](https://entire.com/et/forgix/forgix/commit/24394cd6c17c80027c737822be9c6085946d1540))

- **docs:** format adr 0034 ([a183d29](https://entire.com/et/forgix/forgix/commit/a183d297c3b5191044611f006098709f70f29556))

- Merge branch 'main' into codex/simplifier-le-readme-de-forgix ([c33414e](https://entire.com/et/forgix/forgix/commit/c33414eccce8d921217c9362833b8f0e14eeca16))

- resolve root product migration against main ([3b5e53a](https://entire.com/et/forgix/forgix/commit/3b5e53a8cdba9016d21dcc06ae9a0ca0955e9d2a))

- **merge:** sync auto_assign_trail_author with origin/main ([3895502](https://entire.com/et/forgix/forgix/commit/3895502575c8f509d33f79ee88cad96fa13ae392))

- **merge:** sync forgix_project_roadmap with origin/main ([d135830](https://entire.com/et/forgix/forgix/commit/d1358301d81e6570a77169b6857d030f2a0bdc4a))

- **merge:** sync ai_agent_planning with origin/main ([9abb643](https://entire.com/et/forgix/forgix/commit/9abb64307858c841343648a4341f5532e9742f6a))

- **merge:** merge swarm-schemas-core-ed0d031e ([9f1fd5f](https://entire.com/et/forgix/forgix/commit/9f1fd5f250ecd68dda55c745dcda6069f4f1bfba))

- **merge:** integrate factory-as-code and formal verification branches ([359915c](https://entire.com/et/forgix/forgix/commit/359915ccf9d42574092714eb3b381d7659b799b9))


### Refactoring

- remove dead code ([b065d53](https://entire.com/et/forgix/forgix/commit/b065d53c3171a9af7e657539dc15f24106ac8f11))

- **product:** move Forgix to repository root ([d6806b8](https://entire.com/et/forgix/forgix/commit/d6806b841ddb6143972876e638a833c1c6aa7fc4))

- **cli:** eliminate remaining as unknown as casts in roadmap patch normalization ([1ec9d3c](https://entire.com/et/forgix/forgix/commit/1ec9d3c64daaf7bb4dae92c5bad67fe1e4a9b8c1))

## [v2.0.0] - 2026-11-15

<!-- forgix-release: {"tag":"v2.0.0","date":"2026-11-15","npmBase":"v1.0.1","pluginBase":"v1.0.1"} -->

### npm + plugins (since v1.0.1)


### Bug fixes

- **plugin:** add bundled branding and concise overview ([#42](https://github.com/Acrazie/forgix/pull/42)) ([c978a3a](https://github.com/Acrazie/forgix/commit/c978a3aeef44a5efdaf64871f6fcbe1e8298e3ab))


### Documentation

- **readme:** redesign repository README with lifecycle diagrams ([#40](https://github.com/Acrazie/forgix/pull/40)) ([5de801f](https://github.com/Acrazie/forgix/commit/5de801f221a5800a2e66b3b855636e10143c88e8))


### Features

- **BREAKING:** require Node.js 26 and extract public website ([#43](https://github.com/Acrazie/forgix/pull/43)) ([50dfbd8](https://github.com/Acrazie/forgix/commit/50dfbd86c2e584fa92faca7b5cb611851a3c24a8))


### Maintenance

- **forgix:** add project engineering profile and architecture diagram ([#38](https://github.com/Acrazie/forgix/pull/38)) ([b1e3419](https://github.com/Acrazie/forgix/commit/b1e3419e910ce81fbbcde5551fa3b2d090a00865))

- **tooling:** adopt Node 26 and Vite+ ([#39](https://github.com/Acrazie/forgix/pull/39)) ([d016f38](https://github.com/Acrazie/forgix/commit/d016f3889fad35f32f150ab9f915c22aa201ff4c))

- **deps:** bump the actions group across 1 directory with 5 updates ([#20](https://github.com/Acrazie/forgix/pull/20)) ([d1ca4cf](https://github.com/Acrazie/forgix/commit/d1ca4cf762dfca6f32d38279c0e09ba8fc3436c1))

- **workflows:** harden GitHub Actions permissions, concurrency, and SHA pins ([#41](https://github.com/Acrazie/forgix/pull/41)) ([f8db23b](https://github.com/Acrazie/forgix/commit/f8db23b06322c2c5ad0cae7756d9e4aad8a871fc))

- **release:** migrate publication to git-cliff and tag-based CI ([#61](https://github.com/Acrazie/forgix/pull/61)) ([6f57cb2](https://github.com/Acrazie/forgix/commit/6f57cb21945694fd5e35295a8357bcdfe31bab40))


### Refactoring

- **forgix:** simplify runtime into core and deep domain modules ([#60](https://github.com/Acrazie/forgix/pull/60)) ([4a5bfd9](https://github.com/Acrazie/forgix/commit/4a5bfd949ba525501ca1eb3d29f1a6474b61cd46))

## [1.0.1](https://github.com/Acrazie/codex-dev-flow/compare/dev-flow-v1.0.0...dev-flow-v1.0.1) (2026-10-06)


### Bug Fixes

* **release:** scope npm package and resume existing releases ([#27](https://github.com/Acrazie/codex-dev-flow/issues/27)) ([ae36f2e](https://github.com/Acrazie/codex-dev-flow/commit/ae36f2eae47ba6728f9869c8a0bd3ad9ac2e4f35))

## [1.0.0](https://github.com/Acrazie/codex-dev-flow/compare/dev-flow-v0.4.0...dev-flow-v1.0.0) (2026-10-06)


### ⚠ BREAKING CHANGES

* **branding:** npm and marketplace plugin identities are now dev-flow. Install the renamed package and replace the old plugin installation.

### Features

* add adaptive intake and local benchmark ([feaacef](https://github.com/Acrazie/codex-dev-flow/commit/feaacefb1faabe228e64bc4c81c93deb4517597a))
* add agentic project INIT and engineering profiles ([93b0145](https://github.com/Acrazie/codex-dev-flow/commit/93b01451c0b5758af5fc6f1019615d9b85ea9d10))
* add agentic project init profiles ([78ab99e](https://github.com/Acrazie/codex-dev-flow/commit/78ab99eea9738ed409ef72d7cc00f032dcd2e30f))
* add interactive Bun release workflow ([00f644a](https://github.com/Acrazie/codex-dev-flow/commit/00f644ad42e1c1d1add069d3e6aa59ff4cf5b5af))
* add subscription-aware routing ([7058d06](https://github.com/Acrazie/codex-dev-flow/commit/7058d0692fab57a952db17415aa44a41a5b74aa2))
* implement minimal gate and task state v4 ([3c215f6](https://github.com/Acrazie/codex-dev-flow/commit/3c215f68072baff9362c8b14f3300f593e3dfd9a))
* implement minimal GATE and TaskState V4 ([7e7e81e](https://github.com/Acrazie/codex-dev-flow/commit/7e7e81e34486261cfc263494fc9806f428b1ec6e))
* mirror npm releases to GitHub Packages ([b4d4b1d](https://github.com/Acrazie/codex-dev-flow/commit/b4d4b1d3848761c578b1adcdc93413bcb4748927))
* publish plugin through marketplace ([9b71d2b](https://github.com/Acrazie/codex-dev-flow/commit/9b71d2befe028a13b2d64702ea4b63d4f26849af))


### Bug Fixes

* **routing:** add quota reset fallback ([da766a1](https://github.com/Acrazie/codex-dev-flow/commit/da766a14fb384988e0ae31cb37da04b20a207361))
* **routing:** add safe quota reset fallback ([a26a949](https://github.com/Acrazie/codex-dev-flow/commit/a26a949fa8a130821102477c64f67d2455e1477d))


### Code Refactoring

* **branding:** rename plugin and site to Dev Flow ([#24](https://github.com/Acrazie/codex-dev-flow/issues/24)) ([ee51532](https://github.com/Acrazie/codex-dev-flow/commit/ee515323e5a767ed58f2ee97b3308c76eb12a4b5))

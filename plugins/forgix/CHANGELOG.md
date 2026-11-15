# Changelog

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

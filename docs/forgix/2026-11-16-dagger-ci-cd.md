# Migration CI/CD vers Dagger (orchestré par Buildkite)

- **Statut** : Brouillon — révisé après revue indépendante, en attente de revalidation et d'approbation humaine
- **Dépôt cible** : `/et/forgix/forgix`
- **Date** : 2026-11-16

---

## 1. Objectif, contexte et critères de succès

Aujourd'hui, [`.buildkite/pipeline.yml`](../../.buildkite/pipeline.yml) exécute directement les commandes de vérification, de packaging et de release sur l'hôte de l'agent Buildkite. Cela couple la CI à l'état préinstallé de la machine hôte (Node `26.8.1`, Bun `1.4.4`, `git-cliff` `2.14.1`) et ne garantit pas une reproductibilité locale à l'identique.

**Objectif** : Déplacer l'exécution des pipelines CI/CD dans un module Dagger TypeScript (`.dagger/`), exécuté sur un moteur Dagger local/Docker, tout en conservant Buildkite comme orchestrateur mince pour le déclenchement sur commits/tags et la remontée des Gates dans Entire Trails.

**Critères de succès** :

1. Chaque étape CI/CD (`check`, `packRuntime`, `runtimeSmoke`, `releaseContract`, `releaseCandidate`, `npmPublish`) est exécutable localement ou en CI via `dagger call` dans des conteneurs épinglés (`26.8.1` pour Node, `1.4.4` pour Bun, `2.14.1` pour `git-cliff`).
2. [`.buildkite/pipeline.yml`](../../.buildkite/pipeline.yml) délègue l'exécution à `dagger call` et continue de produire et publier `.artifacts/forgix.tgz`, `.artifacts/RELEASE_NOTES.md` et `.artifacts/release.json`.
3. Tous les garde-fous de [`scripts/release-ci.ts`](../../scripts/release-ci.ts) (validation du contexte tag/commit/dépôt Buildkite, intégrité SHA-512, non-régression `latest`, `npm audit signatures`, isolation sans `bun install` des jobs privilégiés, masquage de `NPM_TOKEN`, fraîcheur de `plugins/forgix/dist/forgix.mjs`) restent actifs.
4. `bun run check` et les tests de contrat CI/CD (`test/release-ci.test.ts`, `test/release-publication.test.ts`, `test/toolchain-runtime.test.ts`, `test/forgix-identity.test.ts`) passent.

**Hors périmètre** :

- Suppression de Buildkite ou perte de l'intégration native Entire Trails.
- Utilisation de Dagger Cloud (`--engine=cloud`).
- Modification du code métier de `plugins/forgix/src/**` ou des hooks Git locaux (`.vite-hooks/`).

---

## 2. Décisions architecturales

### D1 — Buildkite comme orchestrateur mince + Dagger comme moteur d'exécution

- **Décision** : Conserver [`.buildkite/pipeline.yml`](../../.buildkite/pipeline.yml) comme point d'entrée déclenché par Entire (branches, Trails, tags `v*` / `npm-v*` / `plugin-v*`) et déléguer chaque étape à `dagger call`.
- **Justification** : Entire Trails s'appuie sur Buildkite pour remonter les statuts CI comme Gates de merge. Dagger fournit l'isolation conteneurisée et l'exécution locale identique (`dagger call check`).
- **Compromis** : L'agent Buildkite doit disposer du CLI `dagger` et d'un moteur Docker/OCI fonctionnel ; en contrepartie, il n'a plus besoin de maintenir Node 26, Bun ou `git-cliff` sur l'hôte après la période de transition.

### D2 — Périmètre complet (CI + Packaging + Release npm) dans Dagger

- **Décision** : Porter l'ensemble des 4 étapes actuelles (`quality-gate`, `runtime-smoke`, `release-contract`, `npm-publish`) vers des fonctions Dagger, y compris `scripts/release-ci.ts candidate` et `scripts/release-ci.ts npm`.
- **Justification** : Évite d'avoir deux environnements d'exécution divergents (conteneur Dagger pour la CI, hôte Buildkite nu pour la release).
- **Compromis** : Nécessite de transmettre explicitement les variables `BUILDKITE_*`, `NPM_TOKEN` (en `Secret`), un jeton anti-cache pour les vérifications réseau temps réel, et un accès Git complet (`origin/main`, `sha^`, tags) lors des étapes de release.

### D3 — Module Dagger TypeScript sous `.dagger/`

- **Décision** : Créer un module Dagger avec le SDK TypeScript officiel (`@dagger.io/dagger`) sous `.dagger/`, configuré comme entrypoint du workspace Dagger (`dagger.toml` à la racine) afin que `dagger call <fonction>` soit invocable directement depuis la racine du dépôt.
- **Justification** : Le dépôt est entièrement en TypeScript/JavaScript (`package.json`, `scripts/`, `plugins/forgix/`).
- **Images et versions épinglées** :
  - **Image CI (`check`, `packRuntime`, `releaseContract`, vérification dist)** : base `node:26.8.1-bookworm-slim` (alignée sur `.node-version` = `26.8.1`) + `git` + Bun `1.4.4` (aligné sur `.bun-version`).
  - **Image Runtime Smoke (`runtimeSmoke`)** : `node:26.8.1-bookworm-slim` seul (**sans Bun**), garantissant le test en environnement Node.js pur.
  - **Image Release privilégiée (`releaseCandidate` étape 2, `npmPublish`)** : `node:26.8.1-bookworm-slim` + `git` + `npm` (et `git-cliff` `2.14.1` téléchargé avec vérification SHA-256 pour `releaseCandidate` uniquement), **sans Bun, sans `bun install`, sans `node_modules`**, respectant la frontière de privilège de [`scripts/release-ci.ts`](../../scripts/release-ci.ts#L1).

### D4 — Moteur Dagger local / Docker et maîtrise du cache

- **Décision** : Exécuter Dagger sur le moteur local/Docker (pas de Dagger Cloud). Utiliser `dag.cacheVolume` pour le cache Bun dans les étapes CI non privilégiées, mais **invalider explicitement le cache** (`DAGGER_CACHE_BUSTER` basé sur `BUILDKITE_BUILD_ID` / `BUILDKITE_RETRY_COUNT` ou horodatage) avant l'exécution de `scripts/release-ci.ts` dans `releaseCandidate` et `npmPublish`.
- **Justification** : Sans invalidation de cache, un retry Buildkite avec des entrées identiques renverrait un conteneur mis en cache et sauterait les appels réseau temps réel (`git ls-remote --tags origin`, `registry.npmjs.org`, `npm audit signatures`).

### D5 — Préservation du contrat `assertContext` dans `scripts/release-ci.ts`

- **Décision** : Conserver [`assertContext`](../../scripts/release-ci.ts#L58-L71) tel quel et injecter les 5 variables `BUILDKITE`, `BUILDKITE_REPO`, `BUILDKITE_TAG`, `BUILDKITE_COMMIT` et `BUILDKITE_PULL_REQUEST` en lecture seule depuis l'environnement Buildkite vers `releaseCandidate` et `npmPublish` (sans valeur codée en dur pour `BUILDKITE="true"`).
- **Justification** : Empêche toute publication accidentelle depuis un poste local, une branche non taguée ou un fork.

---

## 3. Contrats, interfaces et frontières de modification

### 3.1 Fonctions exposées par le module `.dagger/`

| Fonction Dagger    | Entrées principales                                                                                                                                                                                                                                                                | Image / Outils                                                                                                          | Exécution & Sortie                                                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check`            | `source: Directory` (sans `.git`, `node_modules`, `.artifacts`, `.worktrees`)                                                                                                                                                                                                      | `node:26.8.1` + `bun@1.4.4` + `git`                                                                                     | `bun install --frozen-lockfile` + `bun scripts/observe-command.ts "Full Gate" bun run check` -> `Container`                                                                                                                                                                                        |
| `packRuntime`      | `source: Directory` (sans `.git`, `node_modules`, `.artifacts`, `.worktrees`)                                                                                                                                                                                                      | `node:26.8.1` + `bun@1.4.4`                                                                                             | `bun install --frozen-lockfile` + `bun run build` + `bun run pack:runtime` -> `File` (`.artifacts/forgix.tgz`)                                                                                                                                                                                     |
| `runtimeSmoke`     | `source: Directory` (sans `.git`, `node_modules`, `.artifacts`, `.worktrees`), `tarball: File`                                                                                                                                                                                     | `node:26.8.1` seul (sans Bun)                                                                                           | Monte `tarball` à `.artifacts/forgix.tgz` (ou `FORGIX_TARBALL`), exécute `node --test plugins/forgix/test/runtime/runtime-smoke.test.mjs` -> `Container`                                                                                                                                           |
| `releaseContract`  | `source: Directory` (sans `.git`, `node_modules`, `.artifacts`, `.worktrees`)                                                                                                                                                                                                      | `node:26.8.1` + `bun@1.4.4`                                                                                             | `bun install --frozen-lockfile` + `bun run --cwd plugins/forgix release:test` -> `Container`                                                                                                                                                                                                       |
| `releaseCandidate` | `source: Directory` (**avec `.git`**, sans `node_modules`, `.artifacts`, `.worktrees`), `tag: string`, `buildkite: string`, `buildkiteRepo: string`, `buildkiteCommit: string`, `buildkitePullRequest?: string`, `cacheBuster: string`                                             | Étape 1 : `node:26.8.1` + `bun@1.4.4` + `git` ; Étape 2 : `node:26.8.1` + `git` + `npm` + `git-cliff@2.14.1` (sans Bun) | Étape 1 : `bun install --frozen-lockfile && bun run build && git diff --exit-code -- plugins/forgix/dist/forgix.mjs`. Étape 2 (conteneur séparé sur `source` propre) : avec `DAGGER_CACHE_BUSTER`, exécute `RELEASE_TAG=<tag> node scripts/release-ci.ts candidate` -> `Directory` (`.artifacts/`) |
| `npmPublish`       | `source: Directory` (**avec `.git`**, sans `node_modules`, `.artifacts`, `.worktrees`), `artifacts: Directory`, `tag: string`, `buildkite: string`, `buildkiteRepo: string`, `buildkiteCommit: string`, `npmToken: Secret`, `buildkitePullRequest?: string`, `cacheBuster: string` | `node:26.8.1` + `git` + `npm` (sans Bun, sans `git-cliff`)                                                              | Monte `artifacts` à `.artifacts/`, injecte `npmToken` via `withSecretVariable("NPM_TOKEN", npmToken)` et `DAGGER_CACHE_BUSTER`, exécute `RELEASE_TAG=<tag> node scripts/release-ci.ts npm` -> `Container`                                                                                          |

Règles d'implémentation du module :

- **Séparation du filtrage `source`** : Les fonctions CI (`check`, `packRuntime`, `runtimeSmoke`, `releaseContract`) excluent `.git` afin que les changements de commits/refs n'invalident pas le cache. Les fonctions de release (`releaseCandidate`, `npmPublish`) incluent `.git` car [`scripts/release-ci.ts`](../../scripts/release-ci.ts#L74-L110) et [`plugins/forgix/scripts/release-notes.ts`](../../plugins/forgix/scripts/release-notes.ts#L28-L29) exécutent `git rev-parse`, `git merge-base`, `git show ${sha}^:...`, `git rev-list` et `git tag`.
- **Fraîcheur du bundle `dist/forgix.mjs`** : Parce que `check` s'exécute dans un conteneur isolé, `releaseCandidate` ne peut pas se contenter de `git diff --exit-code` sur `source` brut. Il exécute `bun run build && git diff --exit-code -- plugins/forgix/dist/forgix.mjs` dans un conteneur de build dédié, puis exécute `scripts/release-ci.ts candidate` dans un second conteneur privilégié sans `node_modules`. De même, `packRuntime` exécute `bun run build` avant `bun run pack:runtime`.
- **Secrets** : `npmToken` est toujours de type `Secret` (`withSecretVariable("NPM_TOKEN", npmToken)`), jamais `string`.

### 3.2 Intégration dans `.buildkite/pipeline.yml`

Les 4 étapes existantes et leurs dépendances sont conservées :

- **Préparation Git sur l'hôte (étapes de tag)** : Avant d'appeler `release-candidate` ou `npm-publish`, dé-shallow si nécessaire et synchroniser `origin/main` et les tags (`if [ -f "$(git rev-parse --git-dir)/shallow" ]; then git fetch --unshallow; fi && git fetch --tags origin "+refs/heads/main:refs/remotes/origin/main"`) afin que `sha^`, `origin/main` et les tags soient présents dans `.git`.
- `quality-gate` : appelle `dagger call check --source=.` ; si `BUILDKITE_TAG` est défini, appelle `dagger call release-candidate --source=. --tag="$BUILDKITE_TAG" --buildkite="$BUILDKITE" --buildkite-repo="$BUILDKITE_REPO" --buildkite-commit="$BUILDKITE_COMMIT" --buildkite-pull-request="${BUILDKITE_PULL_REQUEST:-}" --cache-buster="$BUILDKITE_BUILD_ID-$BUILDKITE_RETRY_COUNT" --output=.artifacts` ; si hors-tag ou tag `plugin-v*`, appelle `dagger call pack-runtime --source=. --output=.artifacts/forgix.tgz`. Conserve `artifact_paths` sur `.artifacts/forgix.tgz`, `.artifacts/RELEASE_NOTES.md`, `.artifacts/release.json`.
- `runtime-smoke` (`depends_on: quality-gate`) : télécharge `.artifacts/forgix.tgz` via `buildkite-agent artifact download` et appelle `dagger call runtime-smoke --source=. --tarball=.artifacts/forgix.tgz`.
- `release-contract` (`depends_on: quality-gate`) : appelle `dagger call release-contract --source=.`.
- `npm-publish` (`if: build.tag =~ /^(v|npm-v)/`, `depends_on: [quality-gate, runtime-smoke, release-contract]`, `concurrency: 1`, `concurrency_group: forgix-release`) : télécharge `.artifacts/*`, récupère `NPM_TOKEN` via `buildkite-agent secret get NPM_TOKEN` et appelle `dagger call npm-publish ... --npm-token=env:NPM_TOKEN --cache-buster="$BUILDKITE_BUILD_ID-$BUILDKITE_RETRY_COUNT"`.

### 3.3 Configuration racine et tests impactés

- **Nouveaux fichiers** : `dagger.toml`, `.dagger/` (`dagger-module.toml`, `package.json`, `tsconfig.json`, `sdk/`, `src/index.ts`).
- **[`tsconfig.json`](../../tsconfig.json)** : inchangé (`include: ["scripts/**/*.ts", "vite.config.ts"]`). Le module `.dagger/` conserve son propre `tsconfig.json` autonome.
- **[`vite.config.ts`](../../vite.config.ts)** : ajouter `.dagger/**` aux `ignorePatterns` de `fmt` et `lint` afin que `vp fmt --check .`, `vp lint .` et `vp lint --type-aware .` (exécutés par `bun run check` sans installer les dépendances de `.dagger/`) n'échouent pas sur le SDK généré ou les décorateurs `@object()` / `@func()`. La vérification TypeScript de `.dagger/` est assurée par `tsc --noEmit -p .dagger/tsconfig.json` (et par `dagger functions` / `dagger call`).
- **[`scripts/release-ci.ts`](../../scripts/release-ci.ts)** : ajouter `\.dagger` à la regex d'exclusion de contenu npm à la ligne 176 par cohérence avec `\.buildkite`.
- **Tests à adapter** :
  - [`test/toolchain-runtime.test.ts`](../../test/toolchain-runtime.test.ts) : vérifier la délégation à `dagger call` dans `.buildkite/pipeline.yml`, l'épinglage de Node `26.8.1` / `.node-version` et `runtime-smoke.test.mjs` dans `.dagger/src/index.ts`.
  - [`test/release-ci.test.ts`](../../test/release-ci.test.ts) : adapter les assertions sur `.buildkite/pipeline.yml` pour les appels `dagger call` et étendre les assertions d'invariants (`GIT_CLIFF` `2.14.1`, `git diff --exit-code -- plugins/forgix/dist/forgix.mjs`, absence de `bun install` / `run check` dans `npmPublish`, usage de `Secret` pour `NPM_TOKEN`) sur `.dagger/src/index.ts`.
  - [`test/forgix-identity.test.ts`](../../test/forgix-identity.test.ts) : reste valide tant que `.artifacts/forgix.tgz` figure dans `.buildkite/pipeline.yml`.

---

## 4. Risques, sécurité et rollback

1. **Accès au remote `entire://` depuis le conteneur Dagger (`releaseCandidate` / `npmPublish`)** :
   - [`scripts/release-ci.ts`](../../scripts/release-ci.ts#L124-L146) exécute `git ls-remote --tags origin` (`remoteTag()`). Or, en production sur Entire, `BUILDKITE_REPO` est de la forme `entire://aws-eu-central-1.entire.io/et/forgix/forgix`.
   - **Risque** : Un conteneur `node:26.8.1` standard ne contient ni `git-remote-entire`, ni les credentials/sockets de l'agent hôte Buildkite pour le protocole `entire://`.
   - **Condition préalable à la bascule de release** : Vérifier sur l'agent Buildkite si `git-remote-entire` et son authentification peuvent être embarqués/montés dans le conteneur (ou si une URL HTTPS authentifiée est disponible). Si `entire://` ne peut pas être résolu depuis un conteneur isolé, le repli documenté consiste à conserver l'exécution de `scripts/release-ci.ts candidate` / `npm` sur l'hôte Buildkite tout en gardant `check`, `packRuntime`, `runtimeSmoke` et `releaseContract` dans Dagger.
2. **Fuite de `NPM_TOKEN`** :
   - **Mitigation** : Passage exclusif par `Secret` Dagger (`--npm-token=env:NPM_TOKEN`), jamais par argument `string` ni variable `withEnvVariable`.
3. **Prérequis d'infrastructure sur l'agent Buildkite** :
   - **Risque** : Absence de `dagger` CLI ou de daemon Docker/OCI accessible sur le pool d'agents Buildkite.
   - **Mitigation** : Valider sur une branche/Trail de test avant de fusionner sur `main`.
4. **Rollback** :
   - Conserver Node 26, Bun et `git-cliff` installés sur les agents Buildkite pendant la fenêtre de transition initiale : un simple revert de `.buildkite/pipeline.yml` (et des tests associés) restaure l'exécution directe sur l'hôte sans impact sur le paquet publié.

---

## 5. Vérification attendue

**Vérifications locales (sans publication npm)** :

- `dagger call check --source=.`
- `dagger call pack-runtime --source=. --output=.artifacts/forgix.tgz`
- `dagger call runtime-smoke --source=. --tarball=.artifacts/forgix.tgz`
- `dagger call release-contract --source=.`
- `bun run check` (incluant `format:check`, `lint`, `lint:type-aware`, `typecheck:tools`, `test:tools` avec les tests mis à jour, et `plugins/forgix` check).

**Vérifications en CI (Buildkite)** :

- Exécution d'un Trail de test validant `quality-gate`, `runtime-smoke`, `release-contract` et la remontée des Gates dans Entire.
- Validation explicite de l'accès `origin` (`entire://` ou HTTPS) et de la profondeur Git (`sha^`, `origin/main`, tags) sur l'agent Buildkite avant le premier tag de release.

---

<!-- EGM_REVIEW_STATE_START -->

## 6. État de revue (EGM)

- **Révision / Digest du corps** : `sha256:e044c374e677c73829592aec25a1e4c415a823e58b04b1bb3c4927ac9d349503` (contenu avant `<!-- EGM_REVIEW_STATE_START -->`, `trimEnd() + "\n"`)
- **Couverture exécutée** : `egm-design-critic` (revue initiale + revalidation ciblée) et `egm-implementation-readiness` (revue initiale + revalidations ciblées) — lecture seule des sources du dépôt
- **Limites de preuve** : aucune exécution réelle de `dagger call`, `bun run check` ni inspection directe du pool d'agents Buildkite (`docker` / `dagger` CLI / accès `entire://` en conteneur)
- **Constatations ouvertes** : 0 Blocker, 0 Major, 0 Nit sur la révision courante
- **Risques acceptés / Prérequis avant bascule** : validation sur agent Buildkite de l'accès `entire://` (ou bascule vers l'exécution hôte pour `release-ci.ts`) et de la disponibilité de `dagger` + Docker
- **Approbation humaine** : Approuvé le 2026-11-16 pour la révision `sha256:e044c374e677c73829592aec25a1e4c415a823e58b04b1bb3c4927ac9d349503`

<!-- EGM_REVIEW_STATE_END -->

# Passage complet du plugin sur Node 26 et extraction autonome du site web

Date : 2026-11-15
Révision source inspectée : `efa590e8f2da2b6f4bad6d84ad0b972925342beb` (`HEAD`)

## Objectif et décisions arrêtées

Aligner l’intégralité du plugin `forgix` et de son dépôt sur **Node.js 26** (suppression du support Node 24), et **extraire** le répertoire `site/` hors du dépôt vers un dossier autonome dédié sans suivi ni références Git, tout en nettoyant toutes les références Git/CI/workspace liées au site dans `forgix`.

Décisions humaines approuvées le 2026-11-15 :

| Sujet                                     | Décision retenue                                                                                                                                                                                                                                                                                                                                                                                                                    | Raison et compromis                                                                                                                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portée de « enlever les références git »  | **Option A** : isoler `site/` dans un dossier autonome **sans `.git/`, historique Git ni workflows GitHub**, et retirer côté `forgix` toute référence Git/CI au site (`website` dans `.github/workflows/ci.yml`, `site/.astro/` dans `.gitignore`).                                                                                                                                                                                 | Répond à la séparation complète du site tout en préservant les workflows GitHub, la release et la distribution du plugin `forgix`. Compromis : le site extrait n’a plus de suivi Git ni de CI automatique tant qu’un dépôt séparé n’est pas créé. |
| Destination externe du site               | **Option A** : `/Users/acrazie/Fluidise/forgix-site` (dossier frère du checkout principal `/Users/acrazie/Fluidise/forgix`), autonome avec `package.json`, `.gitignore`, `bun.lock` propres et sans mention de Node 24 ni du monorepo.                                                                                                                                                                                              | Découple totalement les dépendances (TS 6 vs TS 7) et les CI. Compromis : la cohérence entre les instructions d’installation du site et celles du plugin devient manuelle.                                                                        |
| Docs historiques du site et `bunfig.toml` | **Option A** : marquer [ADR 0032](../../docs/adr/0032-keep-the-public-website-in-the-product-repository.md) comme `Superseded` et [website-plan.md](website-plan.md) comme déplacé/obsolète (copié dans le dossier site puis annoté), retirer `linker = "isolated"` de [bunfig.toml](../../bunfig.toml), et supprimer le test site de [documentation.test.ts](../../plugins/forgix/test/integration/documentation.test.ts#L79-L89). | Préserve la traçabilité des décisions tout en simplifiant l’arbre de dépendances racine (`bunfig.toml`).                                                                                                                                          |
| Contrat Node 26 du plugin                 | **Option A** : `engines.node` à `">=26.0.0"` dans [plugins/forgix/package.json](../../plugins/forgix/package.json#L43-L45), `.node-version` à `26`, CI sur `node-version: 26`, `@types/node` à `26.6.6`, et `target: "node26.0"` dans [build.mjs](../../plugins/forgix/scripts/build.mjs#L18).                                                                                                                                      | Suit la convention de plancher ouvert (`>=26.0.0` comme `>=24.0.0`) sans bloquer Node 27+. Compromis : abandonner Node 24/25 est un changement cassant de prérequis runtime.                                                                      |
| Gouvernance ADR                           | **Option A** : créer un ADR racine `docs/adr/0035-require-node-26-and-extract-website.md` (hors manifeste npm) qui remplace `ADR 0032` et amende `0012` / `0013` / `0020`, avec mise à jour de statut et des docs actifs.                                                                                                                                                                                                           | Évite d’ajouter un nouveau fichier dans la liste blanche `manifest` de [artifact-budget.json](../../plugins/forgix/test/artifact-budget.json#L19-L80) tout en gardant une trace canonique.                                                        |

---

## État actuel vérifié et contradictions levées

1. **Runtime Node 24 vs Node 26** :
   - [ADR 0012](../../plugins/forgix/docs/adr/0012-use-bun-test-and-require-node-24.md), [ADR 0013](../../plugins/forgix/docs/adr/0013-layer-source-distribution-and-runtime-tests.md) et [ADR 0020](../../plugins/forgix/docs/adr/0020-support-linux-and-macos-with-targeted-ci.md) imposaient Node 24 pour le plugin et le Runtime Smoke Suite.
   - En pratique, le poste local exécute déjà `node` `v26.8.1` et `bun` `1.4.4` ; `esbuild@0.28.1` accepte `target: "node26.0"`, et `@types/node` `26.6.6` (`dist-tags.latest` / `ts7.0`) est publié sur npm.
2. **Site web dans le monorepo** :
   - [ADR 0032](../adr/0032-keep-the-public-website-in-the-product-repository.md) et [website-plan.md](website-plan.md) maintenaient `site/` dans les workspaces racine ([package.json](../../package.json#L6-L13)) et dans `.github/workflows/ci.yml` (`website` + `full-gate`).
   - [bunfig.toml](../../bunfig.toml#L5-L7) n’activait `linker = "isolated"` que pour isoler `typescript@6.0.2` requis par `@astrojs/check` dans `site/` vis-à-vis de `typescript@7.0.2` à la racine et dans `plugins/forgix/`.
   - Le dossier `site/` actuel est un scaffold statique minimal (`astro.config.mjs`, `package.json`, `.node-version`, `tsconfig.json`, `scripts/astro.mjs`, `src/pages/index.astro`, `src/styles/global.css`, `README.md`) sans répertoire `.git/`.

Le présent design remplace formellement ces choix antérieurs suite à l’approbation explicite de l’utilisateur.

---

## Portée et exclusions

### Inclus

1. **Migration complète du dépôt et du plugin vers Node 26** (fichiers de version, manifests, build esbuild, `@types/node`, workflows CI/mirror, tests, docs actives).
2. **Extraction du site vers `/Users/acrazie/Fluidise/forgix-site`** en projet Bun + Astro + Node 26 autonome, sans `.git/`, sans workflows GitHub ni couplage à `forgix`.
3. **Nettoyage complet de `site/` et de ses références** dans `forgix` (`package.json`, `bunfig.toml`, `bun.lock`, `.gitignore`, `.github/workflows/ci.yml`, `documentation.test.ts`).
4. **Gouvernance ADR** (`docs/adr/0035-require-node-26-and-extract-website.md`, statut de `ADR 0032`, `website-plan.md`, et notes d’amendement dans `ADR 0012` / `0013` / `0020`).

### Exclusions explicites

- Aucune modification de la logique métier du plugin (`plugins/forgix/src/*.ts`), des schémas JSON ou des skills (`plugins/forgix/skills/**`).
- Aucun changement de `"target": "ES2024"` dans [tsconfig.json](../../tsconfig.json#L5) et [plugins/forgix/tsconfig.json](../../plugins/forgix/tsconfig.json#L5) (ES2024 reste valide sous TypeScript 7.0.2 et n’introduit pas de changement de surface compilateur inutile).
- Aucune suppression des références Git/GitHub propres au plugin `forgix` (`origin`, `plugins/forgix/package.json` `repository`/`bugs`/`homepage`, `scripts/mirror-npm-to-github.ts`, `release-please-config.json`, `scripts/worktree.sh`, `docs/git-workflow.md`).
- Aucune création de dépôt Git, remote GitHub, déploiement Dokploy/VPS ou modification DNS pour `/Users/acrazie/Fluidise/forgix-site`.
- Aucune incrémentation de version npm/plugin, commit, push, PR ou publication (hors mandat ; noter seulement que la hausse `engines.node` de `>=24.0.0` à `>=26.0.0` constituera un changement cassant `SemVer major` lors de la prochaine release npm).

---

## Contrats techniques et comportement attendu

### 1. Contrat runtime et outillage Node 26 pour `forgix`

- **Version de référence et CI** :
  - [`.node-version`](../../.node-version) passe de `24` à `26`.
  - [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) passe `node-version: 24` → `node-version: 26` dans les trois jobs restants (`quality-gate` ligne 30, `runtime-smoke` ligne 59, `maintainer-release-macos` ligne 75).
  - [`.github/workflows/publish-github-package.yml`](../../.github/workflows/publish-github-package.yml#L33) passe `node-version: 24` → `node-version: 26`.
- **Plancher npm et types** :
  - [`plugins/forgix/package.json`](../../plugins/forgix/package.json#L43-L67) fixe `"engines": { "node": ">=26.0.0" }` et `"@types/node": "26.6.6"`.
  - [`package.json`](../../package.json#L30) fixe `"@types/node": "26.6.6"`.
- **Compilation du bundle distribué** :
  - [`plugins/forgix/scripts/build.mjs`](../../plugins/forgix/scripts/build.mjs#L18) passe `target: "node24.0"` → `target: "node26.0"`, tout en conservant `minify: true`, `format: "esm"`, `platform: "node"` et le banner `createRequire`.
  - [`plugins/forgix/dist/forgix.mjs`](../../plugins/forgix/dist/forgix.mjs) doit être régénéré (`bun run build`) et rester sous les plafonds inchangés de [`plugins/forgix/test/artifact-budget.json`](../../plugins/forgix/test/artifact-budget.json#L14-L18) (`bundleBytes <= 941852`, `packedBytes <= 276057`, `unpackedBytes <= 1230247`).
- **Tests et documentation active** :
  - [`test/github-package-workflow.test.ts`](../../test/github-package-workflow.test.ts#L26) vérifie `"node-version": 26`.
  - [`plugins/forgix/test/runtime/runtime-smoke.test.mjs`](../../plugins/forgix/test/runtime/runtime-smoke.test.mjs#L39-L45) met à jour le libellé vers `Node 26` et vérifie `assert.equal(manifest.engines.node, ">=26.0.0")`.
  - [`plugins/forgix/test/support/project-profile.ts`](../../plugins/forgix/test/support/project-profile.ts#L43) met à jour la fixture `"Use TypeScript on Node.js 26 with Bun tooling."`.
  - Documentation active mise à jour vers **Node.js 26** (`>=26.0.0`, et rejet des versions `25` et antérieures) : [`README.md`](../../README.md#L22), [`CONTRIBUTING.md`](../../CONTRIBUTING.md#L7), [`plugins/forgix/README.md`](../../plugins/forgix/README.md#L14), [`plugins/forgix/docs/getting-started.md`](../../plugins/forgix/docs/getting-started.md#L13) (ainsi que la ligne 242 : `Node.js 25 and older are outside the supported runtime contract.`), [`plugins/forgix/docs/runbooks/maintainer-release.md`](../../plugins/forgix/docs/runbooks/maintainer-release.md#L35).

### 2. Extraction autonome vers `/Users/acrazie/Fluidise/forgix-site`

- **Invariant de sécurité à l’écriture externe** : avant toute création dans `/Users/acrazie/Fluidise/forgix-site`, l’agent d’implémentation vérifie que le chemin résolu (après résolution d’éventuels liens symboliques) est bien `/Users/acrazie/Fluidise/forgix-site` et qu’il n’existe pas déjà avec du contenu imprévu ; s’il existe et n’est pas vide, il s’arrête et demande confirmation avant d’écraser quoi que ce soit.
- **Contenu copié et nettoyé dans `/Users/acrazie/Fluidise/forgix-site`** :
  - Copier uniquement les sources utiles de `site/` : `.node-version` (`26.8.1`), `astro.config.mjs`, `package.json`, `tsconfig.json`, `scripts/astro.mjs`, `src/pages/index.astro`, `src/styles/global.css`, `README.md` (aucun `.git/`, aucun `.github/`, aucun `node_modules/`, `.astro/`, `dist/`).
  - Copier également le plan d’origine (`docs/forgix/website-plan.md` → `/Users/acrazie/Fluidise/forgix-site/PLAN.md`) en retirant/annotant les anciennes sections couplées au monorepo ou aux workflows GitHub de `forgix`.
  - Adapter `/Users/acrazie/Fluidise/forgix-site/package.json` en projet autonome : conserver `"name": "forgix-site"`, `"private": true`, `"type": "module"`, `"engines": { "node": ">=26.0.0 <27" }`, et ajouter `"packageManager": "bun@1.4.4"`.
  - Ajouter `/Users/acrazie/Fluidise/forgix-site/.gitignore` local minimal (`node_modules/`, `.astro/`, `dist/`, `.env*`, `.DS_Store`) par hygiène locale (sans initialiser de dépôt `.git`).
  - Adapter `/Users/acrazie/Fluidise/forgix-site/scripts/astro.mjs:6` pour supprimer la mention du plugin en Node 24 (`"Website commands require Node 26."`).
  - Réécrire `/Users/acrazie/Fluidise/forgix-site/README.md` pour documenter l’installation et les commandes locales autonomes (`bun install --frozen-lockfile`, `bun run dev`, `bun run check`, `bun run build`, Node `26.8.1` / `.node-version`), sans référence à un dépôt Git, à la racine `forgix`, à `linker = "isolated"` ou à Node 24.
  - Exécuter `bun install` puis `bun run build` (Astro check + build statique sous Node 26) dans `/Users/acrazie/Fluidise/forgix-site` afin de produire un `bun.lock` autonome valide et une preuve de build avant de finaliser le retrait côté `forgix`.

### 3. Nettoyage de `forgix` après extraction du site

- **Fichiers supprimés** : tout le répertoire [`site/`](../../site) (`git rm -r site`, puis suppression sur disque de tout répertoire résiduel non suivi ou précédemment ignoré comme `site/.astro/`, `site/node_modules/` ou `site/dist/`, afin de garder un arbre de travail propre vis-à-vis de `release.ts` et des scans `oxfmt`/`oxlint`).
- **Workspace et installation Bun** :
  - [`package.json`](../../package.json#L6-L13) : `"workspaces": ["plugins/*"]`, suppression de `"site:dev"`, `"site:check"` et `"site:build"`.
  - [`bunfig.toml`](../../bunfig.toml#L5-L7) : suppression de `[install]` (`linker = "isolated"` et son commentaire TS 6/TS 7) ; conservation uniquement de `[test]` (`randomize = true`, `retry = 0`).
  - Régénération de `bun.lock` par `bun install` à la racine pour refléter l’absence du workspace `site` (suppression d’Astro, Tailwind, Motion, `@astrojs/check`, TS 6) et le passage à `@types/node@26.6.6`, suivie de la vérification `bun install --frozen-lockfile`.
  - **Vérification de régression post-retrait de `linker = "isolated"`** : même avec le linker par défaut de Bun, `minify: true` reste conservé dans `build.mjs` et `distribution.test.ts` continue de garantir l’absence de chemins `.bun/` dans `dist/forgix.mjs` et le respect de `artifact-budget.json`.
- **Gitignore, CI et tests** :
  - [`.gitignore`](../../.gitignore#L21) : suppression de `site/.astro/`.
  - [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) : suppression du job `website` (lignes 9–21) et suppression de `website` / `WEBSITE_RESULT` dans `full-gate` (`needs: [quality-gate, runtime-smoke, maintainer-release-macos]`, lignes 85, 93, 98).
  - [`plugins/forgix/test/integration/documentation.test.ts`](../../plugins/forgix/test/integration/documentation.test.ts#L79-L89) : suppression du test `website branding uses Forgix and preserves its scaffold boundary`.

### 4. Gouvernance ADR

- Créer [`docs/adr/0035-require-node-26-and-extract-website.md`](../adr/0035-require-node-26-and-extract-website.md) (hors tarball npm `plugins/forgix`) documentant :
  1. le passage du runtime plugin/CI de Node 24 à Node `>=26.0.0` (amendant `ADR 0012`, `ADR 0013` et `ADR 0020`) ;
  2. l’extraction du site vers `/Users/acrazie/Fluidise/forgix-site` sans suivi Git/CI (remplaçant `ADR 0032`).
- Mettre à jour le statut de [`docs/adr/0032-keep-the-public-website-in-the-product-repository.md`](../adr/0032-keep-the-public-website-in-the-product-repository.md) (`Superseded by ADR 0035`) et ajouter une bannière de statut en tête de [`docs/forgix/website-plan.md`](website-plan.md) indiquant que le site a été extrait vers `/Users/acrazie/Fluidise/forgix-site` selon ADR 0035.
- Ajouter une note courte de statut en tête de [`plugins/forgix/docs/adr/0012-use-bun-test-and-require-node-24.md`](../../plugins/forgix/docs/adr/0012-use-bun-test-and-require-node-24.md), [`0013`](../../plugins/forgix/docs/adr/0013-layer-source-distribution-and-runtime-tests.md) et [`0020`](../../plugins/forgix/docs/adr/0020-support-linux-and-macos-with-targeted-ci.md) indiquant directement en ligne l’amendement vers **`Node.js >=26.0.0`** et mentionnant `docs/adr/0035-require-node-26-and-extract-website.md` en texte brut (chemin racine du dépôt, **sans lien Markdown relatif** sortant de la tarball npm), sans ajouter de nouveaux fichiers dans `plugins/forgix/docs/adr/` afin de préserver la liste `manifest` de `artifact-budget.json`.

---

## Frontière de modification et ordre d'exécution (en phase d'implémentation)

### Périmètre d'écriture autorisé à l'implémentation

| Action                             | Chemins exacts                                                                                                                                                                                                                                                                                                                                                                                                                       | Responsabilité                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Créer (hors workspace)**         | `/Users/acrazie/Fluidise/forgix-site/{.node-version,.gitignore,astro.config.mjs,package.json,tsconfig.json,README.md,PLAN.md,bun.lock,scripts/astro.mjs,src/pages/index.astro,src/styles/global.css}`                                                                                                                                                                                                                                | Site web Astro/Tailwind autonome sous Node 26, sans `.git` ni workflows GitHub.                                                 |
| **Créer (dépôt)**                  | `docs/adr/0035-require-node-26-and-extract-website.md`                                                                                                                                                                                                                                                                                                                                                                               | ADR racine actant Node 26 + extraction du site.                                                                                 |
| **Supprimer (dépôt)**              | `site/**`                                                                                                                                                                                                                                                                                                                                                                                                                            | Retrait du site du monorepo `forgix`.                                                                                           |
| **Modifier (Node 26 & workspace)** | `.node-version`, `package.json`, `bunfig.toml`, `bun.lock`, `.gitignore`, `plugins/forgix/package.json`, `plugins/forgix/scripts/build.mjs`, `plugins/forgix/dist/forgix.mjs`                                                                                                                                                                                                                                                        | Passage `@types/node` 26.6.6, `engines.node >=26.0.0`, `target: "node26.0"`, retrait workspace `site` et `linker = "isolated"`. |
| **Modifier (CI)**                  | `.github/workflows/ci.yml`, `.github/workflows/publish-github-package.yml`                                                                                                                                                                                                                                                                                                                                                           | Suppression du job `website` et passage des jobs plugin à `node-version: 26`.                                                   |
| **Modifier (tests)**               | `test/github-package-workflow.test.ts`, `plugins/forgix/test/runtime/runtime-smoke.test.mjs`, `plugins/forgix/test/support/project-profile.ts`, `plugins/forgix/test/integration/documentation.test.ts`                                                                                                                                                                                                                              | Alignement des assertions sur Node 26 et suppression du test couplé à `site/`.                                                  |
| **Modifier (docs & ADRs)**         | `README.md`, `CONTRIBUTING.md`, `plugins/forgix/README.md`, `plugins/forgix/docs/getting-started.md`, `plugins/forgix/docs/runbooks/maintainer-release.md`, `docs/adr/0032-keep-the-public-website-in-the-product-repository.md`, `docs/forgix/website-plan.md`, `plugins/forgix/docs/adr/{0012-use-bun-test-and-require-node-24,0013-layer-source-distribution-and-runtime-tests,0020-support-linux-and-macos-with-targeted-ci}.md` | Prérequis Node 26 et statuts ADR/plan à jour.                                                                                   |

### Séquence sûre et plan de retour arrière

1. **Exporter d’abord le site** vers `/Users/acrazie/Fluidise/forgix-site` (vérification préalable de non-collision), générer son `bun.lock` (`bun install`) et valider `bun run build` sous Node 26 dans `/Users/acrazie/Fluidise/forgix-site`. En cas d’échec, supprimer uniquement le dossier cible neuf sans avoir altéré `forgix`.
2. **Mettre à jour `forgix`** : supprimer `site/`, éditer les manifests, `bunfig.toml`, `.node-version`, `build.mjs`, CI, tests et docs, puis exécuter `bun install` à la racine pour régénérer `bun.lock`.
3. **Reconstruire et valider** sous Node 26 : `bun install --frozen-lockfile`, `bun run build`, `bun run check`, `bun run pack:runtime && bun run --cwd plugins/forgix test:runtime`, `bun run --cwd plugins/forgix release:test`.
4. **Retour arrière avant commit** : dans `forgix`, `git restore` / `git clean` rétablit intégralement `site/`, `bun.lock` et l’état initial ; après merge, un `git revert` du commit d’extraction restaure `site/` depuis l’historique Git.

---

## Risques identifiés et vérifications attendues

### Risques et garde-fous

- **Échec de résolution `@types/node@26.6.6` avec `typescript@7.0.2` ou `oxlint --type-aware`** : si de nouvelles définitions Node 26 déclenchent un diagnostic TS/Oxlint, tenter d’abord d’ajuster la version exacte de `@types/node` dans la branche `26.x` (sans retomber sur Node 24) à l’intérieur de `package.json` et `plugins/forgix/package.json`. Si le diagnostic persiste dans `plugins/forgix/src/*.ts`, `scripts/*.ts` ou un test non listé dans le périmètre d’écriture, **arrêter l’implémentation et demander une autorisation explicite d’extension de périmètre** avant toute modification hors frontière.
- **Retrait de `linker = "isolated"` dans `bunfig.toml`** : `bun.lock` et le graphe `node_modules` changent. _Garde-fou_ : `bun run check` inclut `distribution.test.ts` (vérifie l’absence de `node_modules/.bun/` et la reproductibilité du bundle) et `check:size` (`artifact-budget.json`).
- **Rupture des utilisateurs sous Node 24/25** : assumée par le passage à `engines.node >=26.0.0`. _Garde-fou_ : documentation explicite dans `README.md`, `getting-started.md`, `maintainer-release.md` et `ADR 0035`.
- **Règles de protection de branche GitHub** : vérifier après fusion que `Full Gate` reste le check requis et qu’aucune règle de protection GitHub ne requiert séparément l’ancien job supprimé `Website (Node 26)`.
- **Résidus `site` ou `Node 24` oubliés** : vérifier par `git grep` final qu’aucune référence active à `site/`, `site:*`, `Node 24`, `Node.js 24`, `node24`, `>=24`, `@types/node` `24.*` ou `node-version: 24` ne subsiste hors archives historiques, ADRs amendés/remplacés et référence figée du nom de fichier `0012` dans `plugins/forgix/test/artifact-budget.json:34` (`CHANGELOG.md`, `plugins/forgix/CHANGELOG.md`, `docs/forgix/2026-*`, `docs/forgix/website-plan.md`, `docs/specs/`, `docs/adr/0032-*.md`, `docs/adr/0035-*.md`, `plugins/forgix/docs/adr/{0012,0013,0020}-*.md`, `plugins/forgix/test/artifact-budget.json:34`).

### Vérifications attendues à l'implémentation

- Dans `/Users/acrazie/Fluidise/forgix-site` :
  - Absence de `.git/` et de `.github/`.
  - `node -v` en `26.x`, `bun install --frozen-lockfile` (après génération de `bun.lock`), `bun run check` et `bun run build` sortent en code `0` avec génération de `dist/index.html`.
- Dans `forgix` :
  - `.node-version` contient `26` et `package.json` ne déclare plus `"site"` dans `"workspaces"` ni de scripts `site:*`.
  - `bun install --frozen-lockfile`
  - `bun run check` (formatage `oxfmt`, `oxlint`, `lint:type-aware`, `typecheck:tools`, `test:tools`, `plugins/forgix` typecheck, build, test randomization, coverage et `check:size`)
  - `bun run pack:runtime && bun run --cwd plugins/forgix test:runtime` (exécuté sous Node 26)
  - `bun run --cwd plugins/forgix release:test`
  - Contrôle final : `git grep -n -i -E 'node(\.js)?[^0-9a-zA-Z]*24|node-version[^0-9]*24|>=24|@types/node[^0-9]*24|(^|[^a-zA-Z0-9_-])site([:/]|$)' -- ':!bun.lock' ':!plugins/forgix/dist' ':!docs/roadmap.md' ':!docs/ROADMAP.md' ':!CHANGELOG.md' ':!plugins/forgix/CHANGELOG.md' ':!docs/forgix/2026-*' ':!docs/forgix/website-plan.md' ':!docs/specs/*' ':!docs/adr/0032-*' ':!docs/adr/0035-*' ':!plugins/forgix/docs/adr/0012-*' ':!plugins/forgix/docs/adr/0013-*' ':!plugins/forgix/docs/adr/0020-*'` ne retourne que l’unique correspondance attendue `plugins/forgix/test/artifact-budget.json:34` (`"docs/adr/0012-use-bun-test-and-require-node-24.md"`).

<!-- egm-review-state:start -->

## État de revue et d'approbation

- **Statut** : `approved` (approuvé par l'utilisateur le 2026-11-15 : `"oui go implem"`, sur la révision `sha256:cb1215b120878e2c4254f41f6db2f3a51142b7d81aff4ac07483d99cc65fb811`)
- **Révision du design (substantive body digest)** : `sha256:cb1215b120878e2c4254f41f6db2f3a51142b7d81aff4ac07483d99cc65fb811` (21780 octets UTF-8)
- **Domaine du digest** : octets UTF-8 de `docs/forgix/2026-11-15-node26-and-site-extraction.md` strictement antérieurs au marqueur `<!-- egm-review-state:start -->`.
- **Révision source inspectée** : `efa590e8f2da2b6f4bad6d84ad0b972925342beb` (`HEAD`)
- **Couverture planifiée et exécutée** : `egm-design-critic`, `egm-implementation-readiness`
- **Historique de revue** :
  - Passe 1 (`sha256:e4f49410b3420a89acc5cf2425ecc179479cce12a7e276733b879b5fe26caf4f`) : `egm-design-critic` (1 Major, 2 Nit) et `egm-implementation-readiness` (1 Major, 2 Nit).
  - Passe 2 (`sha256:6edd07ed8ac46c56f9d69f8cba1e5d39d71e2dcd7f77d7d3a4339456274141a1`) : `egm-implementation-readiness` (**Ready** — `0 Blocker / 0 Major / 1 Nit` sur l'allowlist et la regex `git grep`) ; `egm-design-critic` (`1 Major` sur la regex et l'allowlist `git grep`).
  - Passe 3 (`sha256:cb1215b120878e2c4254f41f6db2f3a51142b7d81aff4ac07483d99cc65fb811`) : revalidation ciblée en contexte frais par `egm-design-critic` (**Ready** — `0 Blocker / 0 Major / 0 Nit`).
- **Limites matérielles de couverture** : phase strictement limitée à la conception (aucun fichier de production modifié, aucun déplacement vers `/Users/acrazie/Fluidise/forgix-site`, aucune installation de dépendances ni commit). Les relecteurs en contexte frais opéraient en lecture seule sans shell ; les vérifications d'exécution (`bun install` avec `@types/node@26.6.6`, `bun run check`, `pack:runtime` + `test:runtime` sous Node 26, `release:test`, build autonome dans `/Users/acrazie/Fluidise/forgix-site`, contrôle des règles de protection de branche GitHub et `git grep` final post-édition) restent à exécuter lors de l'implémentation après approbation humaine. Le coordinateur a vérifié en lecture seule que `esbuild@0.28.1` accepte `target: "node26.0"`, que `@types/node@26.6.6` est publié sur npm (`latest` / `ts7.0`) et que la commande `git grep` proposée cible les lignes actives attendues sur `HEAD`.

<!-- egm-review-state:end -->

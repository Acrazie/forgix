# Suppression des références actives à `dev-flow` vers `forgix`

## Objectif et décisions arrêtées

Éliminer les références actives résiduelles à `dev-flow`, `DEV FLOW`, `Dev Flow`, `codex-dev-flow` et `dev-flow.acrazie.dev` dans le runtime, la CLI, les skills, le brand kit, le site et les manifestes de Forgix, afin d'aligner l'ensemble du projet sur l'identité **Forgix** sans ambiguïté multi-harness (Codex, Claude Code, Antigravity).

Décisions humaines approuvées pour ce design :

| Sujet                                    | Décision retenue                                                                                                                                                                                                   | Raison et compromis                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Répertoire `.codex/` vs noms `dev-flow`  | Renommer toutes les références actives `dev-flow` / `DEV FLOW` vers `forgix` / `FORGIX`, tout en conservant `.codex/` pour la config et les états internes (`tasks/`, `benchmarks/`, `project-init/`, `roadmap/`). | Répond directement au périmètre `fix_dev_flow_references` sans perturber les stores internes déjà neutres ; laisse le nom `.codex/` visible sous Antigravity et Claude Code.                        |
| Rétrocompatibilité des chemins/marqueurs | **Coupure nette** : lire et écrire uniquement les chemins et marqueurs `forgix`, sans fallback vers `dev-flow`.                                                                                                    | Simplifie `config.ts`, `project-profile.ts`, `domain-projection.ts` et `mirror-npm-to-github.ts` ; casse la lecture silencieuse d'éventuelles configs/profils `dev-flow` non renommés manuellement. |
| Brand kit, site web et dépôt GitHub      | Tout basculer vers Forgix : brand kit dans `docs/assets/brand/`, URL `https://forgix.acrazie.dev`, dépôt GitHub `Acrazie/forgix`.                                                                                  | Cohérence totale d'identité publique ; suppose le renommage effectif du dépôt GitHub et la configuration DNS correspondante avant déploiement/publication.                                          |
| Miroir GitHub Packages                   | `scripts/mirror-npm-to-github.ts` accepte uniquement `github.com/acrazie/forgix` (aucune tarball 1.0.0 à rétro-mirer).                                                                                             | Aligné sur la coupure nette ; toute future publication de `@acrasie/forgix` doit embarquer `Acrazie/forgix`.                                                                                        |
| Docs sous `docs/dev-flow/`               | Déplacer les 15 documents existants de `docs/dev-flow/` vers `docs/forgix/` (`git mv`), sans réécrire leur prose historique.                                                                                       | Aligne le dossier sur `shape-projection.ts` (`docs/forgix/...`) tout en préservant les traces historiques.                                                                                          |
| Compteur d'étapes dans `init.ts`         | Corriger l'incohérence `1/4 → 2/3` lors du choix d'un harness host-native à l'étape 1.                                                                                                                             | Évite un changement déroutant du nombre total d'étapes après la première sélection.                                                                                                                 |

## Portée et exclusions

### Inclus

1. **Configuration et wizard CLI** (`plugins/forgix/src/config.ts`, `plugins/forgix/src/init.ts`, `.codex/forgix.yaml`, `.gitignore`, `plugins/forgix/.gitignore`).
2. **Project Engineering Profile et projections** (`plugins/forgix/src/project-profile.ts`, `plugins/forgix/src/domain-projection.ts`, `plugins/forgix/src/shape-projection.ts`).
3. **Skill principal et documentation active** (`plugins/forgix/skills/forgix/SKILL.md`, `README.md`, `CONTRIBUTING.md`, `plugins/forgix/README.md`, `plugins/forgix/docs/*` hors ADRs/changelogs).
4. **Manifestes, miroir et site web** (`plugins/forgix/package.json`, `plugins/forgix/plugin.json`, `plugins/forgix/.claude-plugin/plugin.json`, `scripts/mirror-npm-to-github.ts`, `site/astro.config.mjs`).
5. **Brand kit** (`docs/assets/brand/README.md` et SVGs sous `docs/assets/brand/svg/`).
6. **Migration du dossier `docs/dev-flow/` → `docs/forgix/`**, reconstruction de `plugins/forgix/dist/forgix.mjs`, et mise à jour/renforcement des suites de tests (`test/*`, `plugins/forgix/test/*`).

### Exclusions explicites

- Le répertoire `.codex/` et ses sous-dossiers neutres (`tasks/`, `benchmarks/`, `project-init/`, `roadmap/`, `five-hour-quota-reset.json`) restent inchangés.
- Les archives historiques (`CHANGELOG.md`, `plugins/forgix/CHANGELOG.md`, `docs/adr/*`, `plugins/forgix/docs/adr/*`, `docs/specs/dev-flow-rename.md`, ainsi que le contenu interne des 15 documents déplacés depuis `docs/dev-flow/`) ne sont pas réécrites.
- Les mentions documentaires explicites de l'absence d'anciens alias/paquets (`Neither \`dev-flow\` nor \`codex-dev-flow\` is shipped as a CLI alias.`dans`README.md`, `plugins/forgix/README.md`, `getting-started.md`, et `Historical \`codex-dev-flow\` and \`@acrasie/dev-flow\` packages remain separate`dans`maintainer-release.md`), ainsi que les assertions de tests négatifs gardant contre le retour des **anciens noms d'artefacts** (`skills/dev-flow`, `dist/dev-flow.mjs`, `dist/codex-dev-flow.mjs`, rejet de `"dev-flow"`/`"codex-dev-flow"`dans`release.test.ts`), sont préservées. À l'inverse, les gardes vérifiant qu'un chemin **actif** n'est ni écrit ni empaqueté (`distribution.test.ts:82, 173`) basculent sur `.codex/forgix.project.yaml`et`.codex/forgix.yaml`(tout en conservant ou doublant l'exclusion des équivalents`.codex/dev-flow*`).
- Opérations externes hors dépôt : renommage effectif du dépôt sur GitHub (`Acrazie/codex-dev-flow` → `Acrazie/forgix`), mise à jour du remote local `origin`, configuration DNS/TLS pour `https://forgix.acrazie.dev`, publication npm/GitHub Packages et commits/push/PR.

## Contrats techniques et comportement attendu

### 1. Configuration CLI et résolution (`config.ts`, `init.ts`)

- **Chargement (`plugins/forgix/src/config.ts:102-125`)** : `loadConfigSources` lit uniquement les chemins suivants, par ordre de priorité croissante :
  1. `join(home, ".codex", "forgix.yaml")` (`source: "user"`)
  2. `join(cwd, ".codex", "forgix.yaml")` (`source: "repo"`)
  3. `join(cwd, ".codex", "forgix.local.yaml")` (`source: "local"`)
  4. `options.flags` (`source: "flags"`)
     Les fichiers `dev-flow.yaml` / `dev-flow.local.yaml` sont ignorés sans erreur ni avertissement.
- **Wizard `init` (`plugins/forgix/src/init.ts:91-393`)** :
  - Lit et écrit `join(cwd, ".codex", "forgix.yaml")` (écriture atomique par fichier temporaire + `rename` en mode `0o600`, schéma `plugins/forgix/schemas/config.schema.json` inchangé).
  - **Compteur d'étapes (`collectHarness:249-284` et étapes suivantes `:289, 319, 378`)** : `totalSteps(harness)` vaut `4` pour `codex`/`auto` et `3` pour `claude`/`antigravity`. Comme le harness n'est choisi qu'à la fin de l'étape 1, le titre de l'étape 1 n'affiche plus un dénominateur prématuré (`1/${totalSteps(draft.harness)}`), mais exactement `"1 · Target harness"`. Les étapes suivantes conservent le ratio exact issu du harness sélectionné (`"2/3 · Workflow behavior"` et `"3/3 · External integrations"`, ou `"2/4 · Workflow behavior"`, `"3/4 · Subscription and quota"`, `"4/4 · External integrations"`).
- **Fichier du dépôt et règles d'ignore** :
  - `.codex/dev-flow.yaml` à la racine du dépôt est déplacé vers `.codex/forgix.yaml` avec son contenu intact.
  - `.gitignore` (racine, lignes 24–28) remplace `.codex/dev-flow.project.local.yaml` par `.codex/forgix.project.local.yaml` et **ajoute** `.codex/forgix.local.yaml` (conformément à `CONTRIBUTING.md:163` et `config.ts:108`, ce dernier n'ayant pas de garde `.gitignore` programmatique contrairement à `project-profile.ts`).
  - `plugins/forgix/.gitignore` (lignes 3–4) remplace `.codex/dev-flow.local.yaml` et `.codex/dev-flow.project.local.yaml` par `.codex/forgix.local.yaml` et `.codex/forgix.project.local.yaml`.

### 2. Project Engineering Profile (`project-profile.ts`)

- Les constantes exportées dans `plugins/forgix/src/project-profile.ts:9-12` deviennent :
  - `SHARED_PROJECT_PROFILE_PATH = join(".codex", "forgix.project.yaml")`
  - `LOCAL_PROJECT_PROFILE_PATH = join(".codex", "forgix.project.local.yaml")`
  - `LOCAL_PROJECT_PROFILE_IGNORE_ENTRY = "/.codex/forgix.project.local.yaml"`
  - `PROJECT_DIAGRAM_ROOT = join(".codex", "forgix", "diagrams")`
- La validation `validateProfileContent` (`plugins/forgix/src/project-profile.ts:1125-1130`) exige des références Markdown sous `.codex/forgix/diagrams/` et rejette tout autre préfixe (y compris `.codex/dev-flow/diagrams/`) avec `ProjectProfileError("profile_projection_invalid", "Project diagram refs must be Markdown files below .codex/forgix/diagrams/.")`.
- `isLocalIgnored()` (`plugins/forgix/src/project-profile.ts:717-724`) continue de vérifier `/.codex/forgix.project.local.yaml` ou `.codex/forgix.project.local.yaml` dans `.gitignore`.

### 3. Projections de domaine et de plan (`domain-projection.ts`, `shape-projection.ts`)

- **Marqueurs de domaine (`plugins/forgix/src/domain-projection.ts:93-94`)** : `applyOwnedMarkdownPatch` génère et recherche exclusivement :
  - `<!-- forgix:${patch.ownedIdentity}:start -->`
  - `<!-- forgix:${patch.ownedIdentity}:end -->`
    Des marqueurs hérités `<!-- dev-flow:... -->` dans un fichier existant ne sont ni reconnus ni supprimés : la nouvelle section `<!-- forgix:... -->` est simplement ajoutée.
- **Chemin par défaut des plans (`plugins/forgix/src/shape-projection.ts:136`)** : `defaultPath` retourne `docs/forgix/${date}-${slug}.md`.

### 4. Skill principal et documentation active

- `plugins/forgix/skills/forgix/SKILL.md` :
  - Bannières d'annonce : `[FORGIX · GATE → BUILD]`, `[FORGIX · BUILD → ASSURE]`, `[FORGIX · ASSURE ✓]` et formulation `outside Forgix lifecycle/state` (lignes 264–294).
  - Références de chemins : `.codex/forgix.yaml`, `.codex/forgix.project.yaml`, `/.codex/forgix.project.local.yaml`.
  - Lignes 359–361 (`Resume, evidence, and artifacts`) : dissocier le chemin par défaut de projection Plan (`docs/forgix/YYYY-MM-DD-<slug>.md`, aligné sur `plugins/forgix/docs/artifacts.md:20-21`) des véritables dispositions historiques (`spec.md`, `plan.md`, `risk-and-rollback.md`, `verification.md`), tout en conservant `repository choices only` (vérifié par `workflow-artifacts.test.ts:20`).
- `README.md`, `CONTRIBUTING.md`, `plugins/forgix/README.md`, `plugins/forgix/docs/getting-started.md`, `plugins/forgix/docs/artifacts.md`, `plugins/forgix/docs/project-profile-contract.md`, `plugins/forgix/docs/glossary/forgix.md` :
  - Remplacer toutes les occurrences actives de `Acrazie/codex-dev-flow`, `cd codex-dev-flow`, `./codex-dev-flow/plugins/forgix` par `Acrazie/forgix`, `cd forgix`, `./forgix/plugins/forgix`.
  - Remplacer toutes les occurrences de `.codex/dev-flow*` et `docs/dev-flow/` par `.codex/forgix*` et `docs/forgix/`.
  - Mettre à jour `plugins/forgix/docs/glossary/forgix.md:7-8` (en plus des lignes `428` et `446`) : préciser que `.codex/` reste la racine partagée entre les trois harness (et que `tasks/`, `benchmarks/`, `project-init/`, `roadmap/` conservent leurs chemins), tandis que les configurations, profils, diagrammes, marqueurs et projections (`forgix.*`, `.codex/forgix/diagrams/`, `<!-- forgix:... -->`, `docs/forgix/`) utilisent désormais l'identifiant `forgix` sans rétrocompatibilité `dev-flow`.
  - Réécrire complètement les sections d'introduction et de migration (`README.md:31-34, 136-140`, `plugins/forgix/README.md:23-26, 125-129`, `plugins/forgix/docs/getting-started.md:173-177`) tout en conservant la ligne garde `Neither \`dev-flow\` nor \`codex-dev-flow\` is shipped as a CLI alias.` :
    - Supprimer les affirmations obsolètes (`"no data migration is required"`, `"GitHub repository and website hosting URL are unchanged"`, `"existing .codex/ project configuration and state remain unchanged"`), car le dépôt GitHub bascule sur `Acrazie/forgix` et le site sur `https://forgix.acrazie.dev` (tout en rappelant que `.codex/tasks/`, `benchmarks/`, `project-init/` et `roadmap/` restent inchangés).
    - Pour la mise à niveau plugin (`README.md:137`, `plugins/forgix/README.md:126`, `getting-started.md:174`), indiquer explicitement de remplacer ou ré-ajouter la source marketplace `Acrazie/codex-dev-flow` vers `Acrazie/forgix` avant d'installer `forgix@acrazie`.
    - Décrire la migration manuelle requise par la coupure nette :
      1. **Configs CLI** (`~/.codex/dev-flow.yaml`, `.codex/dev-flow.yaml`, `.codex/dev-flow.local.yaml`, ignorés silencieusement par `loadConfigSources`) : renommer/copier vers `forgix.*` ou relancer `npx @acrasie/forgix init`.
      2. **Profil d'ingénierie projet** (`.codex/dev-flow.project.yaml`, notamment avec `diagramRefs`) : ne pas se contenter d'un renommage ou d'une édition manuelle (validation stricte `.codex/forgix/diagrams/*.md`, `contentDigest`, `receiptDigest`), mais régénérer et ré-approuver via `$forgix init` / `/forgix:forgix init` / `/forgix init`, et renommer `.codex/dev-flow.project.local.yaml` vers `.codex/forgix.project.local.yaml`.
      3. **Docs et marqueurs** : déplacer `docs/dev-flow/` vers `docs/forgix/` si conservés, et mettre à jour/retirer les anciens marqueurs `<!-- dev-flow:... -->` des docs de domaine (sinon la prochaine projection ajoute un second bloc `<!-- forgix:... -->`).

### 5. Manifestes, miroir npm→GitHub, site web et variable de test runtime

- `plugins/forgix/package.json` (`homepage`, `repository.url`, `bugs.url`), `plugins/forgix/plugin.json` (`homepage`, `repository`), `plugins/forgix/.claude-plugin/plugin.json` (`repository`) pointent vers `https://github.com/Acrazie/forgix` (et `git+https://github.com/Acrazie/forgix.git` / `/issues` / `#readme`).
- `scripts/mirror-npm-to-github.ts:14` fixe `EXPECTED_REPOSITORY = "github.com/acrazie/forgix"`. Toute tarball dont `repository.url` pointe encore vers `codex-dev-flow` échoue avec `MirrorError`.
- `site/astro.config.mjs:5` configure `site: "https://forgix.acrazie.dev"`.
- `plugins/forgix/test/runtime/runtime-smoke.test.mjs:18` bascule la variable d'environnement optionnelle de surcharge du tarball de `DEV_FLOW_TARBALL` vers `FORGIX_TARBALL` (sans rétrocompatibilité ; `.github/workflows/ci.yml:47-66` ne passe pas `DEV_FLOW_TARBALL` et repose sur `.artifacts/forgix.tgz`).

### 6. Brand kit (`docs/assets/brand/`)

- `docs/assets/brand/README.md` est mis à jour en `# Forgix Brand Kit` tout en préservant palette (`#5B5CF6`, `#F6F65B`, `#18181B`), règles d'usage et logo ASCII `[/]`.
- `docs/assets/brand/svg/symbol-{black,white}.svg` et `symbol-simple-{color,black,white}.svg` alignent `<title>` sur `Forgix` (comme `symbol-color.svg`).
- `docs/assets/brand/svg/lockup-{color,black,white}.svg` remplacent `Dev Flow` par `Forgix` dans `<title>`, `<desc>` et `<text>`, en ajustant le `viewBox` horizontal si nécessaire (`Forgix` étant plus court que `Dev Flow`) pour équilibrer la marge sans tronquer le texte ni altérer les chemins du symbole `[ / ]`.

## Frontière de modification et ordre d'exécution

### Fichiers à créer / déplacer / modifier

| Action                                 | Fichiers / Dossiers                                                                                                                                                                                                                                                                                                                                                  | Responsabilité                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Créer**                              | `docs/forgix/2026-11-13-fix-dev-flow-references.md`                                                                                                                                                                                                                                                                                                                  | Présent document de design canonique.                                           |
| **Déplacer (`git mv`)**                | `.codex/dev-flow.yaml` → `.codex/forgix.yaml` ; `docs/dev-flow/*` (15 fichiers) → `docs/forgix/*`                                                                                                                                                                                                                                                                    | Alignement de la config locale du dépôt et des archives de design.              |
| **Modifier (runtime & scripts)**       | `plugins/forgix/src/{config,init,project-profile,domain-projection,shape-projection}.ts`, `scripts/mirror-npm-to-github.ts`, `plugins/forgix/dist/forgix.mjs`                                                                                                                                                                                                        | Nouveaux chemins/marqueurs Forgix, correctif `init`, miroir, rebuild du bundle. |
| **Modifier (manifests, site, ignore)** | `.gitignore`, `plugins/forgix/.gitignore`, `plugins/forgix/package.json`, `plugins/forgix/plugin.json`, `plugins/forgix/.claude-plugin/plugin.json`, `site/astro.config.mjs`                                                                                                                                                                                         | Identité Forgix des manifests, URL site et règles `.gitignore`.                 |
| **Modifier (skills, docs, brand)**     | `plugins/forgix/skills/forgix/SKILL.md`, `README.md`, `CONTRIBUTING.md`, `plugins/forgix/README.md`, `plugins/forgix/docs/{getting-started,artifacts,project-profile-contract,glossary/forgix}.md`, `docs/assets/brand/README.md`, `docs/assets/brand/svg/*.svg` (hors `symbol-color.svg` déjà à jour)                                                               | Suppression des références actives `dev-flow` / `Dev Flow` / `codex-dev-flow`.  |
| **Modifier (tests)**                   | `test/{forgix-identity,github-package-mirror}.test.ts`, `plugins/forgix/test/unit/{domain-projection,project-profile,shape-projection,state}.test.ts`, `plugins/forgix/test/integration/{config-loading,distribution,documentation,init,project-profile-cli,project-profile-store,workflow-artifacts}.test.ts`, `plugins/forgix/test/runtime/runtime-smoke.test.mjs` | Mise à jour des assertions et ajout des cas de coupure nette.                   |

### Ordre sûr d'exécution (en phase d'implémentation)

1. Mettre à jour les sources TypeScript (`plugins/forgix/src/*.ts`, `scripts/mirror-npm-to-github.ts`), les manifests, `.gitignore`, `site/astro.config.mjs`, `SKILL.md` et déplacer `.codex/dev-flow.yaml` → `.codex/forgix.yaml`.
2. Mettre à jour la documentation active, le brand kit et déplacer `docs/dev-flow/*` → `docs/forgix/*`.
3. Reconstruire `plugins/forgix/dist/forgix.mjs` (`bun run build`) et adapter/compléter les tests.
4. Exécuter les vérifications complètes (y compris `git grep` des résidus actifs et validation des manifestes plugin si les CLIs hôtes sont disponibles).

## Risques et vérifications attendues

### Risques identifiés et garde-fous

- **Rupture des environnements existants (coupure nette)** : les fichiers `~/.codex/dev-flow.yaml`, `.codex/dev-flow.yaml`, `.codex/dev-flow.local.yaml`, `.codex/dev-flow.project.yaml`, `<!-- dev-flow:... -->` existants ne sont plus lus ; `<!-- dev-flow:... -->` entraîne l'ajout d'un second bloc `<!-- forgix:... -->` lors de la prochaine projection, et les profils signés comportant `diagramRefs` sous `.codex/dev-flow/diagrams/` ne peuvent pas être simplement renommés à la main. _Garde-fou_ : instructions de migration en 3 volets (configs CLI, ré-init/ré-approbation des profils via `$forgix init`, nettoyage `<!-- dev-flow:... -->` / `docs/dev-flow/` et mise à jour de la source marketplace `Acrazie/forgix`) dans `README.md`, `plugins/forgix/README.md`, `getting-started.md` et `glossary/forgix.md` + migration immédiate de `.codex/dev-flow.yaml` dans ce dépôt.
- **Prérequis externes GitHub / DNS** : `Acrazie/forgix` et `https://forgix.acrazie.dev` dans les manifests/docs/miroir supposent le renommage du dépôt GitHub (`origin`) et le routage DNS ; tant que le dépôt GitHub n'est pas renommé, les commandes `marketplace add Acrazie/forgix` / `git clone` et le workflow `publish-github-package.yml` sur anciennes tarballs échoueront.
- **Désynchronisation du bundle Git et budget de taille** : `plugins/forgix/dist/forgix.mjs` étant suivi dans Git, toute modification dans `src/` sans `bun run build` échoue sur `distribution.test.ts` et peut impacter `artifact-budget.json`.

### Vérifications attendues à l'implémentation

- **Tests ciblés nouveaux/adaptés** :
  - `config-loading.test.ts` : charge `.codex/forgix.yaml` / `.codex/forgix.local.yaml` et ignore `.codex/dev-flow.yaml` (coupure nette).
  - `init.test.ts` : écrit `.codex/forgix.yaml` ; vérifier exactement le titre `"1 · Target harness"` sans ratio prématuré puis `"2/3 · Workflow behavior"`, `"3/3 · External integrations"` pour `antigravity` et `"2/4 · Workflow behavior"`, `"3/4 · Subscription and quota"`, `"4/4 · External integrations"` pour `codex`.
  - `project-profile.test.ts` / `project-profile-cli.test.ts` / `project-profile-store.test.ts` : acceptent `.codex/forgix.project.yaml`, `.codex/forgix.project.local.yaml`, `.codex/forgix/diagrams/*.md` et rejettent `.codex/dev-flow/diagrams/...` (`profile_projection_invalid`).
  - `domain-projection.test.ts` : génère `<!-- forgix:... -->` et ignore `<!-- dev-flow:... -->` sans erreur ni écrasement.
  - `shape-projection.test.ts` : retourne `docs/forgix/YYYY-MM-DD-<slug>.md`.
  - `state.test.ts` : met à jour la fixture `issueRef` (`acrazie/codex-dev-flow#42` → `acrazie/forgix#42`, lignes 156, 160, 164).
  - `distribution.test.ts` : met à jour les gardes d'exclusion d'artefacts actifs aux lignes `82` et `173` pour vérifier la non-écriture de `.codex/forgix.project.yaml` et l'exclusion de `.codex/forgix.yaml` dans la tarball npm (tout en conservant l'exclusion de `.codex/dev-flow*` et les gardes legacy sur `dist/dev-flow.mjs`, `dist/codex-dev-flow.mjs`, `skills/dev-flow`).
  - `test/forgix-identity.test.ts` et `test/github-package-mirror.test.ts` : valident `Acrazie/forgix` et le rejet de `github.com/acrazie/codex-dev-flow`.
  - `documentation.test.ts` et `workflow-artifacts.test.ts` : vérifient les nouveaux chemins/commandes (`Acrazie/forgix`, `.codex/forgix.project.yaml`, `.codex/forgix.project.local.yaml`, `docs/forgix/YYYY-MM-DD-<slug>.md`), `https://forgix.acrazie.dev`, et les gardes négatifs conservés.
  - `runtime-smoke.test.mjs` : utilise `FORGIX_TARBALL` (`line 18`), conserve les gardes négatifs `skills/dev-flow`, `dist/dev-flow.mjs`, `dist/codex-dev-flow.mjs` (`lines 46-48`), et vérifie `config validate --json` avec `.codex/forgix.yaml` absent puis présent en isolant **à la fois** `cwd` (répertoire temporaire de travail) et `HOME` (répertoire temporaire passé via `env` à `spawnSync` pour éviter toute lecture de `~/.codex/forgix.yaml` de l'hôte ou écriture dans `packageRoot/dist`).
- **Portes de qualité dépôt** :
  - `bun run build`
  - `bun run check` (formatage, oxlint, lint type-aware, typecheck outils, tests outils, tests plugin randomisés, couverture, budget de taille)
  - `bun run pack:runtime && bun run --cwd plugins/forgix test:runtime`
  - `bun run site:build`
  - Contrôle final par `git grep` confirmant l'absence de `dev-flow` / `DEV FLOW` / `Dev Flow` / `codex-dev-flow` hors exclusions documentées (archives historiques, gardes documentaires d'absence d'alias, tests négatifs).

<!-- egm-review-state:start -->

## État de revue et d'approbation

- **Statut** : `approved` (approuvé par l'utilisateur sur la révision `sha256:9fd13a0174a5c1009cfe06aa4852af2c79b4fd35e27f89e312c3d45a646ccae5`, formaté par `oxfmt` vers `sha256:eb9c3063a7bd459e7dd904a87ffd1cd375e54c3ad03bfc30c50059b9100cfc59` après revalidation indépendante en contexte frais sans `Blocker`, `Major` ni `Nit`)
- **Révision du design (substantive body digest)** : `sha256:eb9c3063a7bd459e7dd904a87ffd1cd375e54c3ad03bfc30c50059b9100cfc59`
- **Domaine du digest** : octets UTF-8 de `docs/forgix/2026-11-13-fix-dev-flow-references.md` strictement antérieurs au marqueur `<!-- egm-review-state:start -->`.
- **Révision source inspectée** : `91c905bd44c86fa757a86e5e0ea8cd2c6e0e1f3d` (`HEAD`)
- **Couverture planifiée et exécutée** : `egm-design-critic`, `egm-implementation-readiness`
- **Historique de revue** :
  - Passe 1 (`sha256:c6932a81ba01e1a7ea46f78f7632a67890fa140f76a9c4ff1bc455f87ca0af43`) : `egm-implementation-readiness` (`Not Ready` — 4 Major, 4 Nit) et `egm-design-critic` (`Changes required` — 3 Major, 2 Nit). Tous les constats Major et Nit ont été résolus dans la révision 2 (`sha256:9fd13a0174a5c1009cfe06aa4852af2c79b4fd35e27f89e312c3d45a646ccae5`).
  - Passe 2 (`sha256:9fd13a0174a5c1009cfe06aa4852af2c79b4fd35e27f89e312c3d45a646ccae5`) :
    - `egm-implementation-readiness` (nouvelle instance en contexte frais) : **Ready** (`0 Blocker / 0 Major / 0 Nit`).
    - `egm-design-critic` (nouvelle instance en contexte frais) : **Ready** (`0 Blocker / 0 Major / 0 Nit`).
- **Limites matérielles de couverture** : phase strictement limitée à la conception (aucun fichier de production modifié ; `bun run build`, `bun run check`, `pack:runtime`, `site:build` et le contrôle `git grep` final restent à exécuter lors de l'implémentation après approbation humaine). Les relecteurs en contexte frais opéraient en lecture seule sans shell (`git grep`, énumération de `docs/dev-flow/*` et calcul SHA-256 vérifiés directement par le coordinateur).

<!-- egm-review-state:end -->

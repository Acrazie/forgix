# Ajout de Renovate Bot sur Entire / Buildkite

- **Statut** : Brouillon — en cours de revue indépendante
- **Dépôt cible** : `/et/forgix/forgix` (`entire://aws-eu-central-1.entire.io/et/forgix/forgix`)
- **Date** : 2026-11-16

---

## 1. Objectif, périmètre et critères de succès

Automatiser la détection et la proposition hebdomadaire des mises à jour de dépendances du dépôt `forgix` via Renovate, en respectant l'hébergement natif Entire (`server-side merge only` sur `main`) et la CI Buildkite ([.buildkite/pipeline.yml](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.buildkite/pipeline.yml)).

### Périmètre inclus

- Configuration Renovate déclarative à la racine ([renovate.json](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/renovate.json)) couvrant :
  - les packages npm/Bun ([package.json](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/package.json), [plugins/forgix/package.json](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/plugins/forgix/package.json), [bun.lock](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/bun.lock)) ;
  - les versions de runtimes épinglées ([.bun-version](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.bun-version), [.node-version](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.node-version)) ;
  - les outils CI épinglés dans [.buildkite/pipeline.yml](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.buildkite/pipeline.yml) (`GIT_CLIFF_VERSION`).
- Script d'application et de publication de Trail (`scripts/renovate-sync.ts`) exécuté par un build Buildkite planifié hebdomadaire.
- Tests unitaires du script de synchronisation (`test/renovate-sync.test.ts`).

### Hors périmètre

- Réintroduction d'un miroir GitHub/Gitea/Forgejo ou de `.github/dependabot.yml`.
- Automerge des mises à jour (tous les Trails Renovate exigent une revue et un merge humain via `entire trail merge`).
- Modification des fixtures de test (`plugins/forgix/test/fixtures/**`) et des archives documentaires (`docs/**`).

### Critères de succès

1. `renovate.json` est valide et `renovate --platform=local --report-type=file` extrait sans erreur les dépendances des 3 familles ciblées, en ignorant `plugins/forgix/test/fixtures/**` et `docs/**`.
2. Un run sans mise à jour disponible se termine en succès (`exit 0`) sans créer ni modifier de branche ni de Trail.
3. Un run avec mises à jour disponibles applique les nouvelles versions, régénère `bun.lock` via `bun install`, valide `bun run check`, committe en Conventional Commits conforme à [fluidise.toml](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/fluidise.toml), pousse la branche `chore/renovate-deps` et crée ou met à jour un unique Entire Trail ouvert ciblant `main` (sans doublon).
4. En cas d'échec de `bun install` ou de `bun run check`, le script échoue explicitement sans pousser de branche cassée ni créer de Trail.
5. `bun run check` passe sur le dépôt après ajout de la configuration, du script et des tests.

---

## 2. Contrats et contraintes du dépôt

- **Protection serveur (`main`)** : `main` est protégée en `server-side merge only` ([2026-11-16-entire-branch-protection.md](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/docs/forgix/2026-11-16-entire-branch-protection.md)). Les branches `chore/*` sont créables, poussables et mergeables via Entire Trail.
- **Politique de commit** : [fluidise.toml](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/fluidise.toml) impose Conventional Commits (titre `<= 100` caractères) et [docs/git-workflow.md](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/docs/git-workflow.md) interdit tout trailer `Co-authored-by:` ou mention d'attribution automatisée.
- **Qualité TypeScript et formatage** :
  - [tsconfig.json](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/tsconfig.json) inclut `scripts/**/*.ts` avec `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
  - [vite.config.ts](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/vite.config.ts) applique `vp fmt --check .` (incluant `renovate.json`, `scripts/*.ts`, `test/*.ts`) et `vp lint .` (avec `denyWarnings: true`).
- **Contrainte technique Renovate (`--platform=local`)** : Renovate ne possède pas de plateforme `entire` native. Sa plateforme `local` est expérimentale et s'exécute uniquement en mode `dryRun=lookup` : elle interroge les registres et écrit un rapport JSON (`--report-type=file --report-path=...`), mais **ne modifie pas les fichiers sur disque** et n'ouvre ni branche ni PR.

---

## 3. Décisions de conception

### D1 — Renovate CLI en mode `local` + script `scripts/renovate-sync.ts`

- **Décision** : Utiliser `renovate --platform=local --report-type=file --report-path=<tmp>/renovate-report.json` pour la détection et la résolution de versions, puis appliquer les mises à jour dans `scripts/renovate-sync.ts`.
- **Justification** : Conserve toute l'intelligence de résolution Renovate (registres npm, `endoflife-date` / `node-version` / `github-releases` selon le datasource, contraintes `packageRules`, `ignorePaths`) dans un `renovate.json` standard, tout en palliant le fait que `--platform=local` n'écrit pas sur disque.
- **Alternative écartée** : Un miroir GitHub/Gitea/Forgejo dédié pour utiliser la plateforme native Renovate a été écarté afin de ne pas réintroduire d'infrastructure GitHub après [2026-11-16-remove-github-references.md](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/docs/forgix/2026-11-16-remove-github-references.md).
- **Compromis** : Absence du Dependency Dashboard interactif (cases à cocher, rebase sur commentaire) propre aux forges supportées nativement par Renovate.

### D2 — Orchestration Buildkite via `build.source == "schedule"`

- **Décision** : Ajouter un step `renovate-sync` conditionné par `if: build.source == "schedule"` dans [.buildkite/pipeline.yml](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.buildkite/pipeline.yml), et conditionner les steps de validation normaux (`quality-gate`, `runtime-smoke`, `release-contract`, `npm-publish`) par `if: build.source != "schedule"` (combiné aux conditions existantes, ex. `build.tag`).
- **Justification** : Centralise toute la configuration CI dans un unique fichier versionné et évite que le build planifié sur `main` ne duplique inutilement la gate déjà exécutée sur les Trails. Le push de la branche `chore/renovate-deps` déclenchera ensuite le pipeline Buildkite standard sur cette branche.
- **Prérequis d'exécution CI** :
  - `scripts/renovate-sync.ts` n'importe aucune dépendance npm tierce (modules natifs `node:*` uniquement), ce qui permet son exécution sans `node_modules` lorsque aucune mise à jour n'est disponible.
  - Si des mises à jour sont détectées, le script exécute `bun install` (qui installe `node_modules` et met à jour `bun.lock`) avant `bun run check`.
  - Le step Buildkite (ou le script) exécute `git fetch origin` au démarrage (un checkout Buildkite étant en `HEAD` détaché sans refs distantes à jour) et passe une identité Git dédiée au commit (`git -c user.name=... -c user.email=... commit`, sans trailer `Co-authored-by:`).
- **Invocation de Renovate** : Exécuter `bunx renovate@<version-épinglée>` dans le step Buildkite (via variable `RENOVATE_VERSION` épinglée dans `.buildkite/pipeline.yml`, elle-même gérable par Renovate), sans ajouter `renovate` aux `devDependencies` du dépôt pour ne pas alourdir `bun.lock` ni `bun install` pour les contributeurs.

### D3 — Branche unique `chore/renovate-deps` et idempotence du Trail Entire

- **Décision** : Regrouper toutes les mises à jour hebdomadaires dans une branche dédiée `chore/renovate-deps` basée sur `origin/main` et liée à un unique Trail ouvert.
- **Comportement** :
  1. Exécuter `git fetch origin` puis réinitialiser la branche locale `chore/renovate-deps` depuis `origin/main` (`git checkout -B chore/renovate-deps origin/main`) afin d'éviter les conflits d'accumulation d'une semaine sur l'autre.
  2. Appliquer les mises à jour issues du rapport JSON Renovate (écrit dans `os.tmpdir()`), exécuter `bun install`, puis valider avec `bun run check` (qui recompile notamment `plugins/forgix/dist/forgix.mjs` si les dépendances du plugin ont changé).
  3. Vérifier s'il existe un changement réel :
     - si l'arbre de travail est identique à `origin/main`, sortir en succès (`exit 0`, aucun commit/push/Trail) ;
     - si `origin/chore/renovate-deps` existe déjà et que son arbre (`git diff --quiet origin/chore/renovate-deps`) est identique à l'état courant après application et build, sortir en succès sans recréer de commit ni re-déclencher de build CI ou de commentaire redondant.
  4. Sinon, indexer explicitement les fichiers modifiés du périmètre (y compris `plugins/forgix/dist/forgix.mjs` si modifié par `bun run check`), committer avec le message `chore(deps): update weekly dependencies` et un corps listant chaque dépendance mise à jour (`nom: ancienne -> nouvelle`).
  5. Pousser la branche avec `git push --force-with-lease origin chore/renovate-deps` (gère aussi bien une branche existante sur un Trail ouvert qu'une branche orpheline issue d'un échec antérieur), puis consulter `entire trail list --json` :
     - si aucun Trail ouvert n'est lié à `chore/renovate-deps`, créer le Trail via `entire trail create --title "chore(deps): update weekly dependencies" --type task --base main --branch chore/renovate-deps --body "<tableau récapitulatif>" --json` (conforme à l'ordre `git push` puis `entire trail create` de [docs/git-workflow.md](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/docs/git-workflow.md)) ;
     - si un Trail ouvert existe déjà sur `chore/renovate-deps`, ajouter un commentaire récapitulatif via `entire trail comment`.
- **Compromis** : Le force-push hebdomadaire sur `chore/renovate-deps` écrase l'état non mergé de la semaine précédente au profit d'un lot propre basé sur `main`.

### D4 — Configuration `renovate.json` et règles d'application

- **Managers activés** :
  - `bun` (natif Renovate pour `package.json`, `plugins/forgix/package.json`, `bun.lock`).
  - `custom.regex` pour :
    - [.bun-version](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.bun-version) (datasource `github-releases` ou `npm` sur `oven-sh/bun` / `bun`) ;
    - [.node-version](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.node-version) (datasource `node-version` sur `node`) ;
    - `GIT_CLIFF_VERSION` (et `RENOVATE_VERSION` si épinglée) dans [.buildkite/pipeline.yml](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.buildkite/pipeline.yml) (datasource `github-releases` sur `orhun/git-cliff`, `renovatebot/renovate`).
- **Exclusions (`ignorePaths`)** : `plugins/forgix/test/fixtures/**`, `docs/**`, `.worktrees/**`.
- **Garde-fou Node (`packageRules`)** : désactiver les mises à jour majeures sur [.node-version](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.node-version) (`matchFileNames: [".node-version"]`, `matchUpdateTypes: ["major"]`, `enabled: false`) tant que [.buildkite/pipeline.yml](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.buildkite/pipeline.yml) épingle `26.*`.
- **Application dans `scripts/renovate-sync.ts`** :
  - Lire le rapport JSON Renovate (`repositories.local.packageFiles`).
  - Pour les fichiers `package.json` (`bun` manager) : mettre à jour les champs ciblés (`dependencies`, `devDependencies`, `packageManager`) avec `newValue`, puis exécuter `bun install` (sans `--frozen-lockfile`) pour mettre à jour `bun.lock`.
  - Pour les fichiers texte/YAML (`.bun-version`, `.node-version`, `.buildkite/pipeline.yml`) : remplacer exactement la valeur `currentValue` par `newValue` (en vérifiant qu'une seule occurrence attendue correspond, sinon échouer explicitement).
  - Si un fichier `package.json` a `packageManager` ou `.bun-version` mis à jour, conserver l'alignement entre `.bun-version` et le champ `packageManager` (`bun@<version>`) des deux `package.json`.

---

## 4. Frontières de modification

Lors de l'implémentation (hors périmètre de ce document de design), seuls les fichiers suivants seront créés ou modifiés :

- **Création** :
  - `renovate.json` — configuration déclarative Renovate.
  - `scripts/renovate-sync.ts` — lecture du rapport JSON Renovate, application des mises à jour, validation `bun run check`, gestion git/Entire Trail.
  - `test/renovate-sync.test.ts` — tests unitaires sur le parsing du rapport Renovate, l'application déterministe des versions, la gestion des cas vides et des erreurs (sans appel réseau réel).
- **Modification** :
  - [.buildkite/pipeline.yml](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.buildkite/pipeline.yml) — ajout du step `renovate-sync` sur `build.source == "schedule"` et garde `if: build.source != "schedule"` sur les steps existants.
  - Les fichiers cibles mis à jour automatiquement lors des runs hebdomadaires (`package.json`, `plugins/forgix/package.json`, `bun.lock`, `.bun-version`, `.node-version`, `.buildkite/pipeline.yml`, et `plugins/forgix/dist/forgix.mjs` lorsqu'il est reconstruit par `bun run check`). Le rapport temporaire Renovate est écrit dans `os.tmpdir()` (aucune modification de `.gitignore` requise).

---

## 5. Risques, prérequis opérationnels et vérifications

### Risques et mitigations

1. **Format du rapport JSON Renovate (`--report-type=file`)** : option marquée expérimentale dans Renovate ; un changement de schéma entre versions de Renovate casserait le parser.
   - _Mitigation_ : épingler la version de Renovate (`RENOVATE_VERSION`) et valider strictement la structure attendue dans `scripts/renovate-sync.ts` avec erreur explicite si le schéma diverge.
2. **Désalignement `.bun-version` / `packageManager` ou `.node-version` / `engines.node`** : une mise à jour majeure de Node (ex. `27.x`) casserait `quality-gate` qui vérifie `26.*` dans [.buildkite/pipeline.yml](file:///Users/acrazie/.gemini/antigravity/worktrees/forgix/add_renovate_bot/.buildkite/pipeline.yml).
   - _Mitigation_ : interdire les mises à jour majeures de `.node-version` dans `renovate.json` (`enabled: false` sur `major`), et maintenir `.bun-version` synchronisé avec `packageManager` dans `scripts/renovate-sync.ts`.
3. **Authentification Entire et droits push côté Buildkite** : l'agent Buildkite doit disposer d'un contexte/token Entire valide pour exécuter `git push` et `entire trail create` / `entire trail list`.
   - _Prérequis manuel_ : configurer la planification hebdomadaire dans l'interface Buildkite (cron sur `main`) et vérifier les credentials Git/Entire de l'agent Buildkite.
4. **Échec partiel push vs Trail** : si `git push` réussit mais `entire trail create` échoue, la branche existe sur le serveur sans Trail associé.
   - _Mitigation_ : propager l'erreur (build Buildkite en échec visible) et réutiliser `--idempotency-key` / `entire trail link` lors du prochain run ou manuellement.

### Vérifications attendues à l'implémentation

- `bunx renovate@<version> --platform=local --report-type=file --report-path=/tmp/renovate-report.json` (dry-run réel sur le dépôt pour valider `renovate.json` et les `customManagers`).
- `bun test test/renovate-sync.test.ts` (tests unitaires couvrant : rapport vide, mise à jour npm + `custom.regex`, rejet de rapport invalide, échec si `bun run check` échoue).
- `bun run check` (formatage `vp fmt`, lint `vp lint`, typecheck `tsc`, tests outils et plugin).
- Validation manuelle d'un premier build planifié Buildkite sur `main` après merge.

---

<!-- review-metadata:start -->

## 6. État de revue et approbation

- **Révision du corps substantiel** : sections 1 à 5 (avant `<!-- review-metadata:start -->`), SHA-256 `a6d77a58cf548061fac15f40ffe146e457247910a806c3537a47d179f9dbae7e`.
- **Couverture de revue** :
  - Passe 1 (`egm-design-critic`, contexte frais sur digest `dfc0f3c1...`) : 3 `Major` et 2 `Nit` identifiés.
  - Passe 2 — revalidation ciblée (`egm-design-critic`, contexte frais sur digest `a6d77a58...`) : les 3 `Major` et 2 `Nit` sont résolus ; 0 `Blocker`, 0 `Major`.
- **Limites de preuve** : revue documentaire en lecture seule (aucune exécution réelle de `renovate --platform=local --report-type=file` ni de `entire trail create` à ce stade).
- **Point mineur ouvert (`Nit`)** : en cas d'échec partiel antérieur (`git push` réussi, `entire trail create` échoué) suivi d'une semaine sans nouvelle mise à jour, le court-circuit no-op (`git diff --quiet origin/chore/renovate-deps`) sort avant la vérification `entire trail list --json` (le premier échec reste visible dans Buildkite et récupérable manuellement via `entire trail link`).
- **Approbation humaine** : approuvé le 2026-11-16 pour la révision `a6d77a58cf548061fac15f40ffe146e457247910a806c3537a47d179f9dbae7e` (n'autorise pas l'implémentation ni la publication sans mandat distinct).

<!-- review-metadata:end -->

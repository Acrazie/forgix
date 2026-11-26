# Spec : Automatisation des releases du paquet à chaque merge sur `main`

Date : 2026-11-26

## 1. Point de départ

### Pourquoi

Les releases de `@acrasie/forgix` et des manifests plugins (Codex, Claude Code, Antigravity) reposent aujourd'hui exclusivement sur l'exécution manuelle locale de `bun run release` (`scripts/release.ts`) depuis un poste mainteneur sur `main`. Tant qu'un mainteneur n'exécute pas cette commande, les changements mergés sur `main` ne sont pas publiés (au 2026-11-26, 4 commits sont en attente depuis `v4.4.0`, dont `6c981ac feat(init): add $forgix sync and stateless config drift checks`).

De plus, l'algorithme actuel de recommandation de version (`recommendBump()` dans `scripts/release-lib.ts:165-170`) classe tout commit non-`feat` et non-breaking en `patch` (y compris `docs:`, `chore:`, `ci:`, `test:`, `refactor:`), et `scripts/release.ts:217-239` attend la CI via un polling synchrone de 15 minutes incompatible avec un agent Buildkite (risque de deadlock de slots et timeout inférieur à `quality-gate` 15 min + `runtime-smoke` 10 min).

### État actuel

Faits vérifiés le 2026-11-26 :

- **Dépôt canonique et protection de branche** : `origin` pointe sur `entire://aws-eu-central-1.entire.io/et/forgix/forgix` (`git remote -v`). La branche `main` est protégée (`server-side merge only`, historique linéaire 1 parent par commit vérifié sur `git log --first-parent -n 10`) ; tout push direct sur `main` est rejeté (`docs/git-workflow.md:9-10`).
- **Pipeline CI Buildkite + Dagger** : `.buildkite/pipeline.yml` (Dagger `0.21.11`, `.dagger/src/index.ts`, Node `26.8.1`, Bun `1.4.4`, `git-cliff 2.14.1`) tourne sur des **Buildkite Hosted Agents éphémères** (`queue=linux-small`, `hosted: true`, cluster `8020b9ba-d300-41f9-9fd6-2b94c08e8ac2`, vérifié via `bk` `3.71.0`), avec `skip_queued_branch_builds: true` et `cancel_running_branch_builds: true` :
  - Variables webhook vérifiées : build #144 (`main`, `906544f`) émet `BUILDKITE_BRANCH="main"`, `BUILDKITE_TAG=""`, `BUILDKITE_PULL_REQUEST="false"`, `BUILDKITE_SOURCE="webhook"` ; build #142 (tag `v4.4.0`, `43be42a`) émet `BUILDKITE_TAG="v4.4.0"`, `BUILDKITE_BRANCH="v4.4.0"`, `BUILDKITE_PULL_REQUEST="false"`, `BUILDKITE_SOURCE="webhook"`.
  - Secrets et auth vérifiés (2026-11-26) :
    - **Entire OIDC** : Service Account `forgix/buildkite-release` (`svc_01M8CHF4WWEXY2Z6R92SBEJSNC`, rôle `writer` sur le dépôt `forgix`, binding `buildkite` épinglé sur `{"organization":"acrazie","pipeline":"forgix"}`, serveur d'auth `eu.auth.entire.io`) — aucun secret Entire statique à stocker.
    - **GitHub miroir** : secret Buildkite Cluster `GITHUB_MIRROR_TOKEN` présent dans le cluster `8020b9ba-d300-41f9-9fd6-2b94c08e8ac2` (`bk api /clusters/8020b9ba-d300-41f9-9fd6-2b94c08e8ac2/secrets`).
  - `renovate-sync` (`if: build.source == "schedule"`, `concurrency: 1`, `concurrency_group: forgix-renovate`), qui pousse une branche sur `origin` et appelle `entire trail create` (`.buildkite/pipeline.yml:9-31`, `scripts/renovate-sync.ts:582-633`).
  - `quality-gate` (`timeout_in_minutes: 15`) : `dagger call check`, `diff-gate` hors tag, `release-candidate` sur tag `v*`, `pack-runtime` hors tag (`.buildkite/pipeline.yml:33-76`).
  - `formal-lean` (15 min) et `formal-tla` (5 min), tous deux `soft_fail: true` hors tag (`.buildkite/pipeline.yml:78-105`).
  - `runtime-smoke` (`timeout_in_minutes: 10`, dépend de `quality-gate`) : `scripts/release-smoke.sh` sur tag `v*`, `dagger call runtime-smoke` sinon (`.buildkite/pipeline.yml:106-124`).
  - `release-contract` (`timeout_in_minutes: 15`) : `dagger call release-contract` (`.buildkite/pipeline.yml:126-136`).
- **Périmètre d'une release unifiée** : une release met à jour exactement les 8 chemins de `ALLOWED_RELEASE_PATHS` (`scripts/release-lib.ts:46-55`) : `package.json`, `bun.lock`, `.codex-plugin/plugin.json` (`X.Y.Z+codex.YYYYMMDDhhmmss`), `.claude-plugin/plugin.json`, `plugin.json`, `.claude-plugin/marketplace.json`, `dist/forgix.mjs`, `CHANGELOG.md` (via `git-cliff 2.14.1` et `cliff.toml`). Les tests existants `bun run release:test` passent (22/22 sur 3 fichiers).
- **Conventional Commits** : CLINT (`fluidise.toml:1-18`) impose les types `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` sur tous les commits.
- **Miroir GitHub et publication npm** : `Acrazie/forgix` (`gh repo view Acrazie/forgix`) est synchronisé par `scripts/sync-github-mirror.ts`, qui sauvegarde et restaure `.github/` exclusivement présent sur le miroir. `.github/workflows/release.yml` (lu via `gh api`) se déclenche sur `push: tags: ["v*"]`, vérifie `package.json.version === TAG#v`, exécute `test/runtime/runtime-smoke.test.mjs`, publie `@acrasie/forgix` via npm Trusted Publishing (OIDC) dans `environment: release`, et crée la GitHub Release. L'environnement GitHub `release` ne comporte que `branch_policy` (aucun reviewer bloquant, vérifié via `gh api repos/Acrazie/forgix/environments/release`). Buildkite ne détient aucun token npm (`docs/runbooks/maintainer-release.md:108`).
- **Gouvernance actuelle** : `.buildkite/pipeline.yml` et `.dagger/**` sont des `Protected Surface`s (`docs/golden-rules.md:190`, `.forgix/config.yaml:40-41`). `docs/git-workflow.md:120` exige aujourd'hui une confirmation humaine pour tout `entire trail merge` et tout push de tag ; `.forgix/config.yaml:4` fixe `merge: never` pour les agents locaux.
- **Pièges identifiés** :
  - `scripts/release.ts:92` exige la branche `main` checkée (Buildkite vérifie souvent un `HEAD` détaché) et n'ajoute pas `-c commit.gpgsign=false` / `-c tag.gpgSign=false`.
  - Un checkout Buildkite shallow casse `previousTag()` (`.buildkite/pipeline.yml:53, 60`).
  - `cancel_running_branch_builds: true` sur le pipeline `forgix` peut annuler le build `main` d'un commit `chore(release): vX.Y.Z` si un nouveau merge arrive avant que Phase 3a n'ait poussé le tag `vX.Y.Z` : Phase 1/3a doit donc détecter et taguer un éventuel commit `chore(release): vX.Y.Z` ancêtre non tagué avant de calculer le bump suivant.
  - Les Hosted Agents étant éphémères, le CLI `entire` doit être installé (ou vérifié) dans les steps qui l'invoquent, et `GITHUB_MIRROR_TOKEN` ne doit jamais apparaître dans les logs ni dans l'URL git stockée en config.
- **Éléments vérifiés / restant à valider sur le premier run live** :
  - **I could not verify this** : si l'échange OIDC Buildkite (`buildkite-agent oidc request-token --audience https://eu.auth.entire.io/api/authz/sts`) avec le Service Account `forgix/buildkite-release` déclenche bien le webhook Buildkite lorsqu'il pousse `release/v*` et `refs/tags/v*`, et si aucune règle Entire sur `main` n'exige un reviewer humain distinct sur `release/v*`. _Conséquence_ : Phase 2 ou Phase 3b ne se déclencherait pas automatiquement. _Comportement sûr en attendant_ : valider sur le premier run live (`v4.5.0`) et stopper en cas de blocage.

### Première tâche, avant tout code

1. Re-vérifier les faits porteurs : `bk api /clusters/8020b9ba-d300-41f9-9fd6-2b94c08e8ac2/secrets` liste `GITHUB_MIRROR_TOKEN`, `entire service-account bindings forgix/buildkite-release` liste le binding `buildkite`, `bun run release:test` passe, et `gh api repos/Acrazie/forgix/environments/release` n'a aucun reviewer bloquant.
2. Vérifier le mécanisme exact d'échange OIDC Buildkite → `entire` CLI / `git-remote-entire` (`ENTIRE_TOKEN` ou endpoint STS `eu.auth.entire.io/api/authz/sts`) avant d'écrire les steps `.buildkite/pipeline.yml`.
3. Si l'un des prérequis échoue, **stopper immédiatement et rapporter**.

---

## 2. Objectifs et hors-périmètre

### Objectifs

1. **Calcul de bump filtré sur `main`** : à chaque merge sur `main`, déterminer le bump SemVer à partir des commits depuis le dernier tag `vX.Y.Z` sur `--first-parent` :
   - `!:` dans l'en-tête ou footer `BREAKING CHANGE:` → `major` ;
   - `feat` → `minor` ;
   - `fix`, `perf`, `revert` → `patch` ;
   - uniquement `docs`, `chore`, `ci`, `test`, `refactor`, `style`, `build` → `none` (aucune release).
2. **Préparation automatisée sans polling (Phase 1)** : sur `main` (commit non-release, bump ≠ `none`), préparer de façon idempotente la branche `release/vX.Y.Z` (mise à jour des 8 chemins autorisés dont `CHANGELOG.md` via `git-cliff 2.14.1` et `dist/forgix.mjs`) et ouvrir ou mettre à jour l'Entire Trail correspondant.
3. **Auto-merge conditionnel (Phase 2)** : sur `release/v*`, une fois `quality-gate`, `runtime-smoke` et `release-contract` verts, exécuter automatiquement `entire trail merge --branch release/vX.Y.Z --delete-branch` pour `patch` et `minor` ; pour `major`, ne jamais auto-merger et laisser le Trail ouvert pour validation et merge humain.
4. **Tag idempotent et garde anti-boucle (Phase 3a)** : sur `main`, lorsque `HEAD` est un commit `chore(release): vX.Y.Z`, vérifier si `refs/tags/vX.Y.Z` existe sur `origin` ; s'il existe, sortir en `0` sans effet (anti-boucle) ; s'il est absent, créer et pousser le tag annoté `vX.Y.Z` sur `origin` (reprise idempotente).
5. **Publication via miroir après validation tag (Phase 3b)** : sur un build Buildkite de tag `v*`, après succès de `quality-gate` (`release-candidate`) et `runtime-smoke` (`scripts/release-smoke.sh`), synchroniser `main` + `vX.Y.Z` vers `Acrazie/forgix` via `scripts/sync-github-mirror.ts --apply` pour déclencher `.github/workflows/release.yml` (npm OIDC + GitHub Release).

### Hors-périmètre (Non-goals)

- **Publication npm directe depuis Buildkite** : `.github/workflows/release.yml` (npm Trusted Publishing OIDC) reste l'unique éditeur npm ; Buildkite ne détient aucun token npm.
- **Canaux prerelease (`alpha`, `beta`, `rc`)** : seuls les tags stables `vX.Y.Z` sont gérés.
- **Suppression ou refonte de `bun run release`** : conservé tel quel en secours manuel local.
- **Synchronisation du miroir GitHub sur les commits non-releasables** : `Acrazie/forgix` reste aligné sur le dernier tag `vX.Y.Z` publié afin que les installations plugin depuis `main` GitHub ne reçoivent pas de commits non releasés.
- **Exécution des pistes formelles (`formal-lean`, `formal-tla`) sur `release/v*` et `chore(release):`** : sautées sur ces commits de release pour limiter l'amplification CI (`quality-gate`, `runtime-smoke` et `release-contract` restent bloquants).

---

## 3. Contraintes

### Invariants

| Invariant                                                                                                                                                                                     | Où il est appliqué / détecté                                                                    | Type              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| Respect des Golden Rules (`docs/golden-rules.md` sections 1–6 : `scripts/** <= 400 LOC`, fonctions `<= 60 LOC`, CC/Cog `<= 15`, zéro `dependencies`, diff→test pairing)                       | `bun run check`, `bun run check:diff`, `dagger call check --source=.`                           | Machine           |
| `main` reste `server-side merge only` (aucun push direct sur `main`)                                                                                                                          | Protection serveur Entire + pipeline Phase 1/2 via Trail                                        | Machine           |
| `.forgix/config.yaml` (`merge: never`) reste strictement intact pour tous les agents IA locaux                                                                                                | `src/core/config.ts` + tests config + revue `Protected Surface`                                 | Machine + Humain  |
| Seuls les 8 fichiers de `ALLOWED_RELEASE_PATHS` peuvent être modifiés par un commit `chore(release): vX.Y.Z`                                                                                  | `unexpectedReleasePaths()` dans `scripts/release-lib.ts` + tests `release:test`                 | Machine           |
| Un bump `major` (`next.major > prev.major`) n'est jamais auto-mergé par la CI                                                                                                                 | Garde explicite Phase 2 + test d'intégration `release:test`                                     | Machine           |
| Aucune boucle infinie sur `chore(release): vX.Y.Z` et reprise idempotente si le tag manque                                                                                                    | Machine à états Phase 3a + tests d'intégration `release:test`                                   | Machine           |
| Historique complet (`--unshallow` + `--tags`) avant tout calcul `previousTag()`                                                                                                               | Steps Buildkite Phase 1 et Phase 3a                                                             | Machine           |
| Préservation de `.github/` (copie unique) lors de chaque synchro vers `Acrazie/forgix`                                                                                                        | `replaceMirrorTree()` dans `scripts/sync-github-mirror.ts` + test `release-preparation.test.ts` | Machine           |
| Identité bot CI déterministe (`forgix-release[bot]` / `forgix-release[bot]@users.noreply.entire.io`) et commits/tags non signés GPG en CI (`-c commit.gpgsign=false`, `-c tag.gpgSign=false`) | Configuration des steps CI + tests d'intégration                                                | Machine           |
| Modification des `Protected Surface`s (`.buildkite/pipeline.yml`, `.dagger/**`) soumise à revue humaine (`Human-Reviewed`)                                                                    | `docs/git-workflow.md` section 5                                                                | Humain (revue PR) |

### Stop and ask / Left to the agent

- **Stop and ask** : si un des 3 prérequis Buildkite/Entire/GitHub de la première tâche échoue, si l'agent Buildkite nécessite un nouveau secret/clé non provisionné, ou si une règle de `docs/golden-rules.md` ou de `scripts/release-ci.ts` entre en conflit avec l'environnement Buildkite réel.
- **Left to the agent** : découpage et nommage des modules sous `scripts/` (en respectant `<= 400 LOC` / `<= 60 LOC` par fonction), clés et labels exacts des steps dans `.buildkite/pipeline.yml`, exposition éventuelle d'une fonction Dagger pour préparer les fichiers de release avec `git-cliff 2.14.1`, et organisation des helpers dans `test/integration/`.

### Permissions

| Acteur                                                                                                                                       | `entire trail merge` (`release/v*` patch/minor) | `entire trail merge` (`release/v*` major / autres) | Push tag `v*` (Entire) | Push miroir `Acrazie/forgix` | Publish npm |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- | ---------------------- | ---------------------------- | ----------- |
| Mainteneur humain                                                                                                                            | Oui (secours)                                   | **Oui (seul)**                                     | Oui (secours)          | Oui (secours)                | Non (OIDC)  |
| Agent IA local                                                                                                                               | **Non** (`merge: never`)                        | **Non** (`merge: never`)                           | **Non**                | **Non**                      | **Non**     |
| Buildkite `main` / `release/v*` (OIDC → Service Account `forgix/buildkite-release`, rôle `writer`)                                           | **Oui**                                         | **Non**                                            | **Oui** (Phase 3a)     | **Non**                      | **Non**     |
| Buildkite tag `v*` vérifié ancêtre de `origin/main` (`GITHUB_MIRROR_TOKEN` via Cluster Secret, HTTPS `contents: write` sur `Acrazie/forgix`) | **Non**                                         | **Non**                                            | **Non**                | **Oui** (Phase 3b)           | **Non**     |
| GitHub Actions `release.yml` (npm OIDC + `GITHUB_TOKEN`)                                                                                     | **Non**                                         | **Non**                                            | **Non**                | **Non**                      | **Oui**     |

Processus porteurs de credentials : aucun step Buildkite portant un accès write Entire ou GitHub n'exécute d'entrée non fiable ; Phase 1/3a ne tournent que sur `main`, Phase 2 uniquement sur `release/v*`, et Phase 3b uniquement sur un tag `v*` vérifié ancêtre de `origin/main` par `scripts/release-ci.ts` (`assertContext` + `merge-base --is-ancestor`).

### Entrypoints

Chaque effet irréversible a un propriétaire unique :

1. **Buildkite Phase 1 (`main`, commit non-release, `concurrency: 1`, `concurrency_group: forgix-release-prepare`)** :
   - _Refuse / no-op_ : `BUILDKITE_TAG` non vide, `BUILDKITE_PULL_REQUEST` actif, `BUILDKITE_COMMIT != origin/main` après `git fetch origin main` (merge plus récent déjà en cours), ou bump filtré == `none`.
   - _Cas limites_ :
     - `v4.4.0..HEAD` = `[docs(specs):, feat(init):, fix(init):, fix(init):]` → `minor` → ouvre `release/v4.5.0`.
     - `v4.5.0..HEAD` = `[docs(readme):, chore(deps):]` → `none` → exit `0`, aucun Trail.
     - Merge concurrent B après A pendant que `release/v4.5.0` est ouvert et obsolète → le build de A s'arrête si `BUILDKITE_COMMIT != origin/main` ; le build de B recalcule sur `origin/main` et met à jour ou remplace la branche/Trail de release obsolète.
2. **Buildkite Phase 2 (`release/v*`, après `quality-gate` + `runtime-smoke` + `release-contract`)** :
   - _Propriétaire unique de `entire trail merge --delete-branch` pour `patch`/`minor`_.
   - _Refuse / no-op_ : si la version cible est un `major` (`next.major > prev.major` par rapport au dernier tag `v*` sur `origin/main`) → log explicite et exit `0` sans merger (le mainteneur humain merge manuellement après revue).
3. **Buildkite Phase 3a (`main`, `HEAD` ou ancêtre récent avec sujet `^chore\(release\): (v\d+\.\d+\.\d+)$` non tagué)** :
   - _Propriétaire unique du tag annoté `vX.Y.Z` sur Entire_.
   - _Cas limites_ :
     - `HEAD` est `chore(release): vX.Y.Z` et le tag `vX.Y.Z` existe déjà sur `origin` → exit `0` immédiat (garde anti-boucle).
     - `HEAD` est `chore(release): vX.Y.Z` (ou un ancêtre récent non tagué suite à `cancel_running_branch_builds: true`) et le tag `vX.Y.Z` est absent sur `origin` → vérifie `validateVersions(root, tag)` sur ce commit, pose et pousse `refs/tags/vX.Y.Z` sur `origin` avant toute nouvelle Phase 1.
4. **Buildkite Phase 3b (tag `v*`, après `quality-gate`/`release-candidate` + `runtime-smoke`)** :
   - _Propriétaire unique de la synchro `main` + `vX.Y.Z` vers `Acrazie/forgix` (préservation de `.github/`)_.
   - Récupère `GITHUB_MIRROR_TOKEN` via `buildkite-agent secret get GITHUB_MIRROR_TOKEN` et appelle `scripts/sync-github-mirror.ts --source-ref <tag> --tag <tag> --apply` en HTTPS sans exposer ni logger le token.
5. **Secours manuel (`bun run release`)** : conservé inchangé pour intervention humaine ou reprise d'urgence.

### Ordre, bascule (cutover) et rollback

- **Ordre strict** : Phase 1 (`main` → Trail `release/vX.Y.Z`) → Phase 2 (`release/v*` CI verte → merge si `patch`/`minor`, pause humaine si `major`) → Phase 3a (`main` `chore(release):` → tag `vX.Y.Z` sur Entire) → Phase 3b (tag `v*` `release-candidate` + `runtime-smoke` → sync miroir GitHub) → GitHub Actions `release.yml` (npm OIDC + GitHub Release). Compresser Phase 2 dans Phase 1 via polling réintroduirait le deadlock d'agents Buildkite et dépasserait le timeout de 15 min ; sauter Phase 3b court-circuiterait `release-candidate` + `runtime-smoke`.
- **Cutover** : au merge de la PR d'implémentation sur `main`, le backlog actuel (4 commits depuis `v4.4.0` dont `feat(init):`) déclenche automatiquement la première release live `v4.5.0`.
- **Rollback** : avant le push du tag `vX.Y.Z`, fermer/supprimer le Trail `release/vX.Y.Z` ou reverter la PR pipeline. Après publication npm, correction en avant uniquement par un nouveau `patch` (jamais unpublish, réécriture de `main` ni déplacement de tag).

### Promote on merge

Dans la même PR que l'implémentation :

- Créer `docs/adr/0043-automate-package-releases-on-main-merge.md` (pipeline événementiel 3 étapes, filtre Conventional Commits, validation humaine sur `major`, exception CI-bot).
- Mettre à jour `docs/git-workflow.md` (sections 5 et 6) pour inscrire l'exception strictement scopée au pipeline CI Buildkite (`entire trail merge --delete-branch` sur `release/v*` `patch`/`minor` et push de tags `vX.Y.Z`), tout en réaffirmant `merge: never` pour les agents locaux.
- Mettre à jour `docs/runbooks/maintainer-release.md` pour refléter la release automatisée par défaut et le rôle de secours manuel de `bun run release`.

---

## 4. Preuve

### Environnements de vérification

- **Pré-merge (local et Dagger CI)** : `bun test` + dépôts Git bare temporaires (simulant Entire et le miroir GitHub avec `.github/`) + `git-cliff 2.14.1` réel + stub CLI `entire`, exécutés localement (`bun run release:test`, `bun run check`, `bun run check:diff`) et en conteneur (`dagger call release-contract --source=.`, `dagger call check --source=.`).
- **Prérequis environnement live** : vérifiés en première tâche (accès Buildkite Entire merge/tag + push miroir GitHub + payload webhook).

### Matrice de vérification (tous bloquants pour merger)

| #   | Prouve                                                                             | Surface                                             | Vérification                                                                                                                                                              | Où elle tourne                                                     | Signal de succès                              |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| 1   | Objectif 1 & 5 (calcul bump filtré + skip types internes)                          | Fonction de calcul de bump sur historique Git réel  | Tests couvrant chaque type `fluidise.toml` (`!:`, `BREAKING CHANGE:`, `feat`, `fix`, `perf`, `revert`, et skip sur `docs`/`chore`/`ci`/`test`/`refactor`/`style`/`build`) | `bun run release:test` & `dagger call release-contract --source=.` | Exit 0, 100 % des cas passent                 |
| 2   | Objectif 2 (Phase 1 idempotente, tip guard, allowlist)                             | Dépôt Git bare + `git-cliff 2.14.1` + stub `entire` | Tests : création `release/vX.Y.Z` + 8 fichiers valides, no-op sur `none`, no-op si `HEAD != origin/main`, mise à jour d'un Trail obsolète, rejet hors allowlist           | `bun run release:test` & `dagger call release-contract --source=.` | Exit 0, état Git et Trail conformes           |
| 3   | Objectif 3 (Phase 2 auto-merge `patch`/`minor`, blocage `major`)                   | Stub `entire` + dépôt Git bare                      | Tests : appel `entire trail merge --delete-branch` sur `patch` et `minor` ; aucun appel de merge (exit 0) sur `major`                                                     | `bun run release:test` & `dagger call release-contract --source=.` | Exit 0, assertions sur appels `entire`        |
| 4   | Objectif 4 & 5 (Phase 3a anti-boucle / reprise crash + Phase 3b miroir `.github/`) | Dépôts Git bare (Entire + miroir avec `.github/`)   | Tests : exit 0 sans action si tag déjà sur `origin` ; pose + push tag si `chore(release):` sans tag ; synchro miroir préservant `.github/`                                | `bun run release:test` & `dagger call release-contract --source=.` | Exit 0, tag + miroir + `.github/` intacts     |
| 5   | Invariants Golden Rules, lint, types, budgets, parité Dagger                       | Dépôt complet                                       | `bun run check && bun run check:diff && dagger call check --source=.`                                                                                                     | Local + Buildkite CI                                               | Exit 0 sans warning ni régression de baseline |

### Après déploiement (After deploy)

- **Déclencheur** : merge de la PR d'implémentation sur `main`.
- **Vérification live** : observer la chaîne complète sur le backlog actuel → Buildkite Phase 1 ouvre `release/v4.5.0` → Phase 2 auto-merge après CI verte → Phase 3a pousse `v4.5.0` sur Entire → Phase 3b (après `release-candidate` + `runtime-smoke`) synchronise `Acrazie/forgix` → GitHub Actions `release.yml` publie `@acrasie/forgix@4.5.0` sur npmjs et crée la GitHub Release `v4.5.0` ; vérifier enfin que le build `main` suivant sur `chore(release): v4.5.0` sort en no-op (zéro boucle).
- **Condition d'arrêt** : la surveillance post-déploiement s'arrête dès que `@acrasie/forgix@4.5.0` est visible sur npmjs, la GitHub Release `v4.5.0` est créée, et le build `main` du commit `chore(release): v4.5.0` s'est terminé sans nouveau Trail.

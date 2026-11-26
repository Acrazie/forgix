# Spec : `$forgix sync` — Vérification et mise à jour incrémentale de la configuration Forgix

Date : 2026-11-26

## 1. Point de départ

### Pourquoi

Lorsqu'un utilisateur initialise un dépôt avec une version donnée du plugin Forgix (ex. `4.4.0`), puis met à jour le plugin vers une version ultérieure et reprend son travail, la configuration en place peut manquer de nouveaux éléments ou comporter des artefacts obsolètes (commandes hooks d'ateliers, entrées `.gitignore` / `.worktreeinclude`, projections `.forgix/factory/**`, nouvelles capacités `bootstrap`, pin CLI machine-local, ou `.forgix/project.yaml` absent/invalide/obsolète).

Aujourd'hui :

- `forgix init check` est strictement en lecture seule et incomplet (ne vérifie ni le pin CLI, ni la complétude des entrées par défaut de `.worktreeinclude`, ni l'absence/validité/fraîcheur de `.forgix/project.yaml`, ni les nouvelles capacités `bootstrap` absentes).
- Réconcilier la configuration oblige à relancer `$forgix init` (ADR 0042), qui exige que l'agent reconstruise un `InitBootstrapManifest` complet sur `stdin`.

### État actuel (vérifié le 2026-11-26)

- **Version du plugin non exposée au runtime** : `@acrasie/forgix` est en `4.4.0` (`package.json:2-3`, `plugin.json:4`), mais `src/` n'embarque ni ne lit la version du package (`grep -rn "version" src/ scripts/build.mjs`).
- **Schéma de configuration strict** : `schemas/config.schema.json:5-11` impose `additionalProperties: false` et `schemaVersion: 1`. `resolveConfig()` (`src/core/config.ts:69-76, 116-126`) fournit les valeurs par défaut runtime (`DEFAULT_CONFIG`), ce qui permet à `.forgix/config.yaml` d'omettre volontairement les sections optionnelles (`runner`, `roadmap`, etc.).
- **État de `forgix init check`** (`src/init/index.ts:702-933`, sondé via `node dist/forgix.mjs init check`) : retourne `{command: "init_check", status: "ok"|"drift", data: {inSync, findings}}` avec `exit 0` même en cas de dérive. Contrôle `.forgix/config.yaml`, factory drift (`src/init/factory-check.ts`), hooks (`src/init/hooks-config.ts`), `.gitignore` (bloc + `MANDATORY_GITIGNORE_ENTRIES`) et uniquement la présence du bloc `# forgix:start` dans `.worktreeinclude` (pas `DEFAULT_WORKTREE_INCLUDE_ENTRIES`). Pour `.forgix/project.yaml` (`src/init/index.ts:762-769`), ne vérifie que l'absence de symlink/non-fichier.
- **Pin CLI machine-local** : géré par `src/hooks/bundle-identity.ts:23-107` (`$XDG_CONFIG_HOME/forgix/cli-path.<harness>`) et vérifié uniquement par `forgix init check-build <harness>` (`src/init/build-installation.ts:10-40`). Piège observé : `src/init/index.ts:971-975` écrit le même `entrypointPath` pour tous les harnesses de `manifest.harnesses`, risquant d'écraser les pins des autres harnesses en dépôt multi-harness.
- **`SessionStart` hook** (`src/hooks/guards.ts:433-540`) : détecte déjà une dérive légère et émet `Bootstrap drift (...); run \`forgix init check\`.`
- **Protected Surfaces** (`src/core/config.ts:234-251`, `src/hooks/guards.ts:287-338`) : `.forgix/config.yaml` et `.forgix/project.yaml` sont protégés ; sous `hooks.enforcement: strict` (configuration active de Forgix dans `.forgix/config.yaml:20`), les écritures directes par l'agent sont bloquées hors contrat `BUILD`.
- **Budgets et ratchets** (`test/artifact-budget.json`, `.fallowrc.json`, `docs/golden-rules.md`) :
  - `maxPromptBytes` : `23 205 / 24 000` octets (**795 octets** de marge).
  - `skills/forgix/SKILL.md` : `128 / 160` lignes.
  - `src/init/index.ts` (`988` LOC) et `src/hooks/guards.ts` (`553` LOC) sont gelés par `fallow-baselines/file-lines.json` ; tout nouveau module sous `src/**` doit rester `<= 300` LOC (fonctions `<= 60` LOC, CC/Cog `<= 15`).
  - Zones Fallow : `hooks -> [types, core]`, `init -> [types, core, hooks]`, `profile -> [types, core]` (domaines pairs isolés).
- **Environnement local** (sondé le 2026-11-26) : Node `v26.8.1`, Bun `1.4.4`, Dagger (`/opt/homebrew/bin/dagger`). `node_modules` est absent dans le worktree courant.

### Première tâche avant tout code

1. Re-vérifier les faits porteurs ci-dessus (`package.json`, `schemas/config.schema.json`, `src/init/index.ts`, `test/artifact-budget.json`) ; si l'un est faux, s'arrêter et signaler.
2. Installer les dépendances dans le worktree avec `bun install --frozen-lockfile`.

---

## 2. Objectifs et hors-périmètre

### Objectifs

1. Fournir une commande agent dédiée **`$forgix sync`** (Codex : `$forgix sync`, Claude Code : `/forgix:forgix sync`, Antigravity : `/forgix sync`) adossée à des primitives CLI déterministes (**`forgix init check`** enrichi et **`forgix init sync --plan|--apply [--adopt]`** sans manifeste `stdin` requis) pour vérifier et mettre à jour en place une configuration Forgix existante.
2. Détecter de façon **stateless** (par comparaison d'état/capacités, sans ajouter de clé dans `.forgix/config.yaml`) tous les éléments manquants ou obsolètes :
   - hooks d'ateliers configurés (`.codex/hooks.json`, `.claude/settings.json`, `.agents/hooks.json`) ;
   - bloc `.gitignore` et `MANDATORY_GITIGNORE_ENTRIES` ;
   - bloc `.worktreeinclude` et `DEFAULT_WORKTREE_INCLUDE_ENTRIES` ;
   - artefacts `.forgix/factory/**`, projections par harness, bloc `AGENTS.md`, `factoryPolicies` compilées, règles legacy et `managedPaths` orphelins ;
   - nouvelles capacités `bootstrap` introduites par le plugin lorsqu'elles ne sont ni `true` ni `false` (tout en respectant strictement les `false` explicites et les défauts runtime `DEFAULT_CONFIG`) ;
   - pin CLI machine-local du **harness actif uniquement** (séparé des constats versionnés du dépôt) ;
   - `.forgix/project.yaml` (absent, invalide au schéma, ou empreintes sources obsolètes).
3. Appliquer les mises à jour avec **un aperçu consolidé unique et une seule confirmation utilisateur explicite** avant écriture (0 prompt et 0 écriture si déjà à jour), en préservant toutes les valeurs personnalisées, les opt-outs `false` et les hooks tiers.
4. Signaler la dérive dès la reprise de session dans le hook `SessionStart` (léger et non-bloquant) en orientant vers `$forgix sync`.

### Hors-périmètre (Non-goals)

- **Auto-mise à jour réseau du package/binaire Forgix** : viole l'invariant zéro-réseau dans `src/**`.
- **Remplacement de `$forgix init` pour les dépôts vierges** : un dépôt sans `.forgix/config.yaml` est refusé et renvoyé vers `$forgix init`.
- **Wizard interactif dans le terminal humain** : interdit par l'Agent-First Golden Rule (ADR 0037).
- **Stockage d'un champ `pluginVersion` dans `.forgix/config.yaml`** : casserait la validation `additionalProperties: false` sur les machines/CI encore en Forgix `<= 4.4.0`.
- **Blocage de `BUILD` / `PreToolUse` sur dérive mineure de config** : les prérequis critiques de `BUILD` restent gérés par `forgix init check-build`.
- **Création d'un nouveau fichier skill séparé** : superflu et dépasserait la marge de `795` octets sur `maxPromptBytes`.

---

## 3. Contraintes

### Invariants

| Invariant                                                                                                                                                                                                                                             | Où il est appliqué / détecté                                       | Vérification                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| Doit satisfaire **ADR 0037** (Agent-First, JSON `{command, status, data}` sur `stdout`, diagnostics sur `stderr`, `EXIT_CODES` fixes)                                                                                                                 | `src/cli.ts`, `src/init/invocation.ts`, tests CLI & `test:runtime` | Machine                              |
| Doit satisfaire **ADR 0038** / `docs/golden-rules.md` (zéro deps runtime, zéro réseau `src/**`, nouveaux fichiers `<= 300` LOC, fonctions `<= 60` LOC, CC/Cog `<= 15`, non-croissance des monolithes gelés, zones Fallow, `maxPromptBytes <= 24 000`) | `bun run check`, `bun run check:diff`, `bun run check:size`        | Machine                              |
| Doit satisfaire **ADR 0042** (idempotence, blocage par défaut sur `unmanaged_file_collision` sauf `--adopt` après accord, blocage absolu sur `invalid_json`, `invalid_yaml`, `symlink_or_non_file`, marqueurs corrompus)                              | `src/init/` + tests d'intégration `init`                           | Machine                              |
| Rétrocompatibilité `.forgix/config.yaml` avec Forgix `<= 4.4.0` : `additionalProperties: false` conservé, aucune clé de version ajoutée dans `.forgix/config.yaml`                                                                                    | `schemas/config.schema.json` + tests schéma/config                 | Machine                              |
| Respect des opt-outs explicites (`bootstrap.<module>: false`) et des omissions volontaires couvertes par `DEFAULT_CONFIG`                                                                                                                             | Modules `init check` / `init sync` + tests d'intégration           | Machine                              |
| Isolation multi-harness du pin CLI : `init sync --apply` ne met à jour le pin CLI local que pour le harness actif, sans écraser les pins des autres harnesses                                                                                         | `src/init/` + tests unitaires/intégration                          | Machine                              |
| Toutes les écritures sur `.forgix/config.yaml`, `.forgix/project.yaml` et artefacts bootstrap passent par les primitives CLI déterministes (jamais d'édition directe agent, évitant le blocage `Protected Surface` sous `strict`)                     | `skills/forgix/SKILL.md` + `src/init/` + `src/profile/`            | Machine (CLI) / Humain (revue skill) |

### Compatibilité

- **Posture :** 100 % rétrocompatible et additif.

| Surface                                | Avant                                               | Après                                                                                                            |
| -------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `forgix init check`                    | Sortie `{command: "init_check", status: "ok"        | "drift", data: {inSync, findings}}`, `exit 0`                                                                    | Même contrat de base (`exit 0` par défaut), enrichi avec `pluginVersion`, séparation des constats repo vs local (pin CLI), vérification des entrées par défaut `.worktreeinclude` et état `project.yaml` ; flag optionnel `--strict` retournant un code non-zéro sur dérive **repo** (CI-safe) |
| `forgix init plan\|apply\|check-build` | Inchangé                                            | Inchangé                                                                                                         |
| `$forgix init`                         | Onboarding + réconciliation complète (ADR 0042)     | Inchangé                                                                                                         |
| `SessionStart`                         | `Bootstrap drift (...); run \`forgix init check\`.` | Oriente vers `$forgix sync` (en plus de `forgix init check`) sur dérive détectée, toujours léger et non-bloquant |

### Entrypoints et propriétaires d'effets irréversibles

- **`$forgix sync`** (`/forgix:forgix sync`, `/forgix sync`) :
  - Exécute en lecture seule `forgix init check`, `forgix init sync --plan` et `forgix project-profile inspect`.
  - Si `.forgix/config.yaml` est absent : refuse sans écrire et oriente vers `$forgix init`.
  - Si déjà à jour (`inSync: true`, aucune opération planifiée, `project.yaml` présent/valide/à jour) : rapporte « déjà à jour » (0 prompt, 0 écriture).
  - Si conflits de sécurité bloquants : stoppe sans écrire.
  - Sinon : présente **un aperçu consolidé unique** (actions bootstrap/config/hooks/pin + mises à jour proposées pour `project.yaml` + diffs des éventuelles `unmanaged_file_collision`) et demande **une seule confirmation explicite**.
  - Après approbation : exécute `forgix init sync --apply` (avec `--adopt` uniquement si l'utilisateur a approuvé les collisions), puis `forgix project-profile publish` uniquement si le profil a changé.
- **`forgix init check [--strict]`** : lecture seule. Sans `--strict`, sort toujours `0` (même sur `status: "drift"`). Avec `--strict`, sort non-zéro uniquement si des constats **repo** existent (ignore le pin CLI machine-local pour la CI).
- **`forgix init sync --plan [--adopt]`** : lecture seule, sans `stdin`. Refuse si `.forgix/config.yaml` est absent (`config_missing`). Reconstruit l'état cible depuis `.forgix/config.yaml` + `.forgix/factory/**` + attentes de la version courante du plugin.
- **`forgix init sync --apply [--adopt]`** : **propriétaire unique** de l'écriture atomique (sous verrou `.forgix/init/apply.lock.sqlite` + rollback best-effort) des fichiers repo gérés et de la mise à jour du pin CLI du **harness actif** (exécutée après succès des écritures repo). Refuse si `.forgix/config.yaml` est absent ou si des conflits bloquants existent.
- **`forgix init sync`** (sans `--plan` ni `--apply`) : refuse avec `EXIT_CODES.INVALID_INVOCATION` (`2`).
- **`forgix project-profile publish`** : **propriétaire unique** de l'écriture idempotente de `.forgix/project.yaml`.

### Cas limites vérifiés

- **Dépôt v4.4.0 déjà sain avec `bootstrap.agents: false` et `runner` omis** → `init check` retourne `inSync: true`, `init sync --plan` ne propose aucune action, `$forgix sync` fait 0 prompt et 0 écriture.
- **Dépôt v4.4.0 après upgrade du plugin (ex. nouvelle entrée `.gitignore`, hook modifié, nouvelle capacité `bootstrap`, pin CLI obsolète)** → `init check` signale les constats repo et local séparément, `init sync --plan` génère le diff complet sans `stdin`, `init sync --apply` met à jour en préservant les règles `.forgix/factory/rules/**` et les hooks tiers (ex. Entire), et un second `init check` retourne `inSync: true`.
- **Dépôt multi-harness `[codex, claude, antigravity]` synchronisé depuis Antigravity** → les 3 fichiers hooks versionnés du dépôt sont mis à jour, mais seul `cli-path.antigravity` est mis à jour localement (`cli-path.codex` et `cli-path.claude` intacts).
- **Dépôt non initialisé (pas de `.forgix/config.yaml`)** → `init sync --plan` et `init sync --apply` refusent sans rien écrire (`config_missing`) et orientent vers `$forgix init`.
- **CI (clone frais sans pin CLI local)** → `forgix init check --strict` passe (`exit 0`) tant que les fichiers versionnés du dépôt sont synchronisés.

### S'arrêter et demander / Laissé à l'agent

- **S'arrêter et demander :** si l'ajout de la documentation `$forgix sync` dans `skills/forgix/SKILL.md` ne tient pas dans les `795` octets de marge de `maxPromptBytes` sans raccourcir une consigne existante, ou si une modification de `Protected Surface` non prévue est nécessaire.
- **Laissé à l'agent :** découpage interne des nouveaux modules sous `src/init/` et `src/core/`, nommage interne des types/helpers, mécanisme d'injection de la version du package dans `scripts/build.mjs`, organisation des fixtures de tests dans `test/`.

### Promote on merge

- Mettre à jour `docs/getting-started.md` pour documenter `$forgix sync`, `forgix init check [--strict]` et `forgix init sync --plan|--apply` (aucun nouvel ADR requis ; les principes structurants restent couverts par ADR 0037 et ADR 0042).

---

## 4. Preuves (Proof)

### Environnements de vérification

- Node `v26.8.1`, Bun `1.4.4`, Dagger (`/opt/homebrew/bin/dagger`) ; dépendance préalable : `bun install --frozen-lockfile` dans le worktree.

| #   | Prouve                                                                                                                                                                                                               | Surface                                                                                     | Vérification                                                          | Où         | Signal de succès                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| 1   | Détection stateless complète (hooks, `.gitignore`, `.worktreeinclude` entrées par défaut, factory, nouvelles capacités, `project.yaml`, séparation repo/local, `--strict` CI-safe) et refus sur dépôt non initialisé | Sortie JSON & code de sortie de `forgix init check [--strict]` et `forgix init sync --plan` | `bun test test/unit test/integration` sur dépôts fixtures             | Local + CI | Tous les tests passent (`exit 0`, randomisés, 0 retry)                               |
| 2   | Mise à jour atomique idempotente, préservation des valeurs utilisateur/`false`/hooks tiers, blocage conflits + `--adopt`, isolation du pin CLI au harness actif                                                      | Fichiers sur disque, pins CLI locaux, sortie JSON `forgix init sync --apply`                | `bun test test/integration` (1er `apply` + 2e `check` / `plan` no-op) | Local + CI | Réconciliation complète, 2e passage `inSync: true`, autres pins CLI inchangés        |
| 3   | Rappel non-bloquant `SessionStart` orientant vers `$forgix sync` sur dérive                                                                                                                                          | Sortie JSON `forgix hook <harness> session-start`                                           | `bun test test/unit/hooks.test.ts test/integration/hooks.test.ts`     | Local + CI | Message mentionne `$forgix sync` en cas de dérive et reste silencieux sur dépôt sain |
| 4   | Bundle empaqueté autonome exposant la version du plugin et exécutant `init check` / `init sync` sans dépendances externes                                                                                            | Tarball & CLI `dist/forgix.mjs`                                                             | `bun run pack:runtime && bun run test:runtime`                        | Local + CI | Smoke test runtime passe (`exit 0`)                                                  |
| 5   | Respect des Golden Rules, zones Fallow, non-croissance des monolithes, couverture et `maxPromptBytes <= 24 000`                                                                                                      | Dépôt complet                                                                               | `bun run check && bun run check:diff`                                 | Local + CI | `exit 0` sans erreur ni dépassement de budget                                        |

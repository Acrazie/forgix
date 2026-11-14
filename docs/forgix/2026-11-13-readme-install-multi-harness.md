# Design : Distribution multi-harness de Forgix et mise à jour des README (Antigravity, Codex, Claude Code)

Date : 2026-11-13
Sujet : Distribution multi-harness (Antigravity, Codex, Claude Code) & documentation publique alignée

## 1. Problème et objectif

Aujourd'hui, le dépôt `Acrazie/codex-dev-flow` et son paquet `plugins/forgix` ciblent uniquement **Codex** :

- Les manifestes existants sont exclusivement Codex (`.agents/plugins/marketplace.json` et `plugins/forgix/.codex-plugin/plugin.json`).
- Les validateurs des autres harness ciblés échouent sur le dépôt actuel (`claude plugin validate .agents/plugins/marketplace.json` échoue faute de `owner` et sur le champ `plugins.0.source` Codex ; `agy plugin validate plugins/forgix --json` et `agy plugin validate . --json` échouent faute de `plugin.json`).
- À l'exécution, `plugins/forgix/src/cli.ts` (`run` et `resume`) appelle systématiquement `captureRoutingSnapshot` (`plugins/forgix/src/app-server.ts`) via `codex app-server` et exige les modèles `gpt-5.6-luna`, `gpt-5.6-terra` et `gpt-5.6-sol` (`plugins/forgix/src/types.ts`, `plugins/forgix/src/routing.ts`), ce qui bloque l'exécution sous Claude Code ou Antigravity.
- `plugins/forgix/skills/forgix/SKILL.md` appelle la commande nue `forgix` sans résoudre le bundle `plugins/forgix/dist/forgix.mjs` embarqué dans le plugin et suppose `codex app-server` et `Native Codex`.
- `README.md`, `plugins/forgix/README.md` et `plugins/forgix/docs/getting-started.md` ne documentent l'installation et l'utilisation que pour Codex et npm.

**Objectif** : rendre Forgix installable, exécutable et documenté de manière alignée sur **Antigravity**, **Codex** et **Claude Code** (strictement restreints à ces trois harness), tout en respectant `plugins/forgix/docs/adr/0028-make-public-documentation-user-first-and-current.md` et `plugins/forgix/test/integration/documentation.test.ts` (aucune documentation anticipée d'une commande non fonctionnelle).

## 2. Portée, non-objectifs et décisions arrêtées

### Portée retenue (Option A approuvée)

1. Ajouter les manifestes de distribution requis pour **Claude Code** et **Antigravity** tout en conservant **Codex** intact.
2. Introduire un routage et une exécution conscients du harness (`codex` vs `host-native` pour Claude Code et Antigravity) et la résolution portable du CLI embarqué `dist/forgix.mjs`.
3. Adapter l'empaquetage (`package.json`, `artifact-budget.json`, tests de distribution et smoke tests runtime) ainsi que l'outillage de release/identité (`src/release.ts`, `scripts/release.ts`, `test/forgix-identity.test.ts`).
4. Mettre à jour `README.md`, `plugins/forgix/README.md`, `plugins/forgix/docs/getting-started.md`, `plugins/forgix/docs/design.md`, `plugins/forgix/docs/lifecycle-contract.md`, `plugins/forgix/docs/glossary/forgix.md`, `plugins/forgix/docs/runbooks/maintainer-release.md`, `CONTRIBUTING.md` et `plugins/forgix/test/integration/documentation.test.ts` dans le même cycle d'implémentation.

### Non-objectifs explicites

- Aucun support d'autres harness ou registries (`Cursor`, `Windsurf`, `OpenCode`, `GitHub Copilot`, `skills.sh` / `npx skills`).
- Aucune migration des chemins projet hors `.codex/` (`.codex/dev-flow.yaml`, `.codex/dev-flow.project.yaml`, `.codex/dev-flow.project.local.yaml`, `.codex/tasks/`, `.codex/project-init/state.yaml`, `.codex/benchmarks/`) dans cette itération.
- Aucun nouvel installateur CLI custom (`npx forgix install`) copiant des fichiers dans `~/.claude` ou `~/.gemini`.
- Aucune exposition publique de workflows concurrents : `forgix` reste l'unique workflow utilisateur conformément à `CONTRIBUTING.md`.

### Décisions humaines approuvées

| Sujet                     | Décision retenue                                                                                                      | Raison / Impact                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Portée README vs code     | Option A : implémenter manifestes + compatibilité runtime/skills + documentation alignée                              | `ADR 0028` et `documentation.test.ts` interdisent de documenter des commandes non fonctionnelles ou en attente.     |
| Langue des docs publiques | Anglais pour `README.md`, `plugins/forgix/README.md` et `plugins/forgix/docs/*` ; français pour ce document de design | Cohérent avec la documentation publique existante du dépôt.                                                         |
| Routage hors Codex        | Routage conscient du harness (`host-native` pour Claude Code et Antigravity, sans `codex app-server`)                 | Préserve intégralement le routage quota 5h et `gpt-5.6-*` sous Codex tout en débloquant Claude Code et Antigravity. |
| Chemins projet `.codex/`  | Conservés à l'identique                                                                                               | Évite toute migration de schéma `TaskState` V6 et `Project INIT`.                                                   |
| Installation Antigravity  | Workflow natif `agy` (`git clone` + `agy plugin install ./codex-dev-flow/plugins/forgix`, repli copie/import)         | `agy plugin install` exige un répertoire local et `plugins/forgix` réside dans un sous-dossier du monorepo.         |

## 3. Architecture de distribution, manifestes et release

### Carte des manifestes et commandes d'installation

| Harness         | Manifeste racine dépôt                          | Manifeste racine `plugins/forgix/`       | Installation verrouillée                                                                                            | Invocation                              |
| --------------- | ----------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Codex**       | `.agents/plugins/marketplace.json` _(existant)_ | `.codex-plugin/plugin.json` _(existant)_ | `codex plugin marketplace add Acrazie/codex-dev-flow` puis `codex plugin add forgix@acrazie`                        | `$forgix`, `$forgix init`               |
| **Claude Code** | `.claude-plugin/marketplace.json` _(à créer)_   | `.claude-plugin/plugin.json` _(à créer)_ | `claude plugin marketplace add Acrazie/codex-dev-flow` puis `claude plugin install forgix@acrazie`                  | `/forgix:forgix`, `/forgix:forgix init` |
| **Antigravity** | — _(monorepo)_                                  | `plugin.json` _(à créer)_                | `git clone https://github.com/Acrazie/codex-dev-flow.git` puis `agy plugin install ./codex-dev-flow/plugins/forgix` | `/forgix`, `/forgix init`               |

### Contrat strict des manifestes (validé avec `claude plugin validate --strict` et `agy plugin validate --strict --json`)

1. **`.claude-plugin/marketplace.json`** (racine du dépôt) :
   - Champs : `name: "acrazie"`, `owner: { "name": "Acrazie" }`, `description` (évite tout avertissement `--strict`), et `plugins: [{ "name": "forgix", "source": "./plugins/forgix", "description": "...", "version": "0.4.0", "category": "Productivity" }]`.
   - Aucun champ non standard (`icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl`) : vérifié en bac à sable via `claude plugin validate --strict` (code `0`, zéro avertissement).
2. **`plugins/forgix/.claude-plugin/plugin.json`** :
   - Champs : `name: "forgix"`, `version: "0.4.0"`, `description`, `author: { "name": "forgix contributors" }`, `license: "MIT"`, `repository: "https://github.com/Acrazie/codex-dev-flow"`, `keywords`, `skills: "./skills/"`.
   - Sans champ Codex `interface` ni champ non reconnu : vérifié via `claude plugin validate --strict` (code `0`, zéro avertissement).
3. **`plugins/forgix/plugin.json`** (Antigravity) :
   - Champs : `name: "forgix"`, `displayName: "Forgix"`, `version: "0.4.0"`, `description`, `author: "forgix contributors"`, `license: "MIT"`, `homepage`, `repository`.
   - Les skills sont auto-découverts depuis `./skills/` (vérifié via `agy plugin validate --strict --json` : `components.skills: 6`, code `0`, zéro erreur, zéro avertissement).
   - Ne placer aucun `AGENTS.md` ni `GEMINI.md` à la racine `plugins/forgix/` (`agy plugin validate --strict` échoue sur un fichier règles hors `rules/`).

### Politique de versionning et mise à jour de `release.ts`

Le dépôt distingue déjà deux plans de version indépendants lors des releases partielles (`plugins/forgix/src/release.ts:143-190`, `plugins/forgix/package.json:3` à `"1.0.1"`, `plugins/forgix/.codex-plugin/plugin.json:3` à `"0.4.0+codex.20260822214128"`) :

- **Plan npm** : `plugins/forgix/package.json` et `.release-please-manifest.json` (`"1.0.1"` actuellement) évoluent sur `target: "npm"`, `target: "both"` ou via Release Please.
- **Plan plugin** : les manifestes de plugin partagent une même base sémantique (`pluginBase`, initialement `"0.4.0"`, égale à `semanticBase(plugins/forgix/.codex-plugin/plugin.json)`).
  - `createReleasePlan` (`plugins/forgix/src/release.ts`) reste **strictement pure** et conserve exactement son objet de retour `ReleasePlan` actuel (préservant les assertions `.toEqual` de `release.test.ts`). C'est `scripts/release.ts` (`prepareAndPublish`) qui propage `semanticBase(plan.pluginVersion)` vers les manifestes compagnons lorsque `plan.target !== "npm"`.
  - Lors d'un `target === "both"`, `createReleasePlan` calcule `pluginVersion = <packageVersion>+codex.<UTC>` ; `prepareAndPublish` met ensuite à jour `.codex-plugin/plugin.json` avec `plan.pluginVersion`, et `.claude-plugin/plugin.json`, `plugins/forgix/plugin.json` et `.claude-plugin/marketplace.json` (`plugins[0].version`) avec `semanticBase(plan.pluginVersion)` (`packageVersion`, SemVer strict).
  - Lors d'un `target === "plugin"`, seul le cachebuster Codex change dans `.codex-plugin/plugin.json` (`<currentPluginBase>+codex.<UTC>`), tandis que `.claude-plugin/plugin.json`, `plugins/forgix/plugin.json` et `.claude-plugin/marketplace.json` restent à `<currentPluginBase>` (SemVer strict sans suffixe `+codex.*`).
  - Lors d'un `target === "npm"`, aucun manifeste plugin ni marketplace n'est modifié.

**Contrats requis dans `plugins/forgix/src/release.ts` et `plugins/forgix/scripts/release.ts`** :

1. **Validation par schéma de manifeste** : `validatePluginManifest(value, kind = "codex")` conserve son comportement par défaut pour `"codex"` (`skills` obligatoire terminant par `/`, `semanticBase(version)` acceptant `+codex.*`, tests existants inchangés), et prend en charge `"claude"` (`parseStableVersion(version)` strict + `skills` finissant par `/`, sans `interface`) et `"antigravity"` (`parseStableVersion(version)` strict, `skills` non exigé), complété par la validation de `.claude-plugin/marketplace.json` (entrée unique `forgix`, `source: "./plugins/forgix"`, `parseStableVersion(plugins[0].version)`).
2. **Temporalité distincte des contrôles (`main`, pré-vol, post-édition, reprise et `--publish-existing`)** :
   - Avant `createReleasePlan` dans `main()` et dans `runPreflightValidations(target, readOnly, sourceRoot)` lorsque `target !== "npm"` : lire `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, `plugins/forgix/plugin.json` et `resolve(sourceRoot, "../../.claude-plugin/marketplace.json")` (relatif à `sourceRoot`, jamais codé en dur sur `repoRoot`), valider chaque schéma et vérifier uniquement l'égalité intra-plugin `semanticBase(codex.version) === claude.version === antigravity.version === claudeMarketplace.plugins[0].version` — **sans** exiger l'égalité avec `package.json.version` avant édition (sinon `target === "both"` échouerait dès qu'npm est en avance sur `pluginBase`).
   - Dans `runPreflightValidations` lorsque `target === "npm"` (y compris depuis `publishExistingNpmRelease` sur d'anciens tags `git archive` tels que `forgix-v1.0.1` antérieurs à la distribution multi-harness) : valider uniquement `.codex-plugin/plugin.json` comme aujourd'hui et ne **pas** exiger ni lire `.claude-plugin/plugin.json`, `plugin.json` ou `.claude-plugin/marketplace.json`.
   - Dans `runPreparedValidations(plan)` (post-édition) et `maybeResumePartialRelease()` lorsque la cible touche les plugins (`target !== "npm"`), vérifier en plus que chaque manifeste et `marketplace.plugins[0].version` concordent avec `semanticBase(plan.pluginVersion)` (qui vaut `packageVersion` lorsque `target === "both"`).
3. **Mise à jour JSON imbriquée pour le marketplace** : ne pas utiliser `replaceJsonVersion` (`src/release.ts:110`, limité à une clé `"version"` de premier niveau) sur `.claude-plugin/marketplace.json`. Fournir un helper dédié `replaceMarketplacePluginVersion(contents, "forgix", nextBaseVersion)` ciblant précisément l'entrée `forgix` dans `plugins[]`.
4. **Rollback, chemins autorisés et libellés (`scripts/release.ts`)** :
   - Ajouter `plugins/forgix/.claude-plugin/plugin.json`, `plugins/forgix/plugin.json` et `.claude-plugin/marketplace.json` à `allowedReleasePaths(target)` lorsque `target !== "npm"` (sans modifier `allowedReleasePaths("npm")`).
   - Capturer dans `captureFileSnapshots` les snapshots de **tous** les manifestes concernés avant édition dans `prepareAndPublish` afin que toute annulation restaure chaque fichier ; n'écrire les fichiers SemVer stricts que si leur version change réellement.
   - Mettre à jour `planSummary`, le libellé de cible `"plugin"` dans `chooseTarget()` (`"Multi-harness plugins"` / `"Plugins"` au lieu de `"Codex plugin"` seul), et conserver explicitement `optionalLocalInstall()` dédié au rafraîchissement du cache local Codex (documenté comme propre à Codex, Claude Code et Antigravity se mettant à jour depuis leurs propres commandes).
   - Mettre à jour `test/forgix-identity.test.ts` pour couvrir `.claude-plugin/marketplace.json`, `plugins/forgix/.claude-plugin/plugin.json` et `plugins/forgix/plugin.json`.

### Empaquetage npm, budget d'artefact et suivi Git de `dist/forgix.mjs`

- Ajouter `".claude-plugin/"` et `"plugin.json"` au champ `files` de `plugins/forgix/package.json` (et ajuster `description` / `keywords` tout en gardant `"name": "forgix"` pour `test/forgix-identity.test.ts`).
- Mettre à jour `plugins/forgix/test/artifact-budget.json` (`manifest` et plafonds mesurés après ajout des deux JSON), `plugins/forgix/test/integration/distribution.test.ts` (`manifest.files` + `bun pm pack --dry-run` `required`), et `plugins/forgix/test/runtime/runtime-smoke.test.mjs` (présence de `.claude-plugin/plugin.json` et `plugin.json`).
- **Bundle Git (`plugins/forgix/dist/forgix.mjs`)** : vérifié via `git ls-files`, `plugins/forgix/dist/forgix.mjs` est déjà suivi dans Git malgré `dist/` dans `.gitignore`. Comme les installations Git (`claude plugin install`, `git clone` + `agy plugin install`) exécutent directement ce bundle sans compiler TypeScript ni exiger Bun chez l'utilisateur, toute modification dans `plugins/forgix/src/` **doit** inclure `plugins/forgix/dist/forgix.mjs` recompilé par `bun run build` dans le PR d'implémentation.

_Alternative évaluée et écartée_ : générer les manifestes Claude/Antigravity ou compiler `dist/forgix.mjs` uniquement via un script `postinstall`/installateur côté utilisateur. Écartée car `claude plugin validate`, `agy plugin validate` et le chargement plugin s'appuient directement sur les fichiers versionnés dans Git, sans étape de build requise (Node `>= 24` suffit).

## 4. Contrat d'exécution multi-harness (`routing`, CLI, config, skills)

### A. Grammaire `--harness`, configuration et détection `"auto"`

1. **Grammaire CLI dans `plugins/forgix/src/parse.ts` et `HELP_TEXT`** :
   - Accepter `--harness <auto|codex|claude|antigravity>` ou `--harness=<value>` dans `parseInvocation` sur l'ensemble des commandes (`run` avec ou sans `--benchmark`, `resume`, `status`, `config show|validate`, `project-profile *`, `init`, `benchmark summary`, `--help`), afin que les skills puissent passer `--harness` uniformément à tout appel CLI.
   - Positions acceptées :
     - En tête avant toute commande ou objectif, combinable dans n'importe quel ordre avec `--benchmark` sur `run` (ex. `--harness claude --benchmark <obj>` ou `--benchmark --harness claude <obj>`).
     - En queue sur les sous-commandes à arité fixe (`resume <id>`, `status [id]`, `config ...`, `project-profile ...`, `benchmark summary`, `init`, `--help`).
     - Dès qu'un jeton d'objectif `run` non-option commence, les règles existantes restent strictes : tout `--*` ultérieur (y compris `--harness`) continue de lever `InvocationError` (`EXIT_CODES.INVALID_INVOCATION`).
   - Rejeter par `InvocationError` une valeur vide, inconnue, manquante ou un doublon `--harness`.
   - Exposer `harness?: "auto" | "codex" | "claude" | "antigravity"` uniquement lorsque le drapeau est fourni (omise sinon, pour préserver à l'identique les assertions `.toEqual` existantes de `plugins/forgix/test/unit/parse.test.ts`).
   - Mettre à jour `HELP_TEXT` (`plugins/forgix/src/cli.ts`) pour documenter `--harness auto|codex|claude|antigravity`.

2. **Configuration sans dérive V6 (`config.schema.json` & `config.ts`)** :
   - Ajouter `"harness": { "type": "string", "enum": ["auto", "codex", "claude", "antigravity"] }` en propriété **optionnelle** dans `plugins/forgix/schemas/config.schema.json`.
   - Ne **pas** ajouter `harness` à `DEFAULT_CONFIG` (`plugins/forgix/src/config.ts`) : une absence de `harness` équivaut à `"auto"`. Ainsi, `compareSnapshot` (`plugins/forgix/src/state.ts:867`, `stable(state.configSnapshot) !== stable(current.config)`) ne génère aucune fausse dérive `config_changed` lors de la reprise de tâches V6 préexistantes.
   - Si `--harness <val>` est passé en CLI, `cli.ts` l'injecte en source `{ source: "flags", value: { harness: val } }` **après** `options.configSources ?? loadConfigSources()` sur `run`, `resume` et `config show|validate` : `config show --explain --harness claude` reflète donc `provenance.harness = "flags"`, et `--harness auto` surcharge un `harness: "claude"` persisté dans `.codex/dev-flow.yaml`. Sur `init`, `status`, `project-profile *`, `benchmark summary` et `--help` (commandes exécutées avant `resolveRuntimeConfig`), `--harness` est validé syntaxiquement puis traité sans effet de bord (commodité CLI uniforme pour les skills). Une valeur invalide dans un fichier YAML continue de lever `ConfigValidationError` (`EXIT_CODES.INVALID_CONFIGURATION`).

3. **Résolution déterministe de `"auto"` et isolation testable (`cli.ts`)** :
   - Ajouter `env?: NodeJS.ProcessEnv` et `entrypointPath?: string` à `RunInvocationOptions` (`cli.ts`) pour permettre l'injection sans mutation globale ni conflit sous `bun run test:randomization`.
   - Chaîne de priorité stricte (`resolveHarness`) :
     1. Préférence CLI (`--harness` si distinct de `"auto"`, sinon étape 3 si `--harness auto` force la détection).
     2. Préférence config (`config.value.harness` si distinct de `"auto"`).
     3. Détection automatique en mode `"auto"` (une variable booléenne n'est vraie que si non vide et différente de `"0"` / `"false"`) :
        - a) Si `env.CODEX_THREAD_ID` est défini (session Codex active) -> `"codex"`.
        - b) Sinon, si l'une des variables Claude Code (`CLAUDE_PLUGIN_ROOT`, `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`) est active -> `"claude"`.
        - c) Sinon, si l'une des variables explicites Antigravity (`ANTIGRAVITY_AGENT`, `ANTIGRAVITY_CLI`, `ANTIGRAVITY_SESSION_ID`) est active, **OU** si le chemin normalisé `entrypointPath` (jamais `cwd` ni `process.execPath`) se trouve dans une racine de plugin installée (`/.gemini/config/plugins/` ou `/.gemini/antigravity/plugins/`), **en excluant explicitement les worktrees `/.gemini/antigravity/worktrees/`** -> `"antigravity"`.
        - d) Sinon, si `entrypointPath` se trouve dans `/.claude/plugins/` -> `"claude"`.
        - e) Repli par défaut -> `"codex"`.
   - Adapter `plugins/forgix/test/integration/cli-routing.test.ts` pour injecter `env: {}` (ou `--harness codex`) sur les tests de routage Codex existants afin que la suite reste verte même exécutée depuis un shell hôte Antigravity ou Claude Code.

> **Invariant de non-bascule silencieuse** : lorsque le harness résolu est `"codex"`, toute indisponibilité ou permission manquante sur `codex app-server` continue de retourner `routing_unavailable` / `routing_permission_required` sans jamais basculer sur `host-native`. Inversement, lorsque le harness résolu est `"claude"` ou `"antigravity"`, `captureRoutingSnapshot` (`codex app-server`) n'est **jamais** appelé.

### B. Contrat unifié CLI, `RoutingSnapshot`, `RoutingDecision`, quota cache et `TaskState`

La sortie JSON de `forgix run` et `forgix resume` conserve **le même schéma sur les trois harness** (aucune divergence `status: "ok"` / `data.decisions`) :

| Élément                                          | Harness `codex` (`codex-app-server`)                                                                                                                                      | Harness `claude` / `antigravity` (`host-native`)                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CliResult.status`                               | `"routed"` \| `"routed_with_warning"` \| `"routing_unavailable"` \| `"routing_permission_required"` (inchangé)                                                            | `"routed"` (même si `model === null` et `effort === null`)                                                                                                                                                                                                                                                                      |
| `CliResult.data`                                 | `objective`/`taskId`, `benchmarkEnabled`, `routingSnapshot`, `routingPolicyVersion`, `routingDecisions`, champs erreur optionnels                                         | Identique : `objective`/`taskId`, `benchmarkEnabled`, `routingSnapshot`, `routingPolicyVersion`, `routingDecisions`                                                                                                                                                                                                             |
| `RoutingSnapshot`                                | Structure Codex existante inchangée (`types.ts:43-57`) ; champs optionnels `mode?: "codex-app-server" \| "host-native"`, `harness?: "codex" \| "claude" \| "antigravity"` | `schemaVersion: 1`, `mode: "host-native"`, `harness: "claude" \| "antigravity"`, `capturedAt`, `plan: "unknown"`, `account: {}`, `quota: { pressure: "unknown", source: "unknown" }`, `models: []`, `warnings: []`, `provenance: { plan: "unknown", quota: "unknown", models: "unknown" }`, `subscriptionMultiplier: undefined` |
| `chooseRoute(snapshot, task)`                    | Inchangé (`gpt-5.6-*` et matrice quota 5h)                                                                                                                                | Branche immédiate sur `snapshot.mode === "host-native"` : `{ stage: task.stage, model: null, effort: null, quotaPressure: "unknown", reason: "host-native:<harness>", warnings: [] }` (aucun warning `quota_unknown` / `plan_unknown` / `required_route_unavailable`)                                                           |
| Cache quota 5h (`quota-cache.ts`)                | Lecture / écriture `.codex/tasks/five-hour-quota-reset.json` (inchangée)                                                                                                  | **Totalement court-circuité** (ni lecture ni écriture) afin qu'un cache Codex existant ne mute pas `quota.source` ni n'ajoute `quota_fallback_last_known`                                                                                                                                                                       |
| `routingStable` & `compareSnapshot` (`state.ts`) | Normalise `(snapshot.mode ?? "codex-app-server")` et `(snapshot.harness ?? "codex")` avant sérialisation canonique (hors `capturedAt`)                                    | Deux runs `host-native` sur le même harness ont le même `routingStable` au `resume` ; tout changement `codex` <-> `host-native` ou `claude` <-> `antigravity` signale `routing_changed`                                                                                                                                         |
| Métriques (`metrics.ts`)                         | `model_calls` avec `ALLOWED_MODEL_IDS` / `REASONING_EFFORTS` ; `routing_decisions` avec `quotaPressure`                                                                   | Pas d'émission `model_calls` avec `model: null`/`effort: null` (`metrics.ts:573-579` les rejette) ; `routing_decisions` reste compatible avec `quotaPressure: "unknown"`                                                                                                                                                        |

### C. Résolution portable du CLI embarqué dans `SKILL.md`

Ordre normatif dans `plugins/forgix/skills/forgix/SKILL.md` (prérequis Node `>= 24.0.0`) :

1. Résoudre le script depuis la racine du plugin actif (jamais depuis le CWD du projet) :
   - Si `${CLAUDE_PLUGIN_ROOT}` est défini : `node "${CLAUDE_PLUGIN_ROOT}/dist/forgix.mjs" ...`
   - Sinon, utiliser `<skill_dir>/../../dist/forgix.mjs` relatif au fichier `SKILL.md` chargé (guillemets obligatoires autour du chemin si `$HOME` contient des espaces) : `node "<skill_dir>/../../dist/forgix.mjs" ...`
   - Repli final : binaire `forgix` sur `$PATH` (ne jamais utiliser `npx forgix` pendant le cycle agentique afin d'éviter tout téléchargement implicite).
2. Passer explicitement `--harness claude` sous Claude Code, `--harness antigravity` sous Antigravity et `--harness codex` sous Codex sur `run` et `resume` (ou de façon uniforme sur `status`, `config`, `project-profile`).

### D. Assistant `npx forgix init` et portabilité des skills

1. **`plugins/forgix/src/init.ts` (`npx forgix init`)** :
   - Ajouter une étape de sélection du harness (`collectHarness` : `auto`, `claude`, `antigravity`, `codex`) avec numérotation d'étapes adaptée lorsque l'étape abonnement est masquée.
   - N'exécuter `collectSubscription` que si `draft.harness` vaut `"codex"` ou `"auto"` (si `"claude"` ou `"antigravity"`, sauter la saisie du forfait Codex/seuils quota tout en conservant `subscription` en mémoire durant la boucle de révision si l'utilisateur revient sur `"codex"`/`"auto"`).
   - Dans `buildConfiguration(current, draft)` : si `draft.harness === "auto"`, **supprimer** la clé `harness` du nouvel objet avant sauvegarde (pour ne pas laisser traîner un ancien `harness: "claude"` après retour à `"auto"`) ; sinon écrire `harness: draft.harness`. Si `draft.harness === "claude" | "antigravity"`, conserver un éventuel bloc `subscription` déjà présent ou les défauts minimaux valides au schéma sans forcer sa réédition.
   - Adapter `renderConfigurationSummary`, `renderRoutingSummary` et le menu `ReviewAction` :
     - Inclure `{ value: "harness", label: "Edit target harness" }` ; n'afficher l'option `"subscription"`, les lignes `Subscription` / `Quota pressure` / `Model costs` (Luna/Terra/Sol) et le tableau des routes `gpt-5.6-*` que si `draft.harness` vaut `"codex"` ou `"auto"`. Pour `claude` / `antigravity`, afficher une note `Host-native routing` expliquant qu'aucun `codex app-server` ni quota `gpt-5.6-*` n'est requis.
     - Si l'utilisateur bascule vers `"codex"` ou `"auto"` depuis la boucle de révision, rediriger proprement ou permettre l'édition de `"subscription"`.
   - Mettre à jour les séquences de choix de `plugins/forgix/test/integration/init.test.ts` en conséquence.

2. **Portabilité de `plugins/forgix/skills/*/SKILL.md` et contraintes des tests existants** :
   - **Préservation des invariants vérifiés par `plugins/forgix/test/integration/distribution.test.ts:88-107` et `test/forgix-identity.test.ts:24`** : conserver l'en-tête `name: forgix` et toutes les assertions textuelles exigées dans `SKILL.md` (`Exact \`$forgix init\` is agentic`, `Do not refresh account, quota, or model data between skills`, `Never substitute a fallback model or effort`, `routing_permission_required`, etc.), en y ajoutant les équivalents multi-harness (ex. `/forgix:forgix init`pour Claude Code,`/forgix init`pour Antigravity) et en conditionnant explicitement la règle`gpt-5.6-*`/`codex app-server`au mode`codex-app-server` (`!routingSnapshot.mode || routingSnapshot.mode === "codex-app-server"`).
   - **Mode `host-native` dans `SKILL.md`** : lorsque `routingSnapshot.mode === "host-native"`, déléguer les étapes isolées (`discover-change`, `plan-change`, `design-decisions`, `review-change`, `debug-root-cause`) via le mécanisme natif de sous-agent en lecture seule du harness hôte sans dépendre d'un nom d'outil unique fragile, tout en conservant strictement l'isolation de contexte, la lecture seule et le jeu de reçus V6 ; remplacer `Native Codex` en `BUILD` et hors-cycle par une formulation neutre (`the active host agent`).
   - **Visibilité des 5 skills internes** : `user-invocable: false` a été vérifié avec succès en bac à sable sur `claude plugin validate --strict` et `agy plugin validate --strict --json` (code `0`, zéro avertissement). L'ajouter dans le frontmatter des 5 skills internes (`discover-change`, `plan-change`, `design-decisions`, `review-change`, `debug-root-cause`) pour garder un point d'entrée utilisateur unique (`CONTRIBUTING.md`) sur Claude Code et Antigravity, sous réserve que les validateurs stricts restent à `0` après implémentation. Conserver `skills/forgix/agents/openai.yaml` (toléré sans avertissement par les trois validateurs).

## 5. Contrat documentaire (`README.md`, `plugins/forgix/README.md`, `docs/`)

- **Langue** : **anglais** pour toute la documentation publique et technique du dépôt.
- **Alignement strict `ADR 0028` & `documentation.test.ts`** :
  - Synchroniser `README.md` et `plugins/forgix/README.md` avec des sections **Install** par harness et une référence claire vers `plugins/forgix/docs/getting-started.md`.
  - Aucune mention de roadmap ni de fonctionnalité future/provisoire (`/accepted next target|implementation pending|not yet implemented/i`).
  - Vérifier que tous les liens relatifs résolvent dans les deux emplacements (`README.md` à la racine et `plugins/forgix/README.md`).
  - Étendre de manière additive `sharedJourneyMarkers` dans `plugins/forgix/test/integration/documentation.test.ts` avec les marqueurs verrouillés :
    - **Claude Code** : `claude plugin marketplace add Acrazie/codex-dev-flow`, `claude plugin install forgix@acrazie`, `/forgix:forgix init`, `/forgix:forgix Add rate limiting to the public authentication endpoints`.
    - **Antigravity** : `git clone https://github.com/Acrazie/codex-dev-flow.git`, `agy plugin install ./codex-dev-flow/plugins/forgix`, `/forgix init`, `/forgix Add rate limiting to the public authentication endpoints`.
    - **Codex** : marqueurs existants conservés à l'identique (`codex plugin marketplace add Acrazie/codex-dev-flow`, `codex plugin add forgix@acrazie`, `$forgix init`, `$forgix Add rate limiting to the public authentication endpoints`, `npx forgix init`, etc.).
- **Détails par harness en anglais dans les docs** :
  - Préciser le prérequis **Node `>= 24.0.0`** pour l'exécution du CLI embarqué sur les trois harness (`git` requis pour le clone Antigravity).
  - Sous **Antigravity**, documenter la commande principale verrouillée (`git clone` + `agy plugin install ./codex-dev-flow/plugins/forgix`) ainsi que les compléments natifs : `agy plugin import claude` (si déjà installé sous Claude Code) ou installation IDE/App vers `~/.gemini/config/plugins/forgix/`.
  - Mentionner explicitement que `.codex/` reste le répertoire des fichiers de configuration et d'état projet sur les trois harness dans cette version.
  - Aligner `plugins/forgix/docs/design.md`, `plugins/forgix/docs/lifecycle-contract.md`, `plugins/forgix/docs/glossary/forgix.md`, `plugins/forgix/docs/runbooks/maintainer-release.md` et `CONTRIBUTING.md` sur la distribution multi-harness et le mode `host-native`.

## 6. Frontière d'écriture, ordre d'implémentation, risques et vérifications

### Frontière d'écriture (Write Boundary) pour la future implémentation

- **Créer** :
  - `.claude-plugin/marketplace.json`
  - `plugins/forgix/.claude-plugin/plugin.json`
  - `plugins/forgix/plugin.json`
  - Tests dédiés au routage multi-harness / détection env (ex. `plugins/forgix/test/unit/harness-routing.test.ts` ou extension des suites listées ci-dessous)
- **Modifier** :
  - `plugins/forgix/src/parse.ts`, `plugins/forgix/src/types.ts`, `plugins/forgix/src/config.ts`, `plugins/forgix/src/routing.ts`, `plugins/forgix/src/cli.ts`, `plugins/forgix/src/init.ts`, `plugins/forgix/src/state.ts`, `plugins/forgix/schemas/config.schema.json`
  - `plugins/forgix/src/release.ts`, `plugins/forgix/scripts/release.ts`, `plugins/forgix/package.json`
  - `plugins/forgix/dist/forgix.mjs` _(recompilé via `bun run build` et commité dans Git pour les installations basées sur Git)_
  - `plugins/forgix/skills/forgix/SKILL.md` et frontmatter de `plugins/forgix/skills/{discover-change,plan-change,design-decisions,review-change,debug-root-cause}/SKILL.md`
  - `plugins/forgix/test/artifact-budget.json`, `plugins/forgix/test/unit/parse.test.ts`, `plugins/forgix/test/unit/config.test.ts`, `plugins/forgix/test/unit/state.test.ts`, `plugins/forgix/test/integration/cli-routing.test.ts`, `plugins/forgix/test/integration/init.test.ts`, `plugins/forgix/test/integration/distribution.test.ts`, `plugins/forgix/test/integration/documentation.test.ts`, `plugins/forgix/test/integration/release.test.ts`, `plugins/forgix/test/runtime/runtime-smoke.test.mjs`, `test/forgix-identity.test.ts`
  - `README.md`, `CONTRIBUTING.md`, `plugins/forgix/README.md`, `plugins/forgix/docs/getting-started.md`, `plugins/forgix/docs/design.md`, `plugins/forgix/docs/lifecycle-contract.md`, `plugins/forgix/docs/glossary/forgix.md`, `plugins/forgix/docs/runbooks/maintainer-release.md`
- **Supprimer** : aucun fichier.
- **Hors périmètre** : `docs/ROADMAP.md` (strictement intouché), `.gitignore`, `.github/workflows/release-please.yml`, `.github/workflows/publish-github-package.yml`, migration des dossiers `.codex/`.

### Ordre d'implémentation sûr

1. **Manifestes, release et empaquetage** : créer `.claude-plugin/marketplace.json`, `plugins/forgix/.claude-plugin/plugin.json`, `plugins/forgix/plugin.json` ; étendre `src/release.ts`, `scripts/release.ts`, `package.json`, `artifact-budget.json`, `distribution.test.ts`, `release.test.ts`, `runtime-smoke.test.mjs`, `test/forgix-identity.test.ts` ; valider avec `claude plugin validate --strict` et `agy plugin validate --strict --json`.
2. **Runtime, config, `init` et stabilité V6** : implémenter `--harness`, `harness` optionnel dans `config.schema.json`, détection `"auto"` isolée, `host-native` dans `routing.ts`/`cli.ts` (sans cache quota ni `app-server`), normalisation `routingStable`, refonte `init.ts`, et mettre à jour/ajouter les tests (`parse.test.ts`, `config.test.ts`, `state.test.ts`, `cli-routing.test.ts`, `init.test.ts`).
3. **Skills portables et rebuild bundle** : adapter `skills/*/SKILL.md`, exécuter `bun run build` pour régénérer `plugins/forgix/dist/forgix.mjs`, puis revalider via `claude plugin validate --strict` et `agy plugin validate --strict --json`.
4. **Documentation synchronisée** : mettre à jour `README.md`, `CONTRIBUTING.md`, `plugins/forgix/README.md`, `plugins/forgix/docs/*` et `documentation.test.ts`.
5. **Vérification globale** : exécuter toute la matrice ci-dessous sans échec.

### Risques, garde-fous et limites de vérification

- **Dérive entre manifestes lors de releases `npm` / Release Please / `plugin`** : résolue en découplant la comparaison pré-vol entre le plan npm et le plan plugin (`semanticBase` partagé entre les 3 manifestes plugin + marketplace Claude ; `both` les aligne ensemble sur la nouvelle version npm).
- **Exécution CI sans binaires externes `claude`/`agy`** : `.github/workflows/ci.yml` n'installe pas `claude` ni `agy` CLI ; la protection continue en CI repose sur les vérifications structurelles dans `test/forgix-identity.test.ts`, `distribution.test.ts` et `release.test.ts`, complétées par les validations locales `claude plugin validate --strict` et `agy plugin validate --strict --json` avant merge.
- **Validation distante GitHub pré-merge** : `claude plugin marketplace add Acrazie/codex-dev-flow` et `codex plugin marketplace add Acrazie/codex-dev-flow` liront le marketplace sur GitHub une fois la PR fusionnée sur `main` ; avant merge, tester via le répertoire local ou un dépôt/bac à sable temporaire isolé sans modifier de branche distante.
- **Détection `"auto"` hors contexte plugin** : un appel nu en terminal (ou depuis une worktree `.gemini/antigravity/worktrees/...`) retombe sur `"codex"` sauf si `--harness` ou `.codex/dev-flow.yaml` ou les variables d'environnement d'agent (`CLAUDE*` / `ANTIGRAVITY_*`) sont présents.

### Matrice de vérifications attendues à l'implémentation

| Vérification                                                                                                          | Critère de réussite                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check` et `bun test test/forgix-identity.test.ts`                                                            | Exit `0` : `dist/forgix.mjs` synchronisé, zéro échec malgré un éventuel shell hôte Antigravity/Claude (tests isolés par `env: {}`), tous tests unité/intégration et budget OK                                                                                                                                                                                                                   |
| `bun run pack:runtime` puis `bun run --cwd plugins/forgix test:runtime`                                               | Exit `0` : `.artifacts/forgix.tgz` inclut `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, `plugin.json` et `dist/forgix.mjs` sous Node 24                                                                                                                                                                                                                                            |
| `claude plugin validate --strict .claude-plugin/marketplace.json` et `claude plugin validate --strict plugins/forgix` | Exit `0`, zéro erreur, zéro avertissement (y compris avec `user-invocable: false` et `agents/openai.yaml`)                                                                                                                                                                                                                                                                                      |
| `agy plugin validate plugins/forgix --strict --json`                                                                  | Exit `0`, zéro erreur, zéro avertissement (y compris avec `user-invocable: false` et `agents/openai.yaml`)                                                                                                                                                                                                                                                                                      |
| Compatibilité Codex (`user-invocable: false` & `--publish-existing`)                                                  | `codex plugin` ne proposant pas de sous-commande `validate`, vérifier les parseurs/tests Codex du dépôt (`validatePluginManifest`, `distribution.test.ts`, `release.test.ts` incluant rétro-compatibilité `target: "npm"` sans manifestes Claude/Antigravity) et charger `plugins/forgix` sous Codex CLI si présent                                                                             |
| Smoke tests locaux en bac à sable temporaire                                                                          | `agy plugin install <tmp>/plugins/forgix` et exécution `node <root>/dist/forgix.mjs --harness claude\|antigravity "test"` retournent `status: "routed"` (`model: null`, `effort: null`, zéro `app-server` / cache quota) ; `--harness codex` sans `app-server` retourne exit `0` avec JSON `status: "routing_unavailable"` (ou `"routing_permission_required"`) et aucun basculement silencieux |

## État de revue et approbation

- **Statut** : Revu avec limites d'environnement explicites — prêt pour approbation humaine
- **Domaine du digest (SHA-256 UTF-8)** : Octets exacts du début du document jusqu'au dernier caractère précédant la ligne `## État de revue et approbation` (excluant cette section et son titre) — `36569` octets avant normalisation `oxfmt`, `42685` octets après normalisation `oxfmt`.
- **Digest substantiel courant (pré-`oxfmt` approuvé)** : `0cbe845c4e4ee27e09c47019cbc850e7f0da66aa2ab7bed20300f5c468b539e4`
- **Digest substantiel normalisé (post-`oxfmt`)** : `a557bf880741c0669fd93c0f95cc851ec03fa048aa31b5f07593e0ec564cc910`
- **Historique de revue** :
  - Passe 1 (`4f0f1806e2efaa4e7e752e3401bced9f016231c981ea1dc1fa1e5fa5801864c9`) : `egm-design-critic` (2 Blockers, 5 Majors, 1 Minor) + `egm-implementation-readiness` (3 Blockers, 4 Majors) — résolus.
  - Passe 2 (`34279a5512fd11a2c8dcb8a7a103a763239e62d9cf729cadecab60f7921b5859`) : `egm-design-critic` (0 Blocker, 1 Major, 3 Minors) + `egm-implementation-readiness` (0 Blocker, 1 Major, 2 Minors) — résolus.
  - Passe 3 (`0cbe845c4e4ee27e09c47019cbc850e7f0da66aa2ab7bed20300f5c468b539e4`) : `egm-design-critic` (**Approved** : 0 Blocker, 0 Major, 3 Minors non bloquants) + `egm-implementation-readiness` (**Ready** : 0 Blocker, 0 Major, 0 Minor).
- **Notes mineures non bloquantes pour l'implémentation (Passe 3)** :
  1. §3 pré-vol : utiliser le chemin `plugin.json` relatif à `sourceRoot` (et non `plugins/forgix/plugin.json` préfixé deux fois).
  2. §4.B `exactOptionalPropertyTypes` : omettre la clé `subscriptionMultiplier` sur les snapshots `host-native` au lieu d'assigner littéralement `undefined`.
  3. §6 smoke test `agy plugin install` : isoler `HOME=<tmp>` en bac à sable pour ne pas modifier `~/.gemini/`.
- **Limites de couverture explicites** :
  - Les sous-agents de revue (`egm-design-critic` et `egm-implementation-readiness`) opèrent sans outil shell (`run_command`) : le calcul SHA-256 et la validation préliminaire de manifestes en bac à sable (`claude plugin validate --strict` et `agy plugin validate --strict --json`) ont été exécutés par l'agent coordinateur avant revalidation.
  - `docs/ROADMAP.md` n'a pas été lu, cité ni utilisé conformément aux règles du dépôt.
  - La suite complète (`bun run check`, `pack:runtime`, `test:runtime`) et la validation des fichiers réels créés restent à exécuter lors de l'implémentation après approbation humaine.
- **Approbation humaine** : Approuvé par l'utilisateur le 2026-11-13 ("oui go passer implementer") — digest substantiel pré-`oxfmt` verrouillé `0cbe845c4e4ee27e09c47019cbc850e7f0da66aa2ab7bed20300f5c468b539e4` (normalisé `oxfmt` sans modification sémantique : `a557bf880741c0669fd93c0f95cc851ec03fa048aa31b5f07593e0ec564cc910`).

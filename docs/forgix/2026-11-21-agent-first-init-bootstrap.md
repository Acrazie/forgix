# Refonte Agent-First de `forgix init` (Rules, Hooks et Bootstrap Multi-Harness)

## Problème et objectif

Aujourd'hui, l'initialisation d'un dépôt dans Forgix est scindée entre deux surfaces incompatibles :

1. Un **assistant terminal humain** (`forgix init` via `@clack/prompts` dans `src/core/config.ts`) qui génère `.forgix/config.yaml`.
2. Un **workflow agentique** (`$forgix init` / `Project INIT` dans `skills/forgix/SKILL.md` et `src/profile/index.ts`) qui se limite à publier `.forgix/project.yaml`.

Cette séparation pose deux problèmes structurels :

- Elle contredit la **Règle d'or (`Agent-First Plugin Principle`)** : Forgix est conçu exclusivement pour les agents IA, jamais pour une opération interactive humaine en terminal. Le wizard TUI duplique la logique d'onboarding et alourdit le bundle `dist/forgix.mjs` avec `@clack/prompts`.
- Un dépôt initialisé via `$forgix init` ne dispose d'aucun garde-fou mécanique branché dans les harnesses (Codex, Claude Code, Antigravity) : pas de `Harness Lifecycle Hook`s pour bloquer les commandes destructrices ou les écritures sur `Protected Surface` et signaler les `Escape Hatch`, pas de `Harness Rule`s maintenues de façon idempotente, et pas d'automatisation déterministe pour `.gitignore` / `.worktreeinclude` ni de détection de dérive.

**Objectif** : faire de `$forgix init` (et `/forgix:forgix init`, `/forgix init`) l'unique point d'entrée d'initialisation et de réconciliation d'un dépôt, appuyé par deux nouvelles primitives CLI déterministes (`forgix init plan|apply|check` et `forgix hook <harness> <event>`), tout en supprimant le wizard TUI humain et `@clack/prompts`.

## Périmètre et non-objectifs

### Dans le périmètre

- **Règle d'or & rupture CLI** : suppression de `runInit` TUI et de `@clack/prompts` ; refus structuré de `forgix init` nu en terminal (`EXIT_CODES.INVALID_INVOCATION`).
- **Primitive de bootstrap déterministe** : `forgix init plan|apply|check` (avec schéma JSON `schemas/init-bootstrap.schema.json` enregistré dans `src/core/schema.ts`) pour gérer idempotemment `.forgix/config.yaml`, `Harness Rule`s, `Harness Lifecycle Hook`s, `.gitignore` et `.worktreeinclude`.
- **Primitive d'exécution des hooks** : `forgix hook <harness> <event>` pour `codex` (`session-start|pre-tool-use|post-tool-use`), `claude` (`session-start|pre-tool-use|post-tool-use`) et `antigravity` (`session-start|pre-tool-use|post-invocation`).
- **Extensions rétrocompatibles de schémas** :
  - `schemas/config.schema.json` : ajout optionnel de `harnesses`, `hooks`, et `bootstrap` (modules activés pour `init check`).
  - `schemas/state.schema.json` et `src/types.ts` : ajout de deux champs optionnels sur `CanonicalChangeContract` (`approvedProtectedPaths?: string[]` et `approvedEscapeHatches?: string[]`), sans modifier aucune phase ni transition `TaskState` V6.
- **Workflow agentique `$forgix init`** (`skills/forgix/SKILL.md`, `docs/project-profile-contract.md`) : auto-détection multi-harness, découverte de la stack et des commandes qualité pour pré-remplir `protectedSurfaces` et `surfaceVerificationRules`, détection d'outils existants (Entire, Dagger, Fallow, Context7…) pour `integrations`, proposition paresseuse de `domainDocumentation`, et mode réconciliation/dérive.
- **Tests, budget d'artefact et documentation** : tests unitaires, d'intégration et runtime smoke ; mise à jour de `test/artifact-budget.json` (autorisée ci-dessous), `package.json`, `bun.lock`, `README.md`, `docs/getting-started.md`, `docs/project-profile-contract.md`, `docs/glossary/forgix.md`.

### Hors périmètre

- **Git hooks** (`pre-commit`, `commit-msg`, `pre-push`, lefthook, husky, `.vite-hooks`) : laissés à l'outillage propre du dépôt hôte.
- **Scaffolding produit** : `$forgix init` ne génère jamais de code applicatif ni de `TaskState`.
- **Transitions `TaskState` V6** : aucune nouvelle macro-phase, aucune modification des transitions `INTAKE → SHAPE → GATE → BUILD → ASSURE`.
- **Livraison Git externe** : aucun commit, push, PR ou merge déclenché par `init`.

## Décisions structurantes et contrats

Références canoniques : [ADR 0037](../adr/0037-agent-first-plugin-and-harness-bootstrap.md), [AGENTS.md](../../AGENTS.md#L18-L21), [docs/glossary/forgix.md](../glossary/forgix.md#L418-L486).

### 1. Suppression du wizard TUI humain

- `runInit` (`src/core/config.ts`) et la dépendance `@clack/prompts` (`package.json`, `bun.lock`) sont supprimés.
- Invoquer `forgix init` sans sous-commande (`plan`, `apply` ou `check`) lève une `InvocationError` (`EXIT_CODES.INVALID_INVOCATION = 2`) indiquant explicitement la Règle d'or et la commande agent attendue (`$forgix init`, `/forgix:forgix init`, ou `/forgix init`).
- Aucun flag de compatibilité ni alias TUI n'est conservé.

### 2. Extension de `.forgix/config.yaml` et règle de fusion

`schemas/config.schema.json` reste en `schemaVersion: 1` et ajoute des propriétés optionnelles (les `.forgix/config.yaml` existants restent 100 % valides sans migration) :

- `harnesses?: HarnessId[]` (`["codex", "claude", "antigravity"]`, `uniqueItems: true`) : liste des harnesses versionnés et synchronisés dans le dépôt. Orthogonal au champ singulier existant `harness` (`"auto" | HarnessId`), qui conserve son rôle exclusif de préférence de routage runtime et n'est jamais écrasé involontairement.
- `hooks?: { enforcement?: "balanced" | "strict" | "warn" }` (défaut effectif : `"balanced"`).
- `bootstrap?: { rules?: boolean; hooks?: boolean; gitignore?: boolean; worktreeInclude?: boolean }` : persiste les modules volontairement activés/désactivés afin que `forgix init check` ne signale jamais de fausse dérive sur un module intentionnellement désactivé.

**Règle de fusion dans `.forgix/config.yaml`** :

- Le manifeste d'entrée `init plan|apply` sépare proprement les champs de bootstrap (`harnesses`, `rules`, `hooks`, `gitignore`, `worktreeInclude`) d'un patch optionnel `configPatch` (uniquement pour les clés opérationnelles hors bootstrap : `harness`, `worktree`, `runner`, `integrations`, `subscription`, `roadmap` — `harnesses`, `hooks`, `bootstrap` sont interdits dans `configPatch` pour éliminer toute ambiguïté de précédence).
- `init apply` charge le `.forgix/config.yaml` existant (ou `{ schemaVersion: 1, merge: "never" }` s'il est absent), préserve toutes les sections non mentionnées dans `configPatch` (ex. `roadmap`, `subscription`, `runner`, `integrations`, `harness`), remplace explicitement chaque clé présente dans `configPatch`, puis met à jour `harnesses`, `hooks.enforcement` et `bootstrap` depuis la racine du manifeste. Le résultat complet est validé contre `schemas/config.schema.json` avant toute écriture.

### 3. Contrat de la primitive `forgix init plan|apply|check`

Pure, déterministe, sans appel réseau ni modèle, appuyée sur `WorkspaceStore` (`src/core/store.ts`) pour le confinement de chemins, le rejet des symlinks et l'écriture atomique par fichier.

#### Manifeste déclaratif (stdin pour `plan` et `apply`)

Validé par `schemas/init-bootstrap.schema.json` (enregistré sous `"init-bootstrap"` dans `src/core/schema.ts`, plafond `MAX_STRUCTURED_INPUT_BYTES`, `additionalProperties: false`) :

- `schemaVersion: 1`
- `harnesses`: `HarnessId[]` (peut être vide pour retirer proprement tous les artefacts de harness)
- `configPatch?`: patch optionnel des champs opérationnels de `.forgix/config.yaml` (sans `harnesses`/`hooks`/`bootstrap`)
- `rules`: `{ enabled: boolean; content?: string }` (`content` requis si `enabled: true`, borné à 24 000 octets UTF-8)
- `hooks`: `{ enabled: boolean; enforcement?: "balanced" | "strict" | "warn" }`
- `gitignore`: `{ enabled: boolean; extraEntries?: string[] }`
- `worktreeInclude`: `{ enabled: boolean; entries?: string[] }`

#### Sémantique, concurrence, atomicité et codes de sortie

- **`forgix init plan`** (lecture seule, stdin requis) :
  - Valide le manifeste (`EXIT_CODES.INVALID_CONFIGURATION = 3` si invalide) et inspecte chaque cible.
  - Retourne `exit 0` avec `{ command: "init_plan", status: "ok" | "blocked", data: { actions, conflicts } }` (`actions` : `create | update | remove | unchanged` + aperçu diff ; `conflicts` : JSON malformé, cible symlinkée, marqueurs délimités orphelins/dupliqués). Ne modifie aucun fichier.
- **`forgix init apply`** (stdin requis) :
  - S'assure d'abord de l'existence de `.forgix` en `0o755` (`ensureSafeDirectory(".forgix", { dirMode: 0o755 })`) afin que le répertoire parent versionné ne soit jamais créé en `0o700` sur un dépôt neuf, puis acquiert un verrou exclusif `WorkspaceStore.withWriteLock(".forgix/init/apply.lock.sqlite")` (placé dans `.forgix/init/` privé en `0o700` et déjà gitignoré, comme `.forgix/tasks/<taskId>.lock.sqlite`) pour empêcher tout entrelacement concurrent sur les fichiers partagés.
  - Exécute intégralement la pré-validation `plan`. S'il existe au moins un conflit bloquant, libère le verrou et échoue avant toute écriture (`EXIT_CODES.STATE_CONFLICT = 5`).
  - Prend un instantané en mémoire des fichiers modifiés/supprimés et enregistre les chemins nouvellement créés ; applique les fichiers secondaires (rules, hooks, `.gitignore`, `.worktreeinclude`) par renommage atomique individuel, puis écrit `.forgix/config.yaml` en dernier comme point de validation d'autorité.
  - En cas d'erreur I/O en cours d'application (ex. `EACCES`, disque plein), tente une restauration compensatoire best-effort (restauration des fichiers modifiés/supprimés depuis l'instantané mémoire et suppression best-effort des fichiers nouvellement créés) et retourne `EXIT_CODES.INTERNAL_ERROR = 10`. Relancer `forgix init apply` reste idempotent pour converger proprement.
  - Permissions fichiers : `WorkspaceStore` (`src/core/store.ts`) expose des options facultatives `mode`/`dirMode` (défaut inchangé `0o600`/`0o700` pour l'état interne) ; les fichiers versionnés du dépôt (`AGENTS.md`, `.gitignore`, `.worktreeinclude`, `.agents/hooks.json`, `.codex/hooks.json`, `.claude/settings.json`, `.claude/rules/forgix.md`, `.agents/rules/forgix.md`, `.forgix/config.yaml`, `.forgix/rules.md`) préservent leur mode existant ou sont créés en `0o644` (répertoires `0o755`), afin de rester lisibles dans les environnements conteneurisés/Dagger.
  - Idempotence : un second `apply` avec le même manifeste retourne `exit 0` avec toutes les `actions` à `unchanged`.
- **`forgix init check`** (lecture seule, sans stdin) :
  - Lit `.forgix/config.yaml` (et `.forgix/project.yaml` si présent) et vérifie uniquement les modules activés dans `config.bootstrap` (par défaut tous vérifiés si `harnesses` est défini sans `bootstrap`) : fraîcheur des hooks par harness déclaré, présence de `.forgix/rules.md` et des pointeurs, entrées `.gitignore` obligatoires, marqueurs `.worktreeinclude`, absence de conflits JSON/marqueurs.
  - Retourne `exit 0` avec `{ command: "init_check", status: "ok" | "drift", data: { inSync, findings } }`.

### 4. Contrat des `Harness Rule`s (source canonique unique)

Pour éviter toute duplication et respecter les plafonds de contexte (24 KB / fichier, 20 000 tokens agrégés sur Antigravity) :

- **Source canonique** : `.forgix/rules.md` (≤ 24 000 octets) condense les conventions projet, `Protected Surface`s et commandes de vérification essentielles.
- **Pointeurs compacts (< 30 lignes chacun)** :
  - `claude` → `.claude/rules/forgix.md` (fichier dédié ; **`CLAUDE.md` n'est jamais écrit** pour préserver les symlinks comme `CLAUDE.md -> AGENTS.md`).
  - `antigravity` → `.agents/rules/forgix.md` (fichier dédié).
  - `codex` → bloc délimité `<!-- forgix:start -->` … `<!-- forgix:end -->` fusionné dans `AGENTS.md`. Si `AGENTS.md` est un symlink, `plan`/`apply` signale un conflit bloquant (jamais de suivi silencieux).
- Désactiver `rules` ou retirer un harness supprime uniquement le fichier dédié Forgix ou le bloc délimité dans `AGENTS.md`, en préservant le reste du fichier octet pour octet.

### 5. Contrat des `Harness Lifecycle Hook`s (`forgix hook <harness> <event>`)

#### Câblage non destructif par harness (formats natifs exacts)

- **Antigravity (`.agents/hooks.json`)** : clé racine dédiée `"forgix"` (coexistant avec `"entire"`). Respecte l'asymétrie native du schéma Antigravity (`agy-customizations/docs/hooks.md`) :
  - `SessionStart` : tableau **plat** `[{ "type": "command", "command": "...", "timeout": 5 }]`.
  - `PreToolUse` : tableau **groupé** `[{ "matcher": "*", "hooks": [{ "type": "command", "command": "...", "timeout": 5 }] }]`.
  - `PostInvocation` : tableau **plat** `[{ "type": "command", "command": "...", "timeout": 5 }]` (utilisé pour le scan `Escape Hatch`, car `PostToolUse` sur Antigravity n'accepte que `{}` sans injection de message ni terminaison).
- **Codex (`.codex/hooks.json`)** : fusion dans `hooks.SessionStart`, `hooks.PreToolUse` et `hooks.PostToolUse` (tous supportés par Codex CLI, structure groupée `{ matcher, hooks: [{ type, command, timeout }] }`). Les entrées Forgix sont identifiées par leur commande `forgix hook codex <event>` ; les entrées tierces (`entire`, etc.) restent intactes.
- **Claude Code (`.claude/settings.json`)** : fusion non destructive dans `hooks.SessionStart`, `hooks.PreToolUse` et `hooks.PostToolUse` (structure groupée `{ matcher?, hooks: [{ type, command, timeout }] }`), identifiées par `forgix hook claude <event>`, sans modifier aucune autre clé de `.claude/settings.json`.

#### Résolution binaire sûre et fail-open

Enveloppe POSIX `sh -c` sans exécution depuis un CWD non fiable (pas de `./dist/forgix.mjs` automatique) :

1. Si `CLAUDE_PLUGIN_ROOT` est défini, que `"$CLAUDE_PLUGIN_ROOT/dist/forgix.mjs"` existe et que `command -v node >/dev/null 2>&1`, exécuter `exec node "$CLAUDE_PLUGIN_ROOT/dist/forgix.mjs" hook <harness> <event>` ;
2. Sinon si `command -v forgix >/dev/null 2>&1` (avec préflight `forgix --help </dev/null >/dev/null 2>&1` sur `session-start` uniquement afin de ne jamais consommer stdin ni doubler le temps de démarrage Node sur chaque appel d'outil), exécuter `exec forgix hook <harness> <event>` ;
3. Sinon si la variable opt-in `FORGIX_CLI_PATH` est définie, existe et `command -v node >/dev/null 2>&1`, exécuter `exec node "$FORGIX_CLI_PATH" hook <harness> <event>` ;
4. Sinon **fail-open** (`exit 0`) : sur `session-start`, émettre un JSON d'avertissement au format du harness (`injectSteps` sur Antigravity, `systemMessage` sur Codex/Claude) invitant à installer Forgix ; sur les autres événements, émettre `{}` et sortir `0`.

#### Protocole I/O, contournement `main()` et codes de sortie

- **Contournement de l'enveloppe CLI dans `src/cli.ts#main()`** : lorsque `command === "hook"`, `main()` n'émet PAS `{ command, status, data }` ; il écrit directement le payload JSON natif du harness sur stdout et respecte le code de sortie retourné par le handler de hook.
- **Échec sûr (fail-open) sur erreur interne / stdin malformé / config cassée** : `forgix hook` intercepte toute erreur de parsing stdin ou de lecture config et **ne renvoie jamais le code de sortie `2` sur erreur de parsing/config** (qui provoquerait un blocage permanent dans Claude Code et Codex). Il sort `0` avec `{}` (ou un avertissement léger sur `session-start`).
- **Sémantique de blocage par harness** :
  - **Antigravity** : toujours `exit 0` avec JSON stdout : `SessionStart` → `{ injectSteps: [{ systemMessage: { systemMessage } }] }` ; `PreToolUse` → `{ decision: "allow" | "deny", reason }` ; `PostInvocation` → `{ injectSteps: [...] }` en `balanced`/`warn`, `{ injectSteps: [{ errorMessage: { userMessage } }], terminationBehavior: "terminate" }` en `strict`.
  - **Codex & Claude Code** : `SessionStart` → `exit 0` + `{"systemMessage":"..."}` ; `PreToolUse` allow → `exit 0` + `{}`, warn → `exit 0` + `{"systemMessage":"..."}`, deny → `exit 2` + raison explicite sur `stderr` ; `PostToolUse` clean → `exit 0` + `{}`, violation en `balanced`/`warn` → `exit 0` + `{"systemMessage":"..."}`, violation en `strict` → `exit 2` + raison sur `stderr`.

#### Résolution de la tâche active et règles d'évaluation

- **Résolution déterministe de la tâche active** : inspecte `.forgix/tasks/*.json` et filtre les tâches en `status === "executing"` :
  1. Si une tâche correspond au `cwd` du hook via `activeWorktree.worktreeRef`, elle est sélectionnée ;
  2. Sinon s'il existe exactement une tâche `executing`, elle est sélectionnée ;
  3. Si plusieurs tâches `executing` correspondent de façon ambiguë, aucune autorisation implicite n'est accordée (warning en `balanced`/`warn`, blocage sur `Protected Surface` en `strict`).
- **Autorisations contractuelles (`CanonicalChangeContract`)** :
  - `schemas/state.schema.json` et `src/types.ts` ajoutent deux champs optionnels rétrocompatibles sur `CanonicalChangeContract` : `approvedProtectedPaths?: string[]` et `approvedEscapeHatches?: string[]`.
- **Évaluation par événement (`hooks.enforcement`, défaut `balanced`)** :
  - **`session-start`** : résume `.forgix/project.yaml`, la tâche active éventuelle, un rappel `worktree check-base` si en worktree, et toute dérive détectée par `init check`. Ne bloque jamais.
  - **`pre-tool-use`** :
    - _Commandes shell destructrices (invariants universels, toujours actifs)_ : `git commit --no-verify` / `-n`, `git push --force` / `-f` (hors `--force-with-lease`), `git merge` direct sur la branche tronc (`merge: never`). Blocage en `balanced` et `strict`, avertissement en `warn`.
    - _Écriture sur `Protected Surface`_ : charge `protectedSurfaces` depuis `.forgix/project.yaml` (ou défaut minimal). Pendant un `BUILD` actif, bloque sauf si le chemin correspond à `contract.approvedProtectedPaths` (`verifyProtectedSurfaces`). Hors tâche active, avertit en `balanced`/`warn` et bloque uniquement en `strict`.
  - **`post-tool-use` (Codex/Claude) et `post-invocation` (Antigravity)** :
    - Scanne les ajouts (contenu écrit sur `PostToolUse`, ou `git diff` léger sur `PostInvocation`) avec `scanDiffForEscapeHatches` en passant `contract.approvedEscapeHatches ?? []`.
    - En `balanced`/`warn`, injecte un message immédiat ; en `strict`, bloque/termine.

### 6. Hygiène Git/Worktree et workflow agentique `$forgix init`

- **`.gitignore`** : bloc délimité `# forgix:start` … `# forgix:end` incluant `.forgix/init/`, `.forgix/tasks/`, `.forgix/project.local.yaml`, `.forgix/config.local.yaml`, `.forgix/cache/`, `.forgix/telemetry/`, `.forgix/roadmap/session.yaml`, `.forgix/roadmap/runtime.yaml` (+ `extraEntries` optionnelles).
- **`.worktreeinclude`** : bloc délimité `# forgix:start` … `# forgix:end` pour les entrées locales demandées (ex. `.env`, `.env.local`, `.forgix/project.local.yaml`, `.forgix/config.local.yaml`), garantissant un retrait non destructif si `worktreeInclude.enabled: false` sans jamais supprimer les lignes utilisateur hors marqueurs.
- **Orchestration `$forgix init`** (`skills/forgix/SKILL.md`, `docs/project-profile-contract.md`) :
  1. Lancer `forgix project-profile session-view`, `forgix project-profile inspect` et `forgix init check`.
  2. Auto-détecter les harnesses présents (`.codex/`, `.claude/`, `.agents/`) + le harness actif, la stack et les scripts qualité (pour proposer des `protectedSurfaces` et `surfaceVerificationRules` spécifiques au dépôt), et les outils/plugins existants (Entire, Dagger, Fallow, Context7, Impeccable…) pour pré-remplir `integrations` sans doublons.
  3. Proposer paresseusement `domainDocumentation` uniquement si absente.
  4. Poser uniquement les questions matérielles manquantes/contradictoires/obsolètes (une par tour), valider et publier `.forgix/project.yaml` après approbation explicite du digest.
  5. Construire le manifeste bootstrap, prévisualiser le diff via `forgix init plan`, obtenir confirmation utilisateur, puis exécuter `forgix init apply` et `forgix project-profile session-clear`.

## Migration, compatibilité et retour arrière

- **Rupture CLI (`forgix init`)** : assumée et documentée (`README.md`, `docs/getting-started.md`, `docs/project-profile-contract.md`, [ADR 0037](../adr/0037-agent-first-plugin-and-harness-bootstrap.md)).
- **Compatibilité descendante** : `.forgix/config.yaml` existants et `TaskState` V6 existants restent 100 % valides sans migration (tous les nouveaux champs sont optionnels).
- **Retour arrière sur un dépôt cible** : relancer `forgix init apply` avec `harnesses: []` et tous les modules à `enabled: false` retire proprement uniquement les artefacts Forgix (fichiers dédiés, blocs `# forgix:start/end` et `<!-- forgix:start/end -->`, clés/entrées JSON Forgix).

## Frontières d'écriture prévues (implémentation future)

Respect strict des frontières Fallow (`.fallowrc.json` : `src/**` n'importe jamais `scripts/**` ni `test/**`).

### Create

- `schemas/init-bootstrap.schema.json` : schéma JSON du manifeste `forgix init plan|apply`.
- `src/init/index.ts` (ou sous-modules internes sous `src/init/`) : planification, détection de dérive (`check`), fusion non destructive JSON/marqueurs, verrouillage et application atomique.
- `src/hooks/index.ts` (ou sous-modules internes sous `src/hooks/`) : adaptateurs I/O par harness (`codex`, `claude`, `antigravity`), résolution de tâche active, évaluation `session-start`, `pre-tool-use`, `post-tool-use`, `post-invocation`.
- Tests dédiés sous `test/unit/` et `test/integration/` pour `init plan|apply|check` et `hook`.

### Modify

- `src/cli.ts` : parsing/dispatch `init plan|apply|check` et `hook <harness> <event>`, contournement raw stdout dans `main()` pour `hook`, refus `EXIT_CODES.INVALID_INVOCATION` pour `init` nu.
- `src/core/config.ts` : suppression de `runInit` TUI et des imports `@clack/prompts` ; support des champs optionnels `harnesses`, `hooks`, `bootstrap`.
- `src/core/schema.ts` : ajout de `"init-bootstrap"` à `SchemaName`.
- `src/core/store.ts` : ajout d'options facultatives `mode` / `dirMode` sur `writeTextAtomically` et `ensureSafeDirectory` (défaut inchangé `0o600` / `0o700`).
- `src/types.ts` : types publics (`HookEnforcementMode`, `HookEvent`, `approvedProtectedPaths`, `approvedEscapeHatches`).
- `schemas/config.schema.json` : ajout optionnel de `harnesses`, `hooks`, `bootstrap`.
- `schemas/state.schema.json` : ajout optionnel de `approvedProtectedPaths` et `approvedEscapeHatches` sur `CanonicalChangeContract`.
- `package.json` et `bun.lock` : suppression de `@clack/prompts`, ajout de `docs/adr/0037-agent-first-plugin-and-harness-bootstrap.md` à `package.json#files`.
- `test/artifact-budget.json` _(autorisation explicite de `Protected Surface`)_ : mise à jour du manifeste tarball (`schemas/init-bootstrap.schema.json`, `docs/adr/0037-agent-first-plugin-and-harness-bootstrap.md`) et ajustement éventuel des seuils après retrait de `@clack/prompts`.
- `skills/forgix/SKILL.md`, `docs/project-profile-contract.md`, `docs/getting-started.md`, `README.md`, `docs/glossary/forgix.md`.
- `test/runtime/runtime-smoke.test.mjs` et tests existants qui exerçaient l'ancien `runInit` TUI.

### Delete

- Anciens tests dédiés uniquement au wizard TUI `@clack/prompts` (remplacés par les nouveaux tests `init plan|apply|check` et refus `init` nu).

## Definition of Done

### Critères d'acceptation et preuves attendues

| Critère                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Preuve attendue (incluant cas d'échec et régressions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Règle d'or & suppression TUI** : `forgix init` nu échoue avec `EXIT_CODES.INVALID_INVOCATION` (`2`) et message agent-first ; `@clack/prompts` est retiré de `src/**` et `dist/forgix.mjs` (conservé uniquement en `devDependencies` pour `scripts/release.ts`, ADR 0008).                                                                                                                                                                                                                                                                                                                                                           | Test unitaire/intégration CLI sur `forgix init` nu ; assertion automatisée vérifiant l'absence de `@clack/prompts` dans `src/**` et `dist/forgix.mjs` ; `bun run build && bun run check:size` (manifeste + budget) et `bun run pack:runtime && bun run test:runtime` verts.                                                                                                                                                                                                                                                      |
| **2. Idempotence, concurrence et non-destruction de `forgix init plan\|apply\|check`** : `plan` n'écrit rien ; `apply` fusionne sans perte `.forgix/config.yaml` (préservant `roadmap`, `subscription`, `harness`, etc.), applique sous verrou avec `.forgix/config.yaml` en dernier et permissions `0o644` ; 2e passe = no-op ; `check` sans faux positif sur modules désactivés ; retrait propre par harness/module y compris `.worktreeinclude`.                                                                                                                                                                                      | Tests d'intégration sur dépôt temporaire couvrant : création fraîche, 2e passe idempotente, préservation des sections existantes de `.forgix/config.yaml`, coexistence avec les hooks Entire dans `.agents/hooks.json` (format plat/groupé exact) et `.codex/hooks.json`, préservation du symlink `CLAUDE.md -> AGENTS.md`, retrait propre d'un harness et de `.worktreeinclude`, échecs bloquants avant écriture (JSON corrompu, symlink sur `AGENTS.md`, marqueurs dupliqués), et rollback best-effort sur erreur I/O simulée. |
| **3. Rules canoniques et budget contexte** : `.forgix/rules.md` (≤ 24 KB) est source unique ; `.claude/rules/forgix.md`, `.agents/rules/forgix.md` et le bloc `AGENTS.md` restent compacts (< 30 lignes) ; `CLAUDE.md` n'est jamais écrit ; `.gitignore` inclut `.forgix/config.local.yaml`.                                                                                                                                                                                                                                                                                                                                             | Tests unitaires vérifiant tailles, marqueurs, non-modification de `CLAUDE.md`, présence de `.forgix/config.local.yaml` dans `.gitignore`, et suppression propre du bloc dans `AGENTS.md`.                                                                                                                                                                                                                                                                                                                                        |
| **4. Hooks multi-harness, fail-open sûr et sévérité hybride** : `forgix hook <harness> <event>` contourne l'enveloppe CLI `main()` et émet le JSON natif (`codex`, `claude`, `antigravity` avec `post-invocation`) ; wrapper `sh -c` sans fallback CWD `./dist/forgix.mjs` et avec garde `command -v node` ; fail-open (`exit 0`) si `forgix`/`node` absent ou stdin/config invalide ; `PreToolUse` bloque `--no-verify`/`--force`/merge tronc toujours et `Protected Surface` en `BUILD` actif sauf `contract.approvedProtectedPaths` ; `PostToolUse`/`PostInvocation` scanne les `Escape Hatch` hors `contract.approvedEscapeHatches`. | Tests unitaires et d'intégration par harness (sous `test/unit/` et `test/integration/`, couverts par `test:coverage`) exerçant : les 3 modes (`balanced`, `strict`, `warn`), tâche active unique vs multi-worktree vs ambiguë vs hors tâche, `approvedProtectedPaths` / `approvedEscapeHatches`, stdin malformé → `exit 0` (jamais `exit 2`), et exécution shell réelle du wrapper fail-open sans `forgix` ni `node` sur `$PATH`.                                                                                                |
| **5. Orchestration `$forgix init` et qualité dépôt** : `skills/forgix/SKILL.md` et `docs/project-profile-contract.md` reflètent le workflow complet ; tous les gates qualité du dépôt passent.                                                                                                                                                                                                                                                                                                                                                                                                                                           | Revue de cohérence doc/skill ; `bun run check`, `bun run pack:runtime && bun run test:runtime`, et `dagger call check --source=.` (si Dagger/Docker disponibles) verts après l'édition finale.                                                                                                                                                                                                                                                                                                                                   |

### Gates de livraison (séparés)

1. **Design approuvé (gate courant EGM)** : couverture de revue indépendante complète, zéro Blocker/Major non résolu ni risque non arbitré, approbation humaine explicite sur le digest exact de ce document. _N'autorise ni l'implémentation ni la publication._
2. **Implémentation vérifiée (mandat séparé)** : tous les critères du tableau ci-dessus satisfaits dans les frontières d'écriture approuvées, preuves enregistrées après l'édition finale (révision source, sorties exactes des commandes, limites éventuelles). Tout échec ou check requis non exécuté bloque ce gate.
3. **PR livrée (après validation humaine)** : après revue humaine de l'implémentation réelle et des preuves + approbation explicite de publication, création/mise à jour de la PR selon `docs/git-workflow.md` avec URL vérifiée, révision HEAD et statut des checks distants. Le merge reste hors périmètre automatique.

---

<!-- egm:review-state:start -->

## État de revue (métadonnées exclues du digest)

- **Statut** : `human-approved` (approuvé par l'utilisateur le 2026-11-21 pour le digest exact ci-dessous ; n'autorise pas encore l'implémentation ni la publication)
- **Révision du corps (SHA-256)** : `d0a42c484c2e4b3f45e608ebbb6702891c174446573eb427148388f60088d193`
- **Domaine du digest** : contenu intégral de ce fichier avant la ligne `<!-- egm:review-state:start -->`
- **Couverture indépendante complétée (contextes frais / Goldfish)** :
  - `egm-design-critic` : revue initiale (`761921e...`) + revalidation complète (`651e01c...`) → 0 Blocker ; les 2 Majors relevés ont été corrigés.
  - `egm-implementation-readiness` : revue initiale (`761921e...`) + revalidation (`651e01c...`) + revalidations ciblées (`c254fe1...`, `d0a42c4...`) → **0 Blocker, 0 Major, 0 Minor** sur la révision finale.
- **Décisions humaines arbitrées** : `1A` (champs optionnels `approvedProtectedPaths` / `approvedEscapeHatches` sur `CanonicalChangeContract` + résolution déterministe de la tâche active), `2A` (scan `Escape Hatch` via `PostInvocation` sur Antigravity).
- **Findings ouverts** : aucun
- **Risques acceptés** : aucun (tous les risques identifiés sont couverts par contrat et preuves DoD)
- **Limites matérielles de preuve** : les sous-agents en lecture seule n'exécutent pas de shell (le SHA-256 a été calculé par l'agent principal via Node `crypto`, et les checks runtime `bun run check` / `dagger` relèvent du gate d'implémentation ultérieur).

<!-- egm:review-state:end -->

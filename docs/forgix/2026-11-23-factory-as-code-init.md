# Plan — Factory as Code dans `$forgix init` (`rules`, `agents`, `skills` & policy déterministe)

- **Date** : 2026-11-23 (Révision 2 — post Goldfish Review Round 1)
- **Branche** : `enhance_forgix_init_setup`
- **Profil SHAPE** : `Plan`
- **Périmètre INTAKE** : Source canonique `.forgix/factory/` + projection multi-harness (`codex`, `claude`, `antigravity`), mode hybride (découverte + adoption optionnelle de l'existant + génération sur mesure), remplacement complet de `.forgix/rules.md` par des rules modulaires, et règles unifiées _Policy + Guidance_ (compilation des clauses déterministes vers `.forgix/config.yaml` et les hooks).

---

## 1. Scope & Non-Goals

### Scope

1. **Schémas & contrats** :
   - Étendre `schemas/init-bootstrap.schema.json` : remplacer `rules: { enabled, content }` par `rules: { enabled, items?: FactoryRuleSpec[] }`, et ajouter `agents?: { enabled, items?: FactoryAgentSpec[] }` et `skills?: { enabled, items?: FactorySkillSpec[] }`.
   - Étendre `schemas/config.schema.json` :
     - Ajouter `bootstrap.agents`, `bootstrap.skills` et `bootstrap.managedPaths` (tableau unique de chemins relatifs restreints par motif strict aux préfixes autorisés : `.forgix/factory/`, `.claude/rules/forgix-`, `.claude/agents/forgix-`, `.claude/skills/forgix-`, `.agents/rules/forgix-`, `.agents/agents/forgix-`, `.agents/skills/forgix-`, `.codex/agents/forgix-`, sans `..` ni chemin absolu).
     - Ajouter `factoryPolicies` (`protectedSurfaces`, `blockedCommands`, `escapeHatchPatterns`).
2. **Source canonique `.forgix/factory/`** :
   - `.forgix/factory/rules/<id>.md` (frontmatter YAML `id`, `description`, `globs?`, `alwaysApply?`, `enforce?` + corps Markdown).
   - `.forgix/factory/agents/<id>.md` (frontmatter YAML `id`, `name`, `description`, `role?`, `tools?`, `model?` + corps Markdown).
   - `.forgix/factory/skills/<id>/SKILL.md` (frontmatter YAML `name`, `description` + corps Markdown).
3. **Projection multi-harness, frontmatter valide & ownership non destructif** :
   - Chaque projection générée porte le marqueur `<!-- forgix:managed kind="<rule|agent|skill>" id="<id>" source="<canonicalPath>" -->` placé **immédiatement après le délimiteur fermant `---` du frontmatter YAML** (ou en ligne 1 uniquement lorsqu'il n'y a pas de frontmatter), afin de préserver le parsing YAML frontmatter sur les 3 harnesses.
   - Collision bloquante (`unmanaged_file_collision`) si un fichier cible existe déjà sans marqueur Forgix correspondant — jamais d'écrasement ni de suppression de fichiers non gérés.
   - Mapping par harness :
     - **Rules** : `claude` → `.claude/rules/forgix-<id>.md` (`paths:` frontmatter si `globs`, `CLAUDE.md` jamais écrit) ; `antigravity` → `.agents/rules/forgix-<id>.md` (`trigger`/`globs`) ; `codex` → index compact dans le bloc `<!-- forgix:start --> ... <!-- forgix:end -->` de `AGENTS.md`.
     - **Agents** : `claude` → `.claude/agents/forgix-<id>.md` ; `antigravity` → `.agents/agents/forgix-<id>.md` ; `codex` → `.codex/agents/forgix-<id>.md`.
     - **Skills** : `claude` → `.claude/skills/forgix-<id>/SKILL.md` ; `antigravity` & `codex` → `.agents/skills/forgix-<id>/SKILL.md` (dédupliqué si les deux harnesses sont actifs).
   - **Nettoyage & migration legacy** :
     - `bootstrap.managedPaths` suit **à la fois** les fichiers canoniques `.forgix/factory/**` et les projections gérées ; lors d'un `apply`, tout chemin retiré du manifeste n'est supprimé que s'il figure dans `bootstrap.managedPaths` et (pour une projection) porte le marqueur `<!-- forgix:managed ... -->` (pour un fichier canonique, s'il réside sous `.forgix/factory/` et n'est pas un symlink).
     - Migration de l'ancien format lors d'un `apply` approuvé : `.claude/rules/forgix.md` et `.agents/rules/forgix.md` ne sont supprimés automatiquement que si leur contenu correspond à la signature du pointeur Forgix legacy (sinon `unmanaged_file_collision`) ; `.forgix/rules.md` est planifié en `remove` uniquement dans le cadre d'un `apply` approuvé (et jamais hors manifeste).
     - Le scan récursif de `.forgix/factory/` rejette explicitement tout symlink ou entrée non-fichier (`symlink_or_non_file`).
4. **Compilation Policy → Guardrails/Hooks déterministes** :
   - Les clauses `enforce` des rules (`protectedSurfaces`, `blockedCommands`, `escapeHatchPatterns`) sont validées (y compris compilation RegExp sûre et longueur bornée), dédupliquées et compilées dans `.forgix/config.yaml` (`factoryPolicies`).
   - **Frontière de confiance** : `loadHookRuntimeConfig` charge `factoryPolicies` **exclusivement depuis `.forgix/config.yaml`** versionné dans le dépôt (jamais surchargeable ni effaçable par `.forgix/config.local.yaml`).
   - **Sémantique d'enforcement** :
     - `PreToolUse` (`blockedCommands`) : `hooks.enforcement === "warn"` → `"warn"`, `balanced` | `strict` → `"deny"`.
     - `PreToolUse` (`protectedSurfaces`) : résout d'abord la liste de base (`project.protectedSurfaces.length > 0 ? project.protectedSurfaces : DEFAULT_PROTECTED_SURFACES`), **puis** fait l'union dédupliquée avec `factoryPolicies.protectedSurfaces` afin de ne jamais désactiver `DEFAULT_PROTECTED_SURFACES` ; le compteur dans `buildSessionStartMessage` reflète cette liste fusionnée.
     - `PostToolUse` / `PostInvocation` (`escapeHatchPatterns`) : évalué en complément des `ESCAPE_HATCH_RULES` par défaut, respecte `approvedEscapeHatches` de la tâche active, et mappe `hooks.enforcement === "strict"` → `"block"`, sinon `"warn"`.
5. **Détection de drift (`forgix init check` vs `SessionStart`)** :
   - **`forgix init check`** (complet, dans `src/init/factory-plan.ts`) : vérifie l'absence du reliquat `.forgix/rules.md` / pointeurs legacy, la validité et la sécurité symlink de `.forgix/factory/`, la concordance exacte entre les clauses `enforce` canoniques et `factoryPolicies` dans `.forgix/config.yaml`, l'exactitude byte-à-byte de chaque projection harness, et l'absence de projections ou fichiers canoniques orphelins dans `bootstrap.managedPaths`.
   - **`SessionStart` (`detectBootstrapDrift`)** (léger, synchrone, via helper dans `src/core/factory-policy.ts` sans importer `src/init/**`) : vérifie les invariants structurels rapides (absence de `.forgix/rules.md` legacy, présence des chemins déclarés dans `bootstrap.managedPaths`, présence du bloc `AGENTS.md` pour `codex`) et renvoie vers `forgix init check` pour le contrôle complet.
6. **Skill `$forgix init` & documentation** :
   - Mettre à jour `skills/forgix/SKILL.md` (section `Project INIT`) avec un delta net **`<= +73` octets** (en condensant la prose `Project INIT` existante pour rester sous le budget `promptBytes <= 22 000` et `<= 160` lignes) ; placer le contrat détaillé dans `docs/project-profile-contract.md`.
   - Mettre à jour `docs/project-profile-contract.md`, `docs/getting-started.md` (références `.forgix/rules.md` → `.forgix/factory/`) et `docs/glossary/forgix.md`.

### Non-Goals

- Aucun TUI interactif humain (`Agent-First Plugin Principle` préservé).
- Aucun téléchargement réseau ni registre distant de packs (`src/**` reste zéro-réseau et zéro runtime `dependencies`).
- Aucune modification de `test/artifact-budget.json` ni de `package.json` `files` (on étend les schémas existants).
- Pas de `surfaceVerificationRules` dans `enforce`/`factoryPolicies` ni de couplage de `forgix guardrails check` (`ASSURE`) dans cette itération (`surfaceVerificationRules` reste dans `.forgix/project.yaml` jusqu'à une tâche dédiée).

---

## 2. Implementation Guide (contraintes architecturales vérifiées)

- **Plafonds de lignes & monolithes gelés (`fallow-baselines/file-lines.json` et `.fallowrc.json`)** :
  - Gelés (zéro croissance) : `src/init/index.ts` (1079/1079), `src/hooks/guards.ts` (567/567), `src/core/config.ts` (524/524).
  - Baselined avec marge limitée : `src/hooks/context.ts` (287/358), `src/types.ts` (1090/1092).
  - Non-baselined (plafond strict 300 LOC) : `src/hooks/index.ts` (237/300), plus tous les nouveaux modules `src/**` (`<= 300 LOC`, fonctions `<= 60 LOC`, CC/Cog `<= 15`).
- **Frontières de zones Fallow** : `hooks -> [types, core]` et `init -> [types, core, hooks]`. Les types Factory, la compilation/évaluation des `factoryPolicies`, la fusion sûre des `protectedSurfaces` et le contrôle synchrone léger `SessionStart` vivent dans `src/core/` (`src/core/factory-types.ts`, `src/core/factory-policy.ts`) — zéro import `hooks -> init` et zéro duplication.
- **Zéro Escape Hatch & couverture** : aucun `as any`, `@ts-ignore` ou directive inline dans `src/**` ; chaque nouveau fichier `src/**` doit respecter `bunfig.toml` (`lines >= 0.72`, `functions >= 0.90`) et zéro coverage gap Fallow.

---

## 3. Acceptance Criteria & Validation Matrix

| ID       | Critère vérifiable                                                                                                                                                                                                                                                                                                                                                                        | Couverture tâches                                                                                                                                                                                                                                                                                      | Validation                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **AC-1** | `schemas/init-bootstrap.schema.json` et `schemas/config.schema.json` valident `rules`/`agents`/`skills` + `enforce`, `factoryPolicies` et `bootstrap.managedPaths` (préfixes autorisés uniquement), et rejettent IDs invalides, doublons, RegExp invalides, traversées de chemin et dépassements de budget.                                                                               | T1, T2                                                                                                                                                                                                                                                                                                 | `bun test test/unit/schema.test.ts test/unit/init-bootstrap.test.ts`                  |
| **AC-2** | `forgix init plan                                                                                                                                                                                                                                                                                                                                                                         | apply`écrit atomiquement`.forgix/factory/{rules,agents,skills}`, projette vers `codex`/`claude`/`antigravity`avec marqueur`<!-- forgix:managed ... -->`**après** le frontmatter YAML (sans toucher`CLAUDE.md`), migre/supprime `.forgix/rules.md` et les pointeurs legacy vérifiés, et est idempotent. | T3, T4, T5                                                                            | `bun test test/unit/init-bootstrap.test.ts test/integration/init-bootstrap.test.ts` |
| **AC-3** | Les fichiers utilisateur existants sans marqueur Forgix (y compris un `.claude/rules/forgix.md` modifié manuellement) déclenchent `unmanaged_file_collision` et ne sont jamais écrasés/supprimés ; retirer un item ou un harness supprime proprement les fichiers canoniques et projections gérés dans `bootstrap.managedPaths`.                                                          | T4, T5                                                                                                                                                                                                                                                                                                 | `bun test test/unit/init-bootstrap.test.ts test/integration/init-bootstrap.test.ts`   |
| **AC-4** | `factoryPolicies` compilées dans `.forgix/config.yaml` (jamais surchargeables par `config.local.yaml`) sont appliquées par les hooks selon `hooks.enforcement` (`blockedCommands`, union `DEFAULT_PROTECTED_SURFACES` + `project.protectedSurfaces` + `factoryPolicies.protectedSurfaces`, `escapeHatchPatterns` respectant `approvedEscapeHatches`).                                     | T2, T5, T6                                                                                                                                                                                                                                                                                             | `bun test test/unit/hooks.test.ts test/integration/hooks.test.ts`                     |
| **AC-5** | `forgix init check` détecte tout drift (source canonique modifiée/invalide/symlink, `factoryPolicies` désynchronisées, projection modifiée/manquante/orpheline, reliquat `.forgix/rules.md`), et `SessionStart` détecte le drift structurel rapide (reliquat `.forgix/rules.md`, chemin `managedPaths` manquant, bloc `AGENTS.md` manquant) sans violer la zone `hooks -> [types, core]`. | T2, T4, T5, T6                                                                                                                                                                                                                                                                                         | `bun test test/integration/init-bootstrap.test.ts test/integration/hooks.test.ts`     |
| **AC-6** | `skills/forgix/SKILL.md` (`promptBytes <= 22 000`), `docs/project-profile-contract.md`, `docs/getting-started.md` et `docs/glossary/forgix.md` sont à jour et toutes les portes qualité passent (`check`, `check:diff`, `test:runtime`).                                                                                                                                                  | T7, T8                                                                                                                                                                                                                                                                                                 | `bun run check`, `bun run check:diff`, `bun run pack:runtime && bun run test:runtime` |

---

## 4. Ordered Tasks

1. **T1 — Schémas JSON** (`AC-1`) : Mettre à jour `schemas/init-bootstrap.schema.json` (`rules.items`, `agents`, `skills`, `enforce` sans `surfaceVerificationRules`) et `schemas/config.schema.json` (`bootstrap.{agents,skills,managedPaths}` avec pattern de préfixes autorisés, `factoryPolicies`).
2. **T2 — Types & moteur `factoryPolicies` en `src/core/`** (`AC-1`, `AC-4`, `AC-5`) : Créer `src/core/factory-types.ts` et `src/core/factory-policy.ts` (compilation/déduplication des clauses `enforce`, validation RegExp bornée, `resolveEffectiveProtectedSurfaces` préservant `DEFAULT_PROTECTED_SURFACES`, évaluation `blockedCommands` & `escapeHatchPatterns` avec `enforcement`/`approvedEscapeHatches`, et détection structurelle synchrone pour `SessionStart`).
3. **T3 — Rendu & parsing canonique/projections en `src/init/`** (`AC-2`) : Créer `src/init/factory-render.ts` (rendu frontmatter + Markdown canonique `.forgix/factory/`, parsing pour `check`, rendu des projections par harness avec `<!-- forgix:managed ... -->` après `---`, signature du pointeur legacy, et bloc `AGENTS.md`).
4. **T4 — Planification, collisions, nettoyage & `init check` Factory en `src/init/`** (`AC-2`, `AC-3`, `AC-5`) : Créer `src/init/factory-plan.ts` (opérations canoniques + projections, détection `unmanaged_file_collision`, scan symlink-safe de `.forgix/factory/`, nettoyage des chemins retirés via `bootstrap.managedPaths` + migration legacy sûre, et `init check` complet).
5. **T5 — Intégration dans `src/init/index.ts`** (`AC-2`, `AC-3`, `AC-4`, `AC-5`) : Câbler `factory-plan.ts` et `factory-policy.ts` dans `parseManifest`, `buildMergedConfig`, `computePlan` et `runCheck` (réduction nette de `src/init/index.ts`).
6. **T6 — Câblage runtime dans `src/hooks/`** (`AC-4`, `AC-5`) : Charger `factoryPolicies` depuis `.forgix/config.yaml` uniquement (hors `config.local.yaml`) dans `src/hooks/context.ts`, évaluer `blockedCommands`, `resolveEffectiveProtectedSurfaces` et `escapeHatchPatterns` dans `src/hooks/index.ts` / `src/hooks/guards.ts`, et déléguer le drift `SessionStart` à `src/core/factory-policy.ts` en respectant tous les plafonds de lignes (`guards.ts <= 567`, `index.ts <= 300`).
7. **T7 — Skill & documentation** (`AC-6`) : Mettre à jour `skills/forgix/SKILL.md` (net `<= +73` octets), `docs/project-profile-contract.md`, `docs/getting-started.md` et `docs/glossary/forgix.md`.
8. **T8 — Tests & vérification complète** (`AC-1`..`AC-6`) : Mettre à jour et enrichir `test/unit/init-bootstrap.test.ts`, `test/integration/init-bootstrap.test.ts`, `test/unit/hooks.test.ts`, `test/integration/hooks.test.ts`, `test/unit/schema.test.ts` et `test/integration/documentation.test.ts` (incluant régression `DEFAULT_PROTECTED_SURFACES` et non-override `config.local.yaml`), puis exécuter `bun run check`, `bun run check:diff`, `bun run pack:runtime && bun run test:runtime`.

---

## 5. Risks & Controls

| Risque                                                                                                | Contrôle                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Croissance d'un monolithe gelé ou dépassement 300 LOC (`src/hooks/index.ts`)                          | Tout nouveau code dans `src/core/factory-*.ts` et `src/init/factory-*.ts` (`<= 300 LOC`) ; vérification `fallow guard` + `bun run check`.                                     |
| Désactivation involontaire de `DEFAULT_PROTECTED_SURFACES` ou affaiblissement par `config.local.yaml` | Résolution de base avant union dans `resolveEffectiveProtectedSurfaces` + lecture stricte de `factoryPolicies` depuis `.forgix/config.yaml` uniquement + tests de régression. |
| RegExp malformée / ReDoS dans `blockedCommands` ou `escapeHatchPatterns`                              | Validation syntaxique + longueur bornée à `parseManifest` et garde d'évaluation dans `factory-policy.ts`.                                                                     |
| Suppression accidentelle d'un fichier manuel lors du retrait d'un item ou migration legacy            | Double verrou (`bootstrap.managedPaths` à préfixes restreints + marqueur `<!-- forgix:managed ... -->` ou signature pointeur legacy exacte) + rejet symlinks.                 |
| Dépassement du budget `promptBytes` (73 octets de marge)                                              | Condensation de la section `Project INIT` dans `skills/forgix/SKILL.md` et vérification `bun run check:size`.                                                                 |

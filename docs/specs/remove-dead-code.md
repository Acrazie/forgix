# Suppression du code mort

## Objectif et périmètre

Retirer le code mort TypeScript/JavaScript du dépôt afin de réduire la surface de maintenance et la taille du bundle, sans modifier les fonctionnalités actives ni les contrats documentés.

### Inclus (décisions 1A, 2A, 3A)

- **Code source et scripts** : `plugins/forgix/src/`, `plugins/forgix/scripts/`, `scripts/`.
- **Tests orphelins ou redondants** : `plugins/forgix/test/` et `test/` lorsque des cas de test ne couvrent plus que du code supprimé (ou importent des symboles retirés).
- **Catégories ciblées** :
  - Fonctions, classes, constantes, types et fichiers inatteignables depuis les points d'entrée réels (`plugins/forgix/src/cli.ts`, les scripts référencés dans `package.json`, `plugins/forgix/package.json`, `.vite-hooks/`, `.buildkite/`).
  - Exports inutilisés : retrait du mot-clé `export` lorsque le symbole ne sert qu'en interne du module (ex. `AppServerClient` dans `plugins/forgix/src/core/routing.ts`), ou suppression complète du symbole s'il n'a aucun appelant interne ni contrat documenté (ex. `delegateStage` / `isDelegableStage` dans `plugins/forgix/src/core/routing.ts`).
  - Code « uniquement testé » (décision 2A) : tout symbole qui n'est ni utilisé en interne ni atteignable depuis les points d'entrée de production est retiré avec ses tests dédiés, sauf s'il appartient à un contrat public ou documenté actif.
- **Outil d'audit** : utilisation ponctuelle de `fallow` (`bunx fallow dead-code`) lors de l'implémentation pour établir l'inventaire exact et vérifier l'absence de résidus, sans ajouter `fallow` aux `devDependencies` ni à `bun run check` (décision 3A).

### Exclu

- Aucune suppression de schémas JSON (`plugins/forgix/schemas/`), de skills (`plugins/forgix/skills/`), de documentation ou de sous-commandes CLI actives.
- Aucune refonte architecturale, aucun changement de comportement des commandes CLI existantes (`init`, `config`, `status`, `resume`, `task`, `project-profile`, `roadmap`, `<objective>`).
- Aucune installation permanente de `fallow` ni création de fichier de configuration/baseline `fallow` suivi dans Git.

## Contrats et invariants à préserver

1. **Point d'entrée runtime unique du plugin** : `plugins/forgix/package.json` expose uniquement `"bin": { "forgix": "dist/forgix.mjs" }` (sans champ `main` ni `exports`), compilé depuis `plugins/forgix/src/cli.ts` via `vite.config.ts`. Les symboles internes de `plugins/forgix/src/` ne constituent pas une API npm publique.
2. **Contrats CLI et schémas** : `HELP_TEXT`, `parseInvocation`, `runInvocation`, `main` (vérifié sur le bundle par `plugins/forgix/test/runtime/runtime-smoke.test.mjs`), les codes de sortie (`EXIT_CODES`), la validation de schémas (`plugins/forgix/schemas/*.schema.json`) et les formats d'état/artefacts restent inchangés.
3. **Suppression des ré-exports de modules dans `plugins/forgix/src/cli.ts`** : `cli.ts` ré-exporte aujourd'hui `export * from "./types.js"` et les espaces de noms des 8 modules (`config`, `digest`, `profile`, `roadmap`, `routing`, `schema`, `store`, `task`). Comme `vite.config.ts` compile `src/cli.ts` en entrée ESM (`format: "esm"`), ces ré-exports empêchent le tree-shaking dans `dist/forgix.mjs` et masquent les exports morts lors de l'audit `fallow`.
   - _Décision_ : retirer `export * from "./types.js"` et les 8 ré-exports de modules de `plugins/forgix/src/cli.ts` en première étape.
   - _Migration des tests_ : mettre à jour `plugins/forgix/test/integration/project-profile-cli.test.ts` (seul test identifié utilisant `sourceApi.profile.*` / `sourceApi.schema.*`) pour importer `ProjectProfileError` et `InvocationError` directement depuis `src/profile/index.ts` et `src/core/schema.ts`.
   - `cli.ts` ne conserve comme exports que sa surface CLI directe (`HELP_TEXT`, `parseInvocation`, `runInvocation`, `main`, et les types d'invocation CLI utilisés par les tests).
4. **Seuils qualité du dépôt** :
   - Couverture (`plugins/forgix/test/coverage-baseline.json`) : minimums par fichier (`lines >= 0.72`, `functions >= 0.75`).
   - Budget de taille (`plugins/forgix/test/artifact-budget.json`) : `bundleBytes <= 467958`, `packedBytes <= 228792`, `unpackedBytes <= 779292`, et manifeste d'archive inchangé.
   - Ordre des tests (`test:randomization`), format (`vp fmt --check`), lint (`vp lint` et `vp lint --type-aware`), typage (`tsc --noEmit`) et tests runtime (`test:runtime`).

## Stratégie d'implémentation et risques

### Protocole d'audit avec `fallow`

1. Retirer d'abord les ré-exports en cascade de `plugins/forgix/src/cli.ts` (Contrat 3) et adapter `project-profile-cli.test.ts`, afin que `cli.ts` ne masque plus les exports internes des 8 modules.
2. Exécuter `bunx fallow dead-code --format json` en considérant comme points d'entrée réels :
   - le binaire `plugins/forgix/src/cli.ts` ;
   - les scripts déclarés dans `package.json`, `plugins/forgix/package.json`, `.vite-hooks/` et `.buildkite/`.
3. Classer chaque résultat avant toute suppression :
   - **Mort avéré** (aucun usage interne ni point d'entrée) : supprimer le symbole/fichier et ses éventuels tests orphelins.
   - **Interne exporté à tort** (utilisé dans le même fichier ou un autre module actif, sans contrat externe) : retirer `export` (et adapter les tests si un test l'importait sans besoin réel, ou conserver si le test vérifie un invariant critique interne).
   - **Faux positif dynamique** (chargé dynamiquement, référencé par un hook/CI/manifeste) : conserver et documenter la raison dans le résumé de livraison.
4. Procéder par lots cohérents (un module ou script à la fois) en vérifiant les tests et le typage après chaque lot.

### Risques principaux et garde-fous

- **Masquage par `cli.ts`** : les `export { ... }` de modules entiers dans `plugins/forgix/src/cli.ts` peuvent masquer les exports inutilisés dans `fallow`. _Garde-fou_ : analyser les modules avec un périmètre d'entrée strict (`runInvocation` / CLI) et vérifier les usages réels de chaque export.
- **Régression de couverture par fichier** : supprimer un test orphelin ou modifier un module peut faire passer un fichier sous `lines: 0.72` ou `functions: 0.75` dans `coverage-baseline.json`. _Garde-fou_ : exécuter `bun run --cwd plugins/forgix test:coverage` après nettoyage.
- **Suppression d'un script appelé hors `package.json`** : un script dans `scripts/` ou `plugins/forgix/scripts/` peut être appelé par `.buildkite/` ou `.vite-hooks/`. _Garde-fou_ : vérifier les références dans `.buildkite/`, `.vite-hooks/`, `README.md` et les tests avant de supprimer un fichier.

## Critères de succès et vérification attendue

- **C1 (Inventaire et propreté)** : `bunx fallow dead-code` ne remonte plus de code mort non justifié sur le périmètre `1A`/`2A`.
- **C2 (Intégrité TypeScript et lint)** : `bun run format:check`, `bun run lint`, `bun run lint:type-aware` et `bun run typecheck:tools` réussissent sans avertissement.
- **C3 (Tests et invariants)** : `bun run test:tools`, `bun run test:hooks`, `bun run --cwd plugins/forgix check` (`typecheck`, `build`, `test:randomization`, `test:coverage`, `check:size`), puis `bun run pack:runtime` suivi de `bun run --cwd plugins/forgix test:runtime` réussissent.
- **C4 (Périmètre respecté)** : aucune dépendance ajoutée (`package.json`, `bun.lock` inchangés), aucun schéma/skill/documentation active supprimé.

## État de revue

- **Statut** : approuvé par l'utilisateur le 2026-11-16 pour la révision `f245bb116454b52f0ce03a8cbd65e77c61333f2492c9fa5423b5577324d3961a` (l'approbation porte sur la conception uniquement et n'autorise pas encore l'implémentation ni le commit).
- **Décisions humaines actées** : 1A (code TS/JS et tests orphelins uniquement), 2A (retirer le code uniquement testé s'il est inatteignable hors contrat), 3A (`fallow` utilisé ponctuellement hors CI/dépendances).
- **Couverture effectuée** :
  - `egm-codebase-details` sur la révision initiale `bcebd6a686bc1173aa5b8cb431b08c113c4849ba900b7a2c7fd0ee0e9224a8de` : 0 Blocker, 0 Major, 0 Nit (limite : relecture statique sans shell ni parcours exhaustif de tous les fichiers de test).
  - `egm-design-critic` (revalidation ciblée sur la révision `f245bb116454b52f0ce03a8cbd65e77c61333f2492c9fa5423b5577324d3961a`) : 0 Blocker, 0 Major, 1 Nit cosmétique (numérotation `2.` dupliquée dans `Protocole d'audit avec fallow`).
- **Révision du corps (sha256 UTF-8 du contenu précédant `\n## État de revue`)** : `f245bb116454b52f0ce03a8cbd65e77c61333f2492c9fa5423b5577324d3961a`.
- **Prochaine étape** : demande explicite d'implémentation hors `/egm-design`.

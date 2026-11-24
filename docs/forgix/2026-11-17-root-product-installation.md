# Forgix à la racine : distribution et installation natives

Date : 2026-11-17

## Objectif et décision

Le produit devient la racine du dépôt : un seul paquet, une seule arborescence de skills et un seul bundle. La décision utilisateur remplace le choix de sous-dossier du [design multi-harness antérieur](2026-11-13-readme-install-multi-harness.md), uniquement pour la structure et la distribution. Ce document est le design canonique de cette migration ; il ne réouvre pas le routage ni le cycle métier.

Le résultat visé est une installation Antigravity par URL GitHub, sans clone manuel ni compilation utilisateur. Codex et Claude conservent leur identité de catalogue et leurs commandes publiques. L’origine de développement et la publication restent Entire/Buildkite ; aucune migration d’hébergement n’est décidée ici.

## État inspecté et sources

Base locale inspectée : `01f4d9e59f7f49c72513655f90cd09e852fe3857`, worktree propre au début de la conception. Les contrats sélectionnés seront liés à leurs empreintes dans la section de revue.

- `package.json` est privé et possède le workspace `plugins/*` ; `plugins/forgix/package.json` possède `@acrasie/forgix`, les scripts produit et le binaire `dist/forgix.mjs`.
- `.agents/plugins/marketplace.json` et `.claude-plugin/marketplace.json` ciblent `./plugins/forgix`.
- Les manifestes, `src/`, `skills/`, `schemas/`, `assets/`, `docs/`, les scripts produit et leurs tests résident sous `plugins/forgix/`. Le bundle est suivi par Git.
- Les scripts racine, Dagger, Renovate, les tests d’outillage et les contrôles de release référencent cette disposition. Les deux `bunfig.toml`, les deux configurations TypeScript et les deux README doivent être fusionnés, pas écrasés.
- `scripts/release-ci.ts` protège déjà le contexte Buildkite, l’ascendance sur `origin/main`, les tags, les plans npm/plugin et les artefacts. La migration ne doit pas affaiblir ces contrôles.
- Antigravity local observé : `agy` 1.5.2. L’appel `agy plugin install --help` renvoie `Error: install target must be a directory: --help` ; cette sonde ne démontre ni le support ni l’absence de support des URL. Aucune installation réalisée.

Sources externes consultées via Context7 le 2026-11-17 : [installation](https://antigravity.google/docs/plugins.md), [structure et validation](https://antigravity.google/docs/build-plugins/), [marketplace](https://antigravity.google/docs/marketplace/). Elles documentent les URL GitHub, un manifeste `plugin.json` ou `.antigravity-plugin/plugin.json`, et les composants à la racine du plugin. Elles précisent que les fichiers de contribution racine comme `AGENTS.md` sont ignorés par le chargeur Antigravity, mais peuvent produire des avertissements. Le support d’une URL Entire n’est pas établi : ne pas le promettre.

## Structure cible et propriétaires

- Déplacer `src/`, `skills/`, `schemas/`, `assets/`, `dist/`, `CHANGELOG.md`, `.codex-plugin/` et le manifeste Antigravity à la racine. Conserver `plugin.json` comme manifeste Antigravity unique : déplacer sans introduire un deuxième format ni exiger une nouvelle convention de manifeste.
- Fusionner `.claude-plugin/plugin.json` avec le répertoire racine existant qui contient `marketplace.json`. Les deux fichiers ont des responsabilités distinctes et restent présents.
- Remplacer le paquet racine privé par le manifeste publiable `@acrasie/forgix`, en fusionnant scripts et dépendances de développement à versions inchangées. Supprimer `workspaces`, `private: true` et `repository.directory`. Garder un seul `bun.lock`, régénéré pour le nouveau propriétaire sans mise à jour opportuniste des versions résolues.
- Fusionner les scripts produit dans `scripts/`, sans copie parallèle. Les noms inspectés ne se heurtent pas. Les commandes racine restent les points d’entrée : `build`, `check`, `check:staged`, `pack:runtime`, `release`, `test:hooks` et les commandes de test pertinentes. `check` doit exécuter les contrôles d’outillage ET produit une fois, sans auto-récursion. Conserver les protections des hooks, y compris pour les worktrees.
- Fusionner les tests dans `test/` : conserver les suites racine et ajouter `unit/`, `integration/`, `runtime/`, `support/`, `fixtures/` et le budget d’artefact. Rebaser les imports et les résolutions de chemins ; ne pas modifier les attentes métier pour rendre la migration verte.
- Fusionner TypeScript et Bun sans perdre `resolveJsonModule`, les types Node/Bun, les options strictes, la randomisation sans retry et les seuils de couverture produit (lignes 0,72 ; fonctions 0,75). Le déplacement ne doit ni diluer artificiellement la couverture produit avec les tests d’outillage ni retirer ces derniers du gate. Conserver des commandes/configurations de vérification séparées seulement si nécessaire pour préserver ces domaines.
- Fusionner les documents produit dans `docs/` en conservant les documents du dépôt. Pour chaque collision, comparer avant écriture et préserver les deux contenus utiles. Le README racine devient l’entrée publique concise : installation des trois hôtes, prérequis et liens vers `docs/getting-started.md`. Le contenu technique utile de l’actuel README racine est conservé dans `docs/repository-guide.md` et relié depuis le README. L’overview et le logo du README produit restent représentés, sans deuxième README canonique.
- Garder `AGENTS.md`, `CLAUDE.md`, les règles Git et les fichiers d’infrastructure à leur place. Ne pas les transformer en règles installées dans `rules/`, ne pas ajouter de hooks plugin ni copier les règles mainteneur dans les skills. Comparer les deux licences avant consolidation et conserver tout avis distinct.
- Après migration complète, supprimer les fichiers obsolètes sous `plugins/forgix/` et le dossier devenu vide. Aucun symlink, wrapper ou double paquet pour maintenir artificiellement les anciens chemins internes.

### Catalogues et ressources installées

Mettre les deux sources de catalogue à `./` (en conservant leur forme respective : objet local pour Codex, chaîne pour Claude). Préserver `acrazie`, `forgix`, les métadonnées et la politique existantes. Étendre leurs validateurs/tests au nouveau contrat ; ne pas simplement contourner les assertions actuelles.

Les manifestes gardent les chemins relatifs à la racine produit (`./skills/`, `assets/logo.svg`, `dist/forgix.mjs`). La résolution des skills depuis leur chemin chargé et `CLAUDE_PLUGIN_ROOT` reste indépendante du checkout utilisateur. Conserver un seul point d’entrée utilisateur et la visibilité actuelle des cinq skills internes.

Les identités, versions et exigences existantes restent inchangées par la seule migration : npm `@acrasie/forgix`, binaire `forgix`, Node >= 26.0.0, Bun 1.4.4 pour le développement, Linux/macOS. Aucune migration des fichiers utilisateurs `.forgix/`, aucun changement de schéma ou de comportement du workflow.

### Installation et compatibilité hôte

Commande cible, à publier comme procédure fonctionnelle seulement après preuve sur un client compatible et un dépôt contenant réellement la nouvelle structure :

```sh
agy plugin install https://github.com/Acrazie/forgix
```

La disponibilité et la fraîcheur de ce dépôt GitHub doivent être vérifiées par rapport à la révision livrée ; aucun mécanisme de synchronisation ne doit être supposé. Si ce miroir ne fournit pas la révision, la publication de cette procédure reste bloquée : ne pas remplacer silencieusement l’URL par Entire ni créer une nouvelle infrastructure de miroir.

Le repli local devient `git clone https://entire.com/et/forgix/forgix.git` puis `agy plugin install ./forgix`. Distinguer explicitement Antigravity CLI et App/for IDEs ; pour ces dernières, guider vers `/plugin` et la procédure officielle de leur surface, sans prétendre que le CLI prouve le fonctionnement graphique. Ne pas inventer de version minimale : relever la première version réellement testée et indiquer honnêtement les clients non vérifiés.

Codex et Claude gardent leurs commandes de catalogue actuelles et `forgix@acrazie`. Une nouvelle session recharge le plugin après mise à jour. Ne pas supprimer automatiquement leurs caches ou installations personnelles. Le changement de source locale dans le catalogue doit être testé comme nouvelle installation et mise à jour ; un échec bloque la livraison, pas un renommage de l’identité publique.

## Packaging, release et sécurité

La racine devient publiable, mais le paquet npm doit rester un artefact d’exécution, pas une archive du dépôt. Remplacer l’inclusion générale de `docs/` et `.claude-plugin/` par une sélection explicite des documents produit et manifestes nécessaires. Exclure les catalogues, tests, sources TypeScript, scripts mainteneur, configurations CI, `.git`, fichiers locaux, secrets et documents de conception du dépôt. Mettre à jour le manifeste de budget avec la liste réelle des fichiers attendus ; conserver les plafonds actuels, sauf décision humaine motivée par des mesures.

Conserver le build ESM autonome, le shebang, le mode exécutable et le bundle racine suivi malgré `dist/` ignoré. Une installation Git ne doit nécessiter ni Bun, ni `node_modules`, ni compilation. Les contrôles de reproductibilité comparent le bundle déplacé à un rebuild après les derniers changements.

Rebaser les imports et chemins de `scripts/release.ts`, `release-lib.ts`, `release-notes.ts`, `release-ci.ts`, Dagger et leurs fixtures sur la racine. Préserver la préparation locale sans publication, les allowlists exactes par cible, la restauration des snapshots, les plans de versions distincts, l’intégrité du tarball, l’idempotence et tous les refus de contexte/tag. Ne pas élargir une allowlist à un dossier entier. Les jobs privilégiés restent Node natif sans installation ni exécution de dépendances projet ; les nouvelles importations restent dans ce périmètre.

Les anciennes révisions/taguages gardent leur disposition historique : ne pas réécrire tags ni historique. Le code exécuté depuis une ancienne révision reste celui de cette révision. Pour toute comparaison d’un parent Git traversant la migration, comparer les fichiers homologues via leurs chemins de chaque révision, sans accepter une absence comme preuve d’égalité. Ajouter un cas de régression avant de toucher ces contrôles ; aucun fallback de chemin permissif dans la publication. La migration structurelle ne constitue pas une préparation de release et ne crée aucun tag.

Rebaser aussi `scripts/renovate-sync.ts`, `renovate.json`, `vite.config.ts`, l’adaptateur staged et les tests d’outillage : une seule cible de paquet, les mêmes exclusions de fixtures/changelog, la même politique de hooks et aucun déclenchement de publication supplémentaire. Buildkite garde sa topologie, son autorité et ses secrets ; Dagger garde ses interfaces publiques et ses images épinglées. Modifier uniquement les chemins et commandes devenus invalides.

## Frontière et déroulement de la future implémentation

Autoriser sous mandat séparé le déplacement du contenu suivi de `plugins/forgix/` et les fusions nécessaires dans les propriétaires nommés ci-dessus ; les tests racine `test/`, `scripts/`, `.agents/plugins/marketplace.json`, `.claude-plugin/`, `.dagger/src/index.ts`, `.buildkite/pipeline.yml` si nécessaire, `package.json`, `bun.lock`, `bunfig.toml`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `renovate.json`, README et CONTRIBUTING sont dans cette frontière. Les ajustements de liens et des ADR affectés accompagnent la migration, notamment ADR 0022 : conserver la décision historique et signaler son remplacement, sans réécrire l’histoire.

Les conceptions historiques ne font pas l’objet d’un remplacement global de chemins. Le document inactif protégé par les instructions du dépôt demeure hors lecture et hors écriture. Aucun changement de dépendance, authentification, permission, hébergement ou règle d’autonomie ; aucun déploiement, tag ou publication dans cette migration.

1. Établir une table des déplacements et collisions, puis déplacer et fusionner sans écrasement de contenu distinct.
2. Adapter commandes, imports, catalogues, packaging et contrôles de release dans une même modification cohérente. Ne pas livrer un catalogue visant une structure absente.
3. Regénérer le lockfile et le bundle, vérifier les différences de dépendances et l’archive réelle, puis exécuter les preuves ci-dessous.
4. Vérifier les clients natifs dans des profils temporaires et finaliser la documentation à partir des résultats. Une installation personnelle ou mise à jour de client demande un accord séparé.

Rollback avant publication : revert cohérent de la migration sur une branche revue, sans reset destructeur. Après publication, ne pas remplacer une version npm ni réécrire un tag ; une correction utilise le processus de release existant. Aucun état utilisateur ne doit être migré pour permettre ce retour.

## Definition of Done

### Design approuvé

Revue indépendante du contrat structurel, de la compatibilité, de la migration et des protections de publication terminée sur le digest courant, aucun Blocker/Major non arbitré, puis approbation humaine de cette révision. Ni l’implémentation ni la publication ne sont autorisées par cette seule approbation.

### Implémentation vérifiée — mandat séparé

- Un seul paquet publiable à la racine ; plus de produit actif sous `plugins/forgix/`. Scanner les anciennes références actives et distinguer les historiques conservés ; les références de code/configuration/documentation utilisateur obsolètes doivent disparaître.
- Une installation propre `bun install --frozen-lockfile` réussit. Les versions résolues restent identiques hors modifications de structure explicitement expliquées. `bun run check` réussit après la dernière modification et couvre outillage, types, lint, tests produit, randomisation, couverture et budget. `bun run test:hooks` confirme les hooks avec CLINT requis ; aucune politique abaissée.
- `bun run pack:runtime` produit `.artifacts/forgix.tgz` ; `bun run test:runtime` réussit avec Node 26 sans dépendances installées dans le sandbox. L’archive et le budget prouvent la présence des ressources et l’absence de fichiers de développement/secrets/catalogues. Tester aussi les liens documentaires et ressources depuis l’archive, pas seulement depuis le checkout.
- Les tests de release/CI passent pour `both`, `npm`, `plugin`, les mauvaises identités/tags/contextes, les modifications hors cible et la restauration. Les jobs privilégiés ne gagnent aucune dépendance externe. Vérifier un historique synthétique traversant le déplacement et une révision à ancienne disposition, sans publier.
- `dagger call check --source=.` et les fonctions Dagger `pack-runtime`, `runtime-smoke`, `release-contract` passent lorsque Dagger/Docker sont disponibles. Sinon, noter explicitement ce gate bloqué ; les tests locaux ne le remplacent pas.
- Claude valide plugin et catalogue ; Codex résout réellement le catalogue vers la racine et les ressources. Tests natifs en profils temporaires : nouvelle installation, mise à jour depuis l’ancienne structure, chargement du skill et résolution du bundle sans build, aucune modification des projets utilisateurs ni des caches personnels.
- Antigravity valide le plugin complet et n’importe aucune règle mainteneur comme règle utilisateur. Toute erreur de validation bloque. Les seuls avertissements admissibles sont ceux identifiés précisément comme fichiers contributeur ignorés (`AGENTS.md`, `CLAUDE.md` si le client le signale ainsi), confirmés par les docs et la sonde native ; tout autre avertissement demande correction. Ne pas déplacer des règles dans `rules/` pour masquer un avertissement, ni désactiver globalement la validation.
- L’installation CLI par URL est prouvée sur la révision livrée, avec version du client, URL et SHA relevés, dans un profil isolé et sans build. Avant disponibilité distante, une installation locale prouve seulement la structure, pas l’URL ; ce gate reste ouvert. L’utilisateur ou le validateur habilité vérifie séparément App/for IDEs via `/plugin` avec ressources et skill chargés ; ne pas déclarer ces surfaces testées à partir du seul CLI.
- Les commandes utilisateur, identités, versions de base, schémas, chemins `.forgix/`, règles d’approbation et résultats métier restent inchangés. Les suites de régression existantes restent applicables.

### Livraison PR / Trail

Après validation humaine de l’implémentation et de ses preuves, autorisation explicite de publication requise : migration des catalogues et du pipeline classée Human-Reviewed. Livrer via le processus Entire du dépôt, sans fusion automatique ; déterminer avec l’utilisateur le Trail existant ou nouveau. Relever URL complète, SHA et checks distants. Une installation par URL encore impossible faute de révision distante maintient le gate d’installation ouvert : ne pas la déclarer vérifiée sur la seule base du Trail. Aucun merge ni déploiement implicite.

## État de revue et approbation

Statut : design approuvé par l’utilisateur le 2026-11-17, avec limites de vérification conservées. Les preuves d’implémentation, d’installation native et de publication ne sont pas exécutées dans ce workflow design-only.

- Domaine du digest : octets UTF-8 précédant le titre `## État de revue et approbation`, titre exclu.
- SHA-256 substantiel : `1ff9b5f60d6c0aa9e4accc9df20054dddaa706fcd86a9c1873398f2e3186bdd2`.
- Sources sélectionnées (SHA-256 des fichiers entiers à la révision locale inspectée) :
  - `package.json` : `618c6056d2c23e8102754762ae3620738835427a378b3eadea0dfe3e177e0429`.
  - `plugins/forgix/package.json` : `766ace0570e6875ab23e12a369f3a164bb5bfd8b3fac6d9d72628d6c425f24ce`.
  - `.agents/plugins/marketplace.json` : `642bc7715b00685d45e861e89af0b57d03e78bfb1620a494d2874f577d4437b8`.
  - `.claude-plugin/marketplace.json` : `19749d458f495b4295f4dfa7c5bbc4bbc8aab854ad1cd6050d60610b1b1486f2`.
  - `plugins/forgix/plugin.json` : `b9b3136288c0e9c296dfa11a54bb86943d614f657610cfa465e3d9a452c1f162`.
  - `plugins/forgix/scripts/release-lib.ts` : `8140a88f750f9a340c2a67d2ab40f37d5df724fc16dc070d5ba35dd93a4d98d2`.
  - `scripts/release-ci.ts` : `7ed261550150af75111570d08ecb3325f7af4911e9c30f6a6b6912f3d5bdcbb3`.
  - `.dagger/src/index.ts` : `fd9171223438019b16ba87ce702b22015f15f90034c657db0a4698040f60b491`.
  - `vite.config.ts` : `f7bc4e8c519b4260bb5bfd62ff617e1b7fa778ed0a07566f6d4a4ff8ccb243ad`.
  - `plugins/forgix/test/artifact-budget.json` : `4db313bb39b1a1a6533ebba4772512cc4a0d64e05b1429130753a804527b71f1`.
  - `plugins/forgix/skills/forgix/SKILL.md` : `d4bc27e69451a08dcf173886538975295875636945949b251e1ee71e06acece7`.

- Revue indépendante terminée : `review_root_migration`, contexte neuf (`fork_turns: none`), persona design-critic et trois standards lus. Le réviseur a recalculé le digest et lu/vérifié les 11 sources sélectionnées. Résultat : aucun Blocker, Major ou Nit identifié sur ce digest. Couverture : structure, packaging, compatibilité, sécurité/autorisation de publication, règles installées, historique de release et rollback.
- Limites : documentation externe et état distant non revérifiés indépendamment ; aucun test/build, aucune installation native ni publication. Le contexte conversationnel est isolé ; l’exclusion des instructions hôte n’est pas démontrée. Les gates d’implémentation restent ouverts, notamment version Antigravity compatible et présence de la révision livrée sur GitHub.
- Approbation humaine : design approuvé le 2026-11-17 (« oui, pour l’implementer »). Workflow approuvé : un implémenteur et deux relecteurs indépendants, tous `gpt-6.1-sol`, une passe de correction puis revalidation ciblée. Exécution explicitement autorisée (« Lance l’implémentation selon ce workflow. »). Aucun commit, push, tag, Trail, merge ni publication autorisé.

- Implémentation lancée : agent `implement_root_product`, modèle demandé `gpt-6.1-sol` via sélection explicite ; identité effective non rapportée par le runtime, donc non vérifiée. Écritures de production réservées à cet agent ; coordinateur propriétaire des métadonnées du présent document.

### Résultat d’implémentation locale — 2026-11-17

- Produit déplacé à la racine ; un seul paquet, catalogues vers `./`, scripts/tests/configurations fusionnés et paquet d’exécution explicitement sélectionné. Les sources métier déplacées sont byte-identiques à la base inspectée ; versions/checksums des dépendances inchangés hors suppression des entrées workspace.
- Snapshot d’implémentation corrigé : inventaire de 224 fichiers, SHA-256 `fe4b0252e5d6fc2e5546b0ed73783dddb4bd564eb76ea14462d234c7483dd288`, conservé temporairement à `/private/tmp/forgix-root-corrected-manifest.json`. Le coordinateur a vérifié les contenus et modes. Le présent état de suivi est hors domaine de cet inventaire.
- Deux revues indépendantes Sol sur le snapshot initial ont identifié le même unique P2 : destination de copie manuelle Antigravity incorrecte dans le guide conservé. Une seule passe de correction a modifié le guide et ajouté un test rouge/vert. Deux nouvelles revalidations isolées ont accepté ces corrections ; les autres fichiers du snapshot sont inchangés. Aucune finding matérielle ouverte dans la couverture examinée. Les modèles ont été demandés explicitement via `gpt-6.1-sol` ; le runtime ne rapporte pas leur identité effective.
- Preuves locales après dernière correction : `bun run check` terminé avec 51 tests d’outillage et 152 tests produit, zéro échec ; couverture 96,53 % fonctions / 91,81 % lignes ; budget inchangé. Tests additionnels sur fichiers/artefact inchangés : hooks 2 tests/63 assertions, runtime Node 26.8.1 7 tests, release 25 tests/109 assertions. Les relecteurs ont aussi exécuté 37 tests release/CI et 7 tests runtime en scratch sur le snapshot initial ; une revalidation a réexécuté les 5 tests documentaires corrigés en scratch.
- Bundle `dist/forgix.mjs` : SHA-256 `53b7b2dd01f31fb828e49c5338510db645383b76bd6f96fc0af43902a05e93c4`, mode 0755, identique à l’ancien bundle. Archive : SHA-256 `4c0645a0225c13f0b53edb037dcf085cb57e312b1e8a689945e43df08743e3e0`. Mesures : bundle 381746, archive 202838, décompressé 672129 octets, tous sous plafonds existants. Le bundle racine reste ignoré/non stagé : son inclusion explicite sera impérative lors d’une livraison ultérieure autorisée.
- Installation propre frozen et sondes de profils temporaires rapportées par l’implémenteur : Codex 0.163.0 installation/actualisation locales réussies ; Claude 2.1.252 validation et réinstallation natives réussies, update même version no-op documenté ; Antigravity 1.5.2 installation locale, six skills, zéro règle/hook, seul avertissement de fichier contributeur ignoré. Ces preuves de chargement/installations ne démontrent pas une exécution authentifiée du workflow complet.
- Gates ouverts : Dagger réellement tenté mais bloqué par daemon Docker/OrbStack absent ; autres fonctions Dagger non exécutées. Installation depuis URL sur révision distante livrée, exécution authentifiée des skills et surfaces App/for IDEs non vérifiées. Aucune livraison complète déclarée. Aucun changement d’infrastructure, cache personnel, version, tag ou hébergement pour contourner ces limites.
- Écart d’exécution : la première collecte globale d’empreintes par l’implémenteur a lu les octets du document protégé avant exclusion, sans affichage ni modification de son contenu. Les inventaires ultérieurs excluent ce document avant toute lecture. Cet écart n’est pas assimilé à une autorisation.
- État de livraison : modifications locales uniquement, aucun stage/commit/push/Trail/tag/merge/publication. Validation humaine et autorisation de publication restent nécessaires selon le design.

### Vérifications Dagger après démarrage d’OrbStack — 2026-11-17

- L’utilisateur a autorisé le full check après ouverture d’OrbStack. Accès au socket Docker via escalade sandbox ; aucune modification d’infrastructure.
- `dagger call check --source=.` : échec, 51 tests outillage passent, puis 151 tests produit passent et 1 échoue. Le test `retired local publication option exits without modifying the worktree` appelle `git status` dans `/workspace`, où le fichier `.git` du worktree référence un répertoire hôte macOS absent du conteneur. Le gate reste rouge ; aucun correctif ni contournement appliqué.
- `dagger call pack-runtime --source=. --output=/private/tmp/root-dagger-runtime.tgz` : succès.
- `dagger call runtime-smoke --source=. --tarball=/private/tmp/root-dagger-runtime.tgz` : succès, 7 tests Node passent, zéro échec.
- `dagger call release-contract --source=.` : échec, 24 tests passent et 1 échoue, pour le même test et le même contexte Git de worktree indisponible dans le conteneur.
- Journaux : `/private/tmp/root-dagger-check.log`, `/private/tmp/root-dagger-pack.log`, `/private/tmp/root-dagger-smoke.log`, `/private/tmp/root-dagger-release.log`. Gates d’installation distante/App/IDE inchangés. Aucun fichier de production modifié, aucun commit ni publication.

### Correction ciblée du test Git et full check vert — 2026-11-17

- Autorisation utilisateur supplémentaire obtenue pour corriger le défaut Dagger, puis revérifier. Seuls `test/integration/release-notes.test.ts` et `test/integration/release-preparation.test.ts` ont été modifiés : le test de refus de publication utilise désormais la fixture Git autonome existante et invoque le véritable script copié depuis un cwd sans dépôt. Préservation HEAD/tags/index/statut/contenus vérifiée ; aucune modification du code release ou de Dagger, aucun skip.
- Snapshot corrigé : `/private/tmp/forgix-root-dagger-fixed-manifest.json`, SHA-256 `58b0351722df306c61af2a2c757984257ceaa17be9058d3bb41de5f5e96677bd` (229 fichiers). Six changements de hooks tiers ont été détectés et préservés, annotés séparément dans `/private/tmp/root-dagger-fix-snapshot-annotations.json` ; ils ne sont ni des modifications autorisées de cette correction, ni validés par les revues ciblées.
- Après dernières éditions : check local vert (51 tests outillage, 152 produit), Dagger `check` vert (51 + 152), `pack-runtime` réussi, `runtime-smoke` 7/7, `release-contract` 25/25 (116 assertions). Bundle et archive inchangés. Journaux `/private/tmp/root-dagger-fix-{check,pack,smoke,release}.log` et `/private/tmp/root-dagger-fix-check-local.log`.
- Deux nouvelles revalidations indépendantes Sol ont accepté le correctif ciblé sur ce snapshot ; aucun défaut démontré. Un relecteur a exécuté le test indépendamment en scratch (1 passe, 10 assertions). Le coordinateur a inspecté patch et journaux et vérifié les empreintes/modes.
- Le gate Dagger est désormais satisfait ; les preuves d’installation URL distante et App/for IDEs restent ouvertes. Aucun stage, commit, push, Trail, tag ou publication effectué.

### Résolution du conflit avec main — 2026-11-17

- À la demande de l’utilisateur, intégration de `origin/main` (`c33414eccce8d921217c9362833b8f0e14eeca16`) et du commit produit publié (`d6806b841ddb6143972876e638a833c1c6aa7fc4`) dans un worktree dédié, sans stash ni modification du checkout original contenant des hooks locaux non commités.
- Seul conflit : README. Résolution préservant la simplification de main (106 lignes, 447 mots), bannière/badges, parcours et garanties, tout en adaptant les chemins à la racine. Bannière existante liée par URL publique épinglée à une révision vérifiée, pour ne pas embarquer le PNG de 4 Mo ; icônes SVG des manifestes toujours locales. Aucun nouveau service d’hébergement. Tests de liens Markdown et HTML adaptés dans deux suites ; hooks et test correspondant intégrés sans modification depuis main.
- Snapshot revu : inventaire `/private/tmp/forgix-root-base-sync-manifest.json`, SHA-256 `54fd9589bc57349655ab4d77b22a4a477c23912e69ba6550f7690906d3a788a3` (229 fichiers). Les deux designs et le document protégé sont exclus du calcul avant lecture. Deux nouvelles revues Sol indépendantes : ACCEPT, aucun défaut démontré ; vérification des fichiers, modes, archive et garanties.
- Après dernières éditions : check local et Dagger verts (51 tests outillage + 152 produit), documentation 5/75 assertions, hooks 2/63, packaging réussi, runtime Dagger 7/7, release 25/116 assertions. Archive 203476 octets, décompressée 673530 ; SHA-256 `6a750633e21f5294080b8087b02d0e57170fb700674519d85178e5f87b43cc72`, plafonds inchangés. Journaux `/private/tmp/root-sync-{check-local,docs,hooks,dagger-check,dagger-pack,dagger-smoke,dagger-release}.log`.
- Autorisation de mise à jour de la branche du Trail dans le cadre de la résolution ; aucune fusion du Trail, réécriture publiée ou publication de release autorisée. Gates d’installation native distante et App/IDE toujours ouverts.

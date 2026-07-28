# Codex Dev Flow — Roadmap du lifecycle

## Objectif

Cette roadmap pilote l'optimisation, la simplification et la fiabilisation du lifecycle de Codex Dev Flow.

Elle sert de point de reprise partagé entre le mainteneur et Codex. Elle décrit la progression globale du plugin, pas le plan détaillé d'un changement isolé.

## Comment utiliser cette roadmap

Au début d'une session :

1. Lire `Position actuelle`.
2. Vérifier l'unique élément marqué `[>]`.
3. Lire son bloc `Contexte de reprise`.
4. Confirmer que dépendances et état Git permettent de continuer.
5. Exécuter seulement la prochaine unité bornée.

À la fin d'une session :

1. Mettre à jour les cases concernées.
2. Déplacer `[>]` vers la prochaine unité de travail.
3. Mettre à jour `Position actuelle` et `Dernière mise à jour`.
4. Renseigner décisions, fichiers, preuves et prochaine action.
5. Ne jamais marquer `[x]` sans preuve vérifiable.

### Invariants du tracker

- Une seule unité porte `[>]`, sauf parallélisme explicitement déclaré dans `Position actuelle`.
- `Position actuelle` pointe exactement vers cette unité et son chantier porte le statut `active`.
- Une unité passe à `[x]` seulement avec preuve datée : commande et résultat, diff, commit ou artifact relisible.
- Un chantier passe à `done` seulement si toutes ses unités sont `[x]` ou `[-]` et ses critères de sortie sont vérifiés.
- Un chantier passe à `blocked` seulement avec au moins une unité `[!]`, sa cause et l'action de déblocage.
- Codex peut mettre à jour progression et preuves après travail vérifié. Changement de priorité, scope, dépendance, décision structurante ou abandon exige confirmation humaine.
- Après chaque édition, vérifier que identifiants, position, statuts, dépendances et cases restent cohérents.

### Légende

- `[ ]` : planifié
- `[>]` : travail actuel ou prochaine reprise
- `[x]` : terminé et vérifié
- `[!]` : bloqué ; raison obligatoire
- `[-]` : abandonné ou devenu inutile ; justification obligatoire

### Statuts de chantier

- `planned` : pas commencé
- `active` : chantier commencé ; une unité peut être courante ou le chantier peut avancer transversalement
- `blocked` : obstacle externe ou décision humaine requise
- `done` : critères de sortie tous vérifiés

## Position actuelle

- Chantier : `P1 — État durable et reprise fiable`
- Unité : `P1.3 — Réconciliation au resume`
- Statut : `active`
- Dernière mise à jour : `2026-07-19`
- Prochaine action : implémenter réconciliation config, policy, routing, artifact et Git, puis invalidation sélective fail-closed du Context Capsule.

## Lifecycle cible

Le produit expose six macro-phases simples. Les états internes restent plus précis pour permettre reprise, audit et gestion des erreurs.

```text
1. INTAKE
   request + mode + config + policy + routing

2. SHAPE
   discover + specification + plan

3. GATE
   approval humaine

4. BUILD
   execute + validation locale + corrections

5. ASSURE
   review + résolution + vérification finale

6. HANDOFF
   commit + push + pull request ou finished_local
```

`WORKTREE` n'est pas une macro-phase : c'est une garde d'entrée obligatoire pour Critical. Les gates Critical restent des contrôles distincts à l'intérieur de `GATE`.

### Sémantique des contrôles

- `validate` : feedback rapide pendant implémentation, normalement après chaque tâche.
- `review` : inspection du diff contre contrat approuvé, risques, régressions et maintenabilité.
- `verify` : preuve finale reliant chaque critère d'acceptation aux résultats observés.
- `resolve` : correction contrôlée des échecs de validation, findings de review ou échecs de vérification.

## Principes non négociables

- Consommation quota/tokens est fonction d'optimisation ; fiabilité et absence de faux succès restent contraintes dures.
- `merge: never` reste invariant.
- Standard exige discovery, plan, approbation, exécution, review et vérification.
- Critical exige worktree, threat model, rollback, gates humaines et reviewers read-only.
- Aucun succès sans preuve.
- Aucun élargissement silencieux du scope.
- État machine local sous `.codex/tasks/` ; change artifact logique versionné à l'emplacement choisi par policy/repository.
- Roadmap globale, change artifact et état machine ne doivent pas dupliquer la même responsabilité.
- Chaque phase réutilise contexte provenancé et frais ; contexte périmé déclenche réinspection ou blocage, jamais confiance silencieuse.

## Baseline vérifiée

État observé le `2026-07-18` :

| Capacité | État actuel | Écart restant | Preuve |
| --- | --- | --- | --- |
| Types d'état | 17 statuts déclarés | Définir automate complet et macro-phases | `plugins/codex-dev-flow/src/types.ts` |
| Transitions | Parcours Quick partiel en mémoire | `discovering`, `planning`, `awaiting_approval`, reprise et erreurs sans transitions complètes | `plugins/codex-dev-flow/src/state.ts` |
| Schéma d'état | Schéma V1 strict | Contraindre `resumeTo`, gardes conditionnelles et migration | `plugins/codex-dev-flow/schemas/state.schema.json` |
| Persistance | Aucune lecture/écriture de `state.yaml` | Implémenter persistance atomique et reprise | Recherche dans `plugins/codex-dev-flow/src/` |
| `status` | Sortie placeholder read-only | Charger et résumer état réel | `plugins/codex-dev-flow/src/cli.ts` |
| `resume` | Parsing et routing présents | Charger état/artifact, réconcilier et reprendre | `plugins/codex-dev-flow/src/cli.ts` |
| Artifacts | Contrat logique documenté ; anciens layouts Standard/Critical restent fixtures legacy | Auditer projections policy-selected, liaison et migration | `plugins/codex-dev-flow/docs/artifacts.md` |
| Fingerprints et corrections | Primitives et tests présents | Intégrer compteurs et décisions au lifecycle durable | `plugins/codex-dev-flow/src/fingerprint.ts` |
| Worktree Critical | Décision obligatoire implémentée et testée | Intégrer création/reprise dans orchestration | `plugins/codex-dev-flow/src/worktree.ts` |
| Coût par phase | Baseline structurelle P0 Quick/Standard/Critical ; tokens/latence explicitement indisponibles | Collecter runtime mesuré/estimé après orchestration durable sans contenu sensible | `docs/baselines/2026-07-18-p0-lifecycle.json`, 2026-07-18 |
| Validation repo | 57 tests réussis | Ajouter parcours lifecycle bout en bout | `npm run check`, 2026-07-18 |

Cette baseline distingue primitives existantes, intégration manquante et claims produit. Un test vert prouve comportement couvert, pas lifecycle cible complet.

---

## P0 — Réaligner les contrats du lifecycle

**Statut :** `done`
**Priorité :** critique  
**Dépendances :** aucune

### Pourquoi

Documentation, schéma et implémentation ne décrivent pas encore exactement le même automate. Certains statuts Standard existent dans les types, mais leurs transitions ne sont pas toutes implémentées.

### Travail

- [x] **P0.1 — Définir la state machine canonique**
  - Décrire chaque état, ses entrées, sorties, gardes et erreurs autorisées.
  - Décrire pour chaque macro-phase intention, préconditions, entrées consommées, sorties produites, propriétaires, événements, preuves, reprise et métriques.
  - Distinguer statuts internes et macro-phases utilisateur.
  - Définir parcours Quick, Standard et Critical dans les six macro-phases.
  - Définir boucles `validate`, `review`, `resolve` et `verify` au niveau contractuel.
  - Définir sémantique de `cancelled`, `failed`, `finished_local`, `ready_for_handoff` et `finished`.
  - Définir transitions de `blocked` et `ready_for_handoff` lors d'un resume.
  - Appliquer D-01 et D-02 ; produire table état → macro-phase, transitions, gardes, erreurs et terminalité.
  - Lier contrats de phase aux ADR 0002 à 0005 sans dupliquer leurs décisions.
  - Preuve : contrat normatif `plugins/codex-dev-flow/docs/lifecycle-contract.md` (états, gardes, transitions, modes, boucles, six contrats consume/produce/invalidation/métriques) ; glossaire complété ; `npm --prefix plugins/codex-dev-flow run check` réussi, 57/57 tests, 2026-07-18.
- [x] **P0.2 — Aligner contrats publics**
  - Aligner `README.md`, `plugins/codex-dev-flow/README.md`, `plugins/codex-dev-flow/docs/design.md`, `plugins/codex-dev-flow/docs/artifacts.md` et skills lifecycle.
  - Créer ou retirer liens vers ADR et glossary absents.
  - Distinguer capacités disponibles, primitives partielles et cible roadmap ; retirer claims V1 non implémentés.
  - Retirer anciennes conventions d'artifacts Standard.
  - Preuve : documentation publique et sept skills lifecycle alignés sur les six macro-phases ; layouts Standard/Critical historiques déclarés choix repository non normatifs ; glossaire et tests contractuels artifacts/roadmap/audit réalignés ; 52 liens locaux vérifiés ; `npm --prefix plugins/codex-dev-flow run check` réussi, 59/59 tests, 2026-07-18.
- [x] **P0.3 — Aligner code et schémas**
  - Corriger `plugins/codex-dev-flow/src/state.ts`, `plugins/codex-dev-flow/src/types.ts` et `plugins/codex-dev-flow/schemas/state.schema.json`.
  - Appliquer migration V1→V2 définie par D-03 avant accepter états persistés existants.
  - Refuser toute transition non documentée.
  - Preuve : registry profondément immuable et mode-aware ; attestations liées au fingerprint/révision et historisées ; gates liées au digest ; reprise réconciliée avec gardes cible ; validation V2 schema+replay ; migration V1 exacte refusant HANDOFF/succès non prouvés ; projection normalisée exacte. Review indépendante finale a identifié trois bypass résiduels (Critical direct, migration HANDOFF, fingerprint de reprise), tous corrigés avec tests. Faute d'evaluators fiables dans P0.3, succès/HANDOFF restent explicitement bloqués. `npm --prefix plugins/codex-dev-flow run check` réussi, 70/70 tests, 2026-07-18.
- [x] **P0.4 — Tester parcours complets**
  - Standard heureux : `new` jusqu'à `finished_local`.
  - Quick heureux et Critical avec worktree/gates.
  - Boucle validation/résolution.
  - Boucle review/résolution.
  - Blocage, reprise et handoff externe.
  - Preuve : evaluators guard-specific à exigences de vérification liées à l'état, receipts immuables/reload-validables et contrôle de cibles HANDOFF/Critical ; tests complets Quick, Standard, Critical avec deux gates, boucles BUILD/ASSURE, blocage/reprise et handoff externe jusqu'à `finished`. Revue ciblée a corrigé sélection tardive des critères et perte du receipt après blocage du gate Critical. `npm --prefix plugins/codex-dev-flow run check` réussi, 75/75 tests ; `git diff --check` réussi, 2026-07-18.

### Critères de sortie

- Une source de vérité canonique existe.
- Chaque état possède macro-phase, transitions testées ou statut terminal explicite, gardes et erreurs autorisées.
- Chaque mode possède parcours complet sans introduire macro-phase supplémentaire.
- Chaque macro-phase déclare champs Context/Diff Capsule consommés, produits et invalidés.
- Documentation, types, schéma et code concordent.
- Tests traversent au minimum parcours heureux Standard, branche Quick et gardes Critical.

### Contexte de reprise

- Dernière décision : exposer six macro-phases sans supprimer précision des états internes.
- Fichiers probables : `plugins/codex-dev-flow/test/state.test.mjs`, `plugins/codex-dev-flow/test/schema.test.mjs`, `plugins/codex-dev-flow/src/state-machine.ts`, `plugins/codex-dev-flow/src/state.ts`.
- Preuve disponible : registry exécutable et projections V2 alignés ; tests unitaires P0.3 couvrent dérivation totale, refus de transition/garde, reprise/source terminale et migration claire/ambiguë/future.
- Décisions prises : D-01, D-02 et ADR 0002 à 0005.
- Plan approuvé : T0–T9 dans `docs/dev-flow/2026-07-18-plugin-lifecycle-audit.md`.
- Décision prise pour P0.3 : D-03.
- Preuve P0.1 : `plugins/codex-dev-flow/docs/lifecycle-contract.md` et 57/57 tests réussis le 2026-07-18.
- Preuve P0.2 : README racine/plugin, design, artifacts, glossaire et sept skills alignés ; tests documentaires contradictoires remplacés ; liens locaux et 59/59 tests réussis le 2026-07-18 ; aucun runtime, source ou schéma modifié.
- Preuve P0.3 : `src/state-machine.ts`, projection JSON normalisée, état/schéma V2, migration pure V1→V2, review indépendante et 70/70 tests adversariaux/fonctionnels réussis le 2026-07-18 ; aucune persistance ni orchestration de parcours ajoutée.
- Preuve P0.4 : `test/lifecycle-paths.test.mjs`, evaluators/receipts V2 et 75/75 tests réussis ; P0 satisfait ses critères de sortie.
- Suite exécutée : P8.1 terminé ; position globale désormais sur P1.1.

---

## P1 — État durable et reprise fiable

**Statut :** `active`
**Priorité :** critique  
**Dépendances :** P0

### Travail

- [x] **P1.1 — Persistance atomique et versionnée**
  - Lire et écrire `.codex/tasks/<task-id>/state.yaml`.
  - Utiliser écriture temporaire puis renommage atomique.
  - Valider état avec schéma avant sauvegarde et après chargement.
  - Appliquer D-03 : V1→V2 réversible, version inconnue refusée et aucune migration ambiguë.
  - Preuve : `TaskStateStore` charge/sauvegarde V2 validé, migre V1 en mémoire ou explicitement avec backup byte-identical et publication atomique no-clobber ; confinement symlink, collisions temp, échecs rename, migrations ambiguës/futures et retry couverts. Review indépendante verte après correction de trois findings. 14/14 tests ciblés, 106/106 globaux et `git diff --check` réussis, 2026-07-18.
- [x] **P1.2 — Contexte de reprise minimal**
  - Ne pas persister `macroPhase` ; la dériver selon D-02.
  - Persister mode, tâche courante, `remainingActions`, artifact et worktree actifs.
  - Conserver 200 événements structurés récents et résumé compact selon D-05.
  - Ajouter Context Capsule compact avec provenance, fingerprints et références vers propriétaires des données.
  - Preuve : état V2 enrichi sans `macroPhase`, contexte de reprise et Context Capsule par références propriétaires, historique structuré borné à 200 avec compaction et ancre de gate durable, migration V1 déterministe et compatibilité V2 antérieure. Review indépendante verte après correction du rebind de gate compactée, des événements non bornés, du calendrier RFC 3339 et des régressions de références publiques. 46/46 tests ciblés de re-review, 117/117 globaux, typecheck et `git diff --check` réussis, 2026-07-19.
- [>] **P1.3 — Réconciliation au resume**
  - Comparer config, policy, routing, artifact et état Git.
  - Classer changements en compatibles, confirmation requise ou bloquants.
  - Invalider seulement sections de capsule affectées ; toute ambiguïté déclenche réinspection ou blocage.
- [ ] **P1.4 — Reprise des états stables**
  - Reprendre depuis `blocked` via `resumeTo`.
  - Reprendre handoff depuis `ready_for_handoff` sans réexécuter implémentation.
  - Empêcher duplication d'artifact pour même tâche.
- [ ] **P1.5 — Tests de crash/reprise**
  - Interruption entre chaque macro-phase.
  - État partiellement écrit ou invalide.
  - Artifact absent, déplacé ou divergent.
  - Migration V1 claire, migration ambiguë, version future et compaction au 201e événement.
  - Capsule fraîche, invalidation Git/config/policy/artifact et invalidation sélective.

### Critères de sortie

- Une nouvelle session reprend tâche sans reconstruire contexte manuellement.
- Écriture interrompue ne corrompt pas dernier état valide.
- Incohérences produisent diagnostic actionnable, jamais reprise silencieuse.
- Reprise réutilise contexte frais sans reconstruire conversation ni recopier preuves détaillées.
- Fixtures couvrent dernière version, au moins une ancienne version supportée et version inconnue refusée.

### Contexte de reprise

- Dernière décision : état machine reste local et gitignored.
- Décisions prises : D-02, D-03 et D-05.
- Preuve P1.2 : contexte compact provenancé, historique D-05 et compaction avec binding de gate validés par review indépendante et 117/117 tests.
- Prochaine action : P1.3, réconcilier snapshots et fingerprints puis invalider seulement sections affectées.

---

## P2 — Tracking partagé avec Codex

**Statut :** `active`  
**Priorité :** haute  
**Dépendances :** aucune pour roadmap et son contrôle de cohérence ; P1 pour automatisation liée à l'état des tâches

### Travail

- [x] **P2.1 — Versionner roadmap globale**
  - Ajouter légende, position actuelle, chantiers et contexte de reprise.
  - Preuve : commit `6d9a8c0` (`add roadmap`).
- [x] **P2.2 — Définir protocole de mise à jour**
  - Invariants et droits d'édition définis dans `Comment utiliser cette roadmap`.
  - Preuve : section `Invariants du tracker`, 2026-07-18.
- [ ] **P2.3 — Lier tâches Dev Flow à roadmap**
  - Ajouter identifiant de chantier facultatif, par exemple `P3.2`, au change artifact.
  - Éviter couplage obligatoire pour utilisateurs externes du plugin.
- [x] **P2.4 — Ajouter contrôle de cohérence**
  - Vérifier unicité de `[>]` et correspondance exacte avec `Position actuelle`.
  - Vérifier existence des identifiants et dépendances référencés.
  - Signaler statuts `planned`, `active`, `blocked` ou `done` incompatibles avec cases enfants.
  - Preuve : validateur `scripts/check-roadmap.mjs` intégré à `npm run check`, 12 tests ciblés, review indépendante verte après correction de trois faux négatifs/positifs, suite complète 92/92 et `git diff --check` réussis, 2026-07-18.

### Critères de sortie

- Sur trois reprises consécutives, mainteneur ou Codex identifie unité, dépendances, preuve disponible et prochaine action en moins d'une minute depuis ce fichier seul.
- Chaque session laisse contexte suffisant pour session suivante.
- Roadmap ne remplace ni change artifact ni état machine.
- Contrôle automatique échoue si position, `[>]`, statuts ou dépendances divergent.

### Contexte de reprise

- Dernière décision : `docs/ROADMAP.md` devient tracker global humain.
- Fichier : `docs/ROADMAP.md`.
- Preuve disponible : fichier versionné par `6d9a8c0` et protocole défini le 2026-07-18.
- Prochaine action : lier identifiant roadmap facultatif au change artifact.

---

## P3 — Commandes `status` et `resume`

**Statut :** `planned`  
**Priorité :** haute  
**Dépendances :** P1

### Travail

- [ ] **P3.1 — Rendre `status` fonctionnel**
  - `status <task-id>` charge tâche exacte.
  - `status` sans ID sélectionne seulement un candidat non terminal unique.
  - Zéro candidat retourne `no_active_task` ; plusieurs retournent `ambiguous_active_task` avec liste triée.
  - Signaler états invalides séparément ; ne jamais les ignorer silencieusement.
  - Afficher mode, macro-phase, état interne, progression, blocage et prochaine action.
- [ ] **P3.2 — Rendre `resume` déterministe**
  - Garder `<task-id>` obligatoire et valider identifiant contre traversée de chemin.
  - Charger état et artifact existants.
  - Réconcilier snapshots et checkout.
  - Reprendre première action restante compatible.
- [ ] **P3.3 — Sorties humain et JSON**
  - Garder affichage compact pour conversation.
  - Fournir format structuré stable pour automation.
- [ ] **P3.4 — Diagnostics actionnables**
  - Distinguer identifiant invalide, tâche inconnue, aucune tâche active, sélection ambiguë, état invalide, version non supportée, config changée, route absente et autorisation manquante.

### Sortie utilisateur cible

```text
Task: lifecycle-roadmap
Mode: standard
Macro phase: BUILD
Internal state: validating
Progress: 7/12
Current task: P3.2
Blocked by: none
Next action: run state transition tests
Artifact: <artifact-identity> (<persisted-location>)
```

### Critères de sortie

- `status` ne reste plus placeholder.
- `resume` ne répète aucune tâche déjà prouvée complète.
- Snapshots de tests couvrent sorties humain/JSON stables et chaque diagnostic principal.

---

## P4 — Artifacts plus légers et cohérents

**Statut :** `planned`  
**Priorité :** haute  
**Dépendances :** P0, P1

### Responsabilités

- Roadmap : direction globale et progression entre chantiers.
- Change artifact : propriétaire logique versionné du contrat, plan, risques et références de preuves d'un changement.
- `state.yaml` : progression machine locale et reprise.
- ADR : décision architecturale durable.

### Travail

- [ ] **P4.1 — Auditer duplications**
  - Produire matrice information → propriétaire unique → liens consommateurs.
- [ ] **P4.2 — Stabiliser contrat logique et projections d'artifact**
  - Base présente : `plugins/codex-dev-flow/docs/artifacts.md` et tests contractuels d'artifact.
  - Écart : implémenter champs minimaux, identité/digest et projection physique choisie par policy/repository, sans convention Standard implicite.
- [ ] **P4.3 — Stabiliser les records de risque Critical dans le change artifact**
  - Base présente : threat, risque opérationnel, rollback et preuves définis comme champs/records logiques.
  - Écart : relier records applicables à chaque gate Critical et tester projections mono-fichier, multi-fichier ou repository-native.
- [ ] **P4.4 — Ajouter liens sans recopier contenu**
- [ ] **P4.5 — Définir migration des anciens artifacts**
  - Détecter formats historiques, choisir réutilisation, conversion explicite ou refus actionnable.
- [ ] **P4.6 — Lier approvals au contrat canonique**
  - Persister type de gate, acteur, date, identité d'artifact et digest de projection canonique.
  - Invalider changement matériel ; traiter changement ambigu comme matériel.
  - Présenter seulement delta structuré lors d'une re-gate.

### Critères de sortie

- Chaque information possède propriétaire unique.
- Resume retrouve artifact par locator et identité persistés, puis vérifie fingerprint/digest ; un chemin exact n'est qu'une projection filesystem, sans recherche par glob ou slug supposé.
- Standard n'impose aucun layout physique ; policy/repository choisit projection mono-fichier, multi-fichier ou repository-native.
- Fixtures couvrent projections logiques Standard/Critical, anciens layouts seulement comme formats legacy/migration, et artifact divergent.
- Aucun `approved: true` isolé ne peut autoriser exécution.

---

## P5 — Boucles d'exécution, review et debug

**Statut :** `planned`  
**Priorité :** haute  
**Dépendances :** P0, P1

### Travail

- [ ] **P5.1 — Implémenter boucle par tâche canonique** : `execute → validate → resolve`, avec checkpoint atomique et checks déterministes progressifs.
- [ ] **P5.2 — Implémenter boucle globale canonique** : `review → resolve → validate`, depuis Diff Capsule sans rediscovery globale.
- [ ] **P5.3 — Implémenter gate finale canonique** : `verify` contre chaque critère d'acceptation.
- [ ] **P5.4 — Intégrer fingerprints existants** pour échecs et findings dans état durable.
- [ ] **P5.5 — Intégrer escalade debug existante** après deux corrections stables ratées.
- [ ] **P5.6 — Intégrer gate humaine existante** avant quatrième correction d'une même cause.
- [ ] **P5.7 — Limite review** à trois cycles globaux.
- [ ] **P5.8 — Réutiliser preuves et findings frais** ; invalider seulement si code ou hypothèse concernée change.

### Critères de sortie

- Validation rapide et vérification finale ne sont plus ambiguës.
- Compteurs suivent cause stable, pas simple texte ou numéro de ligne.
- Boucles infinies impossibles sans gate humaine explicite.
- Tests démontrent seuils 2/3/4 corrections et arrêt au troisième cycle de review.
- Succès déterministe simple ne déclenche aucun appel LLM de commentaire.

---

## P6 — Modes adaptatifs

**Statut :** `planned`  
**Priorité :** moyenne  
**Dépendances :** P0 à P5

### Parcours cibles

```text
quick:    INTAKE → BUILD → ASSURE → HANDOFF
standard: INTAKE → SHAPE → GATE → BUILD → ASSURE → HANDOFF
critical: INTAKE → SHAPE → GATE → BUILD → ASSURE → HANDOFF
```

Pour Critical, worktree obligatoire = garde dans INTAKE ; threat model et rollback = exigences SHAPE ; gates séparées = contrôles dans GATE ; reviewers read-only = exigences ASSURE.

### Travail

- [ ] **P6.1 — Implémenter critères de sélection définis en P0**
- [ ] **P6.2 — Implémenter escalade automatique de risque définie en P0**
- [ ] **P6.3 — Tester interdiction de rétrogradation silencieuse**
- [ ] **P6.4 — Implémenter et vérifier gates Critical séparées dans `GATE`**
- [ ] **P6.5 — Tester scope expansion pendant exécution**
- [ ] **P6.6 — Ordonner INTAKE économique**
  - Parse, config/policy, risque et mode précèdent routing et traitements coûteux.
  - Capturer routing seulement après confirmation définitive du mode.
  - Conserver refus de mode comme `cancelled` auditable.
- [ ] **P6.7 — Adapter lanes Critical au risque applicable**
  - Conserver reviewers indépendants.
  - Autoriser omission seulement avec non-applicabilité structurée ; ambiguïté active lane.

### Critères de sortie

- Même concept de macro-phase fonctionne dans trois modes.
- Plus de rigueur ajoute des gates, pas un second lifecycle divergent.
- Aucune rétrogradation de mode, omission de lane ou économie de contexte ne peut réduire assurance silencieusement.

---

## P7 — Handoff et finition

**Statut :** `planned`  
**Priorité :** moyenne  
**Dépendances :** P1, P3, P5

### Travail

- [ ] **P7.1 — Implémenter états finaux définis en P0**
  - `finished_local` : aucun handoff externe requis.
  - `ready_for_handoff` : code et preuves prêts, autorisation/action externe manque.
  - `finished` : toutes exigences, dont PR éventuelle, satisfaites.
- [ ] **P7.2 — Afficher actions Git/GitHub restantes**
- [ ] **P7.3 — Générer résumé final déterministe depuis critères, preuves et reçus sans appel LLM supplémentaire**
- [ ] **P7.4 — Tester absence d'autorisation Git/GitHub**
- [ ] **P7.5 — Vérifier invariant `merge: never`**
- [ ] **P7.6 — Rendre handoff idempotent**
  - Persister identités et reçus commit/push/PR.
  - Réconcilier état local et distant avant retry ; ne jamais dupliquer action existante.

### Critères de sortie

- Aucun manque d'autorisation n'est présenté comme succès complet.
- Handoff peut reprendre sans rejouer BUILD ou ASSURE.
- Handoff requis ou sélectionné mais incomplet produit `ready_for_handoff`, jamais `finished_local`.

---

## P8 — Dogfooding et simplification finale

**Statut :** `active`
**Priorité :** critique pour P8.1 ; moyenne pour P8.2 à P8.6
**Dépendances :** P0 pour P8.1 ; P0 à P7 pour P8.2 à P8.6

### Mesures

- Temps entre invocation `resume` et première action utile, médiane et p90.
- Nombre de confirmations humaines par changement et par mode.
- Nombre de transitions, cycles de correction et gates par changement.
- Phases sans sortie utilisée par phase suivante.
- Champs dupliqués entre roadmap, artifact et état.
- Nombre d'erreurs de transition, reprises bloquées et reprises silencieusement divergentes.
- Nombre de décisions de routing et pression quota initiale par changement.
- Appels modèle, délégations, modèle/effort, tokens natifs si exposés ou estimation explicitement étiquetée.
- Taille contexte, taux réutilisation/invalidation des capsules et lanes review activées.
- Nombre de faux succès détectés, cible absolue `0`.

### Travail

- [x] **P8.1 — Définir protocole et baseline de mesure avant changements comportementaux**
  - Ne stocker ni prompt, code brut, secret ou sortie complète.
  - Capturer baseline Quick, Standard et Critical après contrat P0.
  - Ajouter mesure avant/après à chaque chantier P1 à P7.
  - Preuve : protocole redacted et fail-closed `docs/metrics-protocol.md` ; événements à UUID opaque, dimensions allowlistées, labels/source couplés, wrapper runtime non-throwing ; baseline structurelle reproductible Quick/Standard/Critical avec limites token/latence explicites. Review indépendante a corrigé identité corrélable, zéros implicites, latence promue et isolation d'échec, puis rendu verdict vert. `npm --prefix plugins/codex-dev-flow run check` réussi, 80/80 tests ; `npm --prefix plugins/codex-dev-flow run baseline:p0` déterministe ; `git diff --check` réussi, 2026-07-18.
- [ ] **P8.2 — Dogfooder 10 changements Standard**
- [ ] **P8.3 — Dogfooder au moins 3 changements Quick et 3 Critical**
- [ ] **P8.4 — Collecter friction, incidents et sorties inutilisées**
- [ ] **P8.5 — Supprimer complexité avec décision et preuve avant/après**
- [ ] **P8.6 — Stabiliser contrat lifecycle suivant et migration associée**

### Critères de sortie

- Décisions de simplification reposent sur usages observés.
- Lifecycle final réduit friction sans affaiblir sécurité ni preuves.
- Aucune reprise ne duplique artifact ou tâche déjà prouvée complète dans échantillon.
- Toute suppression compare au moins une mesure avant/après et conserve invariants sécurité.

---

## Ordre recommandé

```text
P0 → P8.1 → P2.4 → P1 → P3 → T4 → T5 → T6 → T7 → T8 → P8.2–P8.6
                         ↘
                           P2 évolue aux waves qui consomment son tracking
```

P0 corrige fondation contractuelle. P8.1 mesure baseline avant changement comportemental. P2.4 fiabilise le tracker utilisé par le delivery workflow. P1 rend reprise réelle. P2 reste transversal. P3 puis les waves T4 à T8 construisent expérience complète selon les dépendances par unité de P4 à P7. P8.2 à P8.6 dogfoodent et simplifient avec données réelles.

## Décisions prises

### D-01 — Registry TypeScript déclaratif comme source canonique

**Décision :** acceptée le `2026-07-18`.

- Créer `plugins/codex-dev-flow/src/state-machine.ts` avec un registry typé `STATE_MACHINE` comme source unique du contrat d'automate.
- Chaque état déclare macro-phase ou règle de dérivation, transitions sortantes, terminalité, reprise et identifiants de gardes.
- Dériver `TaskStatus` des clés du registry ; `transition()` consomme ce registry au lieu d'une table `ALLOWED` séparée.
- Générer ou valider depuis ce registry enum du JSON Schema et table Markdown publique.
- Conserver schéma et documentation générés dans package, mais les traiter comme projections, jamais comme sources concurrentes.
- Faire échouer `npm run check` si types, schéma ou documentation divergent du registry.

**Pourquoi :** transitions et gardes sont comportement exécutable. Markdown ne peut pas les imposer ; JSON Schema valide forme d'un état, pas transition depuis état précédent. Registry typé permet enforcement runtime, dérivation de types et projections vérifiables.

### D-02 — Macro-phase dérivée, jamais persistée

**Décision :** acceptée le `2026-07-18`.

- Ne pas ajouter `macroPhase` dans `state.yaml`.
- Exposer `deriveMacroPhase(state)` depuis registry canonique.
- Chaque état opérationnel appartient à exactement une macro-phase.
- Remplacer état ambigu `resolving` par `resolving_build` et `resolving_assure`.
- Pour `blocked`, dériver macro-phase depuis `resumeTo` ; interdire cible stable ou récursive.
- `ready_for_handoff`, `finished_local` et `finished` appartiennent à HANDOFF.
- Pour `cancelled` et `failed`, dériver dernière macro-phase active depuis événement terminal conservant état source.
- Validation schéma et tests doivent prouver dérivation totale et déterministe.

**Pourquoi :** persister statut et macro-phase dupliquerait même information et autoriserait états contradictoires. Séparer statuts ambigus garde dérivation simple, audit fiable et reprise déterministe.

### D-03 — Schéma V2 avec migration V1 automatique et réversible

**Décision :** acceptée le `2026-07-18`.

- Introduire `schemaVersion: 2` pour nouveau contrat d'état.
- `status` valide et migre V1→V2 en mémoire seulement ; il reste read-only et expose `migrationRequired: true`.
- `resume` migre V1→V2, valide résultat, conserve backup V1, puis remplace état atomiquement avant reprise.
- Migration est pure, déterministe et sans downgrade V2→V1.
- Migrer `resolving` depuis dernière transition source : `validating` → `resolving_build` ; `reviewing` ou `verifying` → `resolving_assure`.
- Pour `blocked` avec `resumeTo: resolving`, utiliser dernier contexte non bloqué avec même règle.
- Historique absent ou incohérent interdit toute supposition : état reste intact et diagnostic actionnable bloque reprise.
- Version future ou inconnue retourne `state_version_unsupported` sans modifier fichier.

**Pourquoi :** V1 est déjà distribué. Migration connue doit préserver reprise, mais toute ambiguïté sur phase de correction peut rejouer mauvaise action. Backup et write atomique rendent conversion réversible.

### D-04 — Sélection automatique seulement avec candidat unique

**Décision :** acceptée le `2026-07-18`.

- `resume <task-id>` conserve identifiant obligatoire ; aucune sélection implicite.
- `status <task-id>` charge tâche exacte.
- `status` sans identifiant sélectionne automatiquement seulement si exactement un état valide non terminal existe.
- Zéro candidat retourne `no_active_task`.
- Plusieurs candidats retournent `ambiguous_active_task` avec liste stable triée par `taskId` ; jamais choisir plus récent.
- `blocked` et `ready_for_handoff` restent candidats actifs ; `cancelled`, `failed`, `finished_local` et `finished` sont exclus.
- État invalide produit diagnostic séparé et n'est jamais ignoré silencieusement.
- Valider `taskId` et chemin résolu pour interdire `/`, `..`, symlink d'évasion ou accès hors `.codex/tasks/`.

**Pourquoi :** pointeur `active` et heuristique temporelle deviennent vite obsolètes avec concurrence. Candidat unique donne confort sans sacrifier déterminisme ni sécurité.

### D-05 — Historique de 200 événements avec compaction

**Décision :** acceptée le `2026-07-18`.

- Garder 200 événements structurés les plus récents dans `state.yaml`.
- Chaque événement contient `sequence` monotone, `at` RFC 3339, `type` stable et références structurées utiles ; ordre repose sur `sequence`, pas horloge.
- Conserver création, migration, transitions, blocage/reprise, gates, scope approuvé, identité/hash d'artifact, issues/corrections et tentatives/résultats de handoff.
- Compacter événements plus anciens dans `historySummary` avec nombre supprimé, plage de séquences/dates et compteurs par type.
- Conserver toujours événement terminal courant nécessaire à D-02.
- Ne jamais stocker credentials, payload app-server brut, prompts, conversation, sortie complète de commande, diff complet ou erreur brute sensible.
- Change artifact versionné reste propriétaire des preuves détaillées ; historique local conserve progression et références seulement.

**Pourquoi :** 200 événements couvrent lifecycle borné et corrections sans croissance illimitée. Résumé garde signal opérationnel ; artifact évite duplication de preuves.

### ADR d'optimisation du lifecycle

- `ADR 0002` — partager Context Capsule provenancé et invalidable entre phases.
- `ADR 0003` — lier Approval à projection canonique du contrat et re-gate par delta.
- `ADR 0004` — adapter lanes d'assurance au risque applicable sans perdre indépendance Critical.
- `ADR 0005` — rendre handoff lié à intention, réconcilié et idempotent.

Sources : `plugins/codex-dev-flow/docs/adr/` et audit
`docs/dev-flow/2026-07-18-plugin-lifecycle-audit.md`.

## Registre des décisions ouvertes

Aucune. Toute nouvelle décision bloquante reçoit identifiant stable, unités bloquées et sortie attendue avant démarrage du travail concerné.

## Journal court

- `2026-07-18` — Création roadmap. Lifecycle cible regroupé en six macro-phases. P0 choisi comme premier chantier technique.
- `2026-07-18` — Audit roadmap. Gouvernance renforcée, baseline ajoutée, parcours Critical réaligné, décisions bloquantes liées aux chantiers et tâches existantes distinguées de leur intégration.
- `2026-07-18` — D-01 et D-02 tranchées : registry TypeScript déclaratif canonique ; macro-phase dérivée sans persistance.
- `2026-07-18` — D-03 à D-05 tranchées : migration V1→V2 réversible, sélection active sans heuristique et historique borné à 200 événements.
- `2026-07-18` — Audit complet des six macro-phases : quota/tokens devient fonction d'optimisation sous contraintes dures de fiabilité et zéro faux succès ; ADR 0002 à 0005 acceptés ; P8.1 avancé avant changements comportementaux.
- `2026-07-18` — Plan d'implémentation T0–T9 approuvé ; reprise maintenue sur P0.1/T0.
- `2026-07-18` — P0.1 terminé : contrat lifecycle normatif créé avec automate total, gardes, parcours par mode, boucles, terminalité, reprise et contrats de capsule par phase ; 57/57 tests réussis. Reprise déplacée vers P0.2.
- `2026-07-18` — P0.2 terminé : contrats publics et sept skills alignés sur le lifecycle canonique ; capacités disponibles, primitives partielles et cible séparées ; anciennes conventions artifacts rendues non normatives ; tests documentaires mis à jour, 52 liens locaux et 59/59 tests réussis. Reprise déplacée vers P0.3.
- `2026-07-18` — Review indépendante P0.2 corrigée : roadmap et audit utilisent désormais un change artifact logique avec locator/identité/digest et projection policy-selected ; anciens layouts restent uniquement legacy/fixtures/migration. Contrat Quick précise vérification obligatoire et branche review seulement si policy/risque l'impose, sans changer les 18 états. P0.3 reste active.
- `2026-07-18` — P0.3 remis actif après review indépendante : gardes librement attestables, contexte gate ambigu, reprise sans réévaluation, garde Critical non conditionnelle, validation/migration insuffisantes, projection partielle et registry mutable doivent être corrigés avant P0.4.
- `2026-07-18` — Corrections P0.3 implémentées : attestations de garde liées au fingerprint/révision et résumées dans historique, `pendingGate`/décision liés au contract digest, reprise réconciliée avec gardes cible, mode V2 et garde Critical conditionnelle, validation schema+runtime avec replay, migration V1 à enum/chaîne complète, projection JSON exacte et deep-freeze récursif. Faute de trust boundary réelle, evaluators de succès/HANDOFF sont déclarés indisponibles et leurs edges bloqués plutôt que d'accepter une fausse preuve. 70/70 tests réussis ; P0.3 reste `[>]` jusqu'à re-review verte.
- `2026-07-18` — Review finale P0.3 corrigée : transitions portent modes applicables et empêchent Critical direct vers BUILD ; migration V1 refuse HANDOFF/succès sans reverification ; fingerprint de garde couvre métadonnées décisionnelles de reprise. 70/70 tests réussis. P0.3 terminé, reprise déplacée vers P0.4.
- `2026-07-18` — P0.4 terminé : evaluators spécialisés remplacent attestations déclaratives pour vérification, intention/reconciliation HANDOFF et approval Critical ; exigences de vérification fixées sur état et liées au contract digest ; receipts immuables validés au reload. Parcours Quick, Standard, Critical, boucles, blocage/reprise et handoff externe couverts ; 75/75 tests réussis. P0 terminé, reprise déplacée vers P8.1.
- `2026-07-18` — P8.1 terminé : protocole de mesure sans payload sensible, événements allowlistés à UUID opaque, séparation measured/estimated/unavailable, collecte non-throwing et baseline contract-fixture Quick/Standard/Critical reproductible. Tokens/latence restent honnêtement indisponibles avant orchestration runtime. Review indépendante verte après quatre corrections ; 80/80 tests réussis. Reprise déplacée vers P1.1.
- `2026-07-18` — Delivery workflow : P2.4 promue comme bootstrap du tracker avant P1.1 sur confirmation humaine. P1 redevient planned sans travail commencé ; reprise déplacée vers P2.4.
- `2026-07-18` — P2.4 terminé : contrôle roadmap intégré au check package ; review indépendante a fait corriger unités malformées ignorées, dépendances dupliquées masquées et parsing des fenced blocks. 12/12 tests ciblés, 92/92 globaux et diff-check réussis. Reprise déplacée vers P1.1.
- `2026-07-18` — P1.1 terminé : state store YAML V2 atomique, migration V1 read-only/persistée avec backup no-clobber et erreurs fail-closed. Review indépendante a fait corriger confinement symlink, ownership temp sur EEXIST et race de backup divergent. 14/14 tests ciblés, 106/106 globaux et diff-check réussis. Reprise déplacée vers P1.2 ; absence de fsync documentée comme limite power-loss non bloquante du contrat temp+rename.
- `2026-07-19` — P1.2 terminé : contexte de reprise et Context Capsule compact ajoutés ; historique structuré borné à 200 avec résumé, migration déterministe et binding de gate conservé après compaction. Deux re-reviews ont fermé rebind de digest, perte de receipt Critical, taille non bornée, calendrier RFC 3339 invalide et compatibilité des identifiants publics. 46/46 tests ciblés de re-review, 117/117 globaux, typecheck et diff-check réussis. Reprise déplacée vers P1.3.

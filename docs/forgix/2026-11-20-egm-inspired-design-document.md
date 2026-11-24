# Un document de design pour Forgix

## Problème et objectif

En mode Plan, la projection actuelle présente le périmètre, les tâches, les critères, les validations et les risques. Elle référence la `ProductBaseline`, sans expliquer directement le besoin ni les choix techniques qui structurent le plan. Le lecteur doit comprendre ce que le plan résout, pourquoi il prend cette forme et comment juger le résultat, sans relire l'entretien.

## Décision

Adapter les [conventions de rédaction d'EGM](https://github.com/Acrazie/elephant-goldfish-model/blob/main/skills/egm-design/references/design_doc.md) au cycle Forgix, sans dépendance au plugin ni délégation de la conception.

- **INTAKE** clarifie le besoin, le périmètre, les règles métier et les critères de succès dans l'état de la tâche. Il ne produit pas de document séparé.
- **SHAPE** résout les choix techniques et prépare leurs validations. En mode Plan, Forgix produit un seul document de design et conserve le même identifiant et le même chemin au fil des révisions. Quick conserve la consultation de son contrat compact au GATE, sans fichier de design.
- **GATE** approuve le contrat dont le document est dérivé, pas les octets du Markdown. Le document et la demande d'approbation peuvent être présentés ensemble. Il n'y a pas de deuxième approbation.

Le document présente le besoin, le périmètre, les choix qui changent le plan, leurs justifications établies, les risques pertinents et leur maîtrise, ainsi que les tâches nécessaires. La **Definition of Done** est obligatoire ; les autres titres s'adaptent au contenu. Pas de transcription, d'alternatives fictives ni de sections vides.

### Contrat et approbation

En Plan, SHAPE fige dans le contrat canonique un résumé du besoin issu de la `ProductBaseline`, les choix retenus qui changent le plan et leurs justifications établies, avec références aux décisions d'origine. Le rendu lit le contrat, pas les registres vivants. Une justification non établie reste absente ; l'argument de l'option recommandée ne justifie pas automatiquement une autre option. Une modification du fond en amont rend la partie dépendante du contrat obsolète ; SHAPE la reconstruit avant le prochain GATE. Un changement de mise en page seul ne modifie pas le contrat.

Pour un nouveau contrat Plan, la carte, le document présenté et l'empreinte du contrat proviennent du même instantané canonique. Un fichier Markdown retouché ne sert jamais de vue approuvable. L'hôte transmet l'empreinte effectivement présentée avec l'approbation interactive ; la CLI refuse une empreinte absente ou différente. Tous les écrivains de l'état canonique, dont `task save` et GATE, partagent le même contrôle de concurrence par tâche. La comparaison de l'état courant et l'écriture du nouvel état forment une seule opération : ni une réponse périmée ni une sauvegarde fondée sur un état périmé ne peut écraser une décision plus récente. Après une réponse périmée, GATE présente le contrat courant pour une nouvelle décision, sans transition ni reçu. Quick et les contrats Plan historiques conservent leur protocole d'approbation. La politique du GATE autonome ne change pas.

### Preuves attendues

Pour les nouveaux contrats Plan, les opérations du contrat ASSURE font foi pour la couverture des critères, les résultats attendus et les conditions d'applicabilité. Les liens de validation conservés dans le plan et la Definition of Done dérivent de ces mêmes opérations, par identifiant et par critère, sans exigences rédigées en parallèle. SHAPE résout les incohérences avant GATE ; GATE refuse une couverture manquante ou des références incompatibles.

ASSURE ne clôture pas la tâche tant qu'une opération obligatoire applicable n'a pas sa propre preuve valide. Deux opérations obligatoires qui couvrent le même critère sont cumulatives ; une réussite ne remplace pas l'autre et l'absence de preuve ne vaut pas non-applicabilité. Les [règles ASSURE existantes](../adr/0031-make-assure-the-success-boundary.md) s'appliquent à la fraîcheur des preuves, à l'identité de l'opération et à la non-applicabilité. Un identifiant inchangé ne suffit pas à réutiliser une preuve si le vérificateur ou le prédicat attendu a changé. Pour une observation manuelle, Forgix conserve le répondant humain prévu par le flux ASSURE existant et n'introduit ni rôle ni mécanisme d'identité supplémentaire.

### Projection et confidentialité

Seul le parent Forgix écrit le document. Avant toute création ou régénération, il vérifie la destination selon la politique et le profil approuvés du dépôt, y compris les protections de chemin applicables. La projection Plan ne contourne pas ces protections et GATE ne vaut pas autorisation d'écrire dans une destination protégée. Un chemin interdit ou une autorisation indéterminée bloque la projection avant écriture.

La projection se limite au contenu dont la diffusion dans le dépôt est établie par la politique applicable, ou confirmée par la personne habilitée si cette politique le permet. Un filtre de secrets ne suffit pas à établir cette autorisation. Aucune transcription, donnée confidentielle ou preuve brute issue de l'état local n'est copiée. Un détail essentiel peut être reformulé seulement si la formulation autorisée préserve l'exigence. Sinon, SHAPE signale le blocage avant GATE : pas de fichier contenant le détail, pas d'omission silencieuse, pas de deuxième document privé.

Distinguer l'empreinte du dernier Markdown généré de celle du rendu proposé. La création n'écrase jamais un fichier apparu au chemin prévu. Lors de l'écriture initiale comme à la reprise, le parent ne publie le rendu que si le contrat et l'autorisation de diffusion sont encore courants au moment de l'écriture. Le remplacement automatique exige en plus que Forgix puisse établir la possession du fichier et que sa version attendue soit encore en place. Si l'une de ces garanties ne peut pas être établie au moment d'écrire, laisser le fichier intact et appliquer la réconciliation du [contrat des artefacts](../artifacts.md#projection). Une fois les contrôles satisfaits, conserver le même chemin, y compris après la disparition d'un fichier.

Avant d'écrire, enregistrer pour cette tâche et ce chemin la révision du contrat et les empreintes de départ et de destination de la mise à jour en cours. À la reprise, si le fichier correspond à la destination enregistrée, que la mise à jour est toujours courante et que Forgix peut établir qu'il s'agit de sa projection, finaliser l'empreinte sans réécrire le fichier. Une empreinte identique ne suffit pas à revendiquer un fichier tiers. Si le fichier correspond au départ, reprendre seulement après les mêmes vérifications ; tout autre cas exige une réconciliation. Ne jamais marquer un rendu comme écrit si l'écriture n'a pas abouti. La consultation GATE ne déclenche aucune écriture.

### Tâches existantes et périmètre

Le nouveau format s'applique lors de la première préparation d'un contrat Plan, même si la tâche a été ouverte avant la mise à jour, et lors de l'adoption explicite du nouveau format par une tâche non terminée. Un contrat déjà persisté conserve son format et son empreinte à la lecture, y compris à la reprise d'une tâche bloquée, en BUILD ou en ASSURE. Un reçu ne vaut que pour son contrat ; les tâches terminées restent immuables. Une adoption explicite repasse par SHAPE puis GATE avant toute reprise de BUILD.

Le nouveau contrat Plan porte une version qu'un ancien binaire refuse de charger. Ce refus ne protège pas l'état contre un ancien `task save` qui dispose déjà d'une copie historique : les écritures de versions différentes dans un même espace de tâches ne sont pas prises en charge. Avant d'activer le nouveau format, le responsable de la mise à niveau arrête les anciens clients et s'assure qu'ils ne pourront plus écrire dans cet espace. Sans cette isolation, ne pas activer le nouveau format.

Le retour à l'ancien binaire ne se fait pas sur l'espace mis à niveau. Au besoin, conserver cet espace intact, y compris ses nouveaux états et reçus, et utiliser un espace distinct contenant uniquement des états compatibles pour l'ancien binaire. Cela ne remet pas le travail déjà effectué à un état antérieur. Les nouveaux contrats restent suspendus jusqu'à leur reprise avec une version compatible ; aucune conversion descendante ni synchronisation automatique entre les espaces.

Périmètre de modification prévu :

- Préparation et interaction : [Planning](../../skills/plan-change/SKILL.md), [skill hôte](../../skills/forgix/SKILL.md) et [CLI](../../src/cli.ts).
- Contrat et persistance : [types](../../src/types.ts), [schéma d'état](../../schemas/state.schema.json), [runtime de tâche](../../src/task/index.ts) et [store](../../src/core/store.ts). Couvrir la projection Plan, toutes les écritures d'état concurrentes, le GATE et la condition de clôture ASSURE des nouveaux contrats Plan.
- Vérification et documentation : [tests de tâche](../../test/unit/task.test.ts), [tests CLI](../../test/integration/cli.test.ts), [tests de persistance](../../test/integration/state-store.test.ts) et leurs fixtures ; mettre à jour les [contrats de cycle](../lifecycle-contract.md) et [d'artefacts](../artifacts.md) avec la consigne de mise à niveau et de retour arrière.

Ni nouvelle phase, ni changement de BUILD, ni nouvelle procédure d'observation humaine. Les règles de [projection des documents de domaine](../target-intake-shape-contract.md#domain-record-lifecycle-and-projection) restent inchangées. Pas de revue EGM dans le cycle Forgix ni d'autorisation Git ou de livraison externe accordée par GATE.

## Definition of Done

| Critère                                                                                               | Preuve attendue                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan produit un seul document, sans écrire en INTAKE, en Quick ni lors de GATE `--view`.              | Couvrir les trois parcours et la révision Plan ; vérifier que le chemin et l'identifiant sont conservés et que Quick reste consultable.                                                                                                                                                                                                                                                                                                            |
| Le rendu restitue le fond approuvé sans inventer de justification.                                    | Tester un choix justifié, un choix différent de la recommandation sans justification établie, et une modification séparée du besoin, du choix ou de sa raison. Vérifier le refus d'une approbation sans empreinte et les deux ordres d'une course entre approbation et `task save` périmé. La vue GATE ignore un fichier retouché et le format seul préserve le reçu.                                                                              |
| La Definition of Done et ASSURE exigent les mêmes preuves.                                            | Tester des références incompatibles au GATE et un critère avec une commande et une observation manuelle obligatoires. La seule commande ne clôture pas la tâche ; l'observation suit le flux humain existant. Tester la non-applicabilité justifiée et le refus d'une ancienne preuve pour un vérificateur ou prédicat modifié.                                                                                                                    |
| La projection respecte la politique du dépôt, la possession du fichier et les modifications humaines. | Tester un détail essentiel non publiable, une reformulation autorisée, une destination interdite ou d'autorisation indéterminée, un fichier tiers, un fichier absent, un ancien rendu intact et une retouche concurrente. Tester un contrat ou une autorisation qui change avant l'écriture, ainsi qu'un arrêt entre écriture et enregistrement de l'empreinte. La reprise ne réécrit ni un rendu déjà appliqué ni un fichier modifié entre-temps. |
| Les états et reçus restent utilisables dans leur périmètre initial, sans écriture entre versions.     | Charger des tâches historiques en attente de GATE, en BUILD, en ASSURE, bloquées vers BUILD ou ASSURE, et terminées. Vérifier la première préparation et l'adoption explicite via SHAPE puis GATE. Vérifier le refus de chargement par l'ancien binaire et faire un essai de retour arrière dans un espace distinct avec un ancien payload de sauvegarde : le nouvel espace reste inchangé.                                                        |

**Jalons de livraison.** L'approbation explicite de ce design n'autorise pas l'implémentation. Sur mandat séparé, vérifier les critères et consigner les preuves sur la révision effectivement testée. Toute publication suit ensuite les règles de livraison du dépôt et requiert ses propres autorisations ; elle n'est pas une étape du cycle Forgix.

<!-- BEGIN REVIEW METADATA -->

## État de la revue

Revalidation indépendante ciblée : aucun blocage ouvert sur la mise à niveau, le retour arrière, les écritures concurrentes et la projection. Révision relue : `de323c5561cea897ef7393b65acf8ee667ec66f85afb540f4bc0ae358ad85a39` (SHA-256 hors bloc de métadonnées et ses délimiteurs). Sources : `955962a236295d6ca226339fe7842d3d1ba864a9`.

Révision approuvée comme design final par l'utilisateur le 20 novembre 2026. Mandat distinct d'implémentation reçu ; aucune autorisation de publication.

### Vérification locale de l'implémentation

- Les tests d'intégration Plan v2 couvrent la projection, la vue canonique, le refus des approbations périmées, les collisions et courses d'écriture, la reprise d'une projection interrompue, l'isolation des états historiques et les preuves cumulatives d'ASSURE.
- Vérifications locales : `bun run check`, `bun run pack:runtime` et `bun run test:runtime`. Un essai du bundle Node 26 a aussi couvert la création d'un Plan v2, sa projection, l'approbation par empreinte et un retour arrière isolé avec le bundle historique.
- Le parcours interactif d'un hôte agentique n'a pas été exécuté. Le remplacement de Markdown n'est pas automatique quand la comparaison et le remplacement ne peuvent pas être garantis : réconciliation sans écrasement.
- Revue de code indépendante recommandée pour la concurrence, la persistance et la compatibilité ; choix utilisateur en attente. Aucun commit ni publication.

<!-- END REVIEW METADATA -->

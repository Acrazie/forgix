# Revue Goldfish des contrats Forgix

## Objectif

Faire relire le contrat de changement par un agent qui n'a pas participé à sa conception. La revue doit détecter les hypothèses non justifiées, les incompatibilités avec le dépôt et les preuves manquantes avant que l'utilisateur n'autorise BUILD.

Ce design étend le [document de design inspiré d'EGM](2026-11-20-egm-inspired-design-document.md). Il adapte la [revue indépendante d'EGM](https://github.com/Acrazie/elephant-goldfish-model/blob/main/resources/review-workflow.md) sans ajouter de dépendance au plugin. La [revue de changement en ASSURE](../../skills/review-change/SKILL.md) reste distincte : elle porte sur le diff et l'implémentation, pas sur le contrat à approuver.

## Périmètre et couverture

La revue se déroule en SHAPE, avant GATE, pour chaque nouveau contrat ou contrat existant repris en SHAPE pour être refait. Les contrats historiques qui ne sont pas refaits et les approbations déjà émises gardent leur protocole. Aucune revue rétroactive.

- **Quick** : un relecteur généraliste lit le contrat canonique compact. Quick ne crée aucun fichier Markdown.
- **Plan** : un relecteur généraliste lit le rendu canonique figé et vérifie qu'il reflète le contrat. Un fichier Markdown retouché n'est pas l'entrée de revue. SHAPE ajoute un spécialiste seulement si un risque concret exige une couverture distincte, par exemple une migration, un risque de perte de données ou une question de sécurité.

### Instantané relu

SHAPE fige la version du contrat, le rendu canonique pour Plan et un manifeste des sources nécessaires et autorisées. Le manifeste identifie le worktree, les chemins ou révisions immuables, l'empreinte du contenu remis et la couverture attendue. Le sous-rôle de revue SHAPE peut lire ces sources, en lecture seule ; Planning reste sans lecture du dépôt. Si une source nécessaire manque ou contredit l'instantané, le relecteur signale la lacune et SHAPE retourne à Discovery pour compléter le manifeste. La couverture requise ne peut pas être déclarée terminée avec une source manquante.

Les relecteurs reçoivent l'instantané et les lectures autorisées, pas l'entretien, le raisonnement de l'auteur, ni les sources privées hors périmètre. Ils travaillent en lecture seule dans un contexte neuf ; cela ne constitue pas une isolation du système de fichiers. SHAPE reste responsable des corrections et du contrat.

## Attestation et approbation

L'intégration hôte lance les relecteurs et atteste l'exécution à partir de leurs résultats natifs effectivement reçus. L'attestation identifie la tâche, le worktree, le tour réservé, l'exécution native, la révision du contrat, les empreintes des sources effectivement relues, la couverture attendue et terminée, et le verdict. Le runtime corrèle ces données à la réservation courante ; un doublon ne compte pas deux fois et un résultat étranger ou périmé ne satisfait aucune couverture. Une simple déclaration de l'auteur ne remplace pas le résultat d'un relecteur. Forgix fait confiance à l'intégration hôte quant à la provenance : le CLI vérifie la cohérence et la fraîcheur de l'attestation, mais ne peut pas authentifier lui-même son origine.

Le runtime possède l'obligation de revue, sa version, les réservations, les constats, leurs dispositions et les attestations dans l'état de la tâche. Il définit l'applicabilité lors de la création d'un nouveau contrat ou de la reprise explicite d'un contrat historique en SHAPE pour le refaire, avant le premier résultat. L'absence d'attestation ne définit jamais un contrat historique. Tous les écrivains des états soumis à Goldfish, Quick compris, utilisent le verrou par tâche et le contrôle de révision de Plan v2. Une sauvegarde générale ne peut pas supprimer ou réinitialiser ces données, rétrograder le contrat, ni injecter un reçu GATE. Le runtime les modifie uniquement par les transitions qui en sont propriétaires. Aucun second document ni transcription d'entretien n'est conservé.

Si l'hôte ne peut pas établir le contexte neuf ou obtenir le résultat d'un relecteur requis, la revue est incomplète et bloque GATE. La tâche peut reprendre sur un hôte compatible. L'auteur ne se substitue pas au relecteur manquant.

GATE ne lance aucun agent. Avant d'enregistrer une décision, la frontière de mutation GATE relit uniquement les fichiers locaux énumérés dans le manifeste et compare leur contenu à l'instantané relu, y compris si aucun `task save` n'a eu lieu depuis la revue. Une modification, un fichier absent ou une empreinte non vérifiable empêche l'approbation et renvoie en SHAPE pour réconcilier puis relire la couverture affectée. Il ne s'agit pas de découvrir de nouveaux fichiers : pas de recherche dans le dépôt, ni d'appel réseau ou modèle. La vérification et l'écriture du reçu utilisent la même révision canonique sous le contrôle de concurrence de la tâche, sans prétendre verrouiller les éditeurs externes.

GATE vérifie la couverture requise, l'absence de bloquant et la disposition des majeurs. En Quick comme en Plan, l'unique approbation interactive vise l'empreinte complète du contrat et la vue de revue effectivement présentée. Une mise à jour des constats ou des acceptations rend cette vue périmée, même si le contrat n'a pas changé. Une revue favorable rend le contrat approuvable ; elle ne l'approuve pas.

Avant la première écriture en BUILD, l'hôte vérifie de nouveau le manifeste de l'instantané approuvé. Après une interruption, il refait le contrôle avant d'écrire, sauf s'il dispose d'une preuve durable qu'une écriture BUILD a effectivement eu lieu pour cette tâche, dans ce worktree et sous ce reçu d'approbation. Le statut `executing`, une vérification réussie avant l'interruption ou un diff dont l'origine est inconnue ne suffisent pas. Si l'hôte ne dispose pas de cette preuve, il ne suppose pas que BUILD était engagé. Tout écart détecté au contrôle bloque les écritures et renvoie en SHAPE, puis GATE, sans annuler le travail existant.

## Corrections et limite de revue

Une correction invalide la couverture affectée. Chaque verdict est lié à la partie couverte et à ses dépendances de contrat et de sources. Les relectures ciblées se font en contexte neuf. Forgix réutilise un verdict seulement s'il peut établir que sa partie et ses dépendances restent inchangées ; à défaut, il relit la couverture entière concernée. Si la revue découvre un risque qui exige une expertise distincte en Plan, la couverture de ce risque doit être terminée avant GATE.

- Un **bloquant** doit être corrigé ou réfuté par des preuves ; il ne peut pas être accepté comme risque.
- Un **majeur** peut être accepté uniquement par décision humaine explicite **en SHAPE**, liée au constat exact et à la révision du contrat. Ce n'est pas une approbation du contrat. Modifier le constat ou changer la révision invalide l'acceptation. Un `--approve` simple n'accepte aucun risque ; en l'absence de décision humaine, le GATE autonome reste bloqué tant qu'un majeur non résolu demeure.

La limite est de **cinq tours au total**, revue initiale et quatre relectures ciblées au maximum. Le runtime réserve durablement un tour par lot avant de lancer les agents, sous le même verrou par tâche et avec un identifiant de tour unique. La réservation ne donne pas le droit de lancer : avant tout appel natif, le runtime attribue atomiquement un droit exclusif et non renouvelable à une seule exécution hôte. Même si deux reprises visent la même réservation, une seule peut obtenir ce droit.

Reprendre ou attendre une exécution native déjà lancée et identifiable ne consomme pas un nouveau tour. Si le détenteur du droit s'interrompt et que l'envoi est incertain, Forgix ne réattribue pas ce droit et ne relance rien sous cette réservation. Celle-ci reste comptée ; un nouvel envoi nécessite un autre tour disponible. Changer de révision ou d'hôte ne remet pas le compteur à zéro.

Au plafond, Forgix expose les constats ouverts et s'arrête ; il ne relance rien de lui-même. Un résultat valide du dernier tour déjà lancé peut encore achever sa couverture. GATE reste inaccessible tant que les exigences ne sont pas satisfaites.

## Activation et périmètre d'écriture

Mettre en place les gardes du runtime et le protocole de reprise avant l'activation : état et schéma de tâche, transitions de revue et de GATE, vérification des sources, puis intégration hôte. Pour l'ensemble des étapes, garder les anciens écrivains hors de l'espace de tâches converti et appliquer le [retour arrière isolé](../artifacts.md#upgrade-and-rollback). Aucun reçu historique n'est révoqué.

**Codex en premier**, après un essai de bout en bout de Forgix démontrant un lancement natif en contexte neuf, un résultat corrélé et une reprise correcte. Le routage seul ne prouve pas cette capacité. Claude Code et Antigravity ne sont pas activés pour les contrats soumis à Goldfish tant que leur intégration n'est pas vérifiée. Sur un hôte sans capacité vérifiée, la tâche reste bloquée avec son état intact jusqu'à sa reprise sur un hôte compatible.

L'implémentation concerne l'[intégration hôte](../../skills/forgix/SKILL.md) et les instructions SHAPE, les [types](../../src/types.ts), le [schéma d'état](../../schemas/state.schema.json), le [runtime de tâche](../../src/task/index.ts), la [CLI](../../src/cli.ts), leurs tests et la documentation normative. BUILD reçoit seulement la vérification de fraîcheur avant sa première écriture ; la revue du diff en ASSURE ne change pas.

## Definition of Done

| Critère                                                                                           | Preuve attendue                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quick et Plan sont relus en SHAPE selon leur couverture.                                          | Vérifier Quick sans fichier Markdown, Plan avec rendu fidèle au contrat et ignorant une projection retouchée, et Plan exigeant un spécialiste. En Codex, vérifier le contexte neuf et le résultat natif corrélé.                                                                                                                                                                                        |
| GATE ne confond pas revue lancée, terminée et valide ; BUILD vérifie l'instantané avant d'écrire. | Vérifier les cas sans capacité native, avec résultat absent ou étranger, et avec un fichier relu modifié sur disque sans sauvegarde TaskState. Interrompre après GATE puis après un contrôle préalable réussi, modifier une source et reprendre sans preuve d'écriture : aucun premier changement n'est autorisé. Vérifier que la preuve d'une écriture sous le bon reçu permet une reprise normale.    |
| L'obligation et l'intégrité de la revue appartiennent au runtime.                                 | En Quick et en Plan, tenter de supprimer le marqueur, de réinitialiser le compteur avec une sauvegarde ancienne et d'entrer directement en BUILD avec un reçu fourni à `task save`. Les opérations doivent être rejetées sans mutation.                                                                                                                                                                 |
| Les relectures sont ciblées et la limite de cinq résiste aux interruptions.                       | Modifier un segment et vérifier que les verdicts sans dépendance restent couverts. Simuler deux reprises de la même réservation avant l'envoi : un seul lot est lancé. Interrompre après attribution du droit avant confirmation de l'envoi : aucun second lot sous ce tour. Vérifier la corrélation d'un résultat tardif, l'absence de sixième lot et la conservation du compteur en changeant d'hôte. |
| Les constats ont la bonne autorité et l'approbation vise la vue présentée.                        | Vérifier le refus d'accepter un bloquant, l'acceptation humaine explicite d'un majeur en SHAPE, le blocage en autonome sans cette décision et le refus d'une approbation sur une vue périmée même si le contrat n'a pas changé.                                                                                                                                                                         |
| Les approbations historiques restent intactes et la revue d'ASSURE reste distincte.               | Reprendre un contrat historique sans le refaire, puis en refaire un en Quick et en Plan et vérifier l'activation. Vérifier que l'ancien binaire ne touche pas au nouvel espace lors du retour arrière et que SHAPE ne remplace pas la revue de code en ASSURE.                                                                                                                                          |

L'approbation de cette révision n'autorise ni l'implémentation ni la publication. Sur mandat distinct, consigner les tests sur la révision effectivement vérifiée ; toute livraison passe ensuite par une demande de revue selon les règles du dépôt, après validation humaine et autorisation de publication.

<!-- BEGIN REVIEW METADATA -->

## État de la revue

Revalidation indépendante ciblée favorable sur la reprise de BUILD et le droit exclusif de lancement. Aucun écart matériel signalé sur ces deux corrections. Révision relue : `2866942cec5ad580b5d28708c7797b3579993d1a2e6f765b999bed54dcf54b3f` (SHA-256 hors bloc de métadonnées et ses délimiteurs). Sources : `6139ae13026e28e6c86e5b28eaad541f359f1290`.

Révision approuvée comme design final par l'utilisateur le 20 novembre 2026. Mandat distinct d'implémentation reçu ; pas d'autorisation de publication.

### Vérification locale

- Six scénarios d'intégration Goldfish couvrent Quick et Plan, la réutilisation ciblée, le lien entre le résultat natif déclaré et la révision, les constats non dérogeables, le plafond de cinq tours sous concurrence, la fraîcheur au GATE et avant BUILD, et la compatibilité des contrats historiques.
- `bun run check` réussi : 60 tests d'outillage et 214 tests avec couverture. `bun run pack:runtime` et les 7 tests du paquet Node réussis. Le bundle Node 26 a aussi vérifié la persistance entre processus et le refus d'une approbation après une modification de source, avec un résultat natif simulé.
- L'essai Codex bout en bout avec de vrais relecteurs en contexte neuf reste à faire avant activation. Revue indépendante du code recommandée vu les changements d'autorité et de concurrence. Aucun commit ni publication.

<!-- END REVIEW METADATA -->

# Renommage de l’identité active en Forgix

## Objectif

Remplacer l’identité active `codex-dev-flow` par `forgix`, sans supprimer les fonctionnalités de l’outil. Le dépôt GitHub conserve son nom et son emplacement.

## Périmètre

- Inclus : nom du package npm, commande CLI, manifeste du plugin, déplacement du dossier vers `plugins/forgix`, renommage du skill principal en `$forgix`, références actives, documentation d’utilisation, scripts, tests et configuration de publication.
- Préservés : configurations et données utilisateur existantes, historique documentaire, changelogs et liens vers le dépôt GitHub. Les noms historiques nécessaires à la lecture des données et configurations sont des exceptions explicites au nettoyage.
- Exclus : publication npm, suppression de packages publiés, désinstallation locale, renommage du dépôt GitHub, commit, push, PR et modification du roadmap.
- Aucun alias de l’ancienne commande n’est conservé. Les anciennes commandes ne font plus partie de l’interface distribuée après mise à jour.

## Critères de réussite et preuves attendues

- C1 : le package, le plugin et le skill principal utilisent une identité cohérente `forgix` ; preuve : inspection des manifestes, du marketplace éventuel et des instructions actives.
- C2 : l’artefact distribué expose uniquement la commande `forgix` ; preuve : inspection du package et test ciblé de l’aide CLI et du binaire déclaré.
- C3 : les scripts, tests et configurations de publication suivent le nouveau dossier et le nouveau nom ; preuve : build, tests ciblés et `bun run check`.
- C4 : aucune référence active obsolète ne subsiste hors exceptions préservées ; preuve : recherche ciblée excluant le roadmap, les historiques, les changelogs, les liens GitHub et les identifiants nécessaires aux données/configurations existantes.
- C5 : les données et configurations existantes restent utilisables sans déplacement destructif ; preuve : tests ciblés de chargement des chemins historiques.

## Décisions et contexte

- L’utilisateur a choisi le nettoyage de l’identité dans le dépôt, et non la suppression externe d’un package.
- L’utilisateur a retenu `forgix`, puis le renommage package + CLI + plugin avec dépôt GitHub inchangé, puis l’absence d’alias.
- Le périmètre final inclut explicitement le dossier du plugin et le skill principal. Il a été approuvé avec le contrat complet, et non déduit des réponses antérieures.
- Sources locales examinées pendant l’entretien : `package.json`, `plugins/codex-dev-flow/package.json`, `plugins/codex-dev-flow/.codex-plugin/plugin.json`, `release-please-config.json`, `plugins/codex-dev-flow/src/config.ts`, `AGENTS.md` et `docs/git-workflow.md`. Le checkout observé déclare le package `codex-dev-flow@0.4.0` et utilise encore l’ancien dossier et l’ancienne commande. Cette preuve décrit uniquement ce checkout.
- Le 12 octobre 2026, une interrogation publique en lecture seule de `https://registry.npmjs.org/forgix` a retourné HTTP 404. Aucun package public n’a été trouvé sous ce nom exact ; cela ne garantit ni réservation ni acceptation d’une publication.
- Les règles officielles npm demandent un nom unique, descriptif, en minuscules, sans confusion avec d’autres packages ni violation de marque : <https://docs.npmjs.com/package-name-guidelines>, consultées via Context7 pendant l’entretien. Ces règles concernent le registre public, indépendamment de la version locale du package.

## Approbation

Statut : approved.

Le 12 octobre 2026, l’utilisateur a répondu exactement « 1 » à la proposition finale présentant ce périmètre, ces exclusions, ces critères et la destination `docs/dev-flow/2026-10-12-renommage-forgix.md`. L’option 1 était : « Approuver contrat et son enregistrement ; implémentation séparée ensuite. »

Cette approbation autorise l’enregistrement du contrat uniquement. L’implémentation, l’activation d’un autre workflow et les opérations externes nécessitent une autorisation distincte. Le responsable de la réalisation sera un workflow de renommage transversal reprenant ce contrat sans rouvrir les décisions établies, sauf découverte contradictoire.

Autorisation de réalisation distincte : le 12 octobre 2026, dans la même conversation, l’utilisateur a demandé exactement « Go implémenter ! ». Cette demande autorise la réalisation locale de ce contrat, sans commit, push, PR, publication ou désinstallation. La réalisation est isolée dans `.worktrees/chore-rename-forgix`, branche `chore/rename-forgix`, depuis le HEAD courant `74ccdfc5a5d74f61333cadffb61289536c36df3e` ; le checkout principal et son contrat original sont préservés.

## Réalisation et transfert autorisé

Après « Go implémenter ! », l’utilisateur a demandé « commit push et pr » et a autorisé un correctif ciblé du contrôle de randomisation. Le premier checkout divergeait de `main` distant ; aucun de ses commits de bootstrap n’est à livrer. L’utilisateur a ensuite répondu « ok » à la proposition de transférer uniquement le renommage et le correctif vers un nouveau worktree basé sur `main` distant, sans rebase ni force-push.

La réalisation destinée à la livraison est dans `.worktrees/chore-forgix-delivery`, branche `chore/forgix-delivery`, depuis `17dfe801fc40bc9952e687726d7cb3aa3cb193f2`. Cette base possède déjà un parseur de sortie Bun limité à une ligne, avec tests LF/CRLF et durée optionnelle : il est réutilisé sans remplacement. Les tests sont renforcés pour deux durées absentes et une sortie sans fixture. Les graines, la fixture et les protections existantes sont inchangées. La version npm de cette base, `1.0.1`, est conservée ; aucune publication n’est réalisée.

Le site upstream est préservé : seuls son intitulé et le nom du workspace deviennent Forgix. L’URL d’hébergement `https://dev-flow.acrazie.dev` et son statut de scaffold local `noindex` restent inchangés. Le builder minifié et la récupération des releases existantes upstream sont conservés et adaptés au nouveau nom ; les anciens binaires et leur writer d’alias sont supprimés. Les snapshots et l’allowlist de release suivent le lockfile du workspace racine.

## Preuves de livraison

Vérifications locales du 12 octobre 2026 sous Bun 1.4.2 et Node.js 26.8.1 sur macOS :

- C1/C2 : manifestes package/plugin/marketplace et skill cohérents ; unique binaire `forgix`, bundle `dist/forgix.mjs`, aucun ancien skill ou bundle dans le package. Des tests d’identité, de distribution et de runtime empaqueté vérifient ces invariants.
- C3 : installation frozen sans scripts et `bun run check` réussis (28 tests outils, 184 tests plugin ; contrôle de randomisation, formatage, lint, types, build et couverture verts). `bun run site:build` réussit (check Astro et build). Les 4 tests de runtime empaqueté passent sous Node.js 26.8.1. Bundle : 479412 octets ; package compressé : 230414 octets ; décompressé : 778852 octets ; limites inchangées et respectées. SHA-256 empaqueté : `d68baaa65237bd075bf4d3db1ec500cd12efcfa15df1f83cedb3fd3b72c5b217`. Ces résultats sont revalidés sur le candidat indexé avant approbation de livraison.
- C4 : références actives adaptées ; liens GitHub, URL d’hébergement, chemins et identifiants persistés conservés. 44 documents historiques (ADRs, baselines, changelogs, anciens contrats) ont été comparés et conservés byte-for-byte ; le roadmap n’est pas lu. Le README utilise le symbole existant, avec intitulé accessible Forgix, sans redesign du wordmark historique.
- C5 : test de lecture/priorité des configurations utilisateur/repository/local sans réécriture. Sept propriétaires source de configuration/persistance sont byte-for-byte identiques après déplacement : configuration, profils projet, state store, benchmark, quota cache, projections de domaine et SHAPE. Les tests existants de profils et états sont conservés.
- Documentation consultée : Bun 1.4.2 lockfile/lifecycle via Context7 ; Release Please manifest/component via Context7 ; schémas plugin/marketplace du dépôt officiel OpenAI Codex et page officielle plugins ; Git push/write-tree et GitHub CLI PR via Context7 et help installé. Ces sources ne prouvent pas l’installation effective du plugin.

## Limites

- L’utilisateur a autorisé le staging ciblé en répondant « ok » à la proposition de figer le renommage, les tests et le contrat. `bun run check:staged`, Full Gate, build du site et 4 tests runtime empaquetés sont verts sur le contenu indexé, avec aucune dépendance hors index. La revue du diff et la recherche heuristique de signatures de credentials ne signalent aucun secret ; cela ne garantit pas leur absence. L’approbation finale du candidat pour commit/push/Draft PR reste distincte.
- Tests runtime locaux sous Node.js 26.8.1, pas une preuve sous Node.js 24. CI Linux/macOS et installation effective dans Codex restent non vérifiées.
- Aucun package npm ou GitHub Packages n’est publié, supprimé ou réservé. Disponibilité npm, marques et domaines doivent être revérifiés avant une publication distinctement autorisée.
- Les checkouts précédents sont préservés. Aucun rebase, force-push, merge, déploiement ou nettoyage destructif n’est autorisé.

# Renommage Dev Flow

## Objectif et périmètre

Renommer le plugin, le package npm et le site existant en **Dev Flow** (`dev-flow`).
Adapter les références publiques, la publication et les tests. Conserver la commande
`codex-dev-flow` comme alias du même exécutable. Ne pas renommer le dépôt GitHub,
modifier les données utilisateur, déployer ou publier un package dans cette étape.

## Critères et preuves attendues

- C1 : identité cohérente entre package, plugin, marketplace et site ; tests de distribution et documentation.
- C2 : les deux commandes exécutent le même bundle ; tests sur les liens exécutables de l’archive.
- C3 : publication et miroir ciblent les nouveaux noms, sans changer le dépôt source ; tests release et miroir.
- C4 : vérifications du dépôt et build du site réussis ; résultats consignés après exécution.

## Décisions et contexte

Base vérifiée : `origin/main`, commit `8736d63`, contenant `site/`.
Le dossier interne `plugins/codex-dev-flow/`, les chemins de configuration et les
archives documentaires restent stables. Le domaine du site est déjà
`https://dev-flow.acrazie.dev`. Ce site est actuellement un scaffold local `noindex`,
pas un site public finalisé. Le registre npm a renvoyé E404 pour `dev-flow` pendant
la vérification ; cela ne réserve pas le nom et ne garantit pas les droits de publication.

## Approbation

Statut : approuvé.
Le 5 octobre 2026, dans cette conversation, l’utilisateur a répondu « ok » au
périmètre proposé : plugin/package/site renommés, ancien alias conservé,
références/release/tests adaptés, dépôt GitHub inchangé, aucun déploiement.
L’utilisateur avait explicitement demandé « renomme plugin ».

## Preuves de livraison

- C1/C3 : tests documentation, distribution, release et miroir réussis.
- C2 : archive créée, sans entrée dupliquée ; les deux liens exécutables testés,
  cinq tests runtime réussis. Un wrapper de 67 octets conserve la commande historique
  en appelant le même bundle : deux noms de bin ciblant directement le même fichier
  provoquaient une duplication dans l’archive Bun. Les plafonds de taille ne changent pas.
- C4 : `bun run check` réussi, dont 24 tests outils et 182 tests plugin ; format,
  lint, typecheck, randomisation, couverture et budget de taille réussis.
  Archive : 229 865 octets, plafond 276 057 octets.
  `bun run site:build` réussi : une page, aucun diagnostic Astro.
  Installation avec lockfile figé et `git diff --check` réussis.
- Environnement local : Bun 1.3.14 et Node 26.8.1. Bun 1.4.2 épinglé et Node 24
  restent à confirmer dans la CI ; aucune CI distante déclenchée.
- Commit, push, PR, publication et déploiement non effectués.

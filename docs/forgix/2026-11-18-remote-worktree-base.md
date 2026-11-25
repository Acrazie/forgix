# Plan Projection: artifact:remote-worktree-base

- Profile: plan
- Risk: medium
- Revision: 1
- Product Baseline: design:product-baseline:1
- Contract Digest: 1caf3d99cc14527cc1f4fbe14c08ce790d71156f9733989d6e3b07a104c8f8ff

## Scope

- Garantir une base distante à jour avant de créer une branche ou de commencer dans un worktree natif.

## Non-Goals

- Pas de hook Git global ni d’intégration dépendante d’une interface d’application.
- Pas de modification automatique d’un worktree existant ni de publication.

## Acceptance Criteria

- **criterion.create**: Le script crée depuis le SHA de la base récupérée auprès d’origin ; une base locale en retard n’est jamais utilisée. (validations: validation.git)
- **criterion.failure**: Un fetch en échec ou une base distante absente ne crée ni branche ni worktree. (validations: validation.git)
- **criterion.native**: Sur un nouveau worktree natif, Forgix vérifie avant le premier edit que HEAD correspond au SHA de la base distante attendue ; sinon il s’arrête sans déplacer HEAD ni toucher aux fichiers. (validations: validation.git)

## Tasks

- **task.create**: Modifier le script add : fetch automatique, base explicite main par défaut, SHA distant épinglé, aucun repli local. (criteria: criterion.create, criterion.failure)
- **task.native**: Brancher le contrôle strict sur l’entrée BUILD pour les nouveaux worktrees natifs ; utiliser la base de tâche explicite ou main par défaut ; ne pas modifier la règle pré-push. (criteria: criterion.native; depends on: task.create)
- **task.evidence**: Tester les scénarios dans de vrais dépôts temporaires et documenter la limite : hors Forgix, l’app peut toujours créer son worktree. (criteria: criterion.create, criterion.failure, criterion.native; depends on: task.create, task.native)

## Validations

- **validation.git**: Vérifier une base avancée, un fetch en échec, une branche supprimée et l’absence de mutation dans un worktree natif périmé. (`bun test test/worktree.test.ts`)

## Risks & Controls

- **risk.native**: Bloquer la création native ou perdre du travail en changeant de base. — Control: Ne poser aucun hook ; bloquer seulement Forgix avant le premier edit, sans checkout ni reset. Ne pas appliquer l’égalité de SHA aux reprises d’un BUILD déjà commencé.

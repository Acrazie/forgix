# Protection des branches sur Entire (`/et/forgix/forgix`)

- **Statut** : Approuvé et appliqué
- **Dépôt cible** : `/et/forgix/forgix` (`entire://aws-eu-central-1.entire.io/et/forgix/forgix`)
- **Date** : 2026-11-16

---

## 1. Objectif et critères de succès

Aligner techniquement la configuration serveur du dépôt natif Entire `/et/forgix/forgix` avec la règle déjà inscrite dans [docs/git-workflow.md](../git-workflow.md#L7-L18) : interdire tout push direct sur la branche par défaut (`main`) et imposer le passage par un merge contrôlé côté serveur.

**Critères de succès** :

1. `entire repo protection list /et/forgix/forgix` retourne la règle `HEAD` au niveau `server-side merge only`.
2. Un push direct (fast-forward ou `--force`) et la suppression de `main` sont refusés par `aws-eu-central-1.entire.io`.
3. L'avancement de `main` reste possible via `entire trail merge` (et l'interface web Entire).
4. Les branches de travail (`feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`) restent créables, poussables et supprimables après merge.

---

## 2. État actuel et périmètre

- **Protection actuelle** : aucune (`entire repo protection list /et/forgix/forgix` -> `Nothing is protected yet.`).
- **Branche par défaut** : `main` (`HEAD`).
- **Workflow existant** : [docs/git-workflow.md](../git-workflow.md) interdit déjà les commits et pushs directs sur `main`, mais mentionne encore le flux GitHub (`gh pr create --draft`, `.github/PULL_REQUEST_TEMPLATE.md`).
- **Scripts de release** : aucune occurrence de `git push` vers `main` dans `scripts/` ni `plugins/forgix/scripts/release*` (les releases reposent sur des tags `v*`).

**Hors périmètre** :

- Suppression ou modification des workflows GitHub Actions résiduels (`.github/workflows/`).
- Configuration des reviewers ou des gates CI avancés sur les Trails (traitable séparément).

---

## 3. Décisions de conception

### D1 — Niveau de protection sur la branche par défaut : `server-side merge only`

- **Décision** : appliquer le niveau `server-side merge only` (`--server-side-merge-only`) sur la branche par défaut.
- **Justification** : l'option `Block force pushes` (`protected`) autorise les pushs fast-forward directs sur `main`, ce qui laisse la porte ouverte aux contournements accidentels de [docs/git-workflow.md](../git-workflow.md). `server-side merge only` garantit côté serveur que `main` n'avance que via un merge Entire (ex. `entire trail merge`).
- **Compromis** : même le propriétaire du dépôt ne peut plus faire de `git push origin main` direct (y compris pour un correctif mineur). Tout changement destiné à `main` doit passer par une branche + Trail.

### D2 — Motif ciblé : `HEAD` uniquement

- **Décision** : cibler le motif `HEAD` plutôt qu'un ensemble de motifs incluant `release/*`.
- **Justification** :
  - `HEAD` suit automatiquement la branche par défaut du dépôt (`main`, même en cas de renommage futur).
  - Le dépôt ne maintient pas de branches `release/*` durables (les versions sont publiées par tags `v*`).
  - Laisser `feat/*`, `fix/*`, `chore/*`, `docs/*` et `refactor/*` non protégées permet leur suppression automatique après merge (`entire trail merge --delete-branch`).

### D3 — Alignement documentaire différé dans `docs/git-workflow.md`

- **Décision** : lors de l'application, mettre à jour [docs/git-workflow.md](../git-workflow.md#L68-L84) pour remplacer les références `gh pr create` par le flux Entire Trails (`entire trail create`, `entire trail merge`), sans bloquer l'activation immédiate de la règle côté serveur.

---

## 4. Plan d'application, vérification et retour arrière

### Application (après approbation)

Via CLI Entire (ou équivalent dans l'interface web sur `/et/forgix/forgix` -> `HEAD` -> `Server-side merge only`) :

```bash
entire repo protection add /et/forgix/forgix HEAD --server-side-merge-only
```

### Vérification attendue

1. `entire repo protection list /et/forgix/forgix` affiche `HEAD` avec le niveau `server-side merge only`.
2. Test négatif : un `git push origin HEAD:main --dry-run` (ou push d'un commit de test sur `main`) est rejeté par le serveur ; un push sur une branche `chore/...` reste accepté.
3. Un `entire trail merge --dry-run` sur une branche de travail valide la compatibilité du flux de merge serveur.

### Retour arrière (rollback)

- **Assouplir vers `Block force pushes` (`protected`)** :
  ```bash
  entire repo protection add /et/forgix/forgix HEAD --server-side-merge-only=false
  ```
- **Supprimer complètement la règle** :
  ```bash
  entire repo protection remove /et/forgix/forgix HEAD
  ```

---

## 5. État de revue et approbation

- **Revue indépendante** : non exécutée (conception légère à périmètre unique sans changement de code applicatif).
- **Approbation humaine** : approuvé et appliqué le 2026-11-16 (`HEAD` -> `server-side merge only` sur `/et/forgix/forgix`).

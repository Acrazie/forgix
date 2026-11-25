# Suppression des références GitHub et migration CI vers Entire/Buildkite

- **Statut** : Approuvé — prêt pour merge
- **Dépôt cible** : `/et/forgix/forgix` (`entire://aws-eu-central-1.entire.io/et/forgix/forgix`)
- **Date** : 2026-11-16

---

## 1. Objectif et critères de succès

Supprimer toute dépendance opérationnelle, documentaire et identitaire à GitHub dans le dépôt `forgix` suite à la migration vers le dépôt natif Entire `/et/forgix/forgix`, tout en conservant :

- la portabilité générique de `forgix` pour les dépôts tiers qui utilisent GitHub ;
- les archives historiques datées (`docs/adr/`, `docs/forgix/`, `docs/specs/`, `plugins/forgix/docs/adr/`).

**Critères de succès** :

1. Aucun fichier sous `.github/` ne subsiste dans le dépôt.
2. Les métadonnées du dépôt et du plugin (`package.json`, `plugin.json`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `cliff.toml`, `.forgix/project.yaml`, `.env.example`, docs actives de `plugins/forgix/`) pointent vers `/et/forgix/forgix` (`https://entire.com/et/forgix/forgix`) au lieu de `github.com/Acrazie/forgix`.
3. La publication GitHub Packages (`scripts/mirror-npm-to-github.ts` et ses tests) est supprimée ; `scripts/release-ci.ts` ne dépend plus de `gh` ni de GitHub Releases.
4. La CI distante est définie dans `.buildkite/pipeline.yml` (Buildkite Free Plan, intégré aux Trails Entire) en remplacement de `.github/workflows/ci.yml` et `release.yml`.
5. `bun run check` passe localement après les modifications.

---

## 2. Périmètre et classification des fichiers

### A. Suppressions (infrastructure & miroir GitHub devenus obsolètes)

- `.github/` complet :
  - `.github/ISSUE_TEMPLATE/` (remplacé nativement par `entire trail create --no-branch --type bug|feature|task`)
  - `.github/PULL_REQUEST_TEMPLATE.md` (remplacé par Entire Trails)
  - `.github/dependabot.yml`
  - `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/workflows/publish-github-package.yml`
- `scripts/mirror-npm-to-github.ts` et ses tests dédiés (`test/github-package-workflow.test.ts`, `test/github-package-mirror.test.ts`).

### B. Migrations et mises à jour

1. **CI/CD vers Buildkite** :
   - Créer `.buildkite/pipeline.yml` reprenant les étapes de vérification (`bun run check`) et de publication tag-based (`scripts/release-ci.ts`).
   - Adapter `scripts/release-ci.ts`, `test/release-ci.test.ts` et `test/release-publication.test.ts` pour utiliser le contexte `BUILDKITE_*` et un `NPM_TOKEN` (Granular Access Token npm) à la place de `gh api`, `GITHUB_*` et de la vérification de provenance GitHub OIDC. Supprimer la création de GitHub Release (`gh release create`).
2. **Métadonnées & configuration** :
   - `plugins/forgix/package.json`, `plugins/forgix/plugin.json`, `plugins/forgix/.claude-plugin/plugin.json`
   - `cliff.toml`, `.forgix/project.yaml`, `.env.example`
   - `test/forgix-identity.test.ts` (si l'identité du repo référence `github.com/Acrazie/forgix`)
3. **Documentation active** :
   - Racine : `README.md`, `CONTRIBUTING.md`, `SECURITY.md`
   - Plugin : `plugins/forgix/README.md`, `plugins/forgix/skills/forgix/SKILL.md`, `plugins/forgix/docs/getting-started.md`, `plugins/forgix/docs/design.md`, `plugins/forgix/docs/glossary/forgix.md`, `plugins/forgix/docs/lifecycle-contract.md`, `plugins/forgix/docs/runbooks/maintainer-release.md`, et tests associés (`plugins/forgix/test/integration/documentation.test.ts`, `plugins/forgix/test/runtime/runtime-smoke.test.mjs`).

### C. Éléments explicitement conservés (hors périmètre de suppression)

- **Archives historiques** : `docs/adr/`, `docs/forgix/`, `docs/specs/`, `plugins/forgix/docs/adr/` (restent figés comme trace décisionnelle datée).
- **Code applicatif générique** : `plugins/forgix/src/roadmap/index.ts`, `plugins/forgix/src/core/digest.ts`, `scripts/observe-command.ts` conservent leur support optionnel pour des dépôts tiers hébergés sur GitHub.
- **Actifs binaires / diagrammes** : les SVG/PNG existants (`docs/assets/diagrams/forgix-roadmap*.svg`, bannières) ne sont retouchés que si un lien/texte explicite vers `github.com/Acrazie/forgix` bloque une vérification.

---

## 3. Décisions de conception

### D1 — Remplacer GitHub Actions par Buildkite (Free Plan)

- **Décision** : migrer `.github/workflows/ci.yml` et `release.yml` vers `.buildkite/pipeline.yml`.
- **Justification** : sur un dépôt natif Entire sans GitHub, les runners purement GitHub Actions (comme Blacksmith) et CircleCI ne peuvent pas se connecter directement à `entire://`. Buildkite est supporté nativement par Entire Trails (remontée des checks comme Gates) et offre un Free Plan (\$0/mois, 2 000 vCPU-minutes/mois Linux).
- **Compromis** : nécessite de lier le projet Buildkite dans l'interface Entire et de configurer les secrets de publication (ex. token npm) dans Buildkite.

### D2 — Remplacer GitHub Issues / PR par Entire Trails

- **Décision** : supprimer `.github/ISSUE_TEMPLATE/` et `.github/PULL_REQUEST_TEMPLATE.md` sans introduire d'outil tiers (type Linear).
- **Justification** : Entire Trails supporte nativement les intents (`--no-branch --type bug|feature|task --priority ... --assignee ...`) et les revues/merges de branches.

### D3 — Conserver les archives historiques et le support GitHub générique de `forgix`

- **Décision** : ne pas réécrire les ADR/designs passés ni supprimer l'adaptateur GitHub de `plugins/forgix/src/roadmap/index.ts`.
- **Justification** : évite de falsifier l'historique des décisions et préserve la compatibilité de `forgix` pour ses utilisateurs externes.

### D4 — Publication npm via Buildkite + `NPM_TOKEN` (Option A)

- **Décision** : publier `@acrasie/forgix` sur npm depuis Buildkite avec un `NPM_TOKEN` (Granular Access Token), en remplaçant `GITHUB_*` / `gh api` / GitHub OIDC provenance par le contexte `BUILDKITE_*` et la vérification Git directe du tag/commit.
- **Justification** : la publication actuelle reposait sur le Trusted Publishing OIDC de GitHub Actions (`Acrazie/forgix/.github/workflows/release.yml`), qui ne fonctionne plus sans GitHub.
- **Prérequis manuel** : ajouter `NPM_TOKEN` dans les secrets/variables d'environnement de la pipeline Buildkite avant le premier tag de release.

---

## 4. Risques et vérifications

- **Risque 1 (Tests couplés à `.github/` ou GitHub Packages)** : `test/github-package-workflow.test.ts`, `test/github-package-mirror.test.ts`, `test/release-ci.test.ts`, `test/release-publication.test.ts` et `plugins/forgix/test/integration/documentation.test.ts` peuvent échouer si `.github/` est supprimé sans mise à jour coordonnée.
  - _Mitigation_ : traiter la suppression de `.github/` et l'adaptation de `scripts/release-ci.ts` + tests dans le même lot, validé par `bun run check`.
- **Risque 2 (Secrets de release)** : le passage à Buildkite exige de recréer le secret npm (`NPM_TOKEN` / OIDC) côté Buildkite avant la prochaine release CI.
- **Vérification post-implémentation** :
  - `bun run check` (lint, types, tests unitaires et d'intégration)
  - `grep -rni "github" README.md CONTRIBUTING.md SECURITY.md .env.example cliff.toml .forgix/ plugins/forgix/README.md plugins/forgix/docs/ plugins/forgix/skills/` (hors `adr/`) pour confirmer zéro référence résiduelle dans le périmètre actif.

---

## 5. État de revue et approbation

- **Revue indépendante** : non exécutée à ce stade (brouillon soumis pour validation du périmètre et des décisions).
- **Approbation humaine** : en attente de validation avant exécution des modifications sur une branche dédiée.

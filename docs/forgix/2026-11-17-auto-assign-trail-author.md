# Auto-assignation explicite des Trails Entire à l'auteur (côté agents/CLI)

- **Statut** : Brouillon en attente de revue indépendante
- **Dépôt cible** : `/et/forgix/forgix` (`entire://aws-eu-central-1.entire.io/et/forgix/forgix`)
- **Date** : 2026-11-17

---

## 1. Objectif et critères de succès

Garantir explicitement, dans le protocole de livraison du dépôt, que tout Entire Trail créé ou lié par un agent ou un contributeur en CLI soit assigné à son auteur, sans dépendre uniquement d'un comportement implicite ou non documenté du serveur Entire.

**Critères de succès** :

1. [docs/git-workflow.md](../git-workflow.md) (section 5, _Delivery & Entire Trail Protocol_) exige explicitement la résolution du login Entire actif et son passage en tant qu'assigné lors de la création ou du rattachement d'un Trail.
2. Les deux chemins CLI documentés dans `docs/git-workflow.md` (`entire trail create` et `entire trail link`) sont couverts :
   - `entire trail create` inclut `--assignee "<user>"`.
   - `entire trail link <trail>` (qui n'expose pas de flag `--assignee`) est suivi de `entire trail update <trail> --add-assignee "<user>"` (exécuté sans condition ou lorsque `assignees` est vide dans `entire trail show <trail> --json`, sans comparaison fragile entre `"github:<login>"` et `"ulid:<id>"`).
3. Aucun secret CI, webhook ni hook Git fragile n'est ajouté.
4. La suite de vérification documentaire/qualité du dépôt (`bun run check`) passe après la modification de `docs/git-workflow.md`.

---

## 2. État actuel et périmètre

- **Comportement observé sur Entire (`0.13.4`)** :
  - Sur les 10 Trails existants de `et/forgix` (`entire trail list --project et/forgix --json`), tous portent déjà `authorAccountId` et `assignees` identiques (`01M52NANZ5MWCTRRP3KQA8MN1G` / `ulid:01M52NANZ5MWCTRRP3KQA8MN1G`).
  - La CLI `entire` n'expose pas de réglage serveur d'auto-assignation au niveau projet (`entire project`), dépôt (`entire repo edit`) ou configuration locale (`entire configure`).
  - `entire trail create` accepte `--assignee strings` ; `entire trail link <trail>` n'accepte pas `--assignee` ; `entire trail update [<trail>]` accepte `--add-assignee strings` (et découvre le Trail via `--branch` ou la branche courante si `<trail>` est omis) ; `entire auth status --json` retourne le champ `user` du contexte actif (ex. `"github:Acrazie"`).
- **Documentation existante** :
  - [docs/git-workflow.md](../git-workflow.md#L68-L82) définit la création/liaison de Trail (`entire trail create` / `entire trail link`) et le garde-fou d'approbation humaine avant exécution.
  - [AGENTS.md](../../AGENTS.md) et [plugins/forgix/docs/runbooks/maintainer-release.md](../../plugins/forgix/docs/runbooks/maintainer-release.md#L62-L64) renvoient déjà au workflow Git du dépôt.

**Frontière d'écriture pour l'implémentation** :

- Uniquement [docs/git-workflow.md](../git-workflow.md) (section 5).

**Hors périmètre** :

- Automatisation CI côté Buildkite (`.buildkite/pipeline.yml`, secret `ENTIRE_TOKEN`).
- Hooks Git locaux ou wrappers autour du binaire `entire`.
- Duplication de la règle dans `CONTRIBUTING.md`, `AGENTS.md` ou `maintainer-release.md`.
- Modification des Trails existants ou création d'un Trail réel durant la phase de design.

---

## 3. Décisions de conception

### D1 — Option A : règle explicite côté agents/CLI dans `docs/git-workflow.md`

- **Décision** : imposer l'assignation explicite à l'auteur via les flags CLI `entire` dans la section 5 de [docs/git-workflow.md](../git-workflow.md), en résolvant l'identité active par `entire auth status --json` (champ `user`).
  - Pour `entire trail create` : passer `--assignee "<user>"` (en conservant la validation humaine préalable prévue en section 6).
  - Pour `entire trail link <trail>` : exécuter ensuite `entire trail update <trail> --add-assignee "<user>"` (ou `entire trail update --add-assignee "<user>"` sur la branche courante). Cette étape s'applique soit systématiquement après `link`, soit lorsque `assignees` est vide dans `entire trail show <trail> --json` — aucune comparaison directe entre `"<user>"` (`"github:<login>"`) et `"ulid:<id>"` n'est requise. Les opérations `link` et `update` font partie de la même étape de livraison Trail soumise à approbation humaine (section 6).
- **Justification** : répond au besoin de garantie explicite côté agents/CLI avec zéro infrastructure, zéro secret CI et une modification strictement locale à la documentation de référence.
- **Compromis** : ne couvre pas les Trails créés manuellement depuis l'interface web Entire ni ceux créés par un bot externe (ex. Renovate) sans intervention d'un agent/CLI.

### D2 — Point d'autorité unique dans `docs/git-workflow.md`

- **Décision** : ne modifier que [docs/git-workflow.md](../git-workflow.md), sans recopier la consigne dans `CONTRIBUTING.md` ni `plugins/forgix/docs/runbooks/maintainer-release.md`.
- **Justification** : `AGENTS.md` et le runbook de release pointent déjà vers le workflow Git du dépôt ; éviter la duplication empêche la dérive documentaire.

### D3 — Garde-fou en cas de session Entire non authentifiée ou d'échec

- **Décision** : si `entire auth status --json` échoue ou retourne `"logged_in": false` (ou un champ `user` vide), l'agent doit s'arrêter et demander à l'utilisateur de s'authentifier (`entire login`) plutôt que de deviner un login ou de créer un Trail sans `--assignee`.
- **Justification** : préserve l'invariant d'autorisation et évite d'assigner un Trail à un identifiant incorrect ou inexistant.

---

## 4. Plan d'application et vérification attendue

1. **Édition autorisée** (après approbation du présent design, dans une phase d'implémentation distincte) :
   - Mettre à jour la section 5 (_Delivery & Entire Trail Protocol_) et, pour cohérence, la mention des opérations Trail en section 6 (_Agent Autonomy Boundaries_) de [docs/git-workflow.md](../git-workflow.md#L68-L82) pour documenter :
     - la lecture du login actif via `entire auth status --json` (champ `user`) ;
     - l'ajout de `--assignee "<user>"` sur `entire trail create` ;
     - l'exécution de `entire trail update <trail> --add-assignee "<user>"` (ou sur la branche courante) après `entire trail link <trail>` ;
     - l'arrêt en cas d'absence de session authentifiée (`logged_in !== true`) ;
     - le maintien de l'approbation humaine préalable pour `create`, `link`, `update` et `merge` sur les Trails distants.
2. **Vérification attendue** :
   - `bun run check` passe sans erreur ni avertissement bloquant sur le dépôt.
   - Relecture ciblée de `docs/git-workflow.md` confirmant que les drapeaux cités (`--assignee`, `--add-assignee`, `entire auth status --json`) correspondent à la CLI `entire` installée (`0.13.4`) et que les garde-fous d'approbation (section 6) couvrent explicitement `create`, `link`, `update` et `merge`.
   - **Cas d'échec / régression couverts** :
     - `entire auth status --json` non connecté (`logged_in: false`) : arrêt documenté, aucune création ni modification de Trail.
     - Utilisation de `entire trail link <trail>` sur un Trail déjà existant : couvert par `entire trail update <trail> --add-assignee "<user>"` sans dépendre d'une correspondance de format entre `"github:<login>"` et `"ulid:<id>"`.
     - Vérification manuelle optionnelle lors de la prochaine création de Trail autorisée par l'humain : `entire trail show --json` confirme que `assignees` contient le compte de l'auteur.

---

## 5. Définition de Done (Definition of Done)

### Critères d'acceptation observables (pour la passation d'implémentation)

1. **Règle explicite dans `docs/git-workflow.md`** :
   - _Vérification_ : lecture de `docs/git-workflow.md` sections 5 et 6.
   - _Attendu_ : la résolution via `entire auth status --json`, `--assignee` sur `entire trail create`, `entire trail update <trail> --add-assignee` après `entire trail link <trail>`, le comportement d'arrêt si non authentifié, et l'approbation humaine préalable pour `create`/`link`/`update`/`merge` sont explicitement décrits.
2. **Périmètre et cohérence des flags CLI** :
   - _Vérification_ : `git diff --name-only` et comparaison avec `entire trail create --help`, `entire trail link --help`, `entire trail update --help` et `entire auth status --help`.
   - _Attendu_ : seul `docs/git-workflow.md` est modifié lors de l'implémentation ; tous les flags mentionnés existent exactement sous cette forme.
3. **Validation qualité du dépôt** :
   - _Vérification_ : `bun run check` exécuté après la dernière édition.
   - _Attendu_ : code de sortie `0`, aucune erreur de formatage ou de lint.
4. **Validation empirique à la prochaine création de Trail (manuelle, hors implémentation)** :
   - _Responsable_ : mainteneur lors du prochain `entire trail create` autorisé.
   - _Attendu_ : `entire trail show --json` affiche l'auteur dans `assignees`.

### Portes de livraison (Delivery Gates)

- **Design approuvé** : la revue indépendante (`design_critic`) est complète sans `Blocker`/`Major` non résolu sur la révision courante, et l'humain a explicitement approuvé ce document. Aucune implémentation ni publication n'est autorisée à ce stade.
- **Implémentation vérifiée** : sous un mandat d'implémentation distinct, `docs/git-workflow.md` est mis à jour dans le périmètre approuvé et `bun run check` passe après la dernière édition.
- **Trail / PR livré** : après revue humaine du diff final dans `docs/git-workflow.md` et approbation explicite de publication, la branche est poussée et livrée via Entire Trails (`entire trail create --assignee ...`) conformément à `docs/git-workflow.md`.

---

## 6. État de revue et approbation

- **Révision de contenu (corps substantiel avant section 6)** : `0a74c8d7453942ede8ed224a6c4631c46759c9844b574e133c9b97169e5f4dc0` (`sed '/^## 6\. État de revue et approbation/,$d' docs/forgix/2026-11-17-auto-assign-trail-author.md | shasum -a 256`).
- **Couverture exécutée** :
  - Revue indépendante initiale (`egm-design-critic`, `3827be2771ea6ec18dc6b0f45330b70180afecd5141dac621383897e2020e9ef`) puis revalidation ciblée en contexte neuf (`egm-design-critic`, `0a74c8d7453942ede8ed224a6c4631c46759c9844b574e133c9b97169e5f4dc0`) sur `feature-spec-standard.md`, `zoom-out-standard.md` et `implementation-readiness-standard.md`.
  - Vérification CLI locale (`entire` `0.13.4`) par l'agent principal : `entire auth status --json`, `entire trail create --help`, `entire trail link --help`, `entire trail update --help`.
- **Limites de preuve** : le reviewer en contexte lecture seule n'avait pas d'outil shell ; `bun run check` sera exécuté lors de la phase d'implémentation après édition de `docs/git-workflow.md`.
- **Constats ouverts** : 0 `Blocker`, 0 `Major`, 1 `Nit` non bloquant (ligne 36 indique `(section 5)` au lieu de `(sections 5 et 6)` alors que les sections 4 et 5 couvrent explicitement les sections 5 et 6).
- **Décision en attente de l'humain** : approbation explicite de cette révision pour autoriser l'implémentation dans [docs/git-workflow.md](../git-workflow.md) (hors périmètre d'EGM).

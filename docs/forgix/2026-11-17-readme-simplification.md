# Simplification du README d’accueil de Forgix

Date : 2026-11-17
Statut : conception en attente de revue indépendante et d’approbation humaine finale.

## Objectif et décision retenue

Le README racine compte actuellement 234 lignes et 1 165 mots selon `wc -l -w README.md`.
Il mélange découverte du produit, installation, référence CLI et architecture interne.
L’utilisateur a choisi l’option 1 : un README d’accueil en anglais d’environ 80–110 lignes,
conservant la bannière, les trois agents, les prérequis, un premier usage et les garanties
utiles. Le lecteur prioritaire découvre Forgix et veut essayer un premier objectif.

Le parcours retenu est : comprendre la valeur, installer pour son agent, initialiser le
projet, lancer un objectif, puis approfondir dans la documentation existante. Les exemples
[Kiri](https://github.com/libracoder/kiri/blob/main/README.md),
[git-cliff](https://github.com/orhun/git-cliff/blob/main/README.md) et
[EGM](https://github.com/google/elephant-goldfish-model/blob/main/README.md)
inspirent cette hiérarchie, pas une reproduction de leurs contenus ou de leurs longueurs.
L’option vitrine de 40–60 lignes a été écartée : elle impose de quitter le README avant
l’installation. Aucun nouveau visuel, site ou guide n’est nécessaire.

## Périmètre et responsabilités

Cette session EGM écrit uniquement ce document de conception. Elle ne modifie pas le
README, n’installe aucune dépendance et ne commit ni ne publie rien.
L’implémentation ultérieure, sous mandat séparé, modifiera uniquement `README.md`.
Les images existantes, le README du plugin, les guides, contrats, ADR et tests restent
inchangés. Aucun fichier n’est supprimé.

Le [Getting Started](../../plugins/forgix/docs/getting-started.md) possède déjà les détails
retirés de la page d’accueil : installation alternative, CLI autonome, commandes avancées,
routage, fichiers générés, configuration et reprise. Le README renvoie vers ce guide,
le [contrat de cycle de vie](../../plugins/forgix/docs/lifecycle-contract.md), le
[README du plugin](../../plugins/forgix/README.md) et les ressources de contribution.
Les trois diagrammes sont retirés du README seulement ; leurs fichiers sont conservés.
Les détails de routage, tableaux exhaustifs et arbre du dépôt ne sont plus reproduits.

L’[ADR 0028](../../plugins/forgix/docs/adr/0028-make-public-documentation-user-first-and-current.md)
établit la séparation README, guide, contrats et décisions. Le changement proposé allège
volontairement sa prescription de contenu détaillé du README racine : commandes avancées,
configuration et fichiers générés restent accessibles dans le guide. Il ne change aucun
contrat logiciel. L’approbation finale de cette conception devra couvrir ce choix éditorial.

## Invariants et compatibilité

- Préserver la bannière, sa description alternative et les trois badges existants.
- Conserver Node.js 26+, Git, Linux/macOS et l’absence de support Windows.
- Conserver une installation explicite pour Codex, Claude Code et Antigravity, avec les
  commandes actuellement documentées ; ne pas inventer de route d’installation depuis
  Entire pour les marketplaces. Leur disponibilité distante n’a pas été exécutée ici.
- Distinguer **Project INIT** de **Configuration wizard** sans rendre ce dernier obligatoire.
- Montrer les trois préfixes et un objectif concret ; préciser que les blocs `$forgix`
  s’exécutent dans l’agent, pas dans le terminal.
- Décrire l’approbation humaine pour le parcours d’objectif interactif montré, pas comme
  une règle universelle : le contrat documente des reçus autonomes pour certains Work Items.
  Ces modes avancés restent hors du démarrage et accessibles par le guide/contrat.
- Conserver vérification finale et absence d’autorisation implicite de livraison pour
  ce parcours interactif. Ne pas promettre qu’une revue garantit l’absence de bugs.
- Ne modifier aucune commande, configuration, politique, capacité ou compatibilité réelle.

## Contenu proposé pour l’implémentation

La proposition ci-dessous remplace le README entier. Les liens sont exprimés relativement
au README racine, pas à ce document. Le bloc n’est pas un fichier déjà appliqué.

````markdown
<h1 align="center">
  <img alt="Forgix" src="./docs/assets/forgix-readme-banner.png" width="100%" />
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@acrasie/forgix"><img src="https://img.shields.io/npm/v/%40acrasie%2Fforgix" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT" /></a>
  <a href="#requirements"><img src="https://img.shields.io/badge/node-%3E%3D26-brightgreen" alt="Node.js >= 26" /></a>
</p>

<p align="center">
  Turn a software objective into an approved, implemented, and verified change.
</p>

Forgix is a workflow plugin and CLI for **Codex**, **Claude Code**, and **Antigravity**.
It helps your coding agent clarify what to build, prepare a plan, and verify the result.

- **Plan with context.** Inspect the repository and resolve missing decisions before editing.
- **Stay in control.** Review and approve the plan before the interactive task implements it.
- **Get evidence.** Finish with fresh review and command-backed verification.

## Requirements

**Node.js 26 or newer**, **Git**, and a supported agent with plugin support on
**Linux or macOS**. Windows is unsupported. Bun is only needed for repository development.

## Install

Choose your coding agent:

### Codex

```sh
codex plugin marketplace add Acrazie/forgix
codex plugin add forgix@acrazie
```

Start a new Codex session after installation.

### Claude Code

Run inside Claude Code:

```text
/plugin marketplace add Acrazie/forgix
/plugin install forgix@acrazie
```

### Antigravity

```sh
git clone https://entire.com/et/forgix/forgix.git
agy plugin install ./forgix/plugins/forgix
```

See [Getting Started](./plugins/forgix/docs/getting-started.md) for alternative installation
methods and standalone CLI usage.

## Quick start

Open your project in your agent. Examples below use Codex's `$forgix`;
use `/forgix:forgix` in Claude Code or `/forgix` in Antigravity.

First, run **Project INIT** to discover and approve shared engineering conventions:

```text
$forgix init
```

Shared conventions live in `.forgix/project.yaml`; machine-local preferences stay in
`.forgix/project.local.yaml`, and resumable INIT state in `.forgix/init/state.yaml`.

Then give your agent a concrete objective:

```text
$forgix Add rate limiting to the public authentication endpoints
```

```text
INTAKE -> SHAPE -> GATE -> BUILD -> ASSURE ✓
```

For this interactive workflow, Forgix clarifies the objective, prepares a plan, waits for
explicit GATE approval, implements it, and finishes with fresh verification evidence.
Approval does not authorize commit, push, pull request, registry publication, or release.
Advanced autonomous Work Item workflows have separate rules in the [lifecycle contract](./plugins/forgix/docs/lifecycle-contract.md).

Optional: `npx @acrasie/forgix init` opens the **Configuration wizard** for plugin
preferences. It is separate from Project INIT.

## Documentation

- [Getting Started](./plugins/forgix/docs/getting-started.md): full walkthrough, configuration, commands, and resuming tasks.
- [Plugin overview](./plugins/forgix/README.md) · [Lifecycle contract](./plugins/forgix/docs/lifecycle-contract.md) · [Glossary](./plugins/forgix/docs/glossary/forgix.md)
- [Contributing](./CONTRIBUTING.md) · [Git workflow](./docs/git-workflow.md) · [Changelog](./plugins/forgix/CHANGELOG.md)

## License & security

[MIT License](./LICENSE). Report vulnerabilities privately via [SECURITY.md](./SECURITY.md).
````

## Vérification attendue et critères de réussite

- README entre 80 et 110 lignes avant reformatage ; une variation due au formateur est
  acceptable si le contenu et la lisibilité restent identiques. Réduire aussi le nombre
  de mots par rapport aux 1 165 mots initiaux, sans sacrifier les invariants ci-dessus.
- Une seule bannière, aucun des trois diagrammes techniques et aucune table exhaustive.
- Installations des trois agents, Project INIT puis premier objectif accessibles sans
  quitter la page ; documentation détaillée et informations de sécurité accessibles par lien.
- Préserver tous les marqueurs exigés par
  `plugins/forgix/test/integration/documentation.test.ts`, notamment les trois chemins
  INIT, les deux interfaces INIT distinctes et le cycle de vie. Ne pas assouplir ce test
  pour faire passer une suppression ; le bloc proposé conserve ces marqueurs.
- Lors de l’implémentation, vérifier le diff, les liens Markdown et HTML locaux, les
  ancres, les fences, puis exécuter le test documentaire ciblé et le contrôle de format.
  Si `node_modules` manque, l’implémentation suit le bootstrap du dépôt avant ses checks.
  Exécuter `bun run check` avant toute livraison autorisée séparément.
- Contrôler le rendu Markdown sur hôte cible, notamment bannière, blocs et navigation.
  Aucun test d’installation distante ni rendu sur Entire n’a été réalisé pendant cette
  conception. Ne pas les annoncer validés à partir d’une lecture ou d’un test de chaînes.

Le retour arrière éventuel consiste à restaurer uniquement le README précédent ; aucune
migration de données, de configuration ou de runtime n’est impliquée.

## État de revue et approbation

Domaine du digest : tous les octets UTF-8 de ce fichier précédant le titre
`## État de revue et approbation`, titre exclu. Les sources sélectionnées sont liées à
leurs empreintes ci-dessous ; aucune référence à une branche distante n’est implicite.

Revue prévue : un Goldfish neuf, en lecture seule, couvrant clarté, adéquation au dépôt,
contrats conservés et préparation de l’implémentation avec les trois standards EGM.
La séparation de conversation ne prouve pas l’exclusion des instructions hôte.

Statut courant : conception approuvée par l’utilisateur le 2026-11-17 dans cette
conversation (réponse « oui » à la demande d’approbation finale). Mandat séparé reçu
pour appliquer le candidat à `README.md`, avec revue adversariale indépendante finale.

Empreintes SHA-256 inspectées :

- Conception : `0908f31005f51caa0c1cdbf89938a160db2d0665d11185cd9fd6455723e5e8a9`.
- `README.md` : `32d8f4762a590bf26e14dd3d46e3d131c2a9a090ba03057e4bb1196fd158658e`.
- `plugins/forgix/docs/getting-started.md` : `45740d098ede2bb463138e0dc2ba2171254228a2b58c4f4af6f824c67a0607e2`.
- `plugins/forgix/docs/lifecycle-contract.md` : `d70f143696bc749ca8becb16b6f71f382198638504b74ed238622083434d5c19`.
- `plugins/forgix/test/integration/documentation.test.ts` : `db4505cea2e09b8d352adb4219bbe1d1a8099bfa2282e0b557d2329467dd6f76`.
- `plugins/forgix/docs/adr/0028-make-public-documentation-user-first-and-current.md` : `70ed49e5be2a67a2691908a4010189b3ee96111d0d50f4ac5eeec41019015371`.

Contrôles locaux du candidat embarqué : 99 lignes, 390 mots ; existence des cibles
locales Markdown/HTML et présence des marqueurs d’installation exigés : réussies.
Ce contrôle Python n’est ni une exécution de la suite Bun ni un test des commandes.

Revue achevée par `/root/readme_design_review`, conversation neuve (`fork_turns: none`),
sur le digest de conception consigné ci-dessus. Le reviewer déclare avoir lu intégralement
sa persona, les trois standards et les cinq sources sélectionnées ; il a recalculé le
digest et vérifié les empreintes sources. Verdict : aucun Blocker, Major ou Nit retenu.
Couverture : clarté, séparation documentaire, parcours des trois agents, prérequis,
INIT, garde d’approbation interactive et exception autonome, preuves, périmètre et rollback.
Contrôles indépendants : 99 lignes, 390 mots, 16 marqueurs, liens locaux et ancre valides.

Le parent a aussi contrôlé après écriture : digest inchangé, fences équilibrées, ancre,
quatre images (bannière et badges), longueur et réduction du texte. `git diff --check`
a réussi ; le nouveau document étant non suivi, ce résultat ne valide pas son format.
Aucun README modifié, aucune suite Bun exécutée, aucune installation distante ni
validation visuelle. Ces limites ne constituent pas une preuve de fonctionnement des
marketplaces ou du rendu Entire. Aucun risque matériel accepté ni finding matériel ouvert.
La validation finale de ce contenu par l’utilisateur reste nécessaire ; elle n’autorise
pas l’implémentation ni la publication.

### Application et revue adversariale finale

Le mandat d’implémentation séparé a été exécuté : `README.md` correspond exactement au
candidat approuvé (99 lignes, 390 mots), SHA-256
`fab1642c9a79db5948aa4a46efe69050aa857b8e22fee627694e5578896ab657`.
Base locale inspectée : `ed83783aabda98a3f415802ab183814a27c7cd02`.

Revue indépendante `/root/readme_adversarial`, conversation neuve sans historique auteur :
**ACCEPT**, zéro défaut introduit démontré, zéro violation anti-contournement.
Périmètre : diff README uniquement (+39 / −174), contrat approuvé, liens et invariants.
Le reviewer a exécuté indépendamment les quatre tests documentaires (88 assertions,
zéro échec) et le contrôle de format du README, tous réussis. Pas de rendu graphique
ni d’installation distante ; piliers ressources et concurrence sans effet runtime ici.

Le bootstrap `bun install --frozen-lockfile` a réussi après autorisation d’accès au cache
et aux hooks propres au worktree, sans changement de lockfile. Le parent a également
exécuté les quatre tests documentaires et les contrôles de format des deux fichiers du
travail, avec succès. Le `bun run check` complet échoue au contrôle de format sur
`docs/adr/0034-risk-conditioned-autonomous-execution-for-roadmap-work-items.md`, inchangé
par rapport à HEAD ; les étapes suivantes du gate ne sont donc pas exécutées.
Ce défaut hors périmètre n’a pas été corrigé. Aucun commit, push ou Trail créé.

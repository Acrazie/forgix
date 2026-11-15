# Identité et présentation du plugin Forgix

Date : 2026-11-15. Conception uniquement ; aucune implémentation ni publication autorisée.

## Objectif et périmètre

Présenter Forgix avec son symbole officiel et une introduction destinée aux utilisateurs du plugin, plutôt qu'avec une icône générique et une longue documentation technique. Le mandat confirmé couvre Codex, Claude Code et Antigravity, un document canonique et une revue indépendante. Le README technique du dépôt reste conservé.

Le résultat attendu est une amélioration utilisant les mécanismes réels de chaque hôte, pas une promesse d'affichage identique partout. Les captures montrent deux rendus différents ; elles ne prouvent ni la version des applications ni l'origine exacte de chaque icône.

Sont exclus : nouveau logo, refonte du README racine, modification du runtime ou des skills, nouveau format de distribution, publication dans un annuaire officiel, installation dans les comptes utilisateur et modification des caches des applications.

## État constaté et sources

Base du dépôt inspectée : `d1ca4cf762dfca6f32d38279c0e09ba8fc3436c1`, arbre initial propre. Les chemins ci-dessous sont relatifs à la racine du dépôt.

- `plugins/forgix/.codex-plugin/plugin.json` contient déjà des descriptions courtes et longues, mais aucun `interface.logo`, `interface.logoDark` ni `interface.composerIcon`.
- `plugins/forgix/plugin.json` ne déclare pas de `logo`. Avec Antigravity CLI **1.5.2**, `agy plugin validate plugins/forgix --strict --json` termine à 0 et indique explicitement que cette absence produit une icône générique.
- `plugins/forgix/.claude-plugin/plugin.json` ne déclare pas d'icône. Claude Code **2.1.252** valide le plugin actuel en mode strict. Une sonde temporaire minimale ajoutant `icon` termine à 1 : champ inconnu. Aucun plugin réel n'a été modifié pour cette sonde.
- `plugins/forgix/README.md` commence par le texte visible dans la première capture et contient ensuite installation, migration, commandes et détails techniques. Cela rend son utilisation par cet Overview vraisemblable, sans constituer une preuve du chargeur de l'application.
- `README.md` est déjà distinct du README empaqueté. Il n'est donc pas nécessaire de créer un troisième texte ni de déplacer le README racine.
- Les maîtres de marque sont dans `docs/assets/brand/`. Ils sont hors de la racine installable `plugins/forgix/`. `plugins/forgix/package.json` ne publie pas de répertoire `assets/` actuellement.
- `plugins/forgix/test/integration/documentation.test.ts` impose les mêmes marqueurs de parcours aux deux README. `plugins/forgix/scripts/check-size-budget.ts` compare la liste exacte des fichiers empaquetés avec `plugins/forgix/test/artifact-budget.json` : ajouter un fichier sans adapter ce contrat échouerait.

### Contrats des hôtes

Sources officielles consultées le 2026-11-15, après recherche Context7 :

1. [Codex, manifeste à la version rust-v0.163.0](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/core-plugins/src/manifest.rs) : `RawPluginManifestInterface` reconnaît `logo`, `logoDark`, `composerIcon` et `brandColor`. Les actifs se résolvent relativement à la racine du plugin avec préfixe `./`. La version CLI locale est 0.163.0 ; cela ne prouve pas la version du backend de l'application montrée. [Référence OpenAI des icônes](https://developers.openai.com/plugins/deploy/submission) : distinction entre icône de listing et icône de composition. Les champs `iconSmall` et `iconLarge` concernent les skills, pas le plugin.
2. [Antigravity, Build plugins](https://antigravity.google/docs/build-plugins) : `logo` est un chemin local vers une image carrée incluse dans le plugin, lisible en clair et sombre. Le README à la racine du plugin est une source documentée pour la présentation avant installation. Le guide actuel contredit l'ancien schéma minimal remonté par Context7 ; le guide actuel et la sonde du CLI local font foi ici.
3. [Claude Code, manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference#directory-listing-fields) : `icon` sert à l'annuaire Anthropic, mais n'est pas lu au chargement par Claude Code. L'acceptation sans avertissement exige 2.1.281 ou plus. Ce champ n'établit donc pas un correctif pour les installations privées actuelles, et casse le contrôle strict local sur 2.1.252.

Les sources consultées ne fournissent pas un champ Overview portable commun aux trois hôtes. En particulier, `longDescription` ne doit pas être présenté comme un remplacement démontré du README de l'Overview.

## Architecture proposée

### Un actif distribué, issu du maître existant

Copier sans redessin `docs/assets/brand/svg/symbol-color.svg` vers le futur `plugins/forgix/assets/logo.svg`. Le symbole Seuil ivoire sur carmin, carré de 136 unités, offre une identité lisible sans dépendre de la couleur de fond. Ne pas utiliser le mot-symbole à petite taille, l'initiale F, une icône générée ou un actif distant.

Conserver géométrie, couleurs et réserve du maître. Le kit précise que le cercle appartient au support et non au symbole ; une éventuelle réserve supplémentaire autour de ce support doit être vérifiée visuellement, sans rogner le dessin. Ne pas modifier le maître pour satisfaire un recadrage d'application.

La copie dans le plugin est une nécessité de distribution, pas un second maître. Un test compare ses octets avec le maître pour empêcher une divergence silencieuse. Ajouter uniquement `assets/` à la liste de publication et `assets/logo.svg` au manifeste exact des fichiers distribués ; ne pas embarquer le kit complet, les fonds ou les polices.

### Métadonnées propres à chaque hôte

- **Codex** : déclarer `interface.logo`, `interface.logoDark` et `interface.composerIcon` avec `./assets/logo.svg`. Le même actif convient aux deux thèmes. Les descriptions existantes et le prompt restent inchangés ; aucune déclaration d'icône de skill n'est nécessaire à ce correctif.
- **Antigravity** : déclarer `logo: "assets/logo.svg"` dans `plugins/forgix/plugin.json`. La sonde temporaire avec ce chemin et le SVG maître est acceptée par `agy` 1.5.2 en mode strict, sans findings. Ce résultat valide la déclaration, pas le rendu graphique.
- **Claude Code** : conserver le manifeste compatible avec 2.1.252, sans `icon` ni champ Codex. Le logo peut être présenté dans le contenu du README si le lecteur accepte les images locales ; ne pas annoncer une icône personnalisée dans la liste des plugins. Ajouter `icon` pour l'annuaire Anthropic serait un autre mandat, avec décision de compatibilité et vérification dans cet annuaire.

Ne pas placer ces champs dans les entrées marketplace, ni modifier les identités, les commandes, les versions ou les règles de release dans cette implémentation. Les mises à jour de version et la livraison restent des opérations séparées via le mécanisme existant.

### Un README de plugin bref, sans supprimer l'information technique

Réutiliser `plugins/forgix/README.md` comme présentation dédiée ; conserver `README.md` comme entrée technique GitHub. Le README du paquet npm deviendra lui aussi plus bref : c'est un effet explicite de cette source partagée, pas une modification du runtime.

Le contenu public reste en anglais. Ordre et contenu requis :

1. Nom et symbole local avec texte alternatif `Forgix`, puis une phrase expliquant le bénéfice, sans garantie de résultat automatique.
2. Trois capacités factuelles : clarifier l'objectif, faire approuver le plan, construire puis vérifier avec preuves fraîches.
3. Prérequis conservés : hôte compatible plugins, Node.js 24+, Git, Linux ou macOS ; Windows non pris en charge.
4. Démarrage après installation : une commande INIT et un exemple d'objectif par hôte, avec les syntaxes existantes `$forgix`, `/forgix:forgix` et `/forgix`.
5. Limites essentielles : approbation explicite avant BUILD ; commit, push et publication jamais implicitement autorisés.
6. Liens vers `docs/getting-started.md`, `docs/lifecycle-contract.md` et le README technique GitHub. Ne pas réinstaller le plugin au milieu du démarrage après installation.

Avant de remplacer le contenu actuel, préserver dans `plugins/forgix/docs/getting-started.md` toute instruction d'installation, migration ou utilisation encore exacte qui serait autrement perdue, y compris les anciens noms sans alias, les chemins d'état et la distinction Project INIT / Configuration wizard. Ne pas ajouter de troisième Overview, de duplication par plateforme, de générateur ou de HTML complexe. Une image indisponible ne doit jamais rendre le démarrage incompréhensible.

Les tests documentaires doivent distinguer les rôles : README racine pour découverte/installation, README du plugin pour démarrage et sécurité, Getting Started pour installation et référence détaillée. Retirer l'obligation d'une longue liste commune ne doit pas supprimer la vérification des commandes, des liens ou des parcours correspondants. Conserver le contrôle des anciens noms dans le guide et adapter explicitement son exception pour le README bref.

## Frontière de la future implémentation

Créer seulement `plugins/forgix/assets/logo.svg`. Modifier seulement :

- `plugins/forgix/.codex-plugin/plugin.json`, `plugins/forgix/plugin.json` ;
- `plugins/forgix/package.json` pour la liste `files` ;
- `plugins/forgix/README.md`, `plugins/forgix/docs/getting-started.md` ;
- `plugins/forgix/test/integration/documentation.test.ts`, `plugins/forgix/test/integration/distribution.test.ts`, `plugins/forgix/test/runtime/runtime-smoke.test.mjs`, `plugins/forgix/test/artifact-budget.json` ;
- `test/forgix-identity.test.ts` pour les métadonnées et la fidélité de l'actif.

Le présent document peut recevoir son état de revue. Aucun autre fichier de production n'est requis. En particulier : pas de modification de `.claude-plugin/plugin.json`, des marketplaces, de `src/release.ts`, du bundle runtime, du README racine ni des maîtres de marque. Si l'outillage existant impose un changement supplémentaire, le justifier avant d'élargir cette frontière. Aucun fichier supprimé.

## Vérification et livraison attendues

La validation structurelle et le rendu des applications sont deux preuves distinctes.

1. Tests ciblés : identité, documentation, distribution et smoke test du paquet extrait. Exiger que les chemins d'icônes référencent un fichier réellement présent dans le plugin et dans l'archive, restent dans leur racine après résolution, et ne dépendent ni du dépôt parent ni d'une URL distante. Inclure des cas négatifs pour fichier manquant et chemin sortant.
2. Comparer la copie SVG au maître et vérifier l'absence de ressources externes ou de script dans l'actif. Les modifications documentaires ne changent aucune commande, politique de sécurité ou garantie de portabilité.
3. Exécuter les validateurs stricts Claude Code et Antigravity sur le plugin complet, ainsi que le marketplace Claude inchangé. Pour Codex, ne pas inventer de commande `plugin validate` ; utiliser les tests du dépôt et le chargement natif approprié dans un environnement isolé.
4. Exécuter les contrôles existants `bun run check`, `bun run pack:runtime`, puis `bun run --cwd plugins/forgix test:runtime`. Vérifier le manifeste et les budgets de taille existants sans les augmenter automatiquement. Aucun nouveau build du runtime n'est nécessaire au contenu visuel, même si les contrôles existants reconstruisent le bundle ; un éventuel changement de bundle doit être expliqué, pas inclus par défaut.
5. À l'implémentation, avec autorisation de l'utilisateur si une installation est nécessaire, vérifier un paquet local isolé dans les applications disponibles : listing, détail et composition Codex ; listing et Overview Antigravity ; README et absence de régression Claude Code. Identifier versions des clients et chemins d'installation. Vérifier thèmes clair/sombre, recadrage, taille réduite et liens du README. Un HOME temporaire doit être utilisé pour les installations CLI de test ; aucune modification des installations personnelles ou des caches globaux.
6. Vérifier quelle source alimente effectivement l'Overview Codex. Le README du plugin est le candidat actuel, non un contrat prouvé du client. Si sa mise à jour ne change pas cet écran, ne pas inventer un champ `overview` : enregistrer le résultat, rechercher le contrat du client et revenir à une décision si une autre surface doit changer.

Le succès visuel est conditionné aux essais des applications ; les validateurs seuls n'autorisent pas une annonce « corrigé partout ». Une surface indisponible doit rester explicitement non vérifiée. La limite Claude Code est une dégradation documentée à soumettre à l'approbation finale, pas un risque déjà accepté.

Le rollback consiste à restaurer README, déclarations et liste de fichiers puis livrer une nouvelle version selon le processus existant. Aucune migration de données, nouvelle permission, dépendance ou requête réseau à l'exécution n'est introduite. Ne pas modifier une version installée directement pour contourner la mise à jour normale.

## État de revue et approbation

- Statut : conception approuvée par l'utilisateur le 2026-11-15 (« oui go »), puis implémentation locale explicitement autorisée (« oui »), sans commit ni publication.
- Domaine SHA-256 : octets UTF-8 du début du fichier jusqu'au début de ce titre, titre et section exclus.
- Révision substantielle approuvée : `32975a238a44c3ea4b534a9e62aaa9b9334455183c094488d06a51f403073176`.
- Revue indépendante achevée : `/root/design_review`, contexte neuf (`fork_turns: "none"`), lecture seule. Persona design_critic et standards feature-spec, zoom-out, implementation-readiness lus. Digest, HEAD et contrats locaux vérifiés ; aucun Blocker, Major ou Nit démontré dans ce périmètre.
- Limites de revue : sources officielles et sondes CLI vérifiées par le coordinateur, pas reproduites par le reviewer. Aucun rendu UI validé par la revue. L'isolation des conversations ne prouve pas l'exclusion des instructions hôte.
- Décisions approuvées : README npm également raccourci ; icône de listing Claude Code non garantie ; résultat visuel Codex conditionné à l'essai du client.
- Implémentation locale réalisée : symbole maître copié sans modification, métadonnées Codex/Antigravity, README bref et guide détaillé, publication de l'actif dans le paquet et tests associés. Le README racine, le manifeste Claude, les versions, le lockfile et le bundle runtime restent inchangés.
- Preuves exécutées : nouveaux tests initialement rouges (2 échecs), puis `bun run check` à 0 (36 tests outils, 204 tests plugin, format, lint, types, build, randomisation et budget) ; `bun run pack:runtime` à 0 ; smoke tests de l'archive à 5/5 sous Node 26.8.1. Budgets existants inchangés. Aucun nouvel essai spécifique sous Node 24 dans cette session.
- Validation hôte : Claude Code 2.1.252, plugin et marketplace stricts à 0 ; Antigravity 1.5.2, plugin strict à 0, aucun finding. Codex CLI 0.163.0, `plugin/read` natif dans un HOME/CODEX_HOME temporaire : les trois chemins d'icône sont résolus vers le SVG local. Aucun appel modèle ni installation personnelle.
- Limite Overview : ce `plugin/read` retourne la description courte du manifeste, pas le contenu du README. Il prouve le chargement des icônes, pas la source effective de l'Overview du client graphique. Le rendu clair/sombre, le recadrage et l'affichage du README dans les applications ne sont pas vérifiés ; aucune affirmation de correction visuelle universelle.
- Aucun commit, push, publication, changement de cache global ou modification d'installation personnelle. Revue indépendante de conception seulement ; aucune revue indépendante de l'implémentation annoncée.

# Forgix — Seuil / Carmin — Fracture

Charte de marque de Forgix : symbole Seuil, signature Exo 2 Bold convertie en tracés et contenus en Sora.

L’identité associe un symbole autonome, une signature typographique sobre et une matière carmin réservée aux supports. Le logo porte l’identité ; le fond l’amplifie sans être nécessaire à sa reconnaissance.

## 1. Fichiers maîtres

| Fichier                                               | Usage                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| [Symbole encre](svg/symbol-ink.svg)                   | Symbole seul sur un fond clair.                                         |
| [Symbole ivoire](svg/symbol-ivory.svg)                | Symbole seul sur un fond encre ou carmin.                               |
| [Signature encre](svg/lockup-ink.svg)                 | Seuil et FORGIX sur un fond clair.                                      |
| [Signature ivoire](svg/lockup-ivory.svg)              | Seuil et FORGIX sur un fond sombre.                                     |
| [Fond de référence](reference/carmin-fracture.png)    | Matière originale, au ratio 3:1, séparée du logo.                       |
| [Planche de référence](preview.png)                   | Présentation du kit et essais de petite taille.                         |
| [Avatar carmin / entrée README](svg/symbol-color.svg) | Déclinaison du symbole conservant le chemin déjà utilisé par le README. |

Les quatre SVG sont de vrais fichiers vectoriels. La signature contient les six lettres FORGIX converties en tracés : aucune police n’est nécessaire pour l’afficher. Ils ne contiennent ni texte graphique vivant, ni image matricielle, ni script, ni ressource externe.

Les anciens assets ASCII, indigo et jaune sont remplacés par ce kit. Le chemin `svg/symbol-color.svg`, déjà utilisé par le README principal, est conservé : il contient désormais le symbole ivoire sur un disque carmin, lisible sur fond clair comme sombre. Les quatre maîtres restent les références pour les autres compositions.

## 2. Symbole et signature

**Seuil** est un bloc à deux angles coupés avec une contreforme intérieure en décroché. Sa géométrie est celle retenue pendant l’exploration ; elle n’a pas été redessinée pour ce kit.

- Conserver le symbole entier, sa contreforme, son orientation et ses proportions.
- Ne pas ajouter de contour, d’ombre, de relief, de grain ou de dégradé au logo.
- Ne pas remplir la contreforme : elle reste transparente et révèle le fond.
- Ne pas remplacer le symbole par une lettre F ou par l’ancien signe ASCII.
- Ne pas recomposer FORGIX en texte pour simuler la signature. Réutiliser le SVG maître.

### Construction et réserve

- Le symbole utilise une grille de 100 × 100 unités ; son dessin occupe les coordonnées 12 à 88.
- La hauteur visible du symbole et du mot-symbole est de 76 unités dans la signature.
- La réserve entre le symbole et la première lettre visible est de 32 unités.
- Les viewBox incluent une réserve minimale de 12 unités autour du dessin. Ne pas la rogner ; ajouter davantage d’espace lorsque la composition le permet.
- La signature utilise les avances natives d’Exo 2 Bold et un espacement additionnel de −0,02 em. Cet espacement est déjà incorporé aux tracés.

### Petites tailles

- Symbole seul : au moins 16 px de largeur, réserve incluse.
- Signature : au moins 160 px de largeur, réserve incluse.
- Lorsque la signature devient trop petite, employer le symbole seul, sans comprimer le nom.
- Un recadrage circulaire d’avatar ne doit couper ni la silhouette ni sa réserve. Le cercle appartient au support, pas au symbole.

## 3. Palette

| Rôle   | Couleur   | Usage                                                               |
| ------ | --------- | ------------------------------------------------------------------- |
| Encre  | `#161318` | Logo positif, texte principal, fonds calmes et sombres.             |
| Carmin | `#AE123D` | Territoire chromatique de Forgix, grands champs colorés et avatars. |
| Corail | `#FF5E68` | Tranche lumineuse et accent graphique secondaire.                   |
| Ivoire | `#F4EEE9` | Fonds clairs, logo inversé et texte sur fond sombre.                |

Préférer encre sur ivoire, ivoire sur encre et ivoire sur carmin. Le corail n’est pas la couleur par défaut des petits textes sur fond clair.

Les aplats ivoire/encre présentent un contraste calculé de 16,01:1 ; ivoire/carmin, de 6,18:1. Ces ratios ne valent pas pour toute la matière photographique. Sur une bannière, placer le logo et le texte dans une zone calme et vérifier le fond réellement visible derrière eux. Il ne s’agit pas d’une certification d’accessibilité.

Forgix conserve ce territoire carmin sur ses différents contenus. Les étapes du workflow ne reçoivent pas chacune une nouvelle identité colorée.

## 4. Typographies

| Rôle                                   | Police                           | Graisse      |
| -------------------------------------- | -------------------------------- | ------------ |
| Mot-symbole FORGIX                     | Exo 2 Bold, dans les SVG fournis | Tracés figés |
| Titres et accroches                    | Sora                             | 700          |
| Paragraphes et textes d’accompagnement | Sora                             | 400          |

Le nom s’écrit **Forgix** dans la prose. **FORGIX** en capitales désigne le mot-symbole. Les commandes et identifiants techniques conservent leur casse exacte.

Les titres peuvent être affirmés et compacts ; les paragraphes restent aérés. Conserver un espacement normal pour les textes courants et ne pas appliquer le resserrement du logo à tout le contenu. Laisser le code dans une police monospace appropriée à son environnement, sans le transformer en logo.

Les tracés fournis font référence. Les contours proviennent d’Exo 2 Bold, distribuée sous SIL Open Font License 1.1. Le fichier de police n’est pas inclus ; les SVG maîtres font référence. Sora reste une police de contenu ; elle ne remplace pas le mot-symbole dans la signature.

## 5. Matière — Carmin / Fracture

La matière est abstraite, mate et tactile : pigment carmin dense, micrograin fin, grandes masses et une fracture asymétrique. Le corail révèle une tranche ; ce n’est ni de la lave, ni un tube néon.

Pour une bannière de référence au ratio 3:1 :

- réserver environ les 55 % de gauche à un champ encre calme ;
- concentrer la matière et la fracture dans la partie droite ;
- conserver une transition progressive entre encre et carmin ;
- poser la signature ivoire au-dessus du fond, sans lui appliquer la texture.

Le fond fourni est un actif séparé et peut être recadré pour un support. Il ne faut pas étirer sa matière ni réutiliser mécaniquement un recadrage qui supprimerait la réserve du logo. Les formats et zones de sécurité propres à chaque plateforme devront être vérifiés au moment des exports correspondants.

### À éviter

Enclumes, engrenages, flammes, étincelles, circuits, interfaces fictives, faux indicateurs de performance, stries diagonales copiées d’une autre marque et effets sur les lettres du logo.

## 6. Recette de génération

Le modèle produit **le fond uniquement**. Le symbole, le mot-symbole et les textes sont ensuite ajoutés à partir des sources vérifiées ; ils ne sont jamais régénérés dans la matière.

### Prompt de base

> Créer un fond abstrait original pour Forgix, direction « Carmin — Fracture ». Format panoramique 3:1. Les 55 % de gauche restent un champ encre presque noir, chaud et calme (#161318), avec très peu de détails. Dans la partie droite, une grande masse de pigment carmin dense (#AE123D), mate et tactile, présente une fracture asymétrique presque verticale. Une tranche corail (#FF5E68) capte la lumière rasante ; elle n’émet pas de lumière. Micrograin fin de sérigraphie, grands volumes abstraits, composition éditoriale sobre. Aucun texte, aucune lettre, aucun logo, aucune interface, aucun cadre. Pas de lave, de feu, de métal littéral, de fumée, de globe, de circuit, de stries répétées ou d’effet science-fiction. Préserver une zone réellement calme pour une future signature ivoire.

### Montage

1. Vérifier le cadrage, le grain et la zone de réserve du fond.
2. Importer la signature ivoire ou le symbole ivoire fourni ; ne pas les redessiner.
3. Ajouter les textes éventuels en Sora, en dehors de la réserve du logo.
4. Contrôler lisibilité, contraste, recadrage et dimensions à la taille de diffusion.
5. Conserver le fond et les maîtres séparés pour les déclinaisons suivantes.

Une image générée n’est pas une preuve de fidélité typographique. Le fichier maître, et non une reproduction visuellement proche, est la source du logo.

## 7. Ton rédactionnel

La voix de Forgix est claire, directe et factuelle. Elle explique ce qui a été clarifié, construit ou vérifié sans transformer une intention en résultat démontré.

- Employer des verbes précis et des phrases courtes, sans jargon promotionnel inutile.
- Distinguer proposition, décision, exécution et preuve.
- Ne pas promettre de vitesse, de sécurité ou de conformité sans éléments qui le démontrent.
- Ne pas inventer de métriques, de citations, de clients ou de résultats de test pour habiller un visuel.

« Clarifier. Construire. Vérifier. » constitue un exemple d’accroche pour cette identité, pas une obligation sur chaque support.

## 8. Sources et droits

- Le symbole Seuil est construit à partir de tracés vectoriels natifs. Aucune recherche d’antériorité de marque n’a été réalisée.
- Le mot-symbole provient d’[Exo 2](https://github.com/googlefonts/Exo-2.0), sous [SIL Open Font License 1.1](https://github.com/google/fonts/blob/main/ofl/exo2/OFL.txt). Seules les six lettres de FORGIX ont été converties en tracés. Aucun fichier de police Exo 2 n’est livré.
- Sora est disponible dans son [projet officiel](https://github.com/sora-xor/sora-font) sous Open Font License. Aucun fichier de police Sora n’est inclus dans cette arborescence. Si la police est distribuée lors d’une intégration ultérieure, conserver les mentions de copyright et le texte de sa licence.
- Le fond de référence a été généré pendant cette exploration avec l’outil de génération d’images. Il n’est pas issu des assets de VoidZero.
- [VoidZero](https://voidzero.dev/) a servi de référence pour le principe d’un socle sobre et d’un territoire coloré par outil, pas de source à reproduire.

Le kit ne contient aucun fichier de police à installer.

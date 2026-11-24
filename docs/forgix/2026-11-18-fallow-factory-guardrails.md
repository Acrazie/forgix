# Plan Projection: artifact:fallow-factory-guardrails

- Profile: plan
- Risk: medium
- Revision: 1
- Product Baseline: design:product-baseline:1
- Contract Digest: 1c5a95e6c4a2ebaa80aaa2c74c535a8c034c88e96650d1c65b10ea1ee59dd37a

## Scope
- Une version et une configuration Fallow pour le dépôt de développement ; aucune dépendance ajoutée au bundle livré.
- Rapport dead-code complet, informatif pour les constats ; frontière src/ vers outillage bloquante dans le gate Bun appelé par Dagger.
- Rapport JSON Buildkite et diagnostics de complexité/duplication uniquement à la demande.

## Non-Goals
- Pas d’autofix, de baseline, de nettoyage des constats existants, de hook, de publication ou de suppression automatique.
- Pas de gate audit, complexity ou duplication.

## Acceptance Criteria
- **criterion.report**: Un rapport JSON de code mort est reproductible en local. Les constats n’échouent pas ; une configuration invalide ou une analyse dégradée échoue. (validations: validation.fallow, validation.artifact)
- **criterion.boundary**: Le gate existant bloque les imports de src/ vers scripts/, test/ ou .dagger/ ; un arbre conforme passe. (validations: validation.fallow, validation.full, validation.dagger)
- **criterion.ci**: Dagger exporte le même rapport et Buildkite le référence comme artefact de qualité, distinct des artefacts consommés pour la publication. (validations: validation.artifact, validation.dagger)
- **criterion.retro**: Complexité et duplication sont consultables à la demande, hors gate et sans baseline. (validations: validation.fallow)

## Tasks
- **task.report**: Épingler Fallow 3.43.2 en devDependency avec bun.lock. Versionner les points d’entrée d’outillage manquants et les exclusions justifiées. Exposer check:dead-code en JSON et en lecture seule. (criteria: criterion.report)
- **task.boundary**: Déclarer deux zones explicites, produit et outillage, et raccorder le contrôle de frontière à bun run check. Écrire les canaris qui distinguent une alerte informative d’un défaut de frontière ou d’analyse. (criteria: criterion.report, criterion.boundary; depends on: task.report)
- **task.ci**: Ajouter la fonction de rapport Dagger, l’appeler depuis le gate Buildkite et exporter le JSON dans un chemin ignoré hors de .artifacts/*. Adapter le test du contrat CI sans toucher les étapes de release. (criteria: criterion.ci; depends on: task.report, task.boundary)
- **task.retro**: Exposer des commandes Bun de diagnostics health et dupes. Documenter leurs usages et limites dans CONTRIBUTING.md. (criteria: criterion.retro; depends on: task.report)

## Validations
- **validation.fallow**: Canaris locaux : code mort informatif, configuration ou parse invalide en échec, franchissement de frontière en échec, et exécution des diagnostics de rétro. (`bun test test/fallow.test.ts test/release-ci.test.ts`)
- **validation.full**: Gate complet local avec la nouvelle frontière. (`bun run check`)
- **validation.artifact**: Exporter le rapport depuis Dagger et vérifier JSON, version, chemin et parité des identifiants avec le scan local du même arbre. (`dagger call dead-code-report --source=. --output=.fallow/dead-code.json`)
- **validation.dagger**: Exécuter le gate Dagger du pipeline sur le changement. (`dagger call check --source=.`)

## Risks & Controls
- **risk.graph**: Les scripts invoqués par le shell, Buildkite ou Dagger peuvent être pris pour du code mort. — Control: Vérifier les racines détectées ; ajouter les entrées réellement appelées, sans glob scripts/** ni baseline.
- **risk.severity**: Traiter toutes les sorties non nulles comme informatives peut masquer une analyse en panne. — Control: Utiliser le mode JSON natif non bloquant pour les constats avec le gate de parse ; tester une erreur réelle et garder architecture bloquante.
- **risk.release**: Un rapport de qualité dans les artefacts de release peut entrer dans les téléchargements de publication. — Control: Exporter sous .fallow/ et conserver le pipeline de publication et ses identités d’artefacts.

## Implementation Guide
- Employer le mode Fallow --only dead-code --format json --fail-on-parse-error vérifié au pilote ; ne pas neutraliser le code retour avec || true.
- Dagger reprend ciContainer et le frozen lockfile ; retourner un File et l’exporter sous .fallow/ avant le gate principal.
- Garder les règles d’architecture séparées des signaux informatifs et ne pas ajouter d’exclusion globale de l’outillage.

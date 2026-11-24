import ForgixKernel.Preparation

open Lean Forgix.Shape Forgix.ProjectInit

private def shapeCases : List (String × Evidence) := [
  ("explicit-match", ⟨some "current", some "current", [some "current"]⟩),
  ("explicit-mismatch", ⟨some "current", some "stale", [some "current"]⟩),
  ("explicit-match-wins", ⟨some "current", some "current", [some "stale"]⟩),
  ("fallback-match", ⟨some "current", none, [some "current"]⟩),
  ("fallback-mismatch", ⟨some "current", none, [some "current", none, some "stale"]⟩),
  ("missing-source-is-not-mismatch", ⟨some "current", none, [none]⟩),
  ("no-expected-fingerprint", ⟨none, some "stale", [some "current"]⟩),
  ("no-source-references", ⟨some "current", none, []⟩)
]

private def decisions : List Decision := [
  ⟨"stack", [], [⟨"package.json", "current"⟩, ⟨"bun.lock", "current"⟩]⟩,
  ⟨"source-layout", ["stack"], []⟩,
  ⟨"architecture-boundary", ["stack"], [⟨"src/core.ts", "current"⟩]⟩,
  ⟨"dependency-direction", ["source-layout", "architecture-boundary"], []⟩,
  ⟨"naming", [], [⟨"AGENTS.md", "current"⟩]⟩,
  ⟨"errors", ["architecture-boundary"], []⟩,
  ⟨"tests", ["dependency-direction"], []⟩,
  ⟨"quality", ["tests"], []⟩
]

private def baseline : Observations :=
  [("package.json", "current"), ("bun.lock", "current"),
    ("src/core.ts", "current"), ("AGENTS.md", "current")]

private def initCases : List (String × Observations) := [
  ("unchanged", baseline),
  ("root-drift-diamond", baseline.map fun (ref, value) =>
    (ref, if ref == "bun.lock" then "changed" else value)),
  ("middle-drift-no-parent-or-sibling", baseline.map fun (ref, value) =>
    (ref, if ref == "src/core.ts" then "changed" else value)),
  ("independent-drift", baseline.map fun (ref, value) =>
    (ref, if ref == "AGENTS.md" then "changed" else value)),
  ("overlapping-roots", baseline.map fun (ref, value) =>
    (ref, if ref == "package.json" || ref == "src/core.ts" then "changed" else value)),
  ("missing-is-not-stale", baseline.filter (fun entry => entry.1 != "package.json")),
  ("missing-and-changed", [("package.json", "changed"), ("unrelated.txt", "changed")])
]

def main : IO Unit := do
  let shape := shapeCases.map fun (name, evidence) =>
    Json.mkObj [("name", toJson name), ("evidence", toJson evidence), ("fresh", toJson (fresh evidence))]
  let init := initCases.map fun (name, observations) =>
    let roots := staleKeys decisions observations
    let missing := missingRefs decisions observations
    Json.mkObj [
      ("name", toJson name), ("observations", toJson observations),
      ("staleDecisionKeys", toJson roots), ("missingSourceRefs", toJson missing),
      ("invalidatedDecisionKeys", toJson (invalidatedKeys decisions observations)),
      ("current", toJson (roots.isEmpty && missing.isEmpty))
    ]
  IO.println <| Json.compress <| Json.mkObj [
    ("shape", toJson shape), ("decisions", toJson decisions), ("init", toJson init)
  ]

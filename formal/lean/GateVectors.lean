import ForgixKernel.Gate

open Lean Forgix.Gate

private def contexts : List (String × Context) := [
  ("plan-v2", ⟨true, "current", false, none⟩),
  ("contract-review-ready", ⟨true, "current", true, some "current"⟩),
  ("contract-review-open-major", ⟨false, "current", true, some "current"⟩),
  ("contract-review-unreviewed", ⟨false, "current", true, none⟩)
]

private def digests : List (Option String) := [some "stale", none, some "current"]

def main : IO Unit := do
  let cases := contexts.flatMap fun (name, context) =>
    digests.flatMap fun contract =>
      digests.map fun review =>
        Json.mkObj [
          ("context", toJson name), ("contract", toJson contract), ("review", toJson review),
          ("receiptContract", toJson (approve context contract review))
        ]
  IO.println (Json.compress (toJson cases))

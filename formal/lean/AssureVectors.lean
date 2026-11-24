import ForgixKernel.Assure

open Lean Forgix.Assure

private def criterion := "criterion.main"
private def subjects := [criterion, "check.required"]
private def snapshot := "worktree:current"
private def a : Operation := ⟨"check:a", "current", subjects, true⟩
private def b : Operation := ⟨"check:b", "current", subjects, true⟩
private def operations := [a, b]

private def passed (op : Operation) : Evidence :=
  { operationId := op.id, verifierDigest := op.verifierDigest, snapshot,
    recordedAt := 0, result := .passed, subjectIds := op.covers }

private def inactive (op : Operation) : Evidence :=
  { passed op with result := .notApplicable, activationEvidence := true }

private def vectors : List (String × List Evidence) :=
  let pa := passed a
  let pb := passed b
  let failure := { pb with result := .failed, recordedAt := 1 }
  let oldSnapshot := { pb with snapshot := "worktree:previous" }
  [
    ("both-current", [pa, pb]),
    ("missing-operation", [pa]),
    ("stale-snapshot", [pa, oldSnapshot]),
    ("stale-definition", [pa, { pb with verifierDigest := "previous" }]),
    ("incomplete-subjects", [pa, { pb with subjectIds := [criterion] }]),
    ("later-failure", [pa, pb, failure]),
    ("later-pass", [pa, failure, { pb with recordedAt := 2 }]),
    ("older-pass-listed-last", [pa, failure, pb]),
    ("same-time-last-failure", [pa, pb, { failure with recordedAt := 0 }]),
    ("same-time-last-pass", [pa, { failure with recordedAt := 0 }, pb]),
    ("newer-stale-snapshot", [pa, pb, { oldSnapshot with recordedAt := 1 }]),
    ("ignore-newer-stale-definition", [pa, pb, { failure with verifierDigest := "previous" }]),
    ("justified-inactive-operation", [pa, inactive b]),
    ("inactive-does-not-cover-criterion", [inactive a, inactive b]),
    ("unjustified-inactive-operation", [pa, { inactive b with activationEvidence := false }])
  ]

def main : IO Unit := do
  let cases := vectors.map fun (name, history) =>
    Json.mkObj [
      ("name", toJson name), ("history", toJson history),
      ("valid", toJson (history.all (validRecord operations))),
      ("ready", toJson (evidenceReady snapshot operations [criterion] history))
    ]
  IO.println <| Json.compress <| Json.mkObj [
    ("snapshot", toJson snapshot), ("operations", toJson operations), ("cases", toJson cases)
  ]

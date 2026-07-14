import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("public workflow defines adaptive versioned artifacts", () => {
  const skill = read("../skills/dev-flow/SKILL.md");

  assert.match(skill, /Quick.*no mandatory artifact/is);
  assert.match(skill, /docs\/dev-flow\/YYYY-MM-DD-<slug>\.md/);
  assert.match(skill, /before implementation approval/i);
  assert.match(skill, /only permitted repository write/i);
  assert.match(skill, /active worktree/i);
  assert.match(skill, /commit or handoff/i);
  assert.match(skill, /reuse the existing artifact/i);
  assert.match(skill, /spec\.md/);
  assert.match(skill, /plan\.md/);
  assert.match(skill, /risk-and-rollback\.md/);
  assert.match(skill, /verification\.md/);
});

test("standard change record has a stable minimum contract", () => {
  const skill = read("../skills/dev-flow/SKILL.md");

  for (const section of [
    "Context and outcome",
    "Scope and non-goals",
    "Constraints and decisions",
    "Acceptance criteria",
    "Implementation plan",
    "Risks and rollback",
    "Verification evidence"
  ]) {
    assert.match(skill, new RegExp(section, "i"));
  }
});

test("stage skills preserve and consume the artifact contract", () => {
  const discover = read("../skills/discover-change/SKILL.md");
  const plan = read("../skills/plan-change/SKILL.md");
  const execute = read("../skills/execute-change/SKILL.md");
  const review = read("../skills/review-change/SKILL.md");
  const verify = read("../skills/verify-change/SKILL.md");

  assert.match(discover, /artifact-ready specification evidence/i);
  assert.match(plan, /acceptance criterion/i);
  assert.match(plan, /Do not embed complete implementations/i);
  assert.match(execute, /approved artifact/i);
  assert.match(review, /approved artifact/i);
  assert.match(verify, /verification evidence/i);
});

test("artifact documentation exposes standard and critical layouts", () => {
  const documentation = read("../docs/artifacts.md");

  assert.match(documentation, /docs\/dev-flow\/YYYY-MM-DD-<slug>\.md/);
  assert.match(documentation, /spec\.md/);
  assert.match(documentation, /plan\.md/);
  assert.match(documentation, /risk-and-rollback\.md/);
  assert.match(documentation, /verification\.md/);
});

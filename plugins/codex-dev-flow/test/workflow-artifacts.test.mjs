import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("public workflow defines logical versioned artifacts", () => {
  const skill = read("../skills/dev-flow/SKILL.md");

  assert.match(skill, /Every task uses adaptive SHAPE/i);
  assert.match(skill, /Quick and Plan share canonical contract/i);
  assert.match(skill, /Quick keeps compact state only/i);
  assert.match(skill, /Plan creates one parent-rendered Proposed\s+Markdown/i);
  assert.match(skill, /Parent alone writes ShapeState and Plan projection/i);
  assert.match(skill, /belongs to active\s+worktree/i);
  assert.match(skill, /commit or handoff/i);
  assert.match(skill, /Reuse existing artifact\s+identity/i);
  assert.match(skill, /repository choices only/i);
});

test("logical change artifact has a stable minimum contract", () => {
  const skill = read("../skills/dev-flow/SKILL.md");

  for (const section of [
    "scope",
    "non-goals",
    "stable criteria",
    "ordered tasks",
    "criterion-linked validation",
    "risks/controls",
    "explicit dependencies",
    "digest",
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

  assert.match(discover, /bounded structured evidence/i);
  assert.match(discover, /source fingerprints/i);
  assert.match(plan, /criterion/i);
  assert.match(plan, /Do not embed complete implementations/i);
  assert.match(execute, /artifact identity\/digest/i);
  assert.match(execute, /matching Approval/i);
  assert.match(review, /artifact\s+identity\/digest/i);
  assert.match(review, /unapproved deviations/i);
  assert.match(verify, /acceptance-criterion-to-evidence map/i);
  assert.match(verify, /logical artifact/i);
});

test("artifact documentation keeps legacy layouts non-canonical", () => {
  const documentation = read("../docs/artifacts.md");

  assert.match(documentation, /docs\/dev-flow\/YYYY-MM-DD-<slug>\.md/);
  assert.match(documentation, /spec\.md/);
  assert.match(documentation, /plan\.md/);
  assert.match(documentation, /risk-and-rollback\.md/);
  assert.match(documentation, /verification\.md/);
  assert.match(documentation, /repository choices only/i);
  assert.match(documentation, /non-canonical/i);
  assert.match(documentation, /cannot replace persisted contract\s+identity\/digest/i);
});

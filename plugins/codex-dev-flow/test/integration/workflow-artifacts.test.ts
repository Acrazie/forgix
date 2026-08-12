// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("public workflow defines logical versioned artifacts", () => {
  const skill = read("../../skills/dev-flow/SKILL.md");

  expect(skill).toMatch(/Every task uses adaptive SHAPE/i);
  expect(skill).toMatch(/Quick and Plan share canonical contract/i);
  expect(skill).toMatch(/Quick keeps compact state only/i);
  expect(skill).toMatch(/Plan creates one parent-rendered Proposed\s+Markdown/i);
  expect(skill).toMatch(/Parent alone writes ShapeState and Plan projection/i);
  expect(skill).toMatch(/belongs to active\s+worktree/i);
  expect(skill).toMatch(/repository retention policy/i);
  expect(skill).toMatch(/Reuse existing artifact\s+identity/i);
  expect(skill).toMatch(/repository choices only/i);
});

test("logical change artifact has a stable minimum contract", () => {
  const skill = read("../../skills/dev-flow/SKILL.md");

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
    expect(skill).toMatch(new RegExp(section, "i"));
  }
});

test("stage skills preserve and consume the artifact contract", () => {
  const discover = read("../../skills/discover-change/SKILL.md");
  const plan = read("../../skills/plan-change/SKILL.md");
  const review = read("../../skills/review-change/SKILL.md");
  const verify = read("../../skills/verify-change/SKILL.md");

  expect(discover).toMatch(/bounded structured evidence/i);
  expect(discover).toMatch(/source fingerprints/i);
  expect(plan).toMatch(/criterion/i);
  expect(plan).toMatch(/Do not embed complete implementations/i);
  expect(read("../../skills/dev-flow/SKILL.md")).toMatch(/without BUILD-specific skill/i);
  expect(review).toMatch(/artifact\s+identity\/digest/i);
  expect(review).toMatch(/unapproved deviations/i);
  expect(verify).toMatch(/acceptance-criterion-to-evidence map/i);
  expect(verify).toMatch(/logical artifact/i);
});

test("artifact documentation keeps legacy layouts non-canonical", () => {
  const documentation = read("../../docs/artifacts.md");

  expect(documentation).toMatch(/docs\/dev-flow\/YYYY-MM-DD-<slug>\.md/);
  expect(documentation).toMatch(/spec\.md/);
  expect(documentation).toMatch(/plan\.md/);
  expect(documentation).toMatch(/risk-and-rollback\.md/);
  expect(documentation).toMatch(/verification\.md/);
  expect(documentation).toMatch(/repository choices only/i);
  expect(documentation).toMatch(/non-canonical/i);
  expect(documentation).toMatch(/cannot replace persisted contract\s+identity\/digest/i);
});

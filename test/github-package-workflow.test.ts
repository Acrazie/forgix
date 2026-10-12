import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { parse } from "yaml";

const workflowPath = new URL("../.github/workflows/publish-github-package.yml", import.meta.url);
const workflowSource = readFileSync(workflowPath, "utf8");
const workflow = parse(workflowSource);

describe("GitHub package workflow", () => {
  test("supports future npm releases and explicit backfill", () => {
    expect(workflow.on.release.types).toEqual(["published"]);
    expect(workflow.on.workflow_dispatch.inputs.versions.default).toBe("all");
    expect(workflow.jobs.mirror.if).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow.jobs.mirror.if).toContain("startsWith(github.event.release.tag_name, 'v')");
    expect(workflow.jobs.mirror.if).toContain("startsWith(github.event.release.tag_name, 'npm-v')");
    expect(workflow.jobs.mirror.if).toContain(
      "startsWith(github.event.release.tag_name, 'forgix-v')",
    );
  });

  test("uses repository-scoped least privilege authentication", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.jobs.mirror.permissions).toEqual({ contents: "read", packages: "write" });
    const steps = workflow.jobs.mirror.steps;
    expect(steps.find((step) => step.uses === "actions/setup-node@v4").with).toMatchObject({
      "node-version": 24,
      "registry-url": "https://npm.pkg.github.com",
      scope: "@acrazie",
    });
    const mirror = steps.find((step) => step.name === "Mirror canonical npm package");
    expect(mirror.env.NODE_AUTH_TOKEN).toBe("${{ secrets.GITHUB_TOKEN }}");
    expect(mirror.run).toBe('bun scripts/mirror-npm-to-github.ts "$MIRROR_SELECTOR"');
  });

  test("keeps credentials out of command arguments and repository files", () => {
    expect(workflowSource).not.toMatch(/ghp_|github_pat_|npm_[A-Za-z0-9]/);
    expect(workflowSource).not.toContain("--token");
  });
});

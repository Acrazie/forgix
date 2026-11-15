import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { parse } from "yaml";

const workflowPath = new URL("../.github/workflows/publish-github-package.yml", import.meta.url);
const workflowSource = readFileSync(workflowPath, "utf8");
const workflow = parse(workflowSource);

describe("GitHub package workflow", () => {
  test("supports explicit release calls and manual backfill, not recursive release events", () => {
    expect(workflow.on.release).toBeUndefined();
    expect(workflow.on.workflow_call.inputs.versions.required).toBe(true);
    expect(workflow.on.workflow_dispatch.inputs.versions.default).toBe("all");
    expect(workflow.jobs.mirror.if).toBeUndefined();
  });

  test("uses repository-scoped least privilege authentication and pinned actions", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency).toEqual({
      group: "publish-github-package",
      queue: "max",
    });
    expect(workflow.concurrency["cancel-in-progress"]).not.toBe(true);
    expect(workflow.jobs.mirror.permissions).toEqual({ contents: "read", packages: "write" });
    expect(workflow.jobs.mirror["timeout-minutes"]).toBeGreaterThan(0);

    const steps = workflow.jobs.mirror.steps;
    const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@"));
    expect(checkout.uses).toMatch(/^actions\/checkout@[0-9a-f]{40}$/);
    expect(checkout.with).toEqual({ "persist-credentials": false });

    const setupNode = steps.find((step) => step.uses?.startsWith("actions/setup-node@"));
    expect(setupNode.uses).toMatch(/^actions\/setup-node@[0-9a-f]{40}$/);
    expect(setupNode.with).toMatchObject({
      "node-version-file": ".node-version",
      "registry-url": "https://npm.pkg.github.com",
      scope: "@acrazie",
    });

    const setupBun = steps.find((step) => step.uses?.startsWith("oven-sh/setup-bun@"));
    expect(setupBun.uses).toMatch(/^oven-sh\/setup-bun@[0-9a-f]{40}$/);
    expect(setupBun.with).toMatchObject({
      "bun-version-file": ".bun-version",
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

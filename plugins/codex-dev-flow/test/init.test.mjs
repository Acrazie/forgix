import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

function answers(values) {
  let index = 0;
  return async () => values[index++] ?? "";
}

test("init writes validated repository configuration with extension allowlists", async () => {
  const { runInvocation, validateSchema } = await import(bundle);
  const root = await mkdtemp(join(tmpdir(), "dev-flow-init-"));
  const output = [];
  try {
    const result = await runInvocation(["init"], {
      init: {
        cwd: root,
        ask: answers([
          "required",
          "required",
          "plus",
          "60",
          "85",
          "impeccable",
          "impeccable:frontend-design",
          "yes"
        ]),
        write: (value) => output.push(value)
      }
    });
    assert.equal(result.status, "created");
    const path = join(root, ".codex", "dev-flow.yaml");
    const config = parseYaml(await readFile(path, "utf8"));
    assert.deepEqual(config.integrations, {
      plugins: ["impeccable"],
      skills: ["impeccable:frontend-design"]
    });
    assert.equal(config.worktree.mode, "required");
    assert.equal(config.finish.pullRequest, "required");
    assert.equal(config.subscription.plan, "plus");
    assert.equal(config.subscription.quota.warningPercent, 60);
    assert.equal(config.subscription.quota.criticalPercent, 85);
    assert.equal(validateSchema("config", config).valid, true);
    assert.match(output.join(""), /Configuration preview/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("init cancellation preserves an existing configuration", async () => {
  const { runInvocation } = await import(bundle);
  const root = await mkdtemp(join(tmpdir(), "dev-flow-init-cancel-"));
  try {
    const first = await runInvocation(["init"], {
      init: { cwd: root, ask: answers(["", "", "", "", "", "", "", "yes"]), write: () => {} }
    });
    const before = await readFile(first.data.path, "utf8");
    const second = await runInvocation(["init"], {
      init: { cwd: root, ask: answers(["", "", "", "", "", "", "", "no"]), write: () => {} }
    });
    assert.equal(second.status, "cancelled");
    assert.equal(await readFile(first.data.path, "utf8"), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

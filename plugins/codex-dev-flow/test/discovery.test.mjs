import assert from "node:assert/strict";
import { test } from "node:test";

test("repository guidance wins over package scripts", async () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  const { discoverVerificationCommands } = await import(bundle);
  const result = discoverVerificationCommands(new URL("./fixtures/node-project", import.meta.url));
  assert.equal(result.source, "AGENTS.md");
  assert.deepEqual(result.commands, ["npm run lint:strict", "npm test"]);
});

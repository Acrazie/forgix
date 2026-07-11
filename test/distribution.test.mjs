import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

test("distribution bundle exists", () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  assert.equal(existsSync(bundle), true);
});

test("distribution bundle imports as ESM", async () => {
  const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
  const module = await import(bundle);
  assert.equal(typeof module.main, "function");
});

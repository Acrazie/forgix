import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("workflow schemas are strict and versioned", () => {
  for (const name of ["config", "policy", "state"]) {
    const path = new URL("../schemas/" + name + ".schema.json", import.meta.url);
    assert.equal(existsSync(path), true);
    const schema = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.schemaVersion.type, "integer");
  }
});

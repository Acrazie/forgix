// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/commands.ts";
import { expect, test } from "bun:test";

test("repository guidance wins over package scripts", async () => {
  const { discoverAssuranceCommands } = sourceApi;
  const result = discoverAssuranceCommands(new URL("../fixtures/node-project", import.meta.url));
  expect(result.source).toBe("AGENTS.md");
  expect(result.commands).toEqual(["npm run lint:strict", "npm test"]);
});

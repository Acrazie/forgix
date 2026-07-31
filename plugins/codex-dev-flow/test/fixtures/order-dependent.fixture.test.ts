import { expect, test } from "bun:test";

let primed = false;

test("order fixture > requires priming", () => {
  expect(primed).toBe(true);
});

test("order fixture > primes shared state", () => {
  primed = true;
});

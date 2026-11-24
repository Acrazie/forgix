import { expect, test } from "bun:test";
import { parseTestOrder } from "../../scripts/test-order.ts";

test("test order ignores optional timing and summary lines", () => {
  const withTiming =
    "(fail) order fixture > requires priming [0.2ms]\n(pass) order fixture > primes shared state [0.1ms]\n --seed=3\n";
  const withoutTiming =
    "(fail) order fixture > requires priming [0.2ms]\n(pass) order fixture > primes shared state\n\n --seed=3\n 1 pass\n 1 fail\n";
  const expected = ["requires priming", "primes shared state"];
  expect(parseTestOrder(withTiming)).toEqual(expected);
  expect(parseTestOrder(withoutTiming)).toEqual(expected);
  expect(parseTestOrder(withoutTiming.replaceAll("\n", "\r\n"))).toEqual(expected);
  expect(parseTestOrder(withoutTiming.replace(" [0.2ms]", ""))).toEqual(expected);
  expect(parseTestOrder(" --seed=3\n 1 pass\n 1 fail\n")).toEqual([]);
});

test("test order excludes source snippets and preserves actual ordering", () => {
  expect(
    parseTestOrder(
      '5 | test("order fixture > requires priming", () => {});\n(pass) order fixture > primes shared state\n(fail) order fixture > requires priming\n',
    ),
  ).toEqual(["primes shared state", "requires priming"]);
});

import { expect } from "bun:test";

export function expectThrown(run: () => unknown, predicate: (error: unknown) => boolean): void {
  let thrown = false;
  try {
    run();
  } catch (error) {
    thrown = true;
    expect(predicate(error)).toBe(true);
  }
  expect(thrown).toBe(true);
}

export async function expectRejected(
  run: () => Promise<unknown>,
  predicate: (error: unknown) => boolean,
): Promise<void> {
  let rejected = false;
  try {
    await run();
  } catch (error) {
    rejected = true;
    expect(predicate(error)).toBe(true);
  }
  expect(rejected).toBe(true);
}

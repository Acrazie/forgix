/** Extract test names, not optional timings or subsequent summary lines. */
export function parseTestOrder(output: string): string[] {
  return [...output.matchAll(/^\((?:pass|fail)\) order fixture > ([^\r\n[]+)/gm)].map((match) =>
    (match[1] ?? "").trim(),
  );
}

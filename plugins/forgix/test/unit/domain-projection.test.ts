import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import {
  applyOwnedMarkdownPatch,
  compileDomainSemanticPatches,
  resolveDomainDestinations,
} from "../../src/domain-projection.ts";

test("domain destination authority is policy then profile then detection then defaults", () => {
  expect(resolveDomainDestinations({}).glossaryPath).toBe("docs/domain/glossary.md");
  expect(
    resolveDomainDestinations({
      policy: { glossaryPath: "policy/terms.md" },
      profile: {
        contextMode: "single",
        glossaryPath: "profile/terms.md",
        rulesPath: "profile/rules.md",
        adrDirectory: "profile/adr",
        language: "fr",
        identityConvention: "stable ids",
        linkConvention: "relative",
        sourceFingerprints: [],
      },
    }).glossaryPath,
  ).toBe("policy/terms.md");
  expect(() =>
    resolveDomainDestinations({
      detected: [
        { glossaryPath: "a/g.md", rulesPath: "a/r.md", adrDirectory: "a/adr" },
        { glossaryPath: "b/g.md", rulesPath: "b/r.md", adrDirectory: "b/adr" },
      ],
    }),
  ).toThrow(/ambiguous/);
});

test("semantic domain patch requires GATE and preserves unrelated content", () => {
  const source = "# Rules\n\nUnrelated.\n";
  const fingerprint = `sha256:${createHash("sha256").update(source).digest("hex")}`;
  const input = [
    {
      operationId: "domain:rule-1",
      kind: "upsert_rule" as const,
      destinationPath: "docs/domain/rules.md",
      ownedIdentity: "rule:one",
      sourceFingerprint: fingerprint,
      content: "## Rule one\nAlways verify.",
    },
  ];
  expect(() => compileDomainSemanticPatches(input, false)).toThrow(/GATE/);
  const [patch] = compileDomainSemanticPatches(input, true);
  const projected = applyOwnedMarkdownPatch(source, patch!);
  expect(projected).toContain("Unrelated.");
  expect(projected).toContain("<!-- dev-flow:rule:one:start -->");
  expect(() => applyOwnedMarkdownPatch(projected, patch!)).toThrow(/stale/);
});

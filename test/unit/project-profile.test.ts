import { expect, test } from "bun:test";
import {
  ProjectProfileError,
  approveProjectProfile,
  diffProjectProfiles,
  prepareProjectProfile,
  reconcileProjectProfile,
  renderProjectProfile,
  validateLocalProjectProfile,
  validateProjectProfile,
  validateProjectProfileProjections,
} from "../../src/profile/index.ts";
import { validateSchema } from "../../src/core/schema.ts";
import { expectThrown } from "../support/expect-error.ts";
import { localProfileInput, projectProfileInput } from "../support/project-profile.ts";

test("project profile canonical digest and approval bind exact durable content", () => {
  const proposal = prepareProjectProfile(projectProfileInput());
  expect(proposal.contentDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(prepareProjectProfile(JSON.parse(JSON.stringify(proposal)))).toEqual(proposal);
  const approved = approveProjectProfile(proposal, "2026-08-03T13:00:00.000Z");
  expect(validateProjectProfile(approved)).toEqual(approved);
  expect(validateSchema("project-profile", approved).valid).toBe(true);
  expect(approved.approval.contentDigest).toBe(proposal.contentDigest);
  expect(approved.approval.receiptDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(renderProjectProfile(proposal)).toContain(`contentDigest: ${proposal.contentDigest}`);

  const tampered = structuredClone(approved);
  tampered.content.decisions![0]!.value = "silently changed";
  expectThrown(
    () => validateProjectProfile(tampered),
    (error: unknown) =>
      error instanceof ProjectProfileError && error.code === "profile_digest_mismatch",
  );
});

test("shared profile accepts minimal project-only content while rejecting local paths, secrets, and false proof", () => {
  const minimal = prepareProjectProfile({
    schemaVersion: 1,
    profileId: "greenfield",
    content: {
      project: { id: "greenfield", name: "Greenfield" },
    },
  });
  expect(minimal.revision).toBe(1);
  expect(validateProjectProfile(approveProjectProfile(minimal)).content.project).toEqual({
    id: "greenfield",
    name: "Greenfield",
  });
  expect(diffProjectProfiles(undefined, minimal)).toEqual({
    addedDecisionKeys: [],
    changedDecisionKeys: [],
    removedDecisionKeys: [],
    topologyChanged: false,
    stackChanged: false,
    domainDocumentationChanged: false,
  });

  const emptyArrays = prepareProjectProfile({
    schemaVersion: 1,
    profileId: "greenfield",
    revision: 1,
    content: {
      project: { id: "greenfield", name: "Greenfield" },
      stack: [],
      decisions: [],
      diagramRefs: [],
    },
  });
  expect(emptyArrays.content.decisions).toEqual([]);

  const wrongIdentity = projectProfileInput();
  wrongIdentity.content.project.id = "another-project";
  expect(() => prepareProjectProfile(wrongIdentity)).toThrow(/identity must match/);

  const localPath = projectProfileInput();
  localPath.content.stack![0]!.sourceRefs = ["/Users/me/project/package.json"];
  expect(() => prepareProjectProfile(localPath)).toThrow(/local absolute path/);

  const embeddedLocalPath = projectProfileInput();
  embeddedLocalPath.content.decisions![0]!.value = "Read /home/alice/project/src directly.";
  expect(() => prepareProjectProfile(embeddedLocalPath)).toThrow(/absolute filesystem path/);

  const secret = projectProfileInput();
  secret.content.decisions![0]!.value = "token=sk-super-secret-token";
  expect(() => prepareProjectProfile(secret)).toThrow(/secret-like/);

  const asserted = projectProfileInput();
  asserted.content.decisions![0]!.provenance.kind = "user_asserted";
  expect(() => prepareProjectProfile(asserted)).toThrow(/cannot carry verified fingerprints/);
});

test("decision graph is strict and drift invalidates only dependent closure", () => {
  const input = projectProfileInput();
  for (const decision of input.content.decisions!) decision.sourceFingerprints = [];
  const architecture = input.content.decisions!.find(({ key }) => key === "architecture-boundary")!;
  const tests = input.content.decisions!.find(({ key }) => key === "tests")!;
  const quality = input.content.decisions!.find(({ key }) => key === "quality")!;
  architecture.sourceFingerprints = [
    { sourceRef: "src/architecture.ts", value: `sha256:${"a".repeat(64)}` },
  ];
  architecture.provenance.sourceRefs = ["src/architecture.ts"];
  tests.dependsOn = [architecture.key];
  quality.dependsOn = [tests.key];
  const proposal = prepareProjectProfile(input);
  expect(
    reconcileProjectProfile(proposal, {
      "src/architecture.ts": `sha256:${"b".repeat(64)}`,
    }),
  ).toEqual({
    staleDecisionKeys: ["architecture-boundary"],
    invalidatedDecisionKeys: ["architecture-boundary", "quality", "tests"],
    missingSourceRefs: [],
    current: false,
  });

  const cycle = projectProfileInput();
  cycle.content.decisions![0]!.dependsOn = [cycle.content.decisions![1]!.key];
  cycle.content.decisions![1]!.dependsOn = [cycle.content.decisions![0]!.key];
  expect(() => prepareProjectProfile(cycle)).toThrow(/contains a cycle/);
});

test("local overlay maps only declared services and cannot override shared decisions", () => {
  const shared = prepareProjectProfile(projectProfileInput());
  const local = localProfileInput("/tmp/forgix");
  expect(validateLocalProjectProfile(local, shared)).toEqual(local);

  const relative = structuredClone(local);
  relative.servicePaths[0]!.path = "../plugin";
  expect(() => validateLocalProjectProfile(relative, shared)).toThrow(/must be absolute/);

  const unknown = structuredClone(local);
  unknown.servicePaths[0]!.serviceId = "unknown";
  expect(() => validateLocalProjectProfile(unknown, shared)).toThrow(/unknown service/);

  const override = structuredClone(local);
  override.preferences[0]!.key = shared.content.decisions![0]!.key;
  expect(() => validateLocalProjectProfile(override, shared)).toThrow(/cannot override/);
});

test("profile diff and generated projections describe exact proposed transaction", () => {
  const initial = prepareProjectProfile(projectProfileInput());
  const changedInput = projectProfileInput({ revision: 2 });
  changedInput.content.decisions!.find(({ key }) => key === "source-layout")!.value =
    "Changed source structure.";
  changedInput.content.decisions!.push({
    ...structuredClone(changedInput.content.decisions![0]!),
    key: "api-contract",
    category: "api",
    value: "HTTP JSON",
  });
  changedInput.content.diagramRefs = [".forgix/diagrams/forgix-r2.mermaid.md"];
  const changed = prepareProjectProfile(changedInput);
  expect(diffProjectProfiles(approveProjectProfile(initial), changed)).toMatchObject({
    addedDecisionKeys: ["api-contract"],
    changedDecisionKeys: ["source-layout"],
    removedDecisionKeys: [],
  });
  expect(
    validateProjectProfileProjections(changed, [
      {
        path: changed.content.diagramRefs![0]!,
        content: "```mermaid\nflowchart LR\nA --> B\n```\n",
      },
    ]),
  ).toHaveLength(1);
  expect(() => validateProjectProfileProjections(changed, [])).toThrow(/Every project diagram/);
  expect(() =>
    validateProjectProfileProjections(changed, [
      { path: changed.content.diagramRefs![0]!, content: "not Mermaid" },
    ]),
  ).toThrow(/match profile diagramRefs/);

  const legacyDiagramInput = projectProfileInput();
  legacyDiagramInput.content.diagramRefs = [".codex/dev-flow/diagrams/legacy.mermaid.md"];
  expectThrown(
    () => prepareProjectProfile(legacyDiagramInput),
    (error: unknown) =>
      error instanceof ProjectProfileError && error.code === "profile_projection_invalid",
  );
});

test("optional domain documentation facet is portable, digest-bound, and reconciled", () => {
  const input = projectProfileInput();
  input.content.domainDocumentation = {
    contextMode: "multiple",
    glossaryPath: "docs/domain/glossary.md",
    rulesPath: "docs/domain/rules.md",
    adrDirectory: "docs/adr",
    contextMapPath: "docs/domain/contexts.md",
    language: "fr",
    identityConvention: "Stable context-prefixed IDs.",
    linkConvention: "Relative Markdown links.",
    sourceFingerprints: [
      { sourceRef: "docs/domain/glossary.md", value: `sha256:${"a".repeat(64)}` },
    ],
  };
  const proposal = prepareProjectProfile(input);
  expect(
    reconcileProjectProfile(proposal, {
      "docs/domain/glossary.md": `sha256:${"b".repeat(64)}`,
      "AGENTS.md": `sha256:${"a".repeat(64)}`,
    }),
  ).toMatchObject({ domainDocumentationStale: true, current: false });
  expect(diffProjectProfiles(undefined, proposal).domainDocumentationChanged).toBe(true);
  const invalid = projectProfileInput();
  invalid.content.domainDocumentation = { ...input.content.domainDocumentation };
  delete invalid.content.domainDocumentation.contextMapPath;
  expect(() => prepareProjectProfile(invalid)).toThrow(/contextMapPath/);
});

test("project profile supports optional protectedSurfaces and surfaceVerificationRules", () => {
  const input = projectProfileInput();
  input.content.protectedSurfaces = [
    ".forgix/policy.yaml",
    ".forgix/project.yaml",
    "formal/**/*.tla",
    "formal/**/*.lean",
  ];
  input.content.surfaceVerificationRules = [
    {
      id: "runtime-surface",
      pathGlobs: ["src/**", "scripts/build.mjs"],
      requiredVerifierKinds: ["runtime-evidence", "command"],
      requiredCommands: ["bun run pack:runtime", "bun run test:runtime"],
    },
    {
      id: "formal-surface",
      pathGlobs: ["formal/**"],
      requiredVerifierKinds: ["tla-tlc", "lean4"],
      requiredCommands: ["bun test test/unit/formal-kernel.test.ts"],
    },
  ];
  const proposal = prepareProjectProfile(input);
  const approved = approveProjectProfile(proposal, "2026-08-03T13:00:00.000Z");
  expect(validateProjectProfile(approved).content.protectedSurfaces).toEqual(
    input.content.protectedSurfaces,
  );
  expect(validateProjectProfile(approved).content.surfaceVerificationRules).toEqual(
    input.content.surfaceVerificationRules,
  );
  expect(diffProjectProfiles(undefined, proposal)).toMatchObject({
    protectedSurfacesChanged: true,
    surfaceVerificationRulesChanged: true,
  });

  const duplicateSurface = structuredClone(input);
  duplicateSurface.content.protectedSurfaces = ["formal/**", "formal/**"];
  expect(() => prepareProjectProfile(duplicateSurface)).toThrow(
    /Protected surfaces|unique|duplicate/i,
  );

  const traversalRule = structuredClone(input);
  traversalRule.content.surfaceVerificationRules![0]!.pathGlobs = ["../outside/**"];
  expect(() => prepareProjectProfile(traversalRule)).toThrow(/portable|invalid/i);
});

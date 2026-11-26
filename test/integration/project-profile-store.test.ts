import { expect, test } from "bun:test";
import {
  LOCAL_PROJECT_PROFILE_IGNORE_ENTRY,
  ProjectProfileError,
  createProjectProfileStore,
} from "../../src/profile/index.ts";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { expectRejected } from "../support/expect-error.ts";
import { localProfileInput, projectProfileInput } from "../support/project-profile.ts";

const workspace = () => mkdtemp(join(tmpdir(), "forgix-project-profile-"));

test("shared profile publishes one digest-bound approved YAML atomically", async () => {
  const root = await workspace();
  try {
    const store = createProjectProfileStore(root);
    const published = await store.publishShared(projectProfileInput(), {
      approvedAt: "2026-08-03T14:00:00.000Z",
    });
    expect(published.revision).toBe(1);
    expect(published.approval.actor).toBe("user");
    expect(await store.loadShared(false)).toEqual(published);
    expect(parseYaml(await readFile(store.sharedPath, "utf8"))).toEqual(published);
    expect((await stat(store.sharedPath)).mode & 0o777).toBe(0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("idempotent publish, auto-revision increment, revision conflicts, and failed atomic write preserve current profile", async () => {
  const root = await workspace();
  try {
    const normal = createProjectProfileStore(root);
    const first = await normal.publishShared(projectProfileInput(), {
      approvedAt: "2026-08-03T14:00:00.000Z",
    });
    const before = await readFile(normal.sharedPath, "utf8");

    // Identical content is idempotent, reports unchanged: true, and leaves file untouched
    const unchanged = await normal.publishSharedWithStatus(projectProfileInput());
    expect(unchanged).toEqual({ profile: first, unchanged: true });
    expect(await readFile(normal.sharedPath, "utf8")).toBe(before);

    // Changed content with omitted or equal revision auto-increments to revision + 1
    const changedAuto = projectProfileInput();
    delete changedAuto.revision;
    changedAuto.content.decisions![0]!.value = "Changed with auto revision.";
    const preparedAuto = await normal.prepareShared(changedAuto);
    expect(preparedAuto.revision).toBe(2);

    const publishedSecond = await normal.publishShared(changedAuto);
    expect(publishedSecond.revision).toBe(2);

    // Explicit revision lower than current is rejected
    const lowerRevision = projectProfileInput({ revision: 1 });
    lowerRevision.content.decisions![0]!.value = "Stale revision attempt.";
    await expectRejected(
      () => normal.prepareShared(lowerRevision),
      (error: unknown) =>
        error instanceof ProjectProfileError && error.code === "profile_revision_conflict",
    );

    const beforeFail = await readFile(normal.sharedPath, "utf8");
    const changed = projectProfileInput({ revision: 3 });
    changed.content.decisions![0]!.value = "Changed after explicit reconciliation.";
    await writeFile(join(root, ".forgix", ".project.yaml.collision.tmp"), "occupied");
    const failing = createProjectProfileStore(root, { temporaryId: () => "collision" });
    await expectRejected(
      () => failing.publishShared(changed),
      (error: unknown) =>
        error instanceof ProjectProfileError && error.code === "profile_write_failed",
    );
    expect(await readFile(normal.sharedPath, "utf8")).toBe(beforeFail);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local overlay requires explicit ignore rule and remains local-only", async () => {
  const root = await workspace();
  try {
    const store = createProjectProfileStore(root);
    await store.publishShared(projectProfileInput());
    const local = localProfileInput(root);
    await expectRejected(
      () => store.publishLocal(local),
      (error: unknown) =>
        error instanceof ProjectProfileError && error.code === "profile_local_not_ignored",
    );
    await writeFile(join(root, ".gitignore"), `${LOCAL_PROJECT_PROFILE_IGNORE_ENTRY}\n`);
    expect(await store.publishLocal(local)).toEqual(local);
    expect(await store.loadLocal(false)).toEqual(local);
    expect((await stat(store.localPath)).mode & 0o777).toBe(0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("diagram projections publish before canonical profile and never follow symlinks", async () => {
  const root = await workspace();
  const outside = await workspace();
  try {
    const input = projectProfileInput();
    const diagram = ".forgix/diagrams/forgix-r1.mermaid.md";
    input.content.diagramRefs = [diagram];
    const content = "```mermaid\nflowchart LR\nProfile --> Diagram\n```\n";
    const store = createProjectProfileStore(root);
    const firstPublish = await store.publishSharedWithStatus(input, {
      projections: [{ path: diagram, content }],
    });
    expect(firstPublish.unchanged).toBe(false);
    expect(await readFile(join(root, diagram), "utf8")).toBe(content);

    // Re-publishing unchanged profile with identical diagram succeeds as unchanged
    const sameDiagram = await store.publishSharedWithStatus(input, {
      projections: [{ path: diagram, content }],
    });
    expect(sameDiagram.unchanged).toBe(true);

    // Re-publishing unchanged profile with modified diagram fails with profile_projection_invalid
    await expectRejected(
      () =>
        store.publishSharedWithStatus(input, {
          projections: [
            { path: diagram, content: "```mermaid\nflowchart LR\nA --> Tampered\n```\n" },
          ],
        }),
      (error: unknown) =>
        error instanceof ProjectProfileError && error.code === "profile_projection_invalid",
    );

    // Invalid approvedAt rejects before writing any diagram projection to disk
    const badTsRoot = await workspace();
    try {
      const badTsStore = createProjectProfileStore(badTsRoot);
      await expectRejected(
        () =>
          badTsStore.publishSharedWithStatus(input, {
            approvedAt: "not-a-timestamp",
            projections: [{ path: diagram, content }],
          }),
        (error: unknown) =>
          error instanceof ProjectProfileError && error.code === "profile_invalid",
      );
      await expectRejected(
        () => readFile(join(badTsRoot, diagram)),
        (error: unknown) => error instanceof Error && error.message.includes("ENOENT"),
      );
    } finally {
      await rm(badTsRoot, { recursive: true, force: true });
    }

    // Two-phase projection pre-check: missing diagram A is NOT written when diagram B conflicts
    const twoDiagRoot = await workspace();
    try {
      const diagA = ".forgix/diagrams/a.mermaid.md";
      const diagB = ".forgix/diagrams/b.mermaid.md";
      const contentA = "```mermaid\nflowchart LR\nA --> B\n```\n";
      const contentB = "```mermaid\nflowchart LR\nB --> C\n```\n";
      const twoInput = projectProfileInput();
      twoInput.content.diagramRefs = [diagA, diagB];
      const twoStore = createProjectProfileStore(twoDiagRoot);
      await twoStore.publishSharedWithStatus(twoInput, {
        projections: [
          { path: diagA, content: contentA },
          { path: diagB, content: contentB },
        ],
      });
      await rm(join(twoDiagRoot, diagA));
      await expectRejected(
        () =>
          twoStore.publishSharedWithStatus(twoInput, {
            projections: [
              { path: diagA, content: contentA },
              { path: diagB, content: "```mermaid\nflowchart LR\nB --> Tampered\n```\n" },
            ],
          }),
        (error: unknown) =>
          error instanceof ProjectProfileError && error.code === "profile_projection_invalid",
      );
      await expectRejected(
        () => readFile(join(twoDiagRoot, diagA)),
        (error: unknown) => error instanceof Error && error.message.includes("ENOENT"),
      );
    } finally {
      await rm(twoDiagRoot, { recursive: true, force: true });
    }

    const linkedRoot = await workspace();
    try {
      await mkdir(join(linkedRoot, ".forgix"));
      await symlink(outside, join(linkedRoot, ".forgix", "diagrams"));
      const linkedInput = projectProfileInput();
      linkedInput.content.diagramRefs = [diagram];
      await expectRejected(
        () =>
          createProjectProfileStore(linkedRoot).publishShared(linkedInput, {
            projections: [{ path: diagram, content }],
          }),
        (error: unknown) =>
          error instanceof ProjectProfileError && error.code === "profile_path_invalid",
      );
      await expectRejected(
        () => readFile(join(outside, "forgix-r1.mermaid.md")),
        (error: unknown) => error instanceof Error && error.message.includes("ENOENT"),
      );
    } finally {
      await rm(linkedRoot, { recursive: true, force: true });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("shared profile directory symlink is rejected before any write", async () => {
  const root = await workspace();
  const outside = await workspace();
  try {
    await symlink(outside, join(root, ".forgix"));
    const store = createProjectProfileStore(root);
    await expectRejected(
      () => store.publishShared(projectProfileInput()),
      (error: unknown) =>
        error instanceof ProjectProfileError && error.code === "profile_path_invalid",
    );
    await expectRejected(
      () => readFile(join(outside, "project.yaml")),
      (error: unknown) => error instanceof Error && error.message.includes("ENOENT"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

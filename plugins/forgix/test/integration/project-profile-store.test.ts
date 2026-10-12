import { expect, test } from "bun:test";
import {
  LOCAL_PROJECT_PROFILE_IGNORE_ENTRY,
  ProjectProfileError,
  createProjectProfileStore,
} from "../../src/project-profile.ts";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { expectRejected } from "../support/expect-error.ts";
import {
  localProfileInput,
  projectInitState,
  projectProfileInput,
} from "../support/project-profile.ts";

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

test("revision/no-change conflicts and failed atomic write preserve current profile", async () => {
  const root = await workspace();
  try {
    const normal = createProjectProfileStore(root);
    await normal.publishShared(projectProfileInput());
    const before = await readFile(normal.sharedPath, "utf8");

    await expectRejected(
      () => normal.prepareShared(projectProfileInput()),
      (error) => error instanceof ProjectProfileError && error.code === "profile_revision_conflict",
    );
    await expectRejected(
      () => normal.prepareShared(projectProfileInput({ revision: 2 })),
      (error) => error instanceof ProjectProfileError && error.code === "profile_no_change",
    );

    const changed = projectProfileInput({ revision: 2 });
    changed.content.decisions[0]!.value = "Changed after explicit reconciliation.";
    await writeFile(join(root, ".codex", ".profile.collision.tmp"), "occupied");
    const failing = createProjectProfileStore(root, { temporaryId: () => "collision" });
    await expectRejected(
      () => failing.publishShared(changed),
      (error) => error instanceof ProjectProfileError && error.code === "profile_write_failed",
    );
    expect(await readFile(normal.sharedPath, "utf8")).toBe(before);
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
      (error) => error instanceof ProjectProfileError && error.code === "profile_local_not_ignored",
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
    const diagram = ".codex/dev-flow/diagrams/codex-dev-flow-r1.mermaid.md";
    input.content.diagramRefs = [diagram];
    const content = "```mermaid\nflowchart LR\nProfile --> Diagram\n```\n";
    const store = createProjectProfileStore(root);
    await store.publishShared(input, { projections: [{ path: diagram, content }] });
    expect(await readFile(join(root, diagram), "utf8")).toBe(content);

    const linkedRoot = await workspace();
    try {
      await mkdir(join(linkedRoot, ".codex"));
      await symlink(outside, join(linkedRoot, ".codex", "dev-flow"));
      const linkedInput = projectProfileInput();
      linkedInput.content.diagramRefs = [diagram];
      await expectRejected(
        () =>
          createProjectProfileStore(linkedRoot).publishShared(linkedInput, {
            projections: [{ path: diagram, content }],
          }),
        (error) => error instanceof ProjectProfileError && error.code === "profile_path_invalid",
      );
      await expectRejected(
        () => readFile(join(outside, "diagrams", "codex-dev-flow-r1.mermaid.md")),
        (error) => error instanceof Error && error.message.includes("ENOENT"),
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
    await symlink(outside, join(root, ".codex"));
    const store = createProjectProfileStore(root);
    await expectRejected(
      () => store.publishShared(projectProfileInput()),
      (error) => error instanceof ProjectProfileError && error.code === "profile_path_invalid",
    );
    await expectRejected(
      () => readFile(join(outside, "dev-flow.project.yaml")),
      (error) => error instanceof Error && error.message.includes("ENOENT"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("Project INIT session state resumes exact question and clears after publication", async () => {
  const root = await workspace();
  try {
    const store = createProjectProfileStore(root);
    await store.saveInitState(projectInitState());
    const awaiting = projectInitState({
      revision: 2,
      status: "awaiting_decision",
      decisions: [
        {
          key: "architecture",
          value: "deterministic core",
          source: "user",
          sourceRefs: ["conversation:architecture"],
          dependsOn: [],
        },
      ],
      activeQuestion: {
        id: "testing-question",
        decisionKey: "testing",
        prompt: "Choose test boundary.",
        evidenceRefs: ["package.json"],
        options: [
          { id: "bun", label: "Bun", impact: "One runner." },
          { id: "node", label: "Node", impact: "Separate runner." },
        ],
        recommendedOptionId: "bun",
        recommendationBasis: "Current repository evidence.",
        recommendationConfidence: "high",
        parentDecisionKeys: ["architecture"],
        directConsequences: ["Testing convention is durable."],
      },
    });
    await store.saveInitState(awaiting);
    expect(await store.loadInitState(false)).toEqual(awaiting);
    await expectRejected(
      () => store.saveInitState(awaiting),
      (error) => error instanceof ProjectProfileError && error.code === "profile_session_conflict",
    );
    expect(await store.clearInitState()).toBe(true);
    expect(await store.loadInitState(true)).toBeUndefined();
    expect(await store.clearInitState()).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

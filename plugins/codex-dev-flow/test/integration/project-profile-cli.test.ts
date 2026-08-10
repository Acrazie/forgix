// @ts-nocheck -- CLI results intentionally cross the unknown JSON boundary.
import * as sourceApi from "../../src/cli.ts";
import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { expectRejected } from "../support/expect-error.ts";
import {
  localProfileInput,
  projectInitState,
  projectProfileInput,
} from "../support/project-profile.ts";

const workspace = () => mkdtemp(join(tmpdir(), "dev-flow-project-profile-cli-"));

test("project-profile validate previews exact diff without writing; publish requires separate call", async () => {
  const root = await workspace();
  try {
    const input = projectProfileInput();
    const validate = await sourceApi.runInvocation(["project-profile", "validate"], {
      workspaceRoot: root,
      projectProfile: { input: stringify(input) },
    });
    expect(validate.status).toBe("valid");
    expect(validate.data.revision).toBe(1);
    expect(validate.data.contentDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(validate.data.diff.addedDecisionKeys).toHaveLength(8);
    expect(validate.data.yaml).not.toContain("approval:");
    await expectRejected(
      () => readFile(join(root, ".codex", "dev-flow.project.yaml")),
      (error) => error instanceof Error && error.message.includes("ENOENT"),
    );

    const publish = await sourceApi.runInvocation(["project-profile", "publish"], {
      workspaceRoot: root,
      projectProfile: {
        input: stringify(input),
        approvedAt: "2026-08-03T15:00:00.000Z",
      },
    });
    expect(publish.status).toBe("published");
    expect(publish.data.approval.actor).toBe("user");

    const view = await sourceApi.runInvocation(["project-profile", "view"], {
      workspaceRoot: root,
    });
    expect(view.data.yaml).toContain("approval:");
    const inspect = await sourceApi.runInvocation(["project-profile", "inspect"], {
      workspaceRoot: root,
    });
    expect(inspect.data.shared.contentDigest).toBe(publish.data.contentDigest);
    expect(inspect.data.local).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project-profile transaction carries exact generated projections", async () => {
  const root = await workspace();
  try {
    const profile = projectProfileInput();
    const path = ".codex/dev-flow/diagrams/project-r1.mermaid.md";
    profile.content.diagramRefs = [path];
    const transaction = {
      profile,
      projections: [{ path, content: "```mermaid\nflowchart LR\nA --> B\n```\n" }],
    };
    const result = await sourceApi.runInvocation(["project-profile", "validate"], {
      workspaceRoot: root,
      projectProfile: { input: JSON.stringify(transaction) },
    });
    expect(result.data.projectionPaths).toEqual([path]);
    await sourceApi.runInvocation(["project-profile", "publish"], {
      workspaceRoot: root,
      projectProfile: { input: JSON.stringify(transaction) },
    });
    expect(await readFile(join(root, path), "utf8")).toContain("flowchart LR");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project-profile local backend validates ignore and shared authority", async () => {
  const root = await workspace();
  try {
    await sourceApi.runInvocation(["project-profile", "publish"], {
      workspaceRoot: root,
      projectProfile: { input: stringify(projectProfileInput()) },
    });
    const local = localProfileInput(root);
    const validated = await sourceApi.runInvocation(["project-profile", "validate", "--local"], {
      workspaceRoot: root,
      projectProfile: { input: stringify(local) },
    });
    expect(validated.status).toBe("valid");
    await expectRejected(
      () =>
        sourceApi.runInvocation(["project-profile", "publish", "--local"], {
          workspaceRoot: root,
          projectProfile: { input: stringify(local) },
        }),
      (error) => error instanceof sourceApi.ProjectProfileError,
    );
    await writeFile(join(root, ".gitignore"), ".codex/dev-flow.project.local.yaml\n");
    const published = await sourceApi.runInvocation(["project-profile", "publish", "--local"], {
      workspaceRoot: root,
      projectProfile: { input: stringify(local) },
    });
    expect(published.status).toBe("published");
    const view = await sourceApi.runInvocation(["project-profile", "view", "--local"], {
      workspaceRoot: root,
    });
    expect(view.data.yaml).toContain(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project-profile backend bounds stdin and rejects transaction extras", async () => {
  const root = await workspace();
  try {
    await expectRejected(
      () =>
        sourceApi.runInvocation(["project-profile", "validate"], {
          workspaceRoot: root,
          projectProfile: { input: "x".repeat(2_000_001) },
        }),
      (error) => error instanceof sourceApi.InvocationError && /exceeds/.test(error.message),
    );
    await expectRejected(
      () =>
        sourceApi.runInvocation(["project-profile", "validate"], {
          workspaceRoot: root,
          projectProfile: {
            input: JSON.stringify({ profile: projectProfileInput(), unexpected: true }),
          },
        }),
      (error) =>
        error instanceof sourceApi.InvocationError && /unsupported fields/.test(error.message),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Project INIT session binds publication to validated candidate digest", async () => {
  const root = await workspace();
  try {
    const profile = projectProfileInput();
    const validation = await sourceApi.runInvocation(["project-profile", "validate"], {
      workspaceRoot: root,
      projectProfile: { input: stringify(profile) },
    });
    const state = projectInitState({
      status: "awaiting_approval",
      candidateContentDigest: validation.data.contentDigest,
    });
    await sourceApi.runInvocation(["project-profile", "session-save"], {
      workspaceRoot: root,
      projectProfile: { input: stringify(state) },
    });
    const resumed = await sourceApi.runInvocation(["project-profile", "session-view"], {
      workspaceRoot: root,
    });
    expect(resumed.data.state).toEqual(state);

    const changed = projectProfileInput();
    changed.content.decisions[0]!.value = "Changed after validation.";
    await expectRejected(
      () =>
        sourceApi.runInvocation(["project-profile", "publish"], {
          workspaceRoot: root,
          projectProfile: { input: stringify(changed) },
        }),
      (error) =>
        error instanceof sourceApi.ProjectProfileError && error.code === "profile_session_conflict",
    );
    expect(
      (
        await sourceApi.runInvocation(["project-profile", "publish"], {
          workspaceRoot: root,
          projectProfile: { input: stringify(profile) },
        })
      ).status,
    ).toBe("published");
    const cleared = await sourceApi.runInvocation(["project-profile", "session-clear"], {
      workspaceRoot: root,
    });
    expect(cleared.data.cleared).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

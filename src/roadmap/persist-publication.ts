import { createWorkspaceStore } from "../core/store.js";
import {
  createPublishedRoadmapStore,
  createRoadmapRuntimeStore,
  DEFAULT_ROADMAP_MARKDOWN_PATH,
  renderRoadmapMarkdown,
  type publishRoadmap,
} from "./index.js";
import { preservePublishedRuntime } from "./reservations.js";

export async function persistRoadmapPublication(
  root: string,
  prepare: () => Promise<ReturnType<typeof publishRoadmap>>,
) {
  const store = createRoadmapRuntimeStore(root);
  return store.withLock(async () => {
    const publication = await prepare();
    const runtime = (await store.exists())
      ? preservePublishedRuntime(await store.load(), publication.runtime)
      : publication.runtime;
    await store.assertPreservesReservations(runtime);
    const markdown = renderRoadmapMarkdown(publication.roadmap, runtime);
    await createPublishedRoadmapStore(root).save(publication.roadmap);
    await store.save(runtime);
    await createWorkspaceStore(root).writeTextAtomically(DEFAULT_ROADMAP_MARKDOWN_PATH, markdown);
    return { ...publication, runtime, markdown };
  });
}

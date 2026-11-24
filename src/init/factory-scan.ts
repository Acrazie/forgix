import { lstat, readdir } from "node:fs/promises";
import type { FactoryAgentSpec, FactoryRuleSpec, FactorySkillSpec } from "../core/factory-types.js";
import type { WorkspaceStore } from "../core/store.js";
import { parseCanonicalAgent, parseCanonicalRule, parseCanonicalSkill } from "./factory-parse.js";
import type { FactorySafeRead } from "./factory-plan.js";
import { FACTORY_ROOT_DIR } from "./factory-render.js";

export interface FactoryCheckFinding {
  path: string;
  code: string;
  message: string;
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}$/;

async function readSafeDirEntries(
  store: WorkspaceStore,
  dir: string,
  findings: FactoryCheckFinding[],
): Promise<string[] | undefined> {
  const full = store.resolvePath(dir);
  let st;
  try {
    st = await lstat(full);
  } catch {
    return undefined;
  }
  if (st.isSymbolicLink() || !st.isDirectory()) {
    findings.push({ path: dir, code: "symlink_or_non_file", message: `${dir} is not a dir.` });
    return undefined;
  }
  return (await readdir(full)).toSorted();
}

async function statDirEntries(
  store: WorkspaceStore,
  relativeDir: string,
  findings: FactoryCheckFinding[],
): Promise<Array<readonly [string, string, Awaited<ReturnType<typeof lstat>>]>> {
  const entries = await readSafeDirEntries(store, relativeDir, findings);
  if (!entries) return [];
  return Promise.all(
    entries.map(async (name) => {
      const relPath = `${relativeDir}/${name}`;
      return [name, relPath, await lstat(store.resolvePath(relPath))] as const;
    }),
  );
}

async function scanEntries(
  store: WorkspaceStore,
  dir: string,
  kind: "file" | "dir",
  findings: FactoryCheckFinding[],
): Promise<Array<{ id: string; path: string }>> {
  const stats = await statDirEntries(store, dir, findings);
  const found: Array<{ id: string; path: string }> = [];
  for (const [name, rel, stat] of stats) {
    const validType = kind === "file" ? stat.isFile() : stat.isDirectory();
    if (stat.isSymbolicLink() || !validType) {
      findings.push({ path: rel, code: "symlink_or_non_file", message: `${rel} is invalid.` });
      continue;
    }
    const id = kind === "file" ? (name.endsWith(".md") ? name.slice(0, -3) : "") : name;
    if (!SLUG_REGEX.test(id)) {
      findings.push({
        path: rel,
        code: "factory_invalid_filename",
        message: `${rel} has invalid slug.`,
      });
      continue;
    }
    found.push({ id, path: kind === "file" ? rel : `${rel}/SKILL.md` });
  }
  return found;
}

function parseProbe<T>(
  entry: { id: string; path: string },
  probe: Awaited<ReturnType<FactorySafeRead>>,
  parse: (content: string, id: string) => { ok: true; value: T } | { ok: false; message: string },
  maxBytes: number | undefined,
  findings: FactoryCheckFinding[],
): T | undefined {
  if (!probe.ok) {
    findings.push(probe.conflict);
    return undefined;
  }
  if (!probe.content || (maxBytes && Buffer.byteLength(probe.content, "utf8") > maxBytes)) {
    const code = !maxBytes
      ? "factory_canonical_invalid"
      : !probe.content
        ? "rules_missing"
        : "rules_oversized";
    findings.push({ path: entry.path, code, message: `${entry.path} is empty or oversized.` });
    return undefined;
  }
  const parsed = parse(probe.content, entry.id);
  if (!parsed.ok) {
    findings.push({ path: entry.path, code: "factory_canonical_invalid", message: parsed.message });
    return undefined;
  }
  return parsed.value;
}

async function loadEntries<T>(
  store: WorkspaceStore,
  subDir: string,
  kind: "file" | "dir",
  safeRead: FactorySafeRead,
  findings: FactoryCheckFinding[],
  parse: (content: string, id: string) => { ok: true; value: T } | { ok: false; message: string },
  opts?: { maxBytes?: number; requireNonEmptyDir?: boolean },
): Promise<T[]> {
  const entries = await scanEntries(store, `${FACTORY_ROOT_DIR}/${subDir}`, kind, findings);
  if (opts?.requireNonEmptyDir && entries.length === 0) {
    findings.push({
      path: `${FACTORY_ROOT_DIR}/${subDir}`,
      code: "rules_missing",
      message: `No canonical ${subDir}.`,
    });
  }
  const probes = await Promise.all(entries.map(async (e) => [e, await safeRead(e.path)] as const));
  const items: T[] = [];
  for (const [entry, probe] of probes) {
    const value = parseProbe(entry, probe, parse, opts?.maxBytes, findings);
    if (value !== undefined) items.push(value);
  }
  return items;
}

export function loadCanonicalRules(
  store: WorkspaceStore,
  maxItemBytes: number,
  safeRead: FactorySafeRead,
  findings: FactoryCheckFinding[],
): Promise<FactoryRuleSpec[]> {
  return loadEntries(
    store,
    "rules",
    "file",
    safeRead,
    findings,
    (c, id) => {
      const r = parseCanonicalRule(c, id);
      return r.ok ? { ok: true, value: r.rule } : r;
    },
    { maxBytes: maxItemBytes, requireNonEmptyDir: true },
  );
}

export function loadCanonicalAgents(
  store: WorkspaceStore,
  safeRead: FactorySafeRead,
  findings: FactoryCheckFinding[],
): Promise<FactoryAgentSpec[]> {
  return loadEntries(store, "agents", "file", safeRead, findings, (c, id) => {
    const r = parseCanonicalAgent(c, id);
    return r.ok ? { ok: true, value: r.agent } : r;
  });
}

export function loadCanonicalSkills(
  store: WorkspaceStore,
  safeRead: FactorySafeRead,
  findings: FactoryCheckFinding[],
): Promise<FactorySkillSpec[]> {
  return loadEntries(store, "skills", "dir", safeRead, findings, (c, id) => {
    const r = parseCanonicalSkill(c, id);
    return r.ok ? { ok: true, value: r.skill } : r;
  });
}

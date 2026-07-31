import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RoutingSnapshot } from "./types.js";

export interface FiveHourResetCache {
  schemaVersion: 1;
  windowDurationMins: 300;
  resetsAt: number;
}

const FIVE_HOURS_SECONDS = 300 * 60;

export async function readFiveHourResetCache(
  path: string,
  nowEpochSeconds: number,
): Promise<FiveHourResetCache | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (
      !isFiveHourResetCache(parsed) ||
      parsed.resetsAt <= nowEpochSeconds ||
      parsed.resetsAt > nowEpochSeconds + FIVE_HOURS_SECONDS
    )
      return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function writeFiveHourResetCache(
  path: string,
  value: Omit<FiveHourResetCache, "schemaVersion">,
): Promise<void> {
  if (value.windowDurationMins !== 300 || !Number.isFinite(value.resetsAt)) {
    throw new Error("Invalid five-hour reset cache value.");
  }
  const cache: FiveHourResetCache = { schemaVersion: 1, ...value };
  const temporaryPath = path + "." + process.pid + "." + randomUUID() + ".tmp";
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporaryPath, JSON.stringify(cache, null, 2) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function applyFiveHourResetFallback(
  snapshot: RoutingSnapshot,
  cached: FiveHourResetCache | undefined,
): RoutingSnapshot {
  if (!cached || snapshot.quota.source === "app-server") return snapshot;
  return {
    ...snapshot,
    quota: {
      windowDurationMins: 300,
      resetsAt: cached.resetsAt,
      pressure: "unknown",
      source: "last-known",
      ...(snapshot.quota.observedWindow ? { observedWindow: snapshot.quota.observedWindow } : {}),
    },
    warnings: snapshot.warnings.includes("quota_fallback_last_known")
      ? snapshot.warnings
      : [...snapshot.warnings, "quota_fallback_last_known"],
    provenance: { ...snapshot.provenance, quota: "last-known-cache" },
  };
}

function isFiveHourResetCache(value: unknown): value is FiveHourResetCache {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    candidate.windowDurationMins === 300 &&
    typeof candidate.resetsAt === "number" &&
    Number.isFinite(candidate.resetsAt)
  );
}

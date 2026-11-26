import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

declare const FORGIX_PLUGIN_VERSION: string | undefined;

function readPackageVersion(): string {
  if (typeof FORGIX_PLUGIN_VERSION === "string" && FORGIX_PLUGIN_VERSION.length > 0) {
    return FORGIX_PLUGIN_VERSION;
  }
  for (const relative of ["../../package.json", "../package.json"]) {
    const candidate = fileURLToPath(new URL(relative, import.meta.url));
    if (!existsSync(candidate)) continue;
    const parsed = JSON.parse(readFileSync(candidate, "utf8")) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  }
  return "0.0.0";
}

export const PLUGIN_VERSION: string = readPackageVersion();

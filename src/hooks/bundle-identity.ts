import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { BUILD_AUTHORIZATION_RECEIPT_VERSION } from "../core/build-authorization.js";
import type { HarnessId } from "../types.js";

const ANTIGRAVITY_DEFAULT_BUNDLE_SEGMENTS = [
  ".gemini",
  "config",
  "plugins",
  "forgix",
  "dist",
  "forgix.mjs",
] as const;

function resolvePinFilePath(
  harness: HarnessId,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const xdgConfig = env.XDG_CONFIG_HOME?.trim();
  const baseDir =
    xdgConfig && isAbsolute(xdgConfig)
      ? xdgConfig
      : env.HOME && isAbsolute(env.HOME)
        ? join(env.HOME, ".config")
        : undefined;
  return baseDir ? join(baseDir, "forgix", `cli-path.${harness}`) : undefined;
}

function resolveDefaultBundlePath(
  harness: HarnessId,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (harness !== "antigravity") return undefined;
  if (!env.HOME || !isAbsolute(env.HOME)) return undefined;
  return join(env.HOME, ...ANTIGRAVITY_DEFAULT_BUNDLE_SEGMENTS);
}

function resolveEffectiveHookPin(
  harness: HarnessId,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const explicit = env.FORGIX_CLI_PATH;
  if (explicit !== undefined && explicit.length > 0) {
    return explicit;
  }
  const pinFile = resolvePinFilePath(harness, env);
  if (pinFile) {
    try {
      const content = readFileSync(pinFile, "utf8").split(/\r?\n/, 1)[0]?.trim();
      if (content && isAbsolute(content)) return content;
    } catch {
      // No machine-local pin file yet.
    }
  }
  return resolveDefaultBundlePath(harness, env);
}

export function writeHarnessCliPin(
  harness: HarnessId,
  entrypointPath: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!entrypointPath) return undefined;
  const pinFile = resolvePinFilePath(harness, env);
  if (!pinFile) return undefined;
  try {
    const canonical = realpathSync(entrypointPath);
    if (!statSync(canonical).isFile()) return undefined;
    mkdirSync(dirname(pinFile), { recursive: true, mode: 0o700 });
    const tempPath = `${pinFile}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tempPath, `${canonical}\n`, { mode: 0o600 });
    renameSync(tempPath, pinFile);
    return pinFile;
  } catch {
    return undefined;
  }
}

export function identifyPinnedHookBundle(
  entrypointPath?: string,
  pinOrContext?: string | { harness: HarnessId; env?: NodeJS.ProcessEnv },
) {
  const pin =
    typeof pinOrContext === "string" || pinOrContext === undefined
      ? pinOrContext
      : resolveEffectiveHookPin(pinOrContext.harness, pinOrContext.env);
  if (!entrypointPath || !pin || !isAbsolute(pin)) return undefined;
  try {
    const path = realpathSync(entrypointPath);
    if (path !== realpathSync(pin) || !statSync(path).isFile()) return undefined;
    return {
      path,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
      buildAuthorizationReceiptVersion: BUILD_AUTHORIZATION_RECEIPT_VERSION,
    };
  } catch {
    return undefined;
  }
}

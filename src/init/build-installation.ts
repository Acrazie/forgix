import { resolveGitWorktree } from "../core/build-authorization.js";
import { createWorkspaceStore } from "../core/store.js";
import { identifyPinnedHookBundle } from "../hooks/bundle-identity.js";
import type { CliResult, HarnessId } from "../types.js";
import { checkHarnessHooksConfig, HOOK_CONFIG_PATHS } from "./hooks-config.js";

const RECOVERY =
  "Reconcile Forgix hooks with agent-driven init (which pins the installed v2 bundle automatically, or override via FORGIX_CLI_PATH), then reload and verify the native session before BUILD.";

export async function checkBuildInstallation(
  harness: HarnessId,
  workspace: string,
  entrypointPath: string | undefined,
  env: NodeJS.ProcessEnv | undefined,
): Promise<CliResult> {
  const bundle = identifyPinnedHookBundle(entrypointPath, { harness, ...(env ? { env } : {}) });
  const workspaceRoot = resolveGitWorktree(workspace);
  const path = HOOK_CONFIG_PATHS[harness];
  const findings = [];
  if (!bundle) {
    findings.push(
      "Pinned CLI bundle is missing, unresolvable or not the running skill bundle (run Forgix init or set FORGIX_CLI_PATH).",
    );
  }
  if (!workspaceRoot) {
    findings.push("Cannot establish the Git worktree for the native hooks.");
  } else {
    try {
      const config = await createWorkspaceStore(workspaceRoot).readText(path, true, 2_000_000);
      findings.push(...checkHarnessHooksConfig(harness, config).map(({ message }) => message));
    } catch {
      findings.push(`Cannot safely read ${path}.`);
    }
  }
  return {
    command: "init_check_build",
    status: findings.length ? "blocked" : "native_verification_required",
    data: { harness, workspaceRoot, bundle, findings, recovery: RECOVERY },
  };
}

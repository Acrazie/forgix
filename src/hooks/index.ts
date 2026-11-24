import { contractReviewPostCheckSignal } from "../core/contract-review-sources.js";
import { resolveGitWorktree } from "../core/build-authorization.js";
import { lookupBuildContext, owningWorktree, withoutExemptions } from "./build-context.js";
import { identifyPinnedHookBundle } from "./bundle-identity.js";
import type { HarnessId, HookEvent, HookRunResult } from "../types.js";
import {
  buildHookCommand,
  HARNESS_HOOK_EVENTS,
  HOOK_EVENT_NATIVE_NAMES,
  isSupportedHarnessHookEvent,
  type HarnessHookEventSpec,
  type NativeHookEventName,
} from "./command.js";
import {
  loadHookProjectSummary,
  loadHookRuntimeConfig,
  readLightGitDiff,
  type ActiveTaskResolution,
  type HookRuntimeConfig,
} from "./context.js";
import {
  buildSessionStartMessage,
  evaluateDestructiveShellCommand,
  evaluateEscapeHatches,
  evaluateProtectedSurfaceWrite,
  type PreToolUseDecision,
} from "./guards.js";
import {
  formatFailOpenResult,
  formatPostCheckResult,
  formatPreToolUseResult,
  formatSessionStartResult,
  parseHookInput,
  type NormalizedHookInput,
} from "./io.js";

export {
  buildHookCommand,
  HARNESS_HOOK_EVENTS,
  HOOK_EVENT_NATIVE_NAMES,
  isSupportedHarnessHookEvent,
  type HarnessHookEventSpec,
  type NativeHookEventName,
};

export interface RunHookOptions {
  workspaceRoot: string;
  input: string;
  env?: NodeJS.ProcessEnv;
  entrypointPath?: string | undefined;
}

function nativeSessionIdentity(
  harness: HarnessId,
  workspaceRoot: string | undefined,
  options: RunHookOptions,
): string {
  if (!workspaceRoot) return "";
  const bundle = identifyPinnedHookBundle(options.entrypointPath, {
    harness,
    ...(options.env ? { env: options.env } : {}),
  });
  return bundle
    ? `Forgix native SessionStart: ${JSON.stringify({ harness, workspaceRoot, bundle })}`
    : "";
}

async function evaluateTargetWrites(
  paths: readonly string[],
  cwd: string,
  eventRoot: string | undefined,
  fallback: string,
  ownContext: ActiveTaskResolution,
): Promise<PreToolUseDecision> {
  const contexts = new Map<string, Promise<ActiveTaskResolution>>();
  const results = await Promise.all(
    paths.map(async (path) => {
      const root = owningWorktree(path, cwd);
      const policyRoot = root ?? fallback;
      const config = loadHookRuntimeConfig(policyRoot);
      const project = loadHookProjectSummary(policyRoot);
      let context: ActiveTaskResolution =
        root && root === eventRoot ? ownContext : { kind: "unverified" };
      if (eventRoot && root && root !== eventRoot) {
        const lookup = contexts.get(root) ?? lookupBuildContext(root);
        contexts.set(root, lookup);
        context = withoutExemptions(await lookup);
      }
      return evaluateProtectedSurfaceWrite(
        [path],
        cwd,
        policyRoot,
        project.protectedSurfaces,
        context,
        config.enforcement,
        config.factoryPolicies,
      );
    }),
  );
  return (
    results.find(({ decision }) => decision === "deny") ??
    results.find(({ decision }) => decision === "warn") ?? { decision: "allow" }
  );
}

function formatContractReviewPostCheck(
  harness: HarnessId,
  receipt: string | undefined,
  nativeWriteRef: string | undefined,
  decision: { status: "clean" | "warn" | "block"; message?: string },
  eligible: boolean,
): HookRunResult {
  if (receipt && nativeWriteRef && decision.status !== "block" && eligible) {
    const signal = contractReviewPostCheckSignal(receipt, nativeWriteRef);
    return formatPostCheckResult(harness, {
      status: "warn",
      message: [decision.message, signal].filter(Boolean).join("\n"),
    });
  }
  return formatPostCheckResult(harness, decision);
}

function evaluatePostTool(
  harness: HarnessId,
  parsed: NormalizedHookInput & { cwd: string },
  root: string | undefined,
  workspaceRoot: string,
  taskResolution: ActiveTaskResolution,
  config: HookRuntimeConfig,
): HookRunResult {
  const addedDiffText = parsed.toolCall?.addedDiffText ?? "";
  const decision = evaluateEscapeHatches(
    addedDiffText,
    parsed.cwd,
    workspaceRoot,
    taskResolution.kind === "active" &&
      (taskResolution.task.contractReviewReceipt ||
        !parsed.toolCall?.filePaths.length ||
        parsed.toolCall.filePaths.some((path) => owningWorktree(path, parsed.cwd) !== root))
      ? withoutExemptions(taskResolution)
      : taskResolution,
    config.enforcement,
    config.factoryPolicies,
  );
  const receipt =
    taskResolution.kind === "active" ? taskResolution.task.contractReviewReceipt : undefined;
  const eligible = Boolean(
    parsed.toolCall?.filePaths.length &&
    parsed.toolCall.addedDiffText !== undefined &&
    parsed.toolCall.filePaths.every((path) => owningWorktree(path, parsed.cwd) === root),
  );
  return formatContractReviewPostCheck(harness, receipt, parsed.nativeWriteRef, decision, eligible);
}

function evaluatePostInvocation(
  harness: HarnessId,
  parsed: NormalizedHookInput & { cwd: string },
  workspaceRoot: string,
  taskResolution: ActiveTaskResolution,
  config: HookRuntimeConfig,
): HookRunResult {
  const diffText = readLightGitDiff(parsed.cwd);
  const receipt =
    taskResolution.kind === "active" ? taskResolution.task.contractReviewReceipt : undefined;
  const decision = evaluateEscapeHatches(
    diffText,
    parsed.cwd,
    workspaceRoot,
    receipt ? withoutExemptions(taskResolution) : taskResolution,
    config.enforcement,
    config.factoryPolicies,
  );
  return formatContractReviewPostCheck(
    harness,
    receipt,
    parsed.nativeWriteRef,
    decision,
    diffText.trim().length > 0,
  );
}

export async function runHook(
  harness: HarnessId,
  event: HookEvent,
  options: RunHookOptions,
): Promise<HookRunResult> {
  try {
    if (!isSupportedHarnessHookEvent(harness, event)) {
      return formatFailOpenResult(
        harness,
        event,
        `Unsupported hook event "${event}" for harness "${harness}".`,
      );
    }

    const input = parseHookInput(harness, options.input);
    const parsed = { ...input, cwd: input.cwd ?? options.workspaceRoot };
    if (parsed.parseError && event !== "session-start") {
      return formatFailOpenResult(harness, event, parsed.parseError);
    }

    const root = input.cwd ? resolveGitWorktree(input.cwd) : undefined;
    const workspaceRoot = root ?? options.workspaceRoot;
    const config = loadHookRuntimeConfig(workspaceRoot);
    const taskResolution: ActiveTaskResolution = root
      ? await lookupBuildContext(root, event === "pre-tool-use")
      : { kind: "none" };

    if (event === "session-start") {
      const project = loadHookProjectSummary(workspaceRoot);
      const message = buildSessionStartMessage(
        options.workspaceRoot,
        parsed.cwd,
        config,
        project,
        taskResolution,
        parsed.parseError,
      );
      const identity = nativeSessionIdentity(harness, root, options);
      return formatSessionStartResult(harness, [message, identity].filter(Boolean).join("\n"));
    }

    if (event === "pre-tool-use") {
      if (!parsed.toolCall) {
        return formatPreToolUseResult(harness, { decision: "allow" });
      }

      if (parsed.toolCall.command) {
        const shellDecision = evaluateDestructiveShellCommand(
          parsed.toolCall.command,
          parsed.cwd,
          config.merge,
          config.enforcement,
          config.factoryPolicies,
        );
        if (shellDecision.decision !== "allow") {
          return formatPreToolUseResult(harness, shellDecision);
        }
      }

      if (parsed.toolCall.filePaths.length > 0) {
        const surfaceDecision = await evaluateTargetWrites(
          parsed.toolCall.filePaths,
          parsed.cwd,
          root,
          workspaceRoot,
          taskResolution,
        );
        return formatPreToolUseResult(harness, surfaceDecision);
      }

      return formatPreToolUseResult(harness, { decision: "allow" });
    }

    if (event === "post-tool-use") {
      return evaluatePostTool(harness, parsed, root, workspaceRoot, taskResolution, config);
    }

    if (event === "post-invocation") {
      return evaluatePostInvocation(harness, parsed, options.workspaceRoot, taskResolution, config);
    }

    return formatFailOpenResult(harness, event);
  } catch {
    return formatFailOpenResult(harness, event, "Unexpected hook runtime error.");
  }
}

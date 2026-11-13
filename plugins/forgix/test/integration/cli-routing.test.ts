// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/cli.ts";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";

test("renders stable CLI help without runtime routing", async () => {
  const result = await sourceApi.runInvocation(["--help"]);

  expect(result).toEqual({
    command: "help",
    status: "ok",
    data: { text: sourceApi.HELP_TEXT },
  });
  expect(sourceApi.HELP_TEXT).toContain("Usage: forgix");
  expect(sourceApi.HELP_TEXT).toContain("config validate [--json]");
});

function routingResult() {
  return {
    available: true,
    snapshot: {
      schemaVersion: 1,
      capturedAt: "2026-07-12T10:00:00.000Z",
      plan: "plus",
      account: { planType: "plus" },
      quota: { windowDurationMins: 300, usedPercent: 10, pressure: "normal", source: "app-server" },
      models: [
        { id: "gpt-5.6-luna", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] },
        { id: "gpt-5.6-terra", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] },
        { id: "gpt-5.6-sol", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] },
      ],
      warnings: [],
      provenance: { plan: "account/read", quota: "account/rateLimits/read", models: "model/list" },
    },
  };
}

test("run and resume capture one routing snapshot per invocation", async () => {
  const { runInvocation } = sourceApi;
  let calls = 0;
  const captureSnapshot = async () => {
    calls += 1;
    return routingResult();
  };
  const run = await runInvocation(["standard", "change", "thing"], {
    captureSnapshot,
    env: {},
    entrypointPath: "/usr/local/bin/forgix",
  });
  expect(calls).toBe(1);
  expect(run.status).toBe("routed");
  expect(run.data.routingDecisions.length).toBe(5);
  expect(run.data.routingDecisions.map((decision) => decision.stage)).toEqual([
    "design",
    "discover",
    "plan",
    "debug",
    "review",
  ]);
  expect(run.data.routingPolicyVersion).toBe("2026-08-13.taskstate-v6.v1");
  await runInvocation(["resume", "task-1"], {
    captureSnapshot,
    env: {},
    entrypointPath: "/usr/local/bin/forgix",
  });
  expect(calls).toBe(2);
});

test("missing exact route reports routing_unavailable without fallback", async () => {
  const { runInvocation } = sourceApi;
  const result = routingResult();
  result.snapshot.models = result.snapshot.models.filter((model) => model.id === "gpt-5.6-luna");
  const run = await runInvocation(["standard", "change", "thing"], {
    captureSnapshot: async () => result,
    env: {},
    entrypointPath: "/usr/local/bin/forgix",
  });
  expect(run.status).toBe("routing_unavailable");
  const plan = run.data.routingDecisions.find((decision) => decision.stage === "plan");
  expect(plan.model).toBe(null);
  expect(plan.warnings.includes("required_route_unavailable")).toBeTruthy();
});

test("state permission failure requests approval instead of reporting generic routing unavailability", async () => {
  const { runInvocation } = sourceApi;
  const unavailable = routingResult();
  unavailable.available = false;
  unavailable.error = "app-server unavailable";
  unavailable.failure = {
    code: "app_server_permission_denied",
    path: "~/.codex",
    retryableWithApproval: true,
  };
  unavailable.snapshot.models = [];
  unavailable.snapshot.quota = { pressure: "unknown", source: "unknown" };
  unavailable.snapshot.warnings = ["quota_unknown", "allowed_model_unavailable"];
  unavailable.snapshot.provenance = { plan: "unknown", quota: "unknown", models: "unknown" };

  const run = await runInvocation(["standard", "change", "thing"], {
    captureSnapshot: async () => unavailable,
    env: {},
    entrypointPath: "/usr/local/bin/forgix",
  });
  expect(run.status).toBe("routing_permission_required");
  expect(run.data.routingFailure).toEqual(unavailable.failure);
  expect(
    run.data.routingDecisions.every(
      (decision) => decision.model === null && decision.effort === null,
    ),
  ).toBeTruthy();
});

test("config show explain stays read-only and exposes provenance", async () => {
  const { runInvocation } = sourceApi;
  const result = await runInvocation(["config", "show", "--explain"], { configSources: [] });
  expect(result.data.provenance["subscription.quota.warningPercent"]).toBe("defaults");
  expect(result.data.value.subscription.plan).toBe("auto");
});

test("a cached five-hour reset supplies safe fallback metadata without stale usage", async () => {
  const { runInvocation } = sourceApi;
  const directory = await mkdtemp(join(tmpdir(), "forgix-quota-"));
  const quotaCachePath = join(directory, "quota-cache.json");
  const nowEpochSeconds = 1780000000;
  try {
    const live = routingResult();
    live.snapshot.quota.resetsAt = nowEpochSeconds + 1800;
    await runInvocation(["standard", "prime", "cache"], {
      captureSnapshot: async () => live,
      quotaCachePath,
      nowEpochSeconds,
      env: {},
      entrypointPath: "/usr/local/bin/forgix",
    });
    const cached = JSON.parse(await readFile(quotaCachePath, "utf8"));
    expect(cached).toEqual({
      schemaVersion: 1,
      windowDurationMins: 300,
      resetsAt: nowEpochSeconds + 1800,
    });

    const missing = routingResult();
    missing.snapshot.quota = {
      pressure: "unknown",
      source: "unknown",
      observedWindow: {
        windowDurationMins: 10080,
        usedPercent: 4,
        resetsAt: nowEpochSeconds + 86400,
      },
    };
    missing.snapshot.warnings = ["quota_unknown", "five_hour_window_unavailable"];
    missing.snapshot.provenance.quota = "unknown";
    const fallback = await runInvocation(["standard", "use", "fallback"], {
      captureSnapshot: async () => missing,
      quotaCachePath,
      nowEpochSeconds,
      env: {},
      entrypointPath: "/usr/local/bin/forgix",
    });
    expect(fallback.data.routingSnapshot.quota).toEqual({
      windowDurationMins: 300,
      resetsAt: nowEpochSeconds + 1800,
      pressure: "unknown",
      source: "last-known",
      observedWindow: {
        windowDurationMins: 10080,
        usedPercent: 4,
        resetsAt: nowEpochSeconds + 86400,
      },
    });
    expect("usedPercent" in fallback.data.routingSnapshot.quota).toBe(false);
    expect(
      fallback.data.routingSnapshot.warnings.includes("quota_fallback_last_known"),
    ).toBeTruthy();
    expect(fallback.data.routingDecisions[0].model).toBe("gpt-5.6-terra");
    expect(fallback.data.routingDecisions[0].effort).toBe("medium");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an expired cached reset is ignored", async () => {
  const { readFiveHourResetCache, runInvocation, writeFiveHourResetCache } = sourceApi;
  const directory = await mkdtemp(join(tmpdir(), "forgix-quota-expired-"));
  const quotaCachePath = join(directory, "quota-cache.json");
  const nowEpochSeconds = 1780000000;
  try {
    await writeFiveHourResetCache(quotaCachePath, {
      windowDurationMins: 300,
      resetsAt: nowEpochSeconds - 1,
    });
    const missing = routingResult();
    missing.snapshot.quota = { pressure: "unknown", source: "unknown" };
    missing.snapshot.warnings = ["quota_unknown", "five_hour_window_unavailable"];
    missing.snapshot.provenance.quota = "unknown";
    const result = await runInvocation(["standard", "expired", "cache"], {
      captureSnapshot: async () => missing,
      quotaCachePath,
      nowEpochSeconds,
      env: {},
      entrypointPath: "/usr/local/bin/forgix",
    });
    expect(result.data.routingSnapshot.quota.source).toBe("unknown");
    expect(result.data.routingSnapshot.warnings.includes("quota_fallback_last_known")).toBe(false);

    await writeFile(quotaCachePath, "not-json", "utf8");
    expect(await readFiveHourResetCache(quotaCachePath, nowEpochSeconds)).toBe(undefined);

    await writeFiveHourResetCache(quotaCachePath, {
      windowDurationMins: 300,
      resetsAt: nowEpochSeconds + 300 * 60 + 1,
    });
    expect(await readFiveHourResetCache(quotaCachePath, nowEpochSeconds)).toBe(undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("cache write failure is non-fatal and explicit", async () => {
  const { runInvocation } = sourceApi;
  const directory = await mkdtemp(join(tmpdir(), "forgix-quota-write-"));
  const blocker = join(directory, "not-a-directory");
  const nowEpochSeconds = 1780000000;
  try {
    await writeFile(blocker, "block", "utf8");
    const live = routingResult();
    live.snapshot.quota.resetsAt = nowEpochSeconds + 1800;
    const result = await runInvocation(["standard", "cache", "failure"], {
      captureSnapshot: async () => live,
      quotaCachePath: join(blocker, "quota-cache.json"),
      nowEpochSeconds,
      env: {},
      entrypointPath: "/usr/local/bin/forgix",
    });
    expect(result.status).toBe("routed");
    expect(result.data.routingSnapshot.warnings.includes("quota_cache_write_failed")).toBeTruthy();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("claude and antigravity use host-native routing without invoking app-server or quota cache", async () => {
  const { runInvocation } = sourceApi;
  const directory = await mkdtemp(join(tmpdir(), "forgix-host-native-"));
  const quotaCachePath = join(directory, "quota-cache.json");
  let calls = 0;
  try {
    const results = await Promise.all(
      ["claude", "antigravity"].map(async (harness) => ({
        harness,
        result: await runInvocation(["--harness", harness, "ship", "feature"], {
          captureSnapshot: async () => {
            calls += 1;
            return routingResult();
          },
          quotaCachePath,
          env: {},
          entrypointPath: "/usr/local/bin/forgix",
        }),
      })),
    );
    expect(calls).toBe(0);
    for (const { harness, result } of results) {
      expect(result.status).toBe("routed");
      expect(result.data.routingSnapshot.mode).toBe("host-native");
      expect(result.data.routingSnapshot.harness).toBe(harness);
      expect("subscriptionMultiplier" in result.data.routingSnapshot).toBe(false);
      expect(
        result.data.routingDecisions.every(
          (decision) =>
            decision.model === null &&
            decision.effort === null &&
            decision.reason === `host-native:${harness}`,
        ),
      ).toBe(true);
    }
    const cachePresent = await readFile(quotaCachePath, "utf8").then(
      () => true,
      () => false,
    );
    expect(cachePresent).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("resolveHarness follows CLI flag, config, env, entrypoint, and fallback precedence", () => {
  const { resolveHarness } = sourceApi;
  expect(
    resolveHarness({
      flag: "claude",
      configHarness: "codex",
      env: { CODEX_THREAD_ID: "t1" },
      entrypointPath: "/Users/me/.gemini/config/plugins/forgix/dist/forgix.mjs",
    }),
  ).toBe("claude");
  expect(
    resolveHarness({
      flag: "auto",
      configHarness: "claude",
      env: { ANTIGRAVITY_AGENT: "1" },
    }),
  ).toBe("antigravity");
  expect(
    resolveHarness({
      configHarness: "antigravity",
      env: { CLAUDECODE: "1" },
    }),
  ).toBe("antigravity");
  expect(
    resolveHarness({
      env: { CODEX_THREAD_ID: "t1", CLAUDECODE: "1", ANTIGRAVITY_AGENT: "1" },
    }),
  ).toBe("codex");
  expect(
    resolveHarness({
      env: { CLAUDE_PLUGIN_ROOT: "/tmp/p", ANTIGRAVITY_AGENT: "1" },
    }),
  ).toBe("claude");
  expect(
    resolveHarness({
      env: {},
      entrypointPath: "/Users/me/.gemini/config/plugins/forgix/dist/forgix.mjs",
    }),
  ).toBe("antigravity");
  expect(
    resolveHarness({
      env: {},
      entrypointPath: "/Users/me/.gemini/antigravity/worktrees/repo/branch/dist/forgix.mjs",
    }),
  ).toBe("codex");
  expect(
    resolveHarness({
      env: {},
      entrypointPath: "/Users/me/.claude/plugins/forgix/dist/forgix.mjs",
    }),
  ).toBe("claude");
  expect(
    resolveHarness({
      env: {},
      entrypointPath: "/usr/local/bin/forgix",
    }),
  ).toBe("codex");
});

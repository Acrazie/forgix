import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);

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
  const { runInvocation } = await import(bundle);
  let calls = 0;
  const captureSnapshot = async () => {
    calls += 1;
    return routingResult();
  };
  const run = await runInvocation(["standard", "change", "thing"], { captureSnapshot });
  assert.equal(calls, 1);
  assert.equal(run.status, "routed");
  assert.equal(run.data.routingDecisions.length, 6);
  assert.deepEqual(
    run.data.routingDecisions.map((decision) => decision.stage),
    ["discover", "plan", "execute", "debug", "review", "verify"],
  );
  assert.equal(run.data.routingPolicyVersion, "2026-07-14.skill-first.v1");
  await runInvocation(["resume", "task-1"], { captureSnapshot });
  assert.equal(calls, 2);
});

test("missing exact route reports routing_unavailable without fallback", async () => {
  const { runInvocation } = await import(bundle);
  const result = routingResult();
  result.snapshot.models = result.snapshot.models.filter((model) => model.id === "gpt-5.6-luna");
  const run = await runInvocation(["standard", "change", "thing"], {
    captureSnapshot: async () => result,
  });
  assert.equal(run.status, "routing_unavailable");
  const plan = run.data.routingDecisions.find((decision) => decision.stage === "plan");
  assert.equal(plan.model, null);
  assert.ok(plan.warnings.includes("required_route_unavailable"));
});

test("state permission failure requests approval instead of reporting generic routing unavailability", async () => {
  const { runInvocation } = await import(bundle);
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
  });
  assert.equal(run.status, "routing_permission_required");
  assert.deepEqual(run.data.routingFailure, unavailable.failure);
  assert.ok(
    run.data.routingDecisions.every(
      (decision) => decision.model === null && decision.effort === null,
    ),
  );
});

test("config show explain stays read-only and exposes provenance", async () => {
  const { runInvocation } = await import(bundle);
  const result = await runInvocation(["config", "show", "--explain"], { configSources: [] });
  assert.equal(result.data.provenance["subscription.quota.warningPercent"], "defaults");
  assert.equal(result.data.value.subscription.plan, "auto");
});

test("a cached five-hour reset supplies safe fallback metadata without stale usage", async () => {
  const { runInvocation } = await import(bundle);
  const directory = await mkdtemp(join(tmpdir(), "dev-flow-quota-"));
  const quotaCachePath = join(directory, "quota-cache.json");
  const nowEpochSeconds = 1780000000;
  try {
    const live = routingResult();
    live.snapshot.quota.resetsAt = nowEpochSeconds + 1800;
    await runInvocation(["standard", "prime", "cache"], {
      captureSnapshot: async () => live,
      quotaCachePath,
      nowEpochSeconds,
    });
    const cached = JSON.parse(await readFile(quotaCachePath, "utf8"));
    assert.deepEqual(cached, {
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
    });
    assert.deepEqual(fallback.data.routingSnapshot.quota, {
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
    assert.equal("usedPercent" in fallback.data.routingSnapshot.quota, false);
    assert.ok(fallback.data.routingSnapshot.warnings.includes("quota_fallback_last_known"));
    assert.equal(fallback.data.routingDecisions[0].model, "gpt-5.6-terra");
    assert.equal(fallback.data.routingDecisions[0].effort, "medium");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an expired cached reset is ignored", async () => {
  const { readFiveHourResetCache, runInvocation, writeFiveHourResetCache } = await import(bundle);
  const directory = await mkdtemp(join(tmpdir(), "dev-flow-quota-expired-"));
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
    });
    assert.equal(result.data.routingSnapshot.quota.source, "unknown");
    assert.equal(result.data.routingSnapshot.warnings.includes("quota_fallback_last_known"), false);

    await writeFile(quotaCachePath, "not-json", "utf8");
    assert.equal(await readFiveHourResetCache(quotaCachePath, nowEpochSeconds), undefined);

    await writeFiveHourResetCache(quotaCachePath, {
      windowDurationMins: 300,
      resetsAt: nowEpochSeconds + 300 * 60 + 1,
    });
    assert.equal(await readFiveHourResetCache(quotaCachePath, nowEpochSeconds), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("cache write failure is non-fatal and explicit", async () => {
  const { runInvocation } = await import(bundle);
  const directory = await mkdtemp(join(tmpdir(), "dev-flow-quota-write-"));
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
    });
    assert.equal(result.status, "routed");
    assert.ok(result.data.routingSnapshot.warnings.includes("quota_cache_write_failed"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

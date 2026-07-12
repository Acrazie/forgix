import assert from "node:assert/strict";
import { test } from "node:test";
import process from "node:process";

const bundle = new URL("../dist/dev-flow.mjs", import.meta.url);
const fixture = new URL("./fixtures/app-server-fixture.mjs", import.meta.url);
const timeoutFixture = new URL("./fixtures/app-server-timeout.mjs", import.meta.url);
const errorFixture = new URL("./fixtures/app-server-error.mjs", import.meta.url);

test("app-server client performs one handshake and reads account, five-hour quota, and model catalog", async () => {
  const { captureRoutingSnapshot } = await import(bundle);
  const result = await captureRoutingSnapshot({
    command: process.execPath,
    args: [fixture.pathname],
    timeoutMs: 1000
  });
  assert.equal(result.snapshot.plan, "pro_20x");
  assert.equal(result.snapshot.quota.usedPercent, 42);
  assert.equal(result.snapshot.quota.windowDurationMins, 300);
  assert.deepEqual(result.snapshot.models.map((model) => model.id), [
    "gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"
  ]);
  assert.deepEqual(result.snapshot.warnings, []);
});

test("app-server timeout is non-fatal and marks quota unknown", async () => {
  const { captureRoutingSnapshot } = await import(bundle);
  const result = await captureRoutingSnapshot({
    command: process.execPath,
    args: [timeoutFixture.pathname],
    timeoutMs: 30
  });
  assert.equal(result.available, false);
  assert.equal(result.snapshot.quota.pressure, "unknown");
  assert.ok(result.snapshot.warnings.includes("quota_unknown"));
  assert.equal(result.snapshot.models.length, 0);
});

test("snapshot sanitization omits credentials and raw protocol payloads", async () => {
  const { buildRoutingSnapshot } = await import(bundle);
  const result = buildRoutingSnapshot({
    account: { planType: "plus", email: "person@example.com", accessToken: "secret-token" },
    rateLimits: { primary: { windowDurationMins: 300, usedPercent: 10 } },
    models: [{ id: "gpt-5.6-luna", supportedReasoningEfforts: ["low"] }],
    config: { plan: "auto" }
  });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("secret-token"), false);
  assert.equal(serialized.includes("person@example.com"), false);
  assert.equal(result.snapshot.account.planType, "plus");
});

test("app-server errors do not leak raw protocol messages", async () => {
  const { captureRoutingSnapshot } = await import(bundle);
  const result = await captureRoutingSnapshot({ command: process.execPath, args: [errorFixture.pathname], timeoutMs: 500 });
  assert.equal(result.available, false);
  assert.equal(result.error?.includes("secret-token"), false);
});

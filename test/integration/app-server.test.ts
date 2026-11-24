// @ts-nocheck -- migrated runtime fixtures preserve pre-existing dynamic boundary cases.
import * as sourceApi from "../../src/core/routing.ts";
import { expect, test } from "bun:test";
import process from "node:process";

const fixture = new URL("../fixtures/app-server-fixture.mjs", import.meta.url);
const timeoutFixture = new URL("../fixtures/app-server-timeout.mjs", import.meta.url);
const errorFixture = new URL("../fixtures/app-server-error.mjs", import.meta.url);
const permissionFixture = new URL("../fixtures/app-server-permission.mjs", import.meta.url);
const closedFixture = new URL("../fixtures/app-server-closed.mjs", import.meta.url);

test("app-server client performs one handshake and reads account, five-hour quota, and model catalog", async () => {
  const { captureRoutingSnapshot } = sourceApi;
  const result = await captureRoutingSnapshot({
    command: process.execPath,
    args: [fixture.pathname],
    timeoutMs: 1000,
  });
  expect(result.snapshot.plan).toBe("pro_20x");
  expect(result.snapshot.quota.usedPercent).toBe(42);
  expect(result.snapshot.quota.windowDurationMins).toBe(300);
  expect(result.snapshot.models.map((model) => model.id)).toEqual([
    "gpt-5.6-luna",
    "gpt-5.6-terra",
    "gpt-5.6-sol",
  ]);
  expect(result.snapshot.models[0].supportedReasoningEfforts).toEqual([
    "low",
    "medium",
    "high",
    "xhigh",
  ]);
  expect(result.snapshot.quota.resetsAt).toBe(1780000000);
  expect(result.snapshot.warnings).toEqual([]);
});

test("app-server timeout is non-fatal and marks quota unknown", async () => {
  const { captureRoutingSnapshot } = sourceApi;
  const result = await captureRoutingSnapshot({
    command: process.execPath,
    args: [timeoutFixture.pathname],
    timeoutMs: 30,
  });
  expect(result.available).toBe(false);
  expect(result.snapshot.quota.pressure).toBe("unknown");
  expect(result.snapshot.warnings.includes("quota_unknown")).toBeTruthy();
  expect(result.snapshot.models.length).toBe(0);
  expect(result.failure).toEqual({
    code: "app_server_timeout",
    retryableWithApproval: false,
  });
});

test("app-server state permission failures are structured and actionable", async () => {
  const { captureRoutingSnapshot } = sourceApi;
  const result = await captureRoutingSnapshot({
    command: process.execPath,
    args: [permissionFixture.pathname],
    timeoutMs: 500,
  });
  expect(result.available).toBe(false);
  expect(result.error).toBe("app-server unavailable");
  expect(result.failure).toEqual({
    code: "app_server_permission_denied",
    path: "~/.codex",
    retryableWithApproval: true,
  });
  expect(JSON.stringify(result).includes(process.env.HOME ?? "never-match")).toBe(false);
});

test("app-server spawn failures have a distinct non-retryable code", async () => {
  const { captureRoutingSnapshot } = sourceApi;
  const result = await captureRoutingSnapshot({
    command: "/definitely/missing/codex",
    timeoutMs: 500,
  });
  expect(result.failure).toEqual({
    code: "app_server_spawn_failed",
    retryableWithApproval: false,
  });
});

test("premature close is classified without exposing bounded stderr", async () => {
  const { captureRoutingSnapshot } = sourceApi;
  const result = await captureRoutingSnapshot({
    command: process.execPath,
    args: [closedFixture.pathname],
    timeoutMs: 500,
  });
  expect(result.failure).toEqual({
    code: "app_server_closed",
    retryableWithApproval: false,
  });
  expect(JSON.stringify(result).includes("secret-token")).toBe(false);
});

test("snapshot sanitization omits credentials and raw protocol payloads", async () => {
  const { buildRoutingSnapshot } = sourceApi;
  const result = buildRoutingSnapshot({
    account: { planType: "plus", email: "person@example.com", accessToken: "secret-token" },
    rateLimits: { primary: { windowDurationMins: 300, usedPercent: 10 } },
    models: [{ id: "gpt-5.6-luna", supportedReasoningEfforts: ["low"] }],
    config: { plan: "auto" },
  });
  const serialized = JSON.stringify(result);
  expect(serialized.includes("secret-token")).toBe(false);
  expect(serialized.includes("person@example.com")).toBe(false);
  expect(result.snapshot.account.planType).toBe("plus");
});

test("app-server errors do not leak raw protocol messages", async () => {
  const { captureRoutingSnapshot } = sourceApi;
  const result = await captureRoutingSnapshot({
    command: process.execPath,
    args: [errorFixture.pathname],
    timeoutMs: 500,
  });
  expect(result.available).toBe(false);
  expect(result.error?.includes("secret-token")).toBe(false);
  expect(JSON.stringify(result).includes("secret-token")).toBe(false);
  expect(result.failure?.code).toBe("app_server_rpc_failed");
});

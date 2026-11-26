import { describe, expect, test } from "bun:test";
import {
  ConfigValidationError,
  EXIT_CODES,
  InvocationError,
  PolicyError,
  StateStoreError,
  validateSchema,
} from "../../src/core/schema.ts";

describe("core/schema", () => {
  test("EXIT_CODES exposes stable numeric workflow exit codes", () => {
    expect(EXIT_CODES).toEqual({
      SUCCESS: 0,
      INVALID_INVOCATION: 2,
      INVALID_CONFIGURATION: 3,
      POLICY_CONTRADICTION: 4,
      STATE_CONFLICT: 5,
      BLOCKED: 6,
      INTERNAL_ERROR: 10,
    });
  });

  test("validateSchema validates valid payloads and formats Ajv diagnostics on failure", () => {
    const validConfig = validateSchema("config", { schemaVersion: 1, harness: "codex" });
    expect(validConfig).toEqual({ valid: true, errors: [] });

    const validBootstrapConfig = validateSchema("config", {
      schemaVersion: 1,
      harness: "auto",
      harnesses: ["codex", "claude", "antigravity"],
      hooks: { enforcement: "balanced" },
      bootstrap: { rules: true, hooks: true, gitignore: true, worktreeInclude: false },
    });
    expect(validBootstrapConfig).toEqual({ valid: true, errors: [] });

    expect(
      validateSchema("config", {
        schemaVersion: 1,
        harnesses: ["codex", "codex"],
      }).valid,
    ).toBe(false);
    expect(
      validateSchema("config", {
        schemaVersion: 1,
        hooks: { enforcement: "invalid" },
      }).valid,
    ).toBe(false);
    expect(
      validateSchema("config", {
        schemaVersion: 1,
        bootstrap: { unknownFlag: true },
      }).valid,
    ).toBe(false);

    const invalidConfig = validateSchema("config", { schemaVersion: 99, unknownField: true });
    expect(invalidConfig.valid).toBe(false);
    expect(invalidConfig.errors.length).toBeGreaterThan(0);

    for (const schemaName of [
      "state",
      "project-profile",
      "project-profile-local",
      "roadmap-state",
    ] as const) {
      const result = validateSchema(schemaName, {});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  test("error classes carry stable domain names and default/explicit exit codes", () => {
    const inv = new InvocationError("bad flags");
    expect(inv.name).toBe("InvocationError");
    expect(inv.exitCode).toBe(EXIT_CODES.INVALID_INVOCATION);

    const cfg = new ConfigValidationError("bad config");
    expect(cfg.name).toBe("ConfigValidationError");
    expect(cfg.exitCode).toBe(EXIT_CODES.INVALID_CONFIGURATION);

    const pol = new PolicyError("locked", "worktree.mode", "local");
    expect(pol.name).toBe("PolicyError");
    expect(pol.exitCode).toBe(EXIT_CODES.POLICY_CONTRADICTION);
    expect(pol.path).toBe("worktree.mode");
    expect(pol.source).toBe("local");

    expect(new StateStoreError("state_conflict", "conflict").exitCode).toBe(
      EXIT_CODES.STATE_CONFLICT,
    );
    expect(new StateStoreError("state_blocked", "blocked").exitCode).toBe(EXIT_CODES.BLOCKED);
    expect(new StateStoreError("state_write_failed", "io").exitCode).toBe(
      EXIT_CODES.INTERNAL_ERROR,
    );
    expect(new StateStoreError("state_invalid", "invalid").exitCode).toBe(
      EXIT_CODES.INVALID_CONFIGURATION,
    );
    expect(new StateStoreError("state_not_found", "missing", EXIT_CODES.BLOCKED).exitCode).toBe(
      EXIT_CODES.BLOCKED,
    );
  });
});

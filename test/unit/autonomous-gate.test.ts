import { describe, expect, test } from "bun:test";
import { evaluateAutonomousGateEligibility } from "../../src/core/autonomous-gate.js";
import type { TaskState } from "../../src/types.js";

describe("core/autonomous-gate", () => {
  test("evaluates predicate inputs across questions, ADR, issueRef, verifiers, and criteria", () => {
    expect(
      evaluateAutonomousGateEligibility(
        {
          risk: "low",
          verifiers: ["command"],
          acceptanceCriteria: ["Verify via command", { command: "bun test" }],
        },
        { issueRef: "#12" },
      ),
    ).toEqual({ eligible: true, reasons: [] });

    const blocked = evaluateAutonomousGateEligibility(
      {
        risk: "high",
        openQuestions: 1,
        adrQualified: true,
        hasExecutableProof: false,
        verifiers: ["model-inspection"],
        acceptanceCriteria: [],
      },
      { issueRef: "bad-ref" },
    );
    expect(blocked.eligible).toBe(false);
    expect(blocked.reasons).toContain("risk_requires_human_gate");
    expect(blocked.reasons).toContain("active_design_question");
    expect(blocked.reasons).toContain("technical_decision_requires_human_gate");
    expect(blocked.reasons).toContain("invalid_or_missing_issue_ref");
    expect(blocked.reasons).toContain("empty_acceptance_criteria");
    expect(blocked.reasons).toContain("autonomous_proof_floor_violated");
  });

  test("evaluates string, object, and non-automatable predicate criteria", () => {
    const modelOnlyString = evaluateAutonomousGateEligibility({
      risk: "medium",
      acceptanceCriteria: ["Check via model-inspection only"],
    });
    expect(modelOnlyString.eligible).toBe(false);
    expect(modelOnlyString.reasons).toContain("autonomous_proof_floor_violated");

    const blankCommand = evaluateAutonomousGateEligibility({
      risk: "low",
      acceptanceCriteria: [{ command: "   " }],
    });
    expect(blankCommand.eligible).toBe(false);
    expect(blankCommand.reasons).toContain("autonomous_proof_floor_violated");

    const nonAutoBlocked = evaluateAutonomousGateEligibility({
      risk: "low",
      acceptanceCriteria: [{ nonAutomatable: true, requiresHumanGate: true }],
    });
    expect(nonAutoBlocked.eligible).toBe(false);
    expect(nonAutoBlocked.reasons).toContain("human_gate_required_for_non_automatable");

    const nonAutoAllowed = evaluateAutonomousGateEligibility(
      {
        risk: "low",
        acceptanceCriteria: [{ nonAutomatable: true, humanGateRequired: true }],
      },
      { allowNonAutomatable: true },
    );
    expect(nonAutoAllowed).toEqual({ eligible: true, reasons: [] });
  });

  test("evaluates TaskState contract proof floor including missing contract and non-automatable criteria", () => {
    const minimalTask = {
      schemaVersion: 6,
      taskId: "t-1",
      status: "awaiting_approval",
      revision: 1,
      risk: "low",
      design: { productBaseline: { dimensions: [] } },
      shape: {
        contract: {
          artifactId: "c-1",
          profile: "standard",
          risk: "low",
          revision: 1,
          productBaselineRef: "pb-1",
          digest: "",
          scope: ["s"],
          nonGoals: [],
          tasks: [{ id: "task-1", title: "t", description: "d", dependsOn: [] }],
          acceptanceCriteria: [
            {
              id: "ac-1",
              description: "Manual UX review",
              validationIds: [],
              nonAutomatable: true,
              requiresHumanGate: true,
            },
            {
              id: "ac-2",
              description: "Direct non-exec",
              validationIds: [],
              verifierKind: "user-observation",
            },
          ],
          validations: [],
          risks: [],
        },
      },
    } as unknown as TaskState;

    const blocked = evaluateAutonomousGateEligibility(minimalTask, {
      issueRef: "#42",
      preflightGate: () => ({ ready: false, blockers: ["custom_blocker"] }),
    });
    expect(blocked.eligible).toBe(false);
    expect(blocked.reasons).toContain("preflight_blocked");
    expect(blocked.reasons).toContain("custom_blocker");
    expect(blocked.reasons).toContain("human_gate_required_for_non_automatable");
    expect(blocked.reasons).toContain("autonomous_proof_floor_violated");

    const allowedNonAuto = evaluateAutonomousGateEligibility(
      {
        ...minimalTask,
        shape: undefined,
      },
      { issueRef: "#42", allowNonAutomatable: true },
    );
    expect(allowedNonAuto.eligible).toBe(false);
    expect(allowedNonAuto.reasons).toContain("autonomous_proof_floor_violated");
  });
});

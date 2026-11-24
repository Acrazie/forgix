import { canonicalize, sha256Hex, validateDependencyGraph } from "../core/digest.js";
import { StateStoreError } from "../core/schema.js";
import type {
  AssuranceOperation,
  CanonicalChangeContract,
  ShapeState,
  TaskState,
} from "../types.js";

type DesignContract = CanonicalChangeContract & {
  schemaVersion: 2;
  profile: "plan";
  planDesign: NonNullable<CanonicalChangeContract["planDesign"]>;
  assuranceContract: NonNullable<CanonicalChangeContract["assuranceContract"]>;
};

export function isDesignContract(
  contract: CanonicalChangeContract | undefined,
): contract is DesignContract {
  return contract?.schemaVersion === 2;
}

function invalid(message: string): never {
  throw new StateStoreError("state_invalid", message);
}

function decisionSelections(shape: ShapeState) {
  return (shape.technicalDecisions ?? [])
    .map(({ id, selectedOptionId, status }) => ({ id, selectedOptionId, status }))
    .toSorted((a, b) => a.id.localeCompare(b.id));
}

export function designSourceFingerprint(state: TaskState, shape: ShapeState): string {
  return sha256Hex(
    canonicalize({
      baseline: state.design.productBaseline,
      decisions: (shape.technicalDecisions ?? []).toSorted((a, b) => a.id.localeCompare(b.id)),
    }),
  );
}

export function operationFingerprint(operation: AssuranceOperation): string {
  return sha256Hex(canonicalize(operation));
}

function sameIds(expected: readonly string[], actual: readonly string[]): boolean {
  const ids = new Set(expected);
  return (
    ids.size === expected.length &&
    ids.size === actual.length &&
    new Set(actual).size === ids.size &&
    actual.every((id) => ids.has(id))
  );
}

export function normalizeDesignContract(
  contract: DesignContract,
  state: TaskState,
  shape: ShapeState,
): void {
  if (
    contract.profile !== "plan" ||
    !contract.planDesign?.objective.trim() ||
    !contract.assuranceContract
  ) {
    invalid("Design contract requires Plan, a publishable objective, and ASSURE operations.");
  }
  const { planDesign, assuranceContract } = contract;
  if (
    planDesign.choices.some((choice) => !choice.summary.trim() || choice.rationale?.trim() === "")
  ) {
    invalid("Design choices require a summary and must omit unknown rationales.");
  }
  if (planDesign.sourceFingerprint === undefined) {
    planDesign.sourceFingerprint = designSourceFingerprint(state, shape);
  }
  if (planDesign.sourceFingerprint === designSourceFingerprint(state, shape)) {
    const selected = decisionSelections(shape).filter(({ status }) => status === "resolved");
    if (
      !sameIds(
        selected.map(({ id }) => id),
        planDesign.choices.map(({ decisionId }) => decisionId),
      ) ||
      planDesign.choices.some(
        ({ decisionId, optionId }) =>
          !selected.some(
            ({ id, selectedOptionId }) => id === decisionId && optionId === selectedOptionId,
          ),
      )
    ) {
      invalid("Design choices must match the resolved SHAPE decisions.");
    }
  }

  const criteria = new Map(contract.acceptanceCriteria.map((item) => [item.id, item]));
  const subjects = new Map(assuranceContract.subjects.map(({ id, kind }) => [id, kind]));
  const operations = new Map(assuranceContract.operations.map((op) => [op.id, op]));
  if (
    criteria.size !== contract.acceptanceCriteria.length ||
    subjects.size !== assuranceContract.subjects.length ||
    operations.size !== assuranceContract.operations.length
  ) {
    invalid("Design criteria, ASSURE subjects and operation IDs must be unique.");
  }
  validateDependencyGraph({
    schemaVersion: 1,
    nodes: assuranceContract.operations.map(({ id, dependsOn }) => ({
      id,
      kind: "assurance_operation",
      dependsOn: [...dependsOn],
    })),
  });
  const coveredSubjects = new Set(assuranceContract.operations.flatMap(({ covers }) => covers));
  if ([...subjects.keys()].some((id) => !coveredSubjects.has(id))) {
    invalid("Every ASSURE subject requires a covering operation.");
  }
  for (const op of operations.values()) {
    if (
      op.covers.length === 0 ||
      op.covers.some((id) => !subjects.has(id)) ||
      (op.conditional && !op.activationPredicateRef) ||
      !op.successPredicate ||
      !Object.values(op.successPredicate).some((value) =>
        typeof value === "string"
          ? value.trim().length > 0
          : Array.isArray(value) && value.length > 0,
      )
    ) {
      invalid(
        `ASSURE operation '${op.id}' lacks a valid coverage, success or activation requirement.`,
      );
    }
  }
  for (const criterion of criteria.values()) {
    const covering = assuranceContract.operations.filter((op) => op.covers.includes(criterion.id));
    if (
      subjects.get(criterion.id) !== "criterion" ||
      covering.length === 0 ||
      !sameIds(
        covering.map((op) => op.id),
        criterion.validationIds,
      )
    ) {
      invalid(`Criterion '${criterion.id}' must reference its canonical ASSURE operations.`);
    }
  }
  const expectedValidations = assuranceContract.operations.filter((op) =>
    op.covers.some((id) => criteria.has(id)),
  );
  if (
    !sameIds(
      expectedValidations.map(({ id }) => id),
      contract.validations.map(({ id }) => id),
    )
  ) {
    invalid("Plan validations must map one-to-one to criterion-covering ASSURE operations.");
  }
  for (const validation of contract.validations) {
    const op = operations.get(validation.id)!;
    if (
      !sameIds(
        op.covers.filter((id) => criteria.has(id)),
        validation.criterionIds,
      ) ||
      validation.verifierKind !== op.kind ||
      validation.command !== undefined
    ) {
      invalid(`Validation '${validation.id}' must reference, not redefine, its ASSURE operation.`);
    }
  }
}

const items = (lines: readonly string[]) => lines.map((line) => `- ${line}`);

function renderProof(operation: AssuranceOperation): string {
  const command = operation.checkIdentity;
  const invocation = command
    ? ` — ${[command.executable, ...command.argv].map((arg) => JSON.stringify(arg)).join(" ")} (${command.logicalCwd})`
    : "";
  const condition = operation.conditional ? `; if ${operation.activationPredicateRef}` : "";
  return `**${operation.id}** (${operation.kind})${invocation}: \`${JSON.stringify(canonicalize(operation.successPredicate))}\`${condition}`;
}

export function renderDesignContract(contract: DesignContract): string {
  const lines = [
    "# Design",
    "",
    contract.planDesign.objective,
    "",
    `- Artifact: ${contract.artifactId}`,
    `- Revision: ${contract.revision}`,
    `- Contract Digest: ${contract.digest}`,
  ];
  const section = (heading: string, body: readonly string[]) => {
    if (body.length) lines.push("", `## ${heading}`, ...items(body));
  };
  section("Scope", contract.scope);
  section("Non-Goals", contract.nonGoals);
  section(
    "Decisions",
    contract.planDesign.choices.map(
      (choice) =>
        `**${choice.decisionId}**: ${choice.summary}${choice.rationale ? ` — ${choice.rationale}` : ""}`,
    ),
  );
  section(
    "Risks & Controls",
    contract.risks.map((risk) => `**${risk.id}**: ${risk.description} — ${risk.control}`),
  );
  section(
    "Tasks",
    contract.tasks.map((task) => {
      const dependencies = task.dependsOnTaskIds.length
        ? `; depends on: ${task.dependsOnTaskIds.join(", ")}`
        : "";
      return `**${task.id}**: ${task.description} (criteria: ${task.criterionIds.join(", ")}${dependencies})`;
    }),
  );
  section("Implementation Guide", contract.guide?.content ?? []);
  lines.push("", "## Definition of Done");
  const operations = new Map(contract.assuranceContract.operations.map((item) => [item.id, item]));
  for (const criterion of contract.acceptanceCriteria) {
    lines.push(`- **${criterion.id}**: ${criterion.description}`);
    for (const id of criterion.validationIds) {
      const operation = operations.get(id);
      if (operation) lines.push(`  - ${renderProof(operation)}`);
    }
  }
  const additional = contract.assuranceContract.operations.filter((op) =>
    op.covers.some((id) =>
      contract.assuranceContract.subjects.some((s) => s.id === id && s.kind !== "criterion"),
    ),
  );
  if (additional.length)
    lines.push("", "### Risk and mandatory checks", ...items(additional.map(renderProof)));
  return `${lines.join("\n")}\n`;
}

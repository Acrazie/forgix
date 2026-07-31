import { createHash } from "node:crypto";
import type { CanonicalChangeContract, PlanProjectionRecord } from "./shape.js";

export interface RenderPlanProjectionOptions {
  path?: string;
  date?: string;
  slug?: string;
}

export interface RenderedPlanProjection extends PlanProjectionRecord {
  markdown: string;
}

export function renderPlanProjection(
  contract: CanonicalChangeContract,
  options: RenderPlanProjectionOptions = {}
): RenderedPlanProjection {
  if (contract.profile !== "plan") throw new Error("Only Plan contract may render Markdown projection.");
  const path = options.path ?? defaultPath(options.date, options.slug);
  validateProjectionPath(path);
  const markdown = render(contract, "Proposed");
  return {
    schemaVersion: 1,
    path,
    status: "Proposed",
    contractDigest: contract.digest,
    contentFingerprint: fingerprint(markdown),
    markdown
  };
}

export function approvePlanProjection(projection: RenderedPlanProjection): RenderedPlanProjection {
  validateProjection(projection);
  if (projection.status !== "Proposed") throw new Error("Only Proposed Plan projection may become Approved.");
  const markdown = projection.markdown.replace(/^Status: Proposed$/m, "Status: Approved");
  return {
    ...projection,
    status: "Approved",
    contentFingerprint: fingerprint(markdown),
    markdown
  };
}

export function detectPlanProjectionDrift(projection: PlanProjectionRecord, observedContent: string): boolean {
  validateProjection(projection);
  if (typeof observedContent !== "string") throw new Error("Observed Plan projection content must be text.");
  return fingerprint(observedContent) !== projection.contentFingerprint;
}

export function reconcilePlanProjection(
  projection: RenderedPlanProjection,
  observedContent: string,
  action: "regenerate" | "integrate"
): { action: "regenerate"; projection: RenderedPlanProjection } | { action: "integrate"; observedContent: string } {
  if (!detectPlanProjectionDrift(projection, observedContent)) {
    throw new Error("Plan projection reconciliation requires detected drift.");
  }
  if (action === "regenerate") return { action, projection };
  if (action === "integrate") return { action, observedContent };
  throw new Error("Plan projection reconciliation action is invalid.");
}

function render(contract: CanonicalChangeContract, status: "Proposed" | "Approved"): string {
  const lines = [
    `# ${titleFromArtifact(contract.artifactId)}`,
    "",
    `Status: ${status}`,
    `Contract-Digest: ${contract.digest}`,
    `Risk: ${contract.risk}`,
    "",
    "## Spec",
    "",
    "### Scope",
    "",
    ...bullets(contract.scope),
    "",
    "### Non-goals",
    "",
    ...bullets(contract.nonGoals),
    "",
    "### Acceptance criteria",
    "",
    ...contract.acceptanceCriteria.map((criterion) =>
      `- [${criterion.id}] ${criterion.description} (validation: ${criterion.validationIds.join(", ")})`
    ),
    "",
    "## Plan",
    "",
    ...contract.tasks.map((task, index) =>
      `${index + 1}. [${task.id}] ${task.description} (covers: ${task.criterionIds.join(", ")})`
    ),
    "",
    "## Validation",
    "",
    ...contract.validations.map((validation) =>
      `- [${validation.id}] ${validation.description}${validation.command ? ` — \`${validation.command}\`` : ""}`
    ),
    "",
    "## Risks",
    "",
    ...(contract.risks.length
      ? contract.risks.map((risk) => `- [${risk.id}] ${risk.description} Control: ${risk.control}`)
      : ["- None identified."])
  ];
  if (contract.guide) {
    lines.push(
      "",
      "## Implementation Guide",
      "",
      ...bullets(contract.guide.content),
      "",
      "Required because:",
      ...contract.guide.requiredBecause.map((reason) =>
        `- ${reason.kind} (evidence: ${reason.evidenceIds.join(", ") || "none"}; risks: ${reason.riskIds.join(", ") || "none"})`
      )
    );
  }
  return `${lines.join("\n")}\n`;
}

function defaultPath(date = new Date().toISOString().slice(0, 10), slug = "change"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Plan projection date is invalid.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Plan projection slug is invalid.");
  return `docs/dev-flow/${date}-${slug}.md`;
}

function validateProjectionPath(path: string): void {
  if (!path || path.startsWith("/") || path.startsWith("\\") || path.split(/[\\/]/).includes("..")
    || path.includes("\0") || !path.endsWith(".md")) {
    throw new Error("Plan projection requires safe repository-relative Markdown path.");
  }
}

function validateProjection(projection: PlanProjectionRecord): void {
  if (!projection || projection.schemaVersion !== 1 || !["Proposed", "Approved"].includes(projection.status)
    || !/^[a-f0-9]{64}$/.test(projection.contentFingerprint)
    || typeof projection.contractDigest !== "string" || !projection.contractDigest.length) {
    throw new Error("Plan projection record is invalid.");
  }
  validateProjectionPath(projection.path);
}

function bullets(items: readonly string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ["- None."];
}

function titleFromArtifact(artifactId: string): string {
  return artifactId
    .replace(/^artifact[.:/-]?/, "")
    .split(/[._:/-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ") || "Change Plan";
}

function fingerprint(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}


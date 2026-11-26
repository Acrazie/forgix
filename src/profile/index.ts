import { isAbsolute, win32 } from "node:path";
import { parse, stringify } from "yaml";
import {
  assertCleanHygiene,
  canonicalJson,
  canonicalize,
  dependencyClosure,
  sha256Hex,
  validateDependencyGraph,
  type DependencyGraph,
} from "../core/digest.js";
import { EXIT_CODES, StateStoreError, validateSchema, type ExitCode } from "../core/schema.js";
import {
  createWorkspaceStore,
  type WorkspaceStore,
  type WorkspaceStoreOptions,
} from "../core/store.js";
import { VERIFIER_KINDS, type SurfaceVerificationRule, type VerifierKind } from "../types.js";

export type { SurfaceVerificationRule, VerifierKind };

const SHARED_PROJECT_PROFILE_PATH = ".forgix/project.yaml";
const LOCAL_PROJECT_PROFILE_PATH = ".forgix/project.local.yaml";
export const LOCAL_PROJECT_PROFILE_IGNORE_ENTRY = ".forgix/project.local.yaml";
const PROJECT_DIAGRAM_ROOT = ".forgix/diagrams";

type ProjectDecisionCategory =
  | "stack"
  | "source_structure"
  | "architecture"
  | "dependency_direction"
  | "naming"
  | "error_handling"
  | "testing"
  | "quality"
  | "frontend"
  | "api"
  | "data"
  | "security"
  | "concurrency"
  | "performance"
  | "compatibility"
  | "migration"
  | "observability"
  | "deployment"
  | "rollback"
  | "operations";

type ProjectDecisionProvenanceKind =
  | "user"
  | "repository"
  | "policy"
  | "official_documentation"
  | "user_asserted";

interface ProjectStackEntry {
  id: string;
  role: string;
  version?: string;
  sourceRefs: string[];
}

interface ProjectService {
  id: string;
  responsibility: string;
  dependencies: string[];
  contracts: string[];
  profileRef?: string;
  sourceRefs: string[];
}

interface ProfileSourceFingerprint {
  sourceRef: string;
  value: string;
}

interface ProjectProfileDecision {
  key: string;
  category: ProjectDecisionCategory;
  value: string;
  rationale: string;
  provenance: {
    kind: ProjectDecisionProvenanceKind;
    sourceRefs: string[];
    capturedAt: string;
  };
  sourceFingerprints: ProfileSourceFingerprint[];
  dependsOn: string[];
}

export interface ProjectProfileContent {
  project: { id: string; name: string };
  stack?: ProjectStackEntry[];
  topology?: {
    rootServiceId: string;
    services: ProjectService[];
  };
  decisions?: ProjectProfileDecision[];
  domainDocumentation?: {
    contextMode: "single" | "multiple";
    glossaryPath: string;
    rulesPath: string;
    adrDirectory: string;
    contextMapPath?: string;
    language: string;
    identityConvention: string;
    linkConvention: string;
    sourceFingerprints: ProfileSourceFingerprint[];
  };
  protectedSurfaces?: string[];
  surfaceVerificationRules?: SurfaceVerificationRule[];
  diagramRefs?: string[];
}

interface ProfileApprovalReceipt {
  schemaVersion: 1;
  actor: "user";
  approvedAt: string;
  profileId: string;
  revision: number;
  contentDigest: string;
  receiptDigest: string;
}

export interface ProjectProfileProposal {
  schemaVersion: 1;
  profileId: string;
  revision: number;
  contentDigest: string;
  content: ProjectProfileContent;
}

export interface ProjectEngineeringProfile extends ProjectProfileProposal {
  approval: ProfileApprovalReceipt;
}

export interface LocalProjectProfile {
  schemaVersion: 1;
  profileId: string;
  sharedContentDigest?: string;
  servicePaths: Array<{ serviceId: string; path: string }>;
  preferences: Array<{ key: string; value: string }>;
}

export interface ProjectProfileProjection {
  path: string;
  content: string;
}

interface ProfileReconciliationResult {
  staleDecisionKeys: string[];
  invalidatedDecisionKeys: string[];
  missingSourceRefs: string[];
  domainDocumentationStale?: boolean;
  current: boolean;
}

interface ProjectProfileDiff {
  addedDecisionKeys: string[];
  changedDecisionKeys: string[];
  removedDecisionKeys: string[];
  topologyChanged: boolean;
  stackChanged: boolean;
  domainDocumentationChanged: boolean;
  protectedSurfacesChanged?: boolean;
  surfaceVerificationRulesChanged?: boolean;
}

type ProjectProfileErrorCode =
  | "profile_invalid"
  | "profile_schema_incompatible"
  | "profile_digest_mismatch"
  | "profile_receipt_invalid"
  | "profile_revision_conflict"
  | "profile_path_invalid"
  | "profile_not_found"
  | "profile_read_failed"
  | "profile_write_failed"
  | "profile_local_not_ignored"
  | "profile_local_conflict"
  | "profile_projection_invalid";

export class ProjectProfileError extends Error {
  readonly exitCode: ExitCode;

  constructor(
    readonly code: ProjectProfileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectProfileError";
    this.exitCode =
      code === "profile_revision_conflict"
        ? EXIT_CODES.STATE_CONFLICT
        : code === "profile_write_failed" || code === "profile_read_failed"
          ? EXIT_CODES.INTERNAL_ERROR
          : EXIT_CODES.INVALID_CONFIGURATION;
  }
}

type ProjectProfileStoreOptions = WorkspaceStoreOptions;

/**
 * Validates and canonicalizes an unapproved shared project profile proposal.
 */
export function prepareProjectProfile(value: unknown): ProjectProfileProposal {
  assertRecord(value, "Project profile proposal must be an object.");
  const allowed = new Set(["schemaVersion", "profileId", "revision", "contentDigest", "content"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ProjectProfileError(
      "profile_invalid",
      "Project profile proposal contains unsupported fields or an approval receipt.",
    );
  }
  if (value.schemaVersion !== 1) {
    throw new ProjectProfileError(
      "profile_schema_incompatible",
      "Project profile schemaVersion must be 1.",
    );
  }
  const contentDigest = sha256Hex(value.content);
  const proposal = canonicalize({
    schemaVersion: 1,
    profileId: value.profileId,
    revision: value.revision ?? 1,
    contentDigest,
    content: value.content,
  }) as ProjectProfileProposal;
  validateProjectProfileStructure(proposal, false);
  if (value.contentDigest !== undefined && value.contentDigest !== contentDigest) {
    throw new ProjectProfileError(
      "profile_digest_mismatch",
      "Project profile proposal contentDigest does not match canonical content.",
    );
  }
  return proposal;
}

/**
 * Binds an explicit user approval receipt to a validated profile proposal.
 */
export function approveProjectProfile(
  value: ProjectProfileProposal,
  approvedAt = new Date().toISOString(),
): ProjectEngineeringProfile {
  const proposal = prepareProjectProfile(value);
  assertTimestamp(approvedAt, "Profile approval timestamp is invalid.");
  const receiptBase = {
    schemaVersion: 1 as const,
    actor: "user" as const,
    approvedAt,
    profileId: proposal.profileId,
    revision: proposal.revision,
    contentDigest: proposal.contentDigest,
  };
  const profile: ProjectEngineeringProfile = {
    ...proposal,
    approval: { ...receiptBase, receiptDigest: sha256Hex(receiptBase) },
  };
  validateProjectProfile(profile);
  return profile;
}

/**
 * Validates a persisted shared project engineering profile and its approval receipt.
 */
export function validateProjectProfile(value: unknown): ProjectEngineeringProfile {
  validateProjectProfileStructure(value, true);
  const profile = canonicalize(value) as ProjectEngineeringProfile;
  if (profile.contentDigest !== sha256Hex(profile.content)) {
    throw new ProjectProfileError(
      "profile_digest_mismatch",
      "Project profile content digest is invalid.",
    );
  }
  const { receiptDigest, ...receiptBase } = profile.approval;
  if (
    profile.approval.profileId !== profile.profileId ||
    profile.approval.revision !== profile.revision ||
    profile.approval.contentDigest !== profile.contentDigest ||
    receiptDigest !== sha256Hex(receiptBase)
  ) {
    throw new ProjectProfileError(
      "profile_receipt_invalid",
      "Project profile approval receipt is not bound to current content.",
    );
  }
  return profile;
}

/**
 * Validates a local project overlay against schema, hygiene, and shared profile authority.
 */
export function validateLocalProjectProfile(
  value: unknown,
  shared?: ProjectEngineeringProfile | ProjectProfileProposal,
): LocalProjectProfile {
  const result = validateSchema("project-profile-local", value);
  if (!result.valid) throw schemaError("Local project profile", result.errors);
  const local = canonicalize(value) as LocalProjectProfile;
  assertProfileHygiene(local, { allowAbsolutePaths: true });
  assertUnique(
    local.servicePaths.map(({ serviceId }) => serviceId),
    "Local service IDs",
  );
  assertUnique(
    local.preferences.map(({ key }) => key),
    "Local preference keys",
  );
  for (const mapping of local.servicePaths) {
    if (!isPortableAbsolute(mapping.path)) {
      throw new ProjectProfileError(
        "profile_invalid",
        `Local service path for ${mapping.serviceId} must be absolute.`,
      );
    }
  }
  if (shared) {
    if (local.profileId !== shared.profileId) {
      throw new ProjectProfileError(
        "profile_local_conflict",
        "Local profile identity differs from shared profile.",
      );
    }
    if (local.sharedContentDigest && local.sharedContentDigest !== shared.contentDigest) {
      throw new ProjectProfileError(
        "profile_local_conflict",
        "Local profile is bound to a different shared content digest.",
      );
    }
    const serviceIds = new Set((shared.content.topology?.services ?? []).map(({ id }) => id));
    for (const mapping of local.servicePaths) {
      if (!serviceIds.has(mapping.serviceId)) {
        throw new ProjectProfileError(
          "profile_local_conflict",
          `Local path references unknown service ${mapping.serviceId}.`,
        );
      }
    }
    const sharedKeys = new Set((shared.content.decisions ?? []).map(({ key }) => key));
    for (const preference of local.preferences) {
      if (sharedKeys.has(preference.key)) {
        throw new ProjectProfileError(
          "profile_local_conflict",
          `Local preference ${preference.key} cannot override shared decision.`,
        );
      }
    }
  }
  return local;
}

/**
 * Renders a canonical shared or local project profile as YAML.
 */
export function renderProjectProfile(
  value: ProjectProfileProposal | ProjectEngineeringProfile | LocalProjectProfile,
): string {
  return stringify(canonicalize(value), { lineWidth: 0 });
}

/**
 * Reconciles observed source fingerprints against a shared profile and computes the transitive
 * closure of invalidated dependent decisions.
 */
export function reconcileProjectProfile(
  profile: ProjectEngineeringProfile | ProjectProfileProposal,
  observedFingerprints: Readonly<Record<string, string>>,
): ProfileReconciliationResult {
  const stale = new Set<string>();
  const missing = new Set<string>();
  const decisions = profile.content.decisions ?? [];
  for (const decision of decisions) {
    for (const fingerprint of decision.sourceFingerprints) {
      const observed = observedFingerprints[fingerprint.sourceRef];
      if (observed === undefined) missing.add(fingerprint.sourceRef);
      else if (observed !== fingerprint.value) stale.add(decision.key);
    }
  }
  let domainDocumentationStale = false;
  for (const fingerprint of profile.content.domainDocumentation?.sourceFingerprints ?? []) {
    const observed = observedFingerprints[fingerprint.sourceRef];
    if (observed === undefined) missing.add(fingerprint.sourceRef);
    else if (observed !== fingerprint.value) domainDocumentationStale = true;
  }
  const invalidatedDecisionKeys = dependencyClosure(decisionsToGraph(decisions), [...stale]);
  return {
    staleDecisionKeys: [...stale].toSorted(),
    invalidatedDecisionKeys,
    missingSourceRefs: [...missing].toSorted(),
    ...(profile.content.domainDocumentation ? { domainDocumentationStale } : {}),
    current: stale.size === 0 && missing.size === 0 && !domainDocumentationStale,
  };
}

/**
 * Computes the semantic difference between a previous and proposed shared project profile.
 */
export function diffProjectProfiles(
  previous: ProjectEngineeringProfile | ProjectProfileProposal | undefined,
  next: ProjectProfileProposal,
): ProjectProfileDiff {
  const nextDecisions = next.content.decisions ?? [];
  if (!previous) {
    return {
      addedDecisionKeys: nextDecisions.map(({ key }) => key).toSorted(),
      changedDecisionKeys: [],
      removedDecisionKeys: [],
      topologyChanged: Boolean(next.content.topology),
      stackChanged: Boolean(next.content.stack?.length),
      domainDocumentationChanged: Boolean(next.content.domainDocumentation),
      ...(next.content.protectedSurfaces ? { protectedSurfacesChanged: true } : {}),
      ...(next.content.surfaceVerificationRules ? { surfaceVerificationRulesChanged: true } : {}),
    };
  }
  const before = new Map(
    (previous.content.decisions ?? []).map((decision) => [decision.key, decision]),
  );
  const after = new Map(nextDecisions.map((decision) => [decision.key, decision]));
  const added = [...after.keys()].filter((key) => !before.has(key)).toSorted();
  const removed = [...before.keys()].filter((key) => !after.has(key)).toSorted();
  const changed = [...after.keys()]
    .filter(
      (key) => before.has(key) && canonicalJson(before.get(key)) !== canonicalJson(after.get(key)),
    )
    .toSorted();
  const hasProtectedSurfaces =
    previous.content.protectedSurfaces !== undefined ||
    next.content.protectedSurfaces !== undefined;
  const hasSurfaceRules =
    previous.content.surfaceVerificationRules !== undefined ||
    next.content.surfaceVerificationRules !== undefined;
  return {
    addedDecisionKeys: added,
    changedDecisionKeys: changed,
    removedDecisionKeys: removed,
    topologyChanged:
      canonicalJson(previous.content.topology) !== canonicalJson(next.content.topology),
    stackChanged: canonicalJson(previous.content.stack) !== canonicalJson(next.content.stack),
    domainDocumentationChanged:
      canonicalJson(previous.content.domainDocumentation) !==
      canonicalJson(next.content.domainDocumentation),
    ...(hasProtectedSurfaces
      ? {
          protectedSurfacesChanged:
            canonicalJson(previous.content.protectedSurfaces) !==
            canonicalJson(next.content.protectedSurfaces),
        }
      : {}),
    ...(hasSurfaceRules
      ? {
          surfaceVerificationRulesChanged:
            canonicalJson(previous.content.surfaceVerificationRules) !==
            canonicalJson(next.content.surfaceVerificationRules),
        }
      : {}),
  };
}

/**
 * Validates that supplied Mermaid diagram projections match the profile's declared diagramRefs.
 */
export function validateProjectProfileProjections(
  proposal: ProjectProfileProposal,
  projections: ProjectProfileProjection[],
): ProjectProfileProjection[] {
  const expected = new Set(proposal.content.diagramRefs ?? []);
  const supplied = new Map<string, string>();
  for (const projection of projections) {
    if (
      !expected.has(projection.path) ||
      supplied.has(projection.path) ||
      !projection.content ||
      projection.content.length > 262_144 ||
      projection.content.includes("\u0000") ||
      !/```mermaid\s/u.test(projection.content)
    ) {
      throw new ProjectProfileError(
        "profile_projection_invalid",
        "Project diagram projections must match profile diagramRefs exactly.",
      );
    }
    supplied.set(projection.path, projection.content);
  }
  if (expected.size !== supplied.size) {
    throw new ProjectProfileError(
      "profile_projection_invalid",
      "Every project diagram ref requires one projection payload.",
    );
  }
  return [...supplied].map(([path, content]) => ({ path, content }));
}

function resolveNextRevision(
  rawRevision: number | undefined,
  previous: ProjectEngineeringProfile | undefined,
  unchanged: boolean,
): number {
  if (!previous) {
    if (rawRevision !== undefined && rawRevision !== 1) {
      throw new ProjectProfileError(
        "profile_revision_conflict",
        "Initial project profile revision must be 1.",
      );
    }
    return 1;
  }
  if (rawRevision !== undefined && rawRevision < previous.revision) {
    throw new ProjectProfileError(
      "profile_revision_conflict",
      "Project profile revision cannot be lower than current revision.",
    );
  }
  if (unchanged) {
    if (rawRevision !== undefined && rawRevision > previous.revision + 1) {
      throw new ProjectProfileError(
        "profile_revision_conflict",
        "Project profile revision cannot skip ahead of current revision.",
      );
    }
    return previous.revision;
  }
  if (
    rawRevision !== undefined &&
    rawRevision !== previous.revision &&
    rawRevision !== previous.revision + 1
  ) {
    throw new ProjectProfileError(
      "profile_revision_conflict",
      "Project profile update must preserve identity and increment revision by one.",
    );
  }
  return previous.revision + 1;
}

/**
 * Atomic, symlink-safe persistence store for shared and local project profiles under `.forgix/`.
 */
class ProjectProfileStore {
  readonly workspaceRoot: string;
  readonly sharedPath: string;
  readonly localPath: string;
  readonly #store: WorkspaceStore;

  constructor(workspaceRoot: string, options: ProjectProfileStoreOptions = {}) {
    try {
      this.#store = createWorkspaceStore(workspaceRoot, options);
    } catch {
      throw new ProjectProfileError(
        "profile_path_invalid",
        "Project profile workspace root must be an existing directory.",
      );
    }
    this.workspaceRoot = this.#store.workspaceRoot;
    this.sharedPath = this.#store.resolvePath(SHARED_PROJECT_PROFILE_PATH);
    this.localPath = this.#store.resolvePath(LOCAL_PROJECT_PROFILE_PATH);
  }

  async loadShared(optional = true): Promise<ProjectEngineeringProfile | undefined> {
    const parsed = await this.#readYaml(SHARED_PROJECT_PROFILE_PATH, optional);
    return parsed === undefined ? undefined : validateProjectProfile(parsed);
  }

  async loadLocal(optional = true): Promise<LocalProjectProfile | undefined> {
    const parsed = await this.#readYaml(LOCAL_PROJECT_PROFILE_PATH, optional);
    if (parsed === undefined) return undefined;
    return validateLocalProjectProfile(parsed, await this.loadShared(true));
  }

  async prepareShared(value: unknown): Promise<ProjectProfileProposal> {
    const rawRevision =
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof (value as Record<string, unknown>).revision === "number"
        ? ((value as Record<string, unknown>).revision as number)
        : undefined;
    const proposal = prepareProjectProfile(value);
    const previous = await this.loadShared(true);
    if (previous && proposal.profileId !== previous.profileId) {
      throw new ProjectProfileError(
        "profile_revision_conflict",
        "Project profile update must preserve profileId.",
      );
    }
    const unchanged = previous !== undefined && proposal.contentDigest === previous.contentDigest;
    const revision = resolveNextRevision(rawRevision, previous, unchanged);
    return revision === proposal.revision ? proposal : { ...proposal, revision };
  }

  /**
   * Publishes an approved shared project profile and its diagram projections atomically.
   * Returns `{ profile, unchanged }` reflecting whether `.forgix/project.yaml` was written.
   */
  async publishSharedWithStatus(
    value: unknown,
    options: { approvedAt?: string; projections?: ProjectProfileProjection[] } = {},
  ): Promise<{ profile: ProjectEngineeringProfile; unchanged: boolean }> {
    const previous = await this.loadShared(true);
    const proposal = await this.prepareShared(value);
    const projections = validateProjectProfileProjections(proposal, options.projections ?? []);
    const unchanged = previous !== undefined && proposal.contentDigest === previous.contentDigest;
    const profile = unchanged ? previous : approveProjectProfile(proposal, options.approvedAt);
    const missingProjections = await this.#planProjectionWrites(projections);
    await Promise.all(missingProjections.map((projection) => this.#writeProjection(projection)));
    if (unchanged) {
      return { profile, unchanged: true };
    }
    await this.#writeYaml(SHARED_PROJECT_PROFILE_PATH, renderProjectProfile(profile));
    return { profile, unchanged: false };
  }

  /**
   * Publishes an approved shared project profile and its diagram projections atomically.
   * Returns the existing profile unchanged when contentDigest matches.
   */
  async publishShared(
    value: unknown,
    options: { approvedAt?: string; projections?: ProjectProfileProjection[] } = {},
  ): Promise<ProjectEngineeringProfile> {
    const { profile } = await this.publishSharedWithStatus(value, options);
    return profile;
  }

  async publishLocal(value: unknown): Promise<LocalProjectProfile> {
    if (!(await this.isLocalIgnored())) {
      throw new ProjectProfileError(
        "profile_local_not_ignored",
        `Local profile must be ignored with ${LOCAL_PROJECT_PROFILE_IGNORE_ENTRY}.`,
      );
    }
    const local = validateLocalProjectProfile(value, await this.loadShared(true));
    await this.#writeYaml(LOCAL_PROJECT_PROFILE_PATH, renderProjectProfile(local));
    return local;
  }

  async isLocalIgnored(): Promise<boolean> {
    try {
      return await this.#store.isGitignored(LOCAL_PROJECT_PROFILE_PATH);
    } catch (error) {
      throw mapStoreError(error, "read");
    }
  }

  async #readYaml(relativePath: string, optional: boolean): Promise<unknown> {
    let source: string | undefined;
    try {
      source = await this.#store.readText(relativePath, optional);
    } catch (error) {
      throw mapStoreError(error, "read");
    }
    if (source === undefined) return undefined;
    try {
      return parse(source);
    } catch {
      throw new ProjectProfileError("profile_invalid", "Project profile is not valid YAML.");
    }
  }

  async #writeYaml(relativePath: string, content: string): Promise<void> {
    try {
      await this.#store.writeTextAtomically(relativePath, content);
    } catch (error) {
      throw mapStoreError(error, "write");
    }
  }

  async #planProjectionWrites(
    projections: readonly ProjectProfileProjection[],
  ): Promise<ProjectProfileProjection[]> {
    const probes = await Promise.all(
      projections.map(async (projection) => {
        let existing: string | undefined;
        try {
          existing = await this.#store.readText(projection.path, true);
        } catch (error) {
          throw mapStoreError(error, "read");
        }
        return { projection, existing };
      }),
    );
    const toWrite: ProjectProfileProjection[] = [];
    for (const { projection, existing } of probes) {
      if (existing !== undefined) {
        if (existing !== projection.content) {
          throw new ProjectProfileError(
            "profile_projection_invalid",
            "Project diagram projection already exists with different content.",
          );
        }
      } else {
        toWrite.push(projection);
      }
    }
    return toWrite;
  }

  async #writeProjection(projection: ProjectProfileProjection): Promise<void> {
    try {
      await this.#store.writeTextAtomically(projection.path, projection.content);
    } catch (error) {
      throw mapStoreError(error, "write");
    }
  }
}

export function createProjectProfileStore(
  workspaceRoot: string,
  options: ProjectProfileStoreOptions = {},
): ProjectProfileStore {
  return new ProjectProfileStore(workspaceRoot, options);
}

function mapStoreError(error: unknown, operation: "read" | "write"): ProjectProfileError {
  if (error instanceof ProjectProfileError) return error;
  if (error instanceof StateStoreError) {
    if (error.code === "state_path_invalid") {
      return new ProjectProfileError("profile_path_invalid", error.message);
    }
    if (error.code === "state_not_found") {
      return new ProjectProfileError("profile_not_found", error.message);
    }
    if (error.code === "state_read_failed") {
      return new ProjectProfileError("profile_read_failed", error.message);
    }
    if (error.code === "state_write_failed") {
      return new ProjectProfileError("profile_write_failed", error.message);
    }
    return new ProjectProfileError("profile_invalid", error.message);
  }
  return new ProjectProfileError(
    operation === "read" ? "profile_read_failed" : "profile_write_failed",
    error instanceof Error ? error.message : String(error),
  );
}

function validateProjectProfileStructure(value: unknown, approvalRequired: boolean): void {
  assertRecord(value, "Project profile must be an object.");
  const schemaCandidate =
    !approvalRequired && value.approval === undefined
      ? {
          ...value,
          approval: {
            schemaVersion: 1,
            actor: "user",
            approvedAt: "1970-01-01T00:00:00.000Z",
            profileId: value.profileId,
            revision: value.revision,
            contentDigest: value.contentDigest,
            receiptDigest: "0".repeat(64),
          },
        }
      : value;
  const result = validateSchema("project-profile", schemaCandidate);
  if (!result.valid) throw schemaError("Project profile", result.errors);
  if (approvalRequired && value.approval === undefined) {
    throw new ProjectProfileError(
      "profile_receipt_invalid",
      "Published project profile requires approval receipt.",
    );
  }
  const profile = value as unknown as ProjectProfileProposal & {
    approval?: ProfileApprovalReceipt;
  };
  if (profile.content.project.id !== profile.profileId) {
    throw new ProjectProfileError(
      "profile_invalid",
      "Project content identity must match profileId.",
    );
  }
  validateProfileContent(profile.content);
}

function validateProfileContent(content: ProjectProfileContent): void {
  const stack = content.stack ?? [];
  assertUnique(
    stack.map(({ id }) => id),
    "Stack IDs",
  );
  if (content.topology) {
    const services = new Set(content.topology.services.map(({ id }) => id));
    if (services.size !== content.topology.services.length) {
      throw new ProjectProfileError("profile_invalid", "Service IDs must be unique.");
    }
    if (!services.has(content.topology.rootServiceId)) {
      throw new ProjectProfileError(
        "profile_invalid",
        "Project topology rootServiceId must reference a declared service.",
      );
    }
    for (const service of content.topology.services) {
      for (const dependency of service.dependencies) {
        if (!services.has(dependency) || dependency === service.id) {
          throw new ProjectProfileError(
            "profile_invalid",
            `Service ${service.id} has invalid dependency ${dependency}.`,
          );
        }
      }
      for (const sourceRef of service.sourceRefs) assertSharedReference(sourceRef);
      if (service.profileRef) assertNoLocalPath(service.profileRef, "Service profileRef");
    }
  }
  for (const entry of stack) {
    for (const sourceRef of entry.sourceRefs) assertSharedReference(sourceRef);
  }
  const decisions = content.decisions ?? [];
  const decisionKeys = new Set(decisions.map(({ key }) => key));
  if (decisionKeys.size !== decisions.length) {
    throw new ProjectProfileError("profile_invalid", "Project decision keys must be unique.");
  }
  for (const decision of decisions) {
    assertTimestamp(
      decision.provenance.capturedAt,
      `Decision ${decision.key} timestamp is invalid.`,
    );
    for (const sourceRef of decision.provenance.sourceRefs) assertSharedReference(sourceRef);
    assertUnique(
      decision.sourceFingerprints.map(({ sourceRef }) => sourceRef),
      `Decision ${decision.key} fingerprint sources`,
    );
    if (decision.provenance.kind === "user_asserted" && decision.sourceFingerprints.length > 0) {
      throw new ProjectProfileError(
        "profile_invalid",
        `User-asserted decision ${decision.key} cannot carry verified fingerprints.`,
      );
    }
    for (const fingerprint of decision.sourceFingerprints) {
      assertSharedReference(fingerprint.sourceRef);
      if (!decision.provenance.sourceRefs.includes(fingerprint.sourceRef)) {
        throw new ProjectProfileError(
          "profile_invalid",
          `Decision ${decision.key} fingerprint lacks matching provenance source.`,
        );
      }
    }
    for (const dependency of decision.dependsOn) {
      if (!decisionKeys.has(dependency) || dependency === decision.key) {
        throw new ProjectProfileError(
          "profile_invalid",
          `Decision ${decision.key} has invalid dependency ${dependency}.`,
        );
      }
    }
  }
  assertAcyclicDecisionRecords(decisions);
  if (content.domainDocumentation) {
    const domain = content.domainDocumentation;
    for (const [label, path] of [
      ["glossaryPath", domain.glossaryPath],
      ["rulesPath", domain.rulesPath],
      ["adrDirectory", domain.adrDirectory],
      ...(domain.contextMapPath ? [["contextMapPath", domain.contextMapPath]] : []),
    ] as Array<[string, string]>) {
      assertNoLocalPath(path, `Domain documentation ${label}`);
      if (path.includes("\\") || path.startsWith("/") || path.split("/").includes("..")) {
        throw new ProjectProfileError(
          "profile_invalid",
          `Domain documentation ${label} must be a portable repository path.`,
        );
      }
    }
    if (domain.contextMode === "multiple" && !domain.contextMapPath) {
      throw new ProjectProfileError(
        "profile_invalid",
        "Multiple domain contexts require contextMapPath.",
      );
    }
    if (
      ![domain.language, domain.identityConvention, domain.linkConvention].every(
        (value) => typeof value === "string" && value.trim().length > 0,
      )
    ) {
      throw new ProjectProfileError(
        "profile_invalid",
        "Domain documentation conventions are incomplete.",
      );
    }
    assertUnique(
      domain.sourceFingerprints.map(({ sourceRef }) => sourceRef),
      "Domain documentation fingerprint sources",
    );
    for (const fingerprint of domain.sourceFingerprints) {
      assertSharedReference(fingerprint.sourceRef);
    }
  }
  if (content.protectedSurfaces) {
    assertUnique(content.protectedSurfaces, "Protected surfaces");
    for (const glob of content.protectedSurfaces) {
      assertPortableRepositoryPattern(glob, "Protected surface");
    }
  }
  if (content.surfaceVerificationRules) {
    assertUnique(
      content.surfaceVerificationRules.map(({ id }) => id),
      "Surface verification rule IDs",
    );
    for (const rule of content.surfaceVerificationRules) {
      assertUnique(rule.pathGlobs, `Surface verification rule ${rule.id} pathGlobs`);
      for (const glob of rule.pathGlobs) {
        assertPortableRepositoryPattern(glob, `Surface verification rule ${rule.id} pathGlob`);
      }
      assertUnique(
        rule.requiredVerifierKinds,
        `Surface verification rule ${rule.id} requiredVerifierKinds`,
      );
      for (const kind of rule.requiredVerifierKinds) {
        if (!(VERIFIER_KINDS as readonly string[]).includes(kind)) {
          throw new ProjectProfileError(
            "profile_invalid",
            `Surface verification rule ${rule.id} has unsupported verifier kind ${kind}.`,
          );
        }
      }
      assertUnique(rule.requiredCommands, `Surface verification rule ${rule.id} requiredCommands`);
      for (const cmd of rule.requiredCommands) {
        if (typeof cmd !== "string" || cmd.trim().length === 0) {
          throw new ProjectProfileError(
            "profile_invalid",
            `Surface verification rule ${rule.id} requiredCommands cannot contain empty commands.`,
          );
        }
      }
    }
  }
  for (const ref of content.diagramRefs ?? []) {
    if (ref.includes("\\")) {
      throw new ProjectProfileError(
        "profile_projection_invalid",
        "Project diagram refs must use portable forward slashes.",
      );
    }
    if (!ref.startsWith(`${PROJECT_DIAGRAM_ROOT}/`) || !ref.endsWith(".md")) {
      throw new ProjectProfileError(
        "profile_projection_invalid",
        `Project diagram refs must be Markdown files below ${PROJECT_DIAGRAM_ROOT}/.`,
      );
    }
  }
  assertProfileHygiene(content);
}

function decisionsToGraph(
  decisions: ReadonlyArray<{ key: string; dependsOn: string[] }>,
): DependencyGraph {
  return {
    schemaVersion: 1,
    nodes: decisions.map((decision) => ({
      id: decision.key,
      kind: "decision",
      dependsOn: decision.dependsOn,
    })),
  };
}

function assertAcyclicDecisionRecords(
  decisions: ReadonlyArray<{ key: string; dependsOn: string[] }>,
): void {
  try {
    validateDependencyGraph(decisionsToGraph(decisions));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("cycle")) {
      throw new ProjectProfileError("profile_invalid", "Project decision graph contains a cycle.");
    }
    throw new ProjectProfileError("profile_invalid", message);
  }
}

function assertProfileHygiene(
  value: unknown,
  options: { allowAbsolutePaths?: boolean } = {},
): void {
  try {
    assertCleanHygiene(value, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/local_absolute_path|home_tilde_path|windows_absolute_path|file_uri/.test(message)) {
      throw new ProjectProfileError(
        "profile_invalid",
        "Shared project profile contains local absolute filesystem path.",
      );
    }
    throw new ProjectProfileError("profile_invalid", "Project profile contains secret-like data.");
  }
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new ProjectProfileError("profile_invalid", `${label} must be unique.`);
  }
}

function assertSharedReference(value: string): void {
  assertNoLocalPath(value, "Shared source reference");
}

function assertPortableRepositoryPattern(value: string, label: string): void {
  assertNoLocalPath(value, label);
  if (value.includes("\\") || value.startsWith("/") || value.split("/").includes("..")) {
    throw new ProjectProfileError(
      "profile_invalid",
      `${label} must be a portable repository path.`,
    );
  }
}

function assertNoLocalPath(value: string, label: string): void {
  if (
    isPortableAbsolute(value) ||
    /^~[\\/]/u.test(value) ||
    /^\/(?:Users|home|private|var|tmp|opt|Volumes)\//u.test(value)
  ) {
    throw new ProjectProfileError(
      "profile_invalid",
      `${label} cannot contain local absolute path.`,
    );
  }
}

function isPortableAbsolute(value: string): boolean {
  return isAbsolute(value) || win32.isAbsolute(value);
}

function assertTimestamp(value: string, message: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new ProjectProfileError("profile_invalid", message);
  }
}

function schemaError(label: string, errors: unknown[]): ProjectProfileError {
  const first = errors[0] as { instancePath?: string; message?: string } | undefined;
  return new ProjectProfileError(
    "profile_invalid",
    `${label} is invalid at ${first?.instancePath || "/"}: ${first?.message ?? "schema validation failed"}.`,
  );
}

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProjectProfileError("profile_invalid", message);
  }
}

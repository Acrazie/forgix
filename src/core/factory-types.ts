import type { BootstrapConfig, HarnessId } from "../types.js";

export type FactoryArtifactKind = "rule" | "agent" | "skill";

export interface BlockedCommandRule {
  pattern: string;
  reason: string;
}

export interface EscapeHatchPatternRule {
  kind: string;
  pattern: string;
}

export interface FactoryRuleEnforce {
  protectedSurfaces?: string[];
  blockedCommands?: BlockedCommandRule[];
  escapeHatchPatterns?: EscapeHatchPatternRule[];
}

export interface FactoryRuleSpec {
  id: string;
  description: string;
  globs?: string[];
  alwaysApply?: boolean;
  enforce?: FactoryRuleEnforce;
  content: string;
}

export interface FactoryAgentSpec {
  id: string;
  name: string;
  description: string;
  role?: string;
  tools?: string[];
  model?: string;
  content: string;
}

export interface FactorySkillSpec {
  id: string;
  name: string;
  description: string;
  content: string;
}

export interface FactoryPoliciesConfig {
  protectedSurfaces?: string[];
  blockedCommands?: BlockedCommandRule[];
  escapeHatchPatterns?: EscapeHatchPatternRule[];
}

export interface FactoryBootstrapConfig extends BootstrapConfig {
  agents?: boolean;
  skills?: boolean;
  managedPaths?: string[];
}

export interface FactoryManifestSection<T> {
  enabled: boolean;
  items?: T[];
}

export interface FactorySelection {
  harnesses: readonly HarnessId[];
  rules: FactoryManifestSection<FactoryRuleSpec>;
  agents: FactoryManifestSection<FactoryAgentSpec>;
  skills: FactoryManifestSection<FactorySkillSpec>;
}

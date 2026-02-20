/**
 * LinuxServer.io MCP Server
 * Module: Shared domain types for LSIO validation and scaffold generation
 * Standards basis: LSIO naming, directory, and metadata conventions
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
export type BaseImage = "alpine" | "ubuntu";

export interface ServiceSpec {
  imageName: string;
  baseImage: BaseImage;
  maintainer?: string;
  appPort?: number;
  serviceName?: string;
  readOnlyRootFs?: boolean;
  includeHealthcheck?: boolean;
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ScaffoldOutput {
  dockerfile: string;
  readmeSnippet: string;
  composeSnippet: string;
  directories: string[];
}

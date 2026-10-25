import { z } from 'zod';

export const LIMITS = {
  files: 256,
  fileBytes: 256_000,
  totalBytes: 2_000_000,
  changedFiles: 500,
  findings: 1_000,
  metadataItems: 256,
  traversedEntries: 10_000,
  depth: 24
} as const;

export const repositoryPathSchema = z
  .string()
  .min(1)
  .max(240)
  .refine(
    (path) =>
      !/[\\:]/.test(path) &&
      ![...path].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
      ) &&
      !path.startsWith('/') &&
      path
        .split('/')
        .every((part) => part !== '' && part !== '.' && part !== '..'),
    'Use a relative repository path without traversal or control characters.'
  );
export const severitySchema = z.enum(['error', 'warning', 'info']);
export type Severity = z.infer<typeof severitySchema>;
export const profileSchema = z.enum(['recommended', 'linuxserver', 'security']);
export type Profile = z.infer<typeof profileSchema>;
export const outputFormatSchema = z.enum(['text', 'json', 'github', 'sarif']);
export type OutputFormat = z.infer<typeof outputFormatSchema>;

const checksSchema = z
  .object({
    generated_files: z.boolean().default(true),
    dockerfile: z.boolean().default(true),
    architectures: z.boolean().default(true),
    s6_overlay: z.boolean().default(true),
    readme_vars: z.boolean().default(true),
    jenkins_vars: z.boolean().default(true),
    branding: z.boolean().default(true),
    security: z.boolean().default(true),
    supply_chain: z.boolean().default(true)
  })
  .strict();
export type CheckGroup = keyof z.infer<typeof checksSchema>;
export const repositoryConfigSchema = z
  .object({
    version: z.literal(1),
    policy: z
      .object({ profile: profileSchema.default('recommended') })
      .strict()
      .default({ profile: 'recommended' }),
    review: z
      .object({ changed_files_only: z.boolean().default(true) })
      .strict()
      .default({ changed_files_only: true }),
    severity: z
      .object({ fail_on: z.array(severitySchema).default(['error']) })
      .strict()
      .default({ fail_on: ['error'] }),
    checks: checksSchema.default({
      generated_files: true,
      dockerfile: true,
      architectures: true,
      s6_overlay: true,
      readme_vars: true,
      jenkins_vars: true,
      branding: true,
      security: true,
      supply_chain: true
    }),
    github: z
      .object({
        annotations: z.boolean().default(true),
        summary: z.boolean().default(true),
        review_comments: z.literal(false).default(false)
      })
      .strict()
      .default({ annotations: true, summary: true, review_comments: false }),
    agent: z
      .object({
        enabled: z.boolean().default(false),
        suggestions: z.boolean().default(false),
        automatic_writes: z.literal(false).default(false)
      })
      .strict()
      .default({ enabled: false, suggestions: false, automatic_writes: false }),
    suppressions: z
      .array(
        z
          .object({
            rule_id: z.string().min(1),
            paths: z.array(repositoryPathSchema).min(1).max(LIMITS.files),
            reason: z.string().trim().min(1).max(500)
          })
          .strict()
      )
      .max(100)
      .default([])
  })
  .strict();
export type RepositoryConfig = z.infer<typeof repositoryConfigSchema>;
export const repositoryFileSchema = z
  .object({
    path: repositoryPathSchema,
    content: z.string().max(LIMITS.fileBytes)
  })
  .strict();
export const repositorySnapshotSchema = z
  .object({
    files: z.array(repositoryFileSchema).max(LIMITS.files),
    changedFiles: z
      .array(repositoryPathSchema)
      .max(LIMITS.changedFiles)
      .optional(),
    complete: z.boolean().default(false),
    profile: profileSchema.optional()
  })
  .strict()
  .superRefine(({ files }, context) => {
    let total = 0;
    const seen = new Set<string>();
    for (const [index, file] of files.entries()) {
      const bytes = new TextEncoder().encode(file.content).length;
      total += bytes;
      if (bytes > LIMITS.fileBytes || seen.has(file.path)) {
        context.addIssue({
          code: 'custom',
          path: ['files', index],
          message: 'File exceeds the byte limit or duplicates another path.'
        });
      }
      seen.add(file.path);
    }
    if (total > LIMITS.totalBytes) {
      context.addIssue({
        code: 'custom',
        path: ['files'],
        message: 'Repository snapshot exceeds the total byte limit.'
      });
    }
  });
export type RepositorySnapshot = z.infer<typeof repositorySnapshotSchema>;
export type RepositoryFile = z.infer<typeof repositoryFileSchema>;

export const CONFIG_PATH = '.github/linuxserver-mcp.yml';
export const POLICY_VERSION = '1.0.0';
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'RESOURCE_LIMIT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'AUTH_REQUIRED'
  | 'NOT_FOUND';

export class AnalysisError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export function parseSnapshot(input: unknown): RepositorySnapshot {
  const parsed = repositorySnapshotSchema.safeParse(input);
  if (!parsed.success) {
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'Invalid repository snapshot: use unique relative paths and stay within the documented file/byte limits.'
    );
  }
  return parsed.data;
}

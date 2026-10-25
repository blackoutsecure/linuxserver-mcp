import { z } from 'zod';
import {
  repositoryConfigSchema,
  repositoryPathSchema,
  severitySchema
} from './schemas.js';

const classificationSchema = z.enum([
  'required',
  'contextual',
  'capability',
  'advisory'
]);
const evidenceKindSchema = z.enum([
  'documented_requirement',
  'observed_convention',
  'general_security',
  'project_recommendation',
  'heuristic'
]);
const categorySchema = z.enum([
  'generated_files',
  'dockerfile',
  'architectures',
  's6_overlay',
  'readme_vars',
  'jenkins_vars',
  'branding',
  'security',
  'supply_chain'
]);
export const evidenceSchema = z
  .object({
    path: repositoryPathSchema,
    line: z.number().int().positive(),
    endLine: z.number().int().positive().optional(),
    value: z
      .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
      .optional()
  })
  .strict();
export const policyRuleSchema = z
  .object({
    id: z.string(),
    version: z.string(),
    title: z.string(),
    description: z.string(),
    applicability: z.string(),
    severity: severitySchema,
    category: categorySchema,
    classification: classificationSchema,
    evidenceKind: evidenceKindSchema,
    authoritativeSources: z.array(z.string().url()).readonly(),
    remediation: z.string(),
    suppressible: z.boolean()
  })
  .strict();
export const findingSchema = z
  .object({
    ruleId: z.string(),
    policyVersion: z.string(),
    severity: severitySchema,
    confidence: z.enum(['high', 'medium', 'low']),
    classification: classificationSchema,
    evidenceKind: evidenceKindSchema,
    message: z.string(),
    evidence: z.array(evidenceSchema).min(1),
    authoritativeSources: z.array(z.string().url()).readonly(),
    remediation: z
      .object({
        classification: z.enum([
          'AUTO_FIX_SAFE',
          'AUTO_FIX_REVIEW',
          'MANUAL_FIX',
          'INFORMATIONAL'
        ]),
        summary: z.string(),
        patch: z.string().optional()
      })
      .strict(),
    suppressible: z.boolean()
  })
  .strict();
export const repositoryInspectionSchema = z
  .object({
    files: z.array(
      z
        .object({
          path: repositoryPathSchema,
          kind: z.string(),
          generatedFrom: repositoryPathSchema.nullable()
        })
        .strict()
    ),
    capabilities: z
      .object({
        readOnly: z.boolean().nullable(),
        nonRoot: z.boolean().nullable()
      })
      .strict(),
    architectures: z.array(z.string()).nullable()
  })
  .strict();
export const auditReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    policyVersion: z.string(),
    mode: z.enum(['audit', 'review']),
    status: z.enum(['complete', 'not_applicable']),
    config: repositoryConfigSchema,
    inspection: repositoryInspectionSchema,
    findings: z.array(findingSchema),
    suppressedFindings: z.array(
      z.object({ finding: findingSchema, reason: z.string() }).strict()
    ),
    skippedRules: z.array(
      z.object({ ruleId: z.string(), reason: z.string() }).strict()
    ),
    summary: z
      .object({
        error: z.number().int().nonnegative(),
        warning: z.number().int().nonnegative(),
        info: z.number().int().nonnegative()
      })
      .strict(),
    notices: z.array(z.string())
  })
  .strict();
export type Evidence = z.infer<typeof evidenceSchema>;
export type PolicyRule = z.infer<typeof policyRuleSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type AuditReport = z.infer<typeof auditReportSchema>;
export type RepositoryInspection = z.infer<typeof repositoryInspectionSchema>;

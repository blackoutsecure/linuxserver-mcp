import { z } from 'zod';

export const searchImagesInput = z.object({
  query: z.string().trim().optional(),
  category: z.string().trim().optional(),
  architecture: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  limit: z.number().int().min(1).max(100).default(20)
});
export const getImageInput = z.object({ imageName: z.string().trim().min(1) });
export const auditImageInput = z.object({
  imageName: z.string().trim().min(1),
  tag: z.string().trim().optional(),
  composeYaml: z.string().max(200_000).optional(),
  dockerRunCommand: z.string().max(50_000).optional()
});
export const auditComposeInput = z.object({
  composeYaml: z.string().min(1).max(200_000),
  imageName: z.string().trim().optional()
});
export const listCategoriesInput = z.object({
  query: z.string().trim().optional(),
  limit: z.number().int().min(1).max(100).default(50)
});
export const knownIssuesInput = z.object({
  includeStatus: z.boolean().default(true),
  includeDeprecations: z.boolean().default(true),
  includeSecurity: z.boolean().default(true)
});
export const searchRequestsInput = z.object({
  query: z.string().trim().optional(),
  status: z.enum(['open', 'closed', 'all']).default('all'),
  sort: z
    .enum(['activity', 'created', 'comments', 'relevance'])
    .default('activity'),
  includeDuplicates: z.boolean().default(true),
  includeRelated: z.boolean().default(true),
  limit: z.number().int().min(1).max(50).default(20)
});
export const shortcutRequestsInput = searchRequestsInput.pick({
  query: true,
  sort: true,
  limit: true
});
export const recommendedImagesInput = z.object({
  query: z.string().trim().optional(),
  category: z.string().trim().optional(),
  includeClosedRequests: z.boolean().default(true),
  limit: z.number().int().min(1).max(50).default(10)
});
export const imagePipelineInput = z.object({
  imageName: z.string().trim().min(1),
  upstreamUrl: z.string().url().optional(),
  searchCurrentImages: z.boolean().default(true),
  searchOpenRequests: z.boolean().default(true),
  searchClosedRequests: z.boolean().default(true),
  checkKnownIssues: z.boolean().default(true),
  recommendIfGapExists: z.boolean().default(true)
});
export const prepareRequestInput = z.object({
  appName: z.string().trim().min(1),
  upstreamUrl: z.string().url().optional(),
  license: z.string().trim().optional(),
  whyItFits: z.string().trim().optional(),
  dockerReadiness: z.string().trim().optional(),
  existingRequestUrl: z.string().url().optional(),
  includeAuditChecklist: z.boolean().default(true)
});
export const supportLinksInput = z.object({
  context: z.enum(['docs', 'support', 'donate', 'status', 'all']).default('all')
});

export const serviceSpecInput = z.object({
  imageName: z.string().min(2),
  baseImage: z.enum(['alpine', 'ubuntu']).default('alpine'),
  maintainer: z.string().optional(),
  appPort: z.number().int().min(1).max(65535).optional(),
  serviceName: z.string().optional(),
  readOnlyRootFs: z.boolean().optional(),
  includeHealthcheck: z.boolean().optional()
});
export const complianceAuditInput = serviceSpecInput.extend({
  candidateDockerfile: z.string().max(200_000).optional(),
  candidateCompose: z.string().max(200_000).optional(),
  candidateReadme: z.string().max(200_000).optional(),
  checkOfficialImage: z.boolean().default(true)
});
export const officialImageLookupInput = serviceSpecInput.pick({
  imageName: true
});
export const guidanceLinksInput = z.object({
  topic: z
    .enum([
      'all',
      'base-image',
      'permissions',
      'read-only',
      'support',
      'compose',
      'branding'
    ])
    .default('all')
});
export const bestPracticesInput = z.object({
  profile: z
    .enum([
      'all',
      'docker',
      'permissions',
      'filesystem',
      'docs',
      'review',
      'skillsets'
    ])
    .default('all')
});
export const skillsetsInput = z.object({
  profile: z
    .enum(['all', 'discovery', 'maintenance', 'review', 'release', 'docs'])
    .default('all')
});
export const optimizationIdeasInput = z.object({
  scope: z.enum(['all', 'server', 'image', 'release', 'quality']).default('all')
});
export const releaseStatusOutput = z.object({
  imageName: z.string(),
  status: z.enum(['found', 'not_found']),
  latestVersion: z.string().nullable(),
  lastBuild: z.string().nullable(),
  deprecated: z.boolean().nullable(),
  architectures: z.array(z.string()).nullable(),
  sourceLinks: z.array(z.string())
});

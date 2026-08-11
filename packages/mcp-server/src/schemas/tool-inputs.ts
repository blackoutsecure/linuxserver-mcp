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

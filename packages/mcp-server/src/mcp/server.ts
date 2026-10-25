import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  AnalysisError,
  auditRepository,
  auditReportSchema,
  inspectRepository,
  repositoryInspectionSchema,
  repositorySnapshotSchema
} from '../core/index.js';
import { getServerJson } from '../registry/server-json.js';
import * as schemas from '../schemas/tool-inputs.js';
import * as tools from '../tools.js';

const json = (value: object) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: { ...value }
});
const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};
const offlineAnnotations = { ...readOnlyAnnotations, openWorldHint: false };
const draftMetadata = {
  'io.github.blackoutsecure/tool-classification': 'deterministic-draft'
};
const safeResult = async (operation: () => object | Promise<object>) => {
  try {
    return json(await operation());
  } catch (error) {
    const detail =
      error instanceof AnalysisError
        ? { code: error.code, message: error.message }
        : {
            code: 'INTERNAL_ERROR',
            message: 'Repository analysis failed. No changes were applied.'
          };
    return { ...json({ error: detail }), isError: true };
  }
};

export function createMcpServer() {
  const { name, version } = getServerJson();
  const server = new McpServer({
    name,
    version
  });
  server.registerTool(
    'lsio.search_images',
    {
      annotations: readOnlyAnnotations,
      description: 'Search current LinuxServer.io images.',
      inputSchema: schemas.searchImagesInput
    },
    async (input) => json(await tools.searchImages(input))
  );
  server.registerTool(
    'lsio.get_image',
    {
      annotations: readOnlyAnnotations,
      description: 'Fetch normalized metadata for a LinuxServer.io image.',
      inputSchema: schemas.getImageInput
    },
    async ({ imageName }) => json(await tools.getImage(imageName))
  );
  server.registerTool(
    'lsio.audit_image',
    {
      annotations: readOnlyAnnotations,
      description:
        'Audit image usage as text against documentation-derived conventions.',
      inputSchema: schemas.auditImageInput
    },
    async (input) => json(await tools.auditImage(input))
  );
  server.registerTool(
    'lsio.audit_compose',
    {
      annotations: readOnlyAnnotations,
      description:
        'Safely parse and audit LinuxServer.io services in Compose YAML.',
      inputSchema: schemas.auditComposeInput
    },
    async ({ composeYaml, imageName }) =>
      json(await tools.auditCompose(composeYaml, imageName))
  );
  server.registerTool(
    'lsio.list_categories',
    {
      annotations: readOnlyAnnotations,
      description: 'List image categories with counts and examples.',
      inputSchema: schemas.listCategoriesInput
    },
    async (input) => json(await tools.listCategories(input))
  );
  server.registerTool(
    'lsio.get_known_issues',
    {
      annotations: readOnlyAnnotations,
      description: 'Return known issue and status context links.',
      inputSchema: schemas.knownIssuesInput
    },
    async (input) => json(await tools.getKnownIssues(input))
  );
  server.registerTool(
    'lsio.search_image_requests',
    {
      annotations: readOnlyAnnotations,
      description:
        'Search open, closed, or all Image Requests. Never comments or reacts.',
      inputSchema: schemas.searchRequestsInput
    },
    async (input) => json(await tools.searchImageRequests(input))
  );
  server.registerTool(
    'lsio.pending_image_requests',
    {
      annotations: readOnlyAnnotations,
      description: 'Search open Image Requests.',
      inputSchema: schemas.shortcutRequestsInput
    },
    async (input) =>
      json(await tools.searchImageRequests({ ...input, status: 'open' }))
  );
  server.registerTool(
    'lsio.closed_image_requests',
    {
      annotations: readOnlyAnnotations,
      description: 'Search closed Image Requests for historical context.',
      inputSchema: schemas.shortcutRequestsInput
    },
    async (input) =>
      json(await tools.searchImageRequests({ ...input, status: 'closed' }))
  );
  server.registerTool(
    'lsio.recommended_new_images',
    {
      annotations: readOnlyAnnotations,
      description:
        'Provide community guidance about possible image request gaps.',
      inputSchema: schemas.recommendedImagesInput
    },
    async (input) => json(await tools.recommendedNewImages(input))
  );
  server.registerTool(
    'lsio.prepare_image_request',
    {
      annotations: readOnlyAnnotations,
      _meta: draftMetadata,
      description:
        'Prepare, but never submit, an Image Request Markdown draft.',
      inputSchema: schemas.prepareRequestInput
    },
    async (input) => json(await tools.prepareImageRequest(input))
  );
  server.registerTool(
    'lsio.image_pipeline',
    {
      annotations: readOnlyAnnotations,
      description: 'Run current image, open/closed request, and issue checks.',
      inputSchema: schemas.imagePipelineInput
    },
    async (input) => json(await tools.imagePipeline(input))
  );
  server.registerTool(
    'lsio.get_support_links',
    {
      annotations: offlineAnnotations,
      description: 'Return LinuxServer.io community links.',
      inputSchema: schemas.supportLinksInput
    },
    async ({ context }) => json(tools.getSupportLinks(context))
  );
  server.registerTool(
    'lsio.validate_spec',
    {
      annotations: offlineAnnotations,
      description: 'Validate LinuxServer.io-oriented service metadata.',
      inputSchema: schemas.serviceSpecInput
    },
    async (input) => json(tools.validateLsioSpec(input))
  );
  server.registerTool(
    'lsio.generate_scaffold',
    {
      annotations: offlineAnnotations,
      _meta: draftMetadata,
      description:
        'Generate LSIO-style Dockerfile, Compose, and README snippets.',
      inputSchema: schemas.serviceSpecInput
    },
    async (input) => json(tools.scaffoldLsioService(input))
  );
  server.registerTool(
    'lsio.get_guidance_links',
    {
      annotations: offlineAnnotations,
      description: 'Return official LinuxServer.io documentation by topic.',
      inputSchema: schemas.guidanceLinksInput
    },
    async ({ topic }) => json(tools.getGuidanceLinks(topic))
  );
  server.registerTool(
    'lsio.get_best_practices',
    {
      annotations: offlineAnnotations,
      description: 'Return LSIO implementation and review checklists.',
      inputSchema: schemas.bestPracticesInput
    },
    async ({ profile }) => json(tools.getBestPractices(profile))
  );
  server.registerTool(
    'lsio.get_skillsets',
    {
      annotations: offlineAnnotations,
      description:
        'Return discovery, maintenance, review, release, and documentation skillsets.',
      inputSchema: schemas.skillsetsInput
    },
    async ({ profile }) => json(tools.getSkillsets(profile))
  );
  server.registerTool(
    'lsio.get_optimization_ideas',
    {
      annotations: offlineAnnotations,
      description:
        'Return LSIO-aligned server, image, release, and quality improvement ideas.',
      inputSchema: schemas.optimizationIdeasInput
    },
    async ({ scope }) => json(tools.getOptimizationIdeas(scope))
  );
  server.registerTool(
    'lsio.lookup_official_image',
    {
      annotations: readOnlyAnnotations,
      description: 'Check the official LSIO catalog and documentation signals.',
      inputSchema: schemas.officialImageLookupInput
    },
    async ({ imageName }) =>
      json(await tools.lookupOfficialLsioImage(imageName))
  );
  server.registerTool(
    'lsio.audit_image_compliance',
    {
      annotations: readOnlyAnnotations,
      description:
        'Audit candidate image artifacts and return LSIO remediation scaffolds.',
      inputSchema: schemas.complianceAuditInput
    },
    async (input) => {
      const officialImage = input.checkOfficialImage
        ? await tools.lookupOfficialLsioImage(input.imageName)
        : undefined;
      return json(tools.auditImageCompliance(input, officialImage));
    }
  );
  server.registerTool(
    'lsio.generate_dockerfile',
    {
      annotations: offlineAnnotations,
      _meta: draftMetadata,
      description:
        'Generate an LSIO-style Dockerfile with validation findings.',
      inputSchema: schemas.serviceSpecInput
    },
    async (input) =>
      json({
        fileName: 'Dockerfile',
        dockerfile: tools.renderDockerfile(input),
        validation: tools.validateLsioSpec(input),
        nextSteps: [
          'Place generated Dockerfile at repository root.',
          'Add root/ service files and ensure /config volume behavior is documented.',
          'Run lsio.audit_image_compliance with candidate artifacts before publishing.'
        ]
      })
  );
  server.registerTool(
    'repo_inspect',
    {
      description:
        'Inspect a bounded repository file snapshot. Read-only, offline; no host filesystem paths or repository execution.',
      annotations: offlineAnnotations,
      inputSchema: repositorySnapshotSchema,
      outputSchema: repositoryInspectionSchema
    },
    async (input) => safeResult(() => inspectRepository(input))
  );
  server.registerTool(
    'repo_audit',
    {
      description:
        'Run policy v1 against a bounded repository snapshot, optionally limited to changed-file relevance. Returns evidence, suppressions and sources; never applies fixes.',
      annotations: offlineAnnotations,
      inputSchema: repositorySnapshotSchema,
      outputSchema: auditReportSchema
    },
    async (input) => safeResult(() => auditRepository(input))
  );
  server.registerTool(
    'release_status',
    {
      description:
        'Read current LinuxServer API version, build timestamp and lifecycle metadata. Unknown fields remain null; this is not upstream application release history.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.getImageInput,
      outputSchema: schemas.releaseStatusOutput
    },
    async ({ imageName }) => safeResult(() => tools.releaseStatus(imageName))
  );
  return server;
}

export const noAutomaticDiscussionMutation = z.literal(true).parse(true);

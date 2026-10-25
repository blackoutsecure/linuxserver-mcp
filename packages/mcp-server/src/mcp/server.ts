import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { getServerJson } from '../registry/server-json.js';
import * as schemas from '../schemas/tool-inputs.js';
import * as tools from '../tools.js';

const json = (value: object) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: { ...value }
});

export function createMcpServer() {
  const { name, version } = getServerJson();
  const server = new McpServer({
    name,
    version
  });
  server.registerTool(
    'lsio.search_images',
    {
      description: 'Search current LinuxServer.io images.',
      inputSchema: schemas.searchImagesInput
    },
    async (input) => json(await tools.searchImages(input))
  );
  server.registerTool(
    'lsio.get_image',
    {
      description: 'Fetch normalized metadata for a LinuxServer.io image.',
      inputSchema: schemas.getImageInput
    },
    async ({ imageName }) => json(await tools.getImage(imageName))
  );
  server.registerTool(
    'lsio.audit_image',
    {
      description:
        'Audit image usage as text against documentation-derived conventions.',
      inputSchema: schemas.auditImageInput
    },
    async (input) => json(await tools.auditImage(input))
  );
  server.registerTool(
    'lsio.audit_compose',
    {
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
      description: 'List image categories with counts and examples.',
      inputSchema: schemas.listCategoriesInput
    },
    async (input) => json(await tools.listCategories(input))
  );
  server.registerTool(
    'lsio.get_known_issues',
    {
      description: 'Return known issue and status context links.',
      inputSchema: schemas.knownIssuesInput
    },
    async (input) => json(await tools.getKnownIssues(input))
  );
  server.registerTool(
    'lsio.search_image_requests',
    {
      description:
        'Search open, closed, or all Image Requests. Never comments or reacts.',
      inputSchema: schemas.searchRequestsInput
    },
    async (input) => json(await tools.searchImageRequests(input))
  );
  server.registerTool(
    'lsio.pending_image_requests',
    {
      description: 'Search open Image Requests.',
      inputSchema: schemas.shortcutRequestsInput
    },
    async (input) =>
      json(await tools.searchImageRequests({ ...input, status: 'open' }))
  );
  server.registerTool(
    'lsio.closed_image_requests',
    {
      description: 'Search closed Image Requests for historical context.',
      inputSchema: schemas.shortcutRequestsInput
    },
    async (input) =>
      json(await tools.searchImageRequests({ ...input, status: 'closed' }))
  );
  server.registerTool(
    'lsio.recommended_new_images',
    {
      description:
        'Provide community guidance about possible image request gaps.',
      inputSchema: schemas.recommendedImagesInput
    },
    async (input) => json(await tools.recommendedNewImages(input))
  );
  server.registerTool(
    'lsio.prepare_image_request',
    {
      description:
        'Prepare, but never submit, an Image Request Markdown draft.',
      inputSchema: schemas.prepareRequestInput
    },
    async (input) => json(await tools.prepareImageRequest(input))
  );
  server.registerTool(
    'lsio.image_pipeline',
    {
      description: 'Run current image, open/closed request, and issue checks.',
      inputSchema: schemas.imagePipelineInput
    },
    async (input) => json(await tools.imagePipeline(input))
  );
  server.registerTool(
    'lsio.get_support_links',
    {
      description: 'Return LinuxServer.io community links.',
      inputSchema: schemas.supportLinksInput
    },
    async ({ context }) => json(tools.getSupportLinks(context))
  );
  server.registerTool(
    'lsio.validate_spec',
    {
      description: 'Validate LinuxServer.io-oriented service metadata.',
      inputSchema: schemas.serviceSpecInput
    },
    async (input) => json(tools.validateLsioSpec(input))
  );
  server.registerTool(
    'lsio.generate_scaffold',
    {
      description:
        'Generate LSIO-style Dockerfile, Compose, and README snippets.',
      inputSchema: schemas.serviceSpecInput
    },
    async (input) => json(tools.scaffoldLsioService(input))
  );
  server.registerTool(
    'lsio.get_guidance_links',
    {
      description: 'Return official LinuxServer.io documentation by topic.',
      inputSchema: schemas.guidanceLinksInput
    },
    async ({ topic }) => json(tools.getGuidanceLinks(topic))
  );
  server.registerTool(
    'lsio.get_best_practices',
    {
      description: 'Return LSIO implementation and review checklists.',
      inputSchema: schemas.bestPracticesInput
    },
    async ({ profile }) => json(tools.getBestPractices(profile))
  );
  server.registerTool(
    'lsio.get_skillsets',
    {
      description:
        'Return discovery, maintenance, review, release, and documentation skillsets.',
      inputSchema: schemas.skillsetsInput
    },
    async ({ profile }) => json(tools.getSkillsets(profile))
  );
  server.registerTool(
    'lsio.get_optimization_ideas',
    {
      description:
        'Return LSIO-aligned server, image, release, and quality improvement ideas.',
      inputSchema: schemas.optimizationIdeasInput
    },
    async ({ scope }) => json(tools.getOptimizationIdeas(scope))
  );
  server.registerTool(
    'lsio.lookup_official_image',
    {
      description: 'Check the official LSIO catalog and documentation signals.',
      inputSchema: schemas.officialImageLookupInput
    },
    async ({ imageName }) =>
      json(await tools.lookupOfficialLsioImage(imageName))
  );
  server.registerTool(
    'lsio.audit_image_compliance',
    {
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
  return server;
}

export const noAutomaticDiscussionMutation = z.literal(true).parse(true);

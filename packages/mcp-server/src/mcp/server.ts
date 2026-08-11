import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import * as schemas from '../schemas/tool-inputs.js';
import * as tools from '../tools.js';

const json = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value as Record<string, unknown>
});

export function createMcpServer() {
  const server = new McpServer({
    name: 'io.github.blackoutsecure/linuxserver-mcp-registry',
    version: '0.1.0'
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
  return server;
}

export const noAutomaticDiscussionMutation = z.literal(true).parse(true);

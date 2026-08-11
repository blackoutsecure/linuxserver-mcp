import {
  auditImage,
  getImage,
  getKnownIssues,
  imagePipeline,
  listCategories,
  prepareImageRequest,
  searchImageRequests,
  searchImages,
  auditImageInput,
  getImageInput,
  imagePipelineInput,
  knownIssuesInput,
  listCategoriesInput,
  searchImagesInput,
  searchRequestsInput,
  prepareRequestInput
} from '@blackoutsecure/linuxserver-mcp-registry';
import { Hono } from 'hono';
import { z } from 'zod';
import { apiCors } from '../middleware/cors.js';
import { rateLimit } from '../middleware/rate-limit.js';

export const apiRoutes = new Hono();
const queryBoolean = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();
const knownIssuesQuery = z.object({
  includeStatus: queryBoolean,
  includeDeprecations: queryBoolean,
  includeSecurity: queryBoolean
});
const queryNumber = (value: string | undefined) =>
  value === undefined ? undefined : Number(value);

apiRoutes.use('/api/*', apiCors);
apiRoutes.get('/api/images', async (context) =>
  context.json(
    await searchImages(
      searchImagesInput.parse({
        query: context.req.query('query'),
        category: context.req.query('category'),
        architecture: context.req.query('architecture'),
        tag: context.req.query('tag'),
        limit: queryNumber(context.req.query('limit'))
      })
    )
  )
);
apiRoutes.get('/api/images/:name', async (context) =>
  context.json(
    await getImage(
      getImageInput.parse({ imageName: context.req.param('name') }).imageName
    )
  )
);
apiRoutes.post('/api/audit', rateLimit, async (context) =>
  context.json(
    await auditImage(auditImageInput.parse(await context.req.json()))
  )
);
apiRoutes.get('/api/categories', async (context) =>
  context.json(
    await listCategories(
      listCategoriesInput.parse({
        query: context.req.query('query'),
        limit: queryNumber(context.req.query('limit'))
      })
    )
  )
);
apiRoutes.get('/api/known-issues', async (context) => {
  const query = knownIssuesQuery.parse(context.req.query());
  return context.json(await getKnownIssues(knownIssuesInput.parse(query)));
});
apiRoutes.get('/api/image-requests', async (context) =>
  context.json(
    await searchImageRequests(
      searchRequestsInput.parse({
        query: context.req.query('query'),
        status: context.req.query('status'),
        sort: context.req.query('sort'),
        includeDuplicates: context.req.query('includeDuplicates')
          ? context.req.query('includeDuplicates') === 'true'
          : undefined,
        includeRelated: context.req.query('includeRelated')
          ? context.req.query('includeRelated') === 'true'
          : undefined,
        limit: queryNumber(context.req.query('limit'))
      })
    )
  )
);
apiRoutes.post('/api/image-pipeline', rateLimit, async (context) =>
  context.json(
    await imagePipeline(imagePipelineInput.parse(await context.req.json()))
  )
);
apiRoutes.post('/api/prepare-image-request', rateLimit, async (context) =>
  context.json(
    await prepareImageRequest(
      prepareRequestInput.parse(await context.req.json())
    )
  )
);

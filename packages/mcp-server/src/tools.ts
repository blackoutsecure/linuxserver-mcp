import { DISCLAIMER, SOURCES } from './constants.js';
import { auditCompose, auditImage } from './services/audit-rules.js';
import { searchImageRequests } from './services/github-discussions.js';
import { getKnownIssues } from './services/known-issues.js';
import {
  fetchImages,
  getImage,
  normalizeImageName,
  searchImages
} from './services/linuxserver-api.js';
import { getSupportLinks } from './services/support-links.js';

export {
  getBestPractices,
  getGuidanceLinks,
  getOptimizationIdeas,
  getSkillsets
} from './authoring/guidance.js';
export {
  auditImageCompliance,
  lookupOfficialLsioImage
} from './authoring/image-audit.js';
export { scaffoldLsioService } from './authoring/scaffold.js';
export {
  renderComposeSnippet,
  renderDockerfile,
  renderReadmeSnippet
} from './authoring/templates.js';
export { validateLsioSpec } from './authoring/validation.js';

export {
  auditCompose,
  auditImage,
  getImage,
  getKnownIssues,
  getSupportLinks,
  searchImageRequests,
  searchImages
};

export async function releaseStatus(imageName: string) {
  const result = await getImage(imageName);
  return {
    imageName: normalizeImageName(imageName),
    status: result.found ? ('found' as const) : ('not_found' as const),
    latestVersion: result.image?.latestVersion ?? null,
    lastBuild: result.image?.lastBuild ?? null,
    deprecated: result.image?.deprecated ?? null,
    architectures: result.image?.architectures ?? null,
    sourceLinks: result.sourceLinks
  };
}

export async function listCategories(input: {
  query?: string;
  limit?: number;
}) {
  const images = await fetchImages();
  const groups = new Map<string, string[]>();
  for (const image of images)
    for (const category of image.categories ?? [])
      groups.set(category, [...(groups.get(category) ?? []), image.name]);
  const categories = [...groups.entries()]
    .filter(
      ([name]) =>
        !input.query || name.toLowerCase().includes(input.query.toLowerCase())
    )
    .map(([name, names]) => ({
      name,
      imageCount: names.length,
      exampleImages: names.slice(0, 5)
    }))
    .slice(0, input.limit ?? 50);
  return { categories, sourceLinks: [SOURCES.categories, SOURCES.catalog] };
}

export async function imagePipeline(input: {
  imageName: string;
  upstreamUrl?: string;
  searchCurrentImages?: boolean;
  searchOpenRequests?: boolean;
  searchClosedRequests?: boolean;
  checkKnownIssues?: boolean;
  recommendIfGapExists?: boolean;
}) {
  const imageName = normalizeImageName(input.imageName);
  const [currentImage, open, closed, issues, related] = await Promise.all([
    input.searchCurrentImages === false
      ? { found: false, image: undefined }
      : getImage(imageName),
    input.searchOpenRequests === false
      ? { results: [], searchLimited: false }
      : searchImageRequests({ query: imageName, status: 'open' }),
    input.searchClosedRequests === false
      ? { results: [], searchLimited: false }
      : searchImageRequests({ query: imageName, status: 'closed' }),
    input.checkKnownIssues === false ? { items: [] } : getKnownIssues({}),
    searchImages({ query: imageName, limit: 5 })
  ]);
  const openRequests = open.results.map((item) => ({
    title: item.title,
    url: item.discussionUrl,
    status: item.status === 'open' ? ('open' as const) : ('unknown' as const)
  }));
  const closedRequests = closed.results.map((item) => ({
    title: item.title,
    url: item.discussionUrl,
    status:
      item.status === 'closed' ? ('closed' as const) : ('unknown' as const)
  }));
  let recommendation:
    | 'image_already_exists'
    | 'open_request_exists'
    | 'closed_request_exists_review_context'
    | 'similar_image_exists'
    | 'new_request_may_be_reasonable'
    | 'not_enough_information';
  let reason: string;
  let nextBestAction: string;
  if (currentImage.found) {
    recommendation = 'image_already_exists';
    reason = 'A matching LinuxServer.io image exists.';
    nextBestAction = 'Review the image documentation and metadata.';
  } else if (openRequests.length) {
    recommendation = 'open_request_exists';
    reason = 'A matching open image request exists.';
    nextBestAction = 'Contribute useful context to the existing discussion.';
  } else if (closedRequests.length) {
    recommendation = 'closed_request_exists_review_context';
    reason =
      'A matching closed request exists and its closure context may still apply.';
    nextBestAction =
      'Review the closed discussion before considering a new request.';
  } else if (related.results.length) {
    recommendation = 'similar_image_exists';
    reason = 'Related image names were found in the current catalog.';
    nextBestAction =
      'Compare the related images with the candidate application.';
  } else if (open.searchLimited || closed.searchLimited) {
    recommendation = 'not_enough_information';
    reason =
      'No image match was found, but GitHub request history could not be searched completely.';
    nextBestAction =
      'Review open and closed Image Requests manually before preparing a new request.';
  } else if (input.recommendIfGapExists === false) {
    recommendation = 'not_enough_information';
    reason = 'No exact inventory or request match was found.';
    nextBestAction = 'Research upstream licensing and container readiness.';
  } else {
    recommendation = 'new_request_may_be_reasonable';
    reason =
      'No current image or open/closed request was found in the available data.';
    nextBestAction =
      'Verify upstream license and container readiness, then prepare a draft for review.';
  }
  return {
    imageName,
    currentImage: {
      found: currentImage.found,
      name: currentImage.image?.name,
      metadata: currentImage.image
    },
    openRequests,
    closedRequests,
    similarImages: related.results
      .filter((item) => item.name !== imageName)
      .map((item) => ({
        name: item.name,
        reason: 'Name or metadata relevance'
      })),
    knownIssueContext: issues.items.map((item) => ({
      title: item.title,
      url: item.url
    })),
    recommendation,
    reason,
    nextBestAction,
    disclaimer: DISCLAIMER,
    sourceLinks: [SOURCES.catalog, SOURCES.requests, SOURCES.knownIssues]
  };
}

export async function recommendedNewImages(input: {
  query?: string;
  category?: string;
  includeClosedRequests?: boolean;
  limit?: number;
}) {
  if (!input.query) return { recommendations: [], disclaimer: DISCLAIMER };
  const pipeline = await imagePipeline({
    imageName: input.query,
    searchClosedRequests: true
  });
  const mapping = {
    image_already_exists: 'already_exists',
    open_request_exists: 'open_request_exists',
    closed_request_exists_review_context:
      'closed_request_exists_review_context',
    similar_image_exists: 'similar_image_exists',
    new_request_may_be_reasonable: 'new_request_may_be_reasonable',
    not_enough_information: 'not_enough_information'
  } as const;
  return {
    recommendations: [
      {
        name: input.query,
        category: input.category,
        recommendation: mapping[pipeline.recommendation],
        reason: pipeline.reason,
        existingImage: pipeline.currentImage?.name,
        relatedRequests: [
          ...pipeline.openRequests,
          ...(input.includeClosedRequests === false
            ? []
            : pipeline.closedRequests)
        ],
        sourceLinks: pipeline.sourceLinks
      }
    ],
    disclaimer: DISCLAIMER
  };
}

export async function prepareImageRequest(input: {
  appName: string;
  upstreamUrl?: string;
  license?: string;
  whyItFits?: string;
  dockerReadiness?: string;
  existingRequestUrl?: string;
  includeAuditChecklist?: boolean;
}) {
  const pipeline = await imagePipeline({ imageName: input.appName });
  if (input.existingRequestUrl) {
    pipeline.openRequests.unshift({
      title: `Existing request supplied for ${input.appName}`,
      url: input.existingRequestUrl,
      status: 'open'
    });
    pipeline.recommendation = 'open_request_exists';
    pipeline.reason = 'An existing request URL was supplied.';
    pipeline.nextBestAction =
      'Review and contribute useful context to the existing discussion.';
  }
  const shouldOpenNewRequest =
    pipeline.recommendation === 'new_request_may_be_reasonable';
  const auditChecklist =
    input.includeAuditChecklist === false
      ? ''
      : '## Audit checklist\n\n- [ ] Open and closed requests reviewed\n- [ ] License confirmed\n- [ ] Architectures documented\n- [ ] Persistent data and ports documented\n- [ ] Security requirements documented\n\n';
  const draftMarkdown = shouldOpenNewRequest
    ? `# [Image Request] ${input.appName}\n\n## Project summary\n\n${input.whyItFits ?? 'Describe the application and its primary use case.'}\n\n## Upstream project\n\n${input.upstreamUrl ?? 'Add the upstream project URL.'}\n\n## License\n\n${input.license ?? 'Confirm the upstream license.'}\n\n## Why this may fit LinuxServer.io\n\n${input.whyItFits ?? 'Explain community fit without implying acceptance.'}\n\n## Existing Docker/container readiness\n\n${input.dockerReadiness ?? 'Describe upstream container support and build reproducibility.'}\n\n## Architectures\n\nDocument supported architectures.\n\n## Runtime requirements\n\nDocument dependencies and startup requirements.\n\n## Volumes and persistence\n\nDocument persistent paths.\n\n## Ports\n\nDocument required ports and protocols.\n\n## Environment variables\n\nDocument configuration variables without secrets.\n\n## Security considerations\n\nDocument privileges, network exposure, and sensitive data handling.\n\n## Similar or related LinuxServer.io images\n\n${pipeline.similarImages.map((item) => `- ${item.name}`).join('\n') || 'No close match found in available image metadata.'}\n\n## Existing request search\n\nOpen and closed Image Requests were searched. Review: ${SOURCES.requests}\n\n${auditChecklist}## Notes\n\n${DISCLAIMER}`
    : `# Request review for ${input.appName}\n\n${pipeline.reason}\n\n${pipeline.nextBestAction}\n\n${DISCLAIMER}`;
  return {
    shouldOpenNewRequest,
    reason: pipeline.reason,
    relatedRequests: [...pipeline.openRequests, ...pipeline.closedRequests],
    draftMarkdown,
    disclaimer: DISCLAIMER
  };
}

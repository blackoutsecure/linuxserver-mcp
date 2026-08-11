import { parse } from 'node-html-parser';
import { SOURCES } from '../constants.js';
import type { RequestResult } from '../types.js';
import { cache } from './cache.js';

type SearchInput = {
  query?: string;
  status?: 'open' | 'closed' | 'all';
  sort?: 'activity' | 'created' | 'comments' | 'relevance';
  includeDuplicates?: boolean;
  includeRelated?: boolean;
  limit?: number;
};

type DiscussionRecord = {
  title: string;
  status: 'open' | 'closed';
  discussionUrl: string;
  createdBy?: string;
  createdDate?: string;
  lastActivityDate?: string;
  comments?: number;
  upvotes?: number;
};

const graphqlUrl = 'https://api.github.com/graphql';
const repositoryOwner = 'linuxserver';
const repositoryName = 'meta-discussion';

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\[(?:image\s*)?(?:req(?:uest)?s?)\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const relevance = (title: string, query?: string) => {
  if (!query) return 1;
  const normalizedTitle = normalize(title);
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 1;
  if (normalizedTitle === normalizedQuery) return 100;
  if (normalizedTitle.includes(normalizedQuery)) return 75;
  const terms = normalizedQuery.split(' ').filter((term) => term.length > 2);
  return terms.some((term) => normalizedTitle.includes(term)) ? 20 : 0;
};

function shapeResults(records: DiscussionRecord[], input: SearchInput) {
  const includeRelated = input.includeRelated !== false;
  const includeDuplicates = input.includeDuplicates !== false;
  const seen = new Set<string>();
  const scored = records
    .filter((record) => {
      if (seen.has(record.discussionUrl)) return false;
      seen.add(record.discussionUrl);
      const score = relevance(record.title, input.query);
      return score > 0 && (includeRelated || score >= 75);
    })
    .map((record) => {
      const score = relevance(record.title, input.query);
      const duplicate = Boolean(input.query && score >= 75);
      const requestInterpretation: RequestResult['requestInterpretation'] =
        record.status === 'closed'
          ? 'closed_request_found'
          : duplicate
            ? 'possible_duplicate'
            : input.query && score < 75
              ? 'related_request'
              : 'possible_pending_request';
      return {
        result: {
          title: record.title,
          status: record.status,
          discussionUrl: record.discussionUrl,
          createdBy: record.createdBy,
          createdDate: record.createdDate,
          lastActivityDate: record.lastActivityDate,
          comments: record.comments,
          communitySignals: {
            upvotes: record.upvotes,
            hasMaintainerResponse: null,
            isDuplicateCandidate: includeDuplicates ? duplicate : undefined
          },
          requestInterpretation,
          nextBestAction:
            record.status === 'closed'
              ? 'Review the discussion closure context before preparing a new request.'
              : 'Contribute relevant context to the existing discussion rather than opening a duplicate.'
        } satisfies RequestResult,
        score
      };
    });

  if (input.sort === 'created')
    scored.sort((left, right) =>
      (right.result.createdDate ?? '').localeCompare(
        left.result.createdDate ?? ''
      )
    );
  else if (input.sort === 'comments')
    scored.sort(
      (left, right) =>
        (right.result.comments ?? 0) - (left.result.comments ?? 0)
    );
  else if (input.sort === 'relevance')
    scored.sort(
      (left, right) =>
        right.score - left.score ||
        (right.result.lastActivityDate ?? '').localeCompare(
          left.result.lastActivityDate ?? ''
        )
    );
  else
    scored.sort((left, right) =>
      (
        right.result.lastActivityDate ??
        right.result.createdDate ??
        ''
      ).localeCompare(
        left.result.lastActivityDate ?? left.result.createdDate ?? ''
      )
    );

  return scored.slice(0, input.limit ?? 20).map(({ result }) => result);
}

export function parseDiscussionHtml(
  html: string,
  status: 'open' | 'closed'
): DiscussionRecord[] {
  const root = parse(html);
  return root
    .querySelectorAll('li.Box-row')
    .flatMap((row): DiscussionRecord[] => {
      const discussion = row.querySelector(
        'a[data-hovercard-type="discussion"]'
      );
      const path = discussion?.getAttribute('href');
      if (
        !discussion ||
        !path?.match(/^\/orgs\/linuxserver\/discussions\/\d+$/)
      )
        return [];
      const author = row
        .querySelectorAll('a')
        .find((link) => link.getAttribute('aria-label')?.endsWith('(author)'));
      const comments = row
        .querySelectorAll('a')
        .map((link) => link.getAttribute('aria-label'))
        .find((label) => label?.match(/^\d+ comments?:/));
      const upvotes = row
        .querySelectorAll('button')
        .map((button) => button.getAttribute('aria-label'))
        .find((label) => label?.startsWith('Upvote:'));
      const createdDate = row
        .querySelector('relative-time')
        ?.getAttribute('datetime');
      return [
        {
          title: discussion.text.trim(),
          status,
          discussionUrl: new URL(path, 'https://github.com').toString(),
          createdBy: author?.text.trim(),
          createdDate,
          lastActivityDate: createdDate,
          comments: comments ? Number(comments.match(/^\d+/)?.[0]) : undefined,
          upvotes: upvotes ? Number(upvotes.match(/\d+/)?.[0]) : undefined
        }
      ];
    });
}

async function searchPublicPages(input: SearchInput, fetcher: typeof fetch) {
  const statuses: Array<'open' | 'closed'> =
    input.status === 'all' || !input.status
      ? ['open', 'closed']
      : [input.status];
  const records: DiscussionRecord[] = [];
  for (const status of statuses) {
    const pages = Math.min(2, Math.max(1, Math.ceil((input.limit ?? 20) / 25)));
    for (let page = 1; page <= pages; page += 1) {
      const url = new URL(SOURCES.requests);
      url.searchParams.set(
        'discussions_q',
        [`is:${status}`, 'category:"Image requests"', input.query]
          .filter(Boolean)
          .join(' ')
      );
      if (page > 1) url.searchParams.set('page', String(page));
      const response = await fetcher(url, {
        headers: { 'User-Agent': 'linuxserver-mcp-registry/0.1.0' }
      });
      if (!response.ok)
        throw new Error('GitHub public discussion lookup failed');
      const pageRecords = parseDiscussionHtml(await response.text(), status);
      records.push(...pageRecords);
      if (pageRecords.length < 25) break;
    }
  }
  return shapeResults(records, input);
}

async function graphqlRequest(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  fetcher: typeof fetch
) {
  const response = await fetcher(graphqlUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'linuxserver-mcp-registry/0.1.0'
    },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) throw new Error('GitHub GraphQL request failed');
  const payload = (await response.json()) as any;
  if (payload.errors?.length) throw new Error('GitHub GraphQL returned errors');
  return payload.data;
}

async function searchAuthenticated(
  input: SearchInput,
  token: string,
  fetcher: typeof fetch
) {
  const categoryData = await graphqlRequest(
    `query { repository(owner: "${repositoryOwner}", name: "${repositoryName}") { discussionCategories(first: 30) { nodes { id slug } } } }`,
    {},
    token,
    fetcher
  );
  const categoryId =
    categoryData?.repository?.discussionCategories?.nodes?.find(
      (category: any) => category.slug === 'image-requests'
    )?.id;
  if (!categoryId) throw new Error('Image Requests category was not found');

  const states =
    input.status === 'open'
      ? ['OPEN']
      : input.status === 'closed'
        ? ['CLOSED']
        : null;
  const records: DiscussionRecord[] = [];
  let after: string | null = null;
  let hasNextPage = true;
  while (hasNextPage && records.length < 500) {
    const data: any = await graphqlRequest(
      `query($categoryId: ID!, $states: [DiscussionState!], $after: String) { repository(owner: "${repositoryOwner}", name: "${repositoryName}") { discussions(first: 100, after: $after, categoryId: $categoryId, states: $states, orderBy: {field: UPDATED_AT, direction: DESC}) { nodes { title url closed createdAt updatedAt upvoteCount comments { totalCount } author { login } } pageInfo { hasNextPage endCursor } } } }`,
      { categoryId, states, after },
      token,
      fetcher
    );
    const connection = data?.repository?.discussions;
    if (!connection) throw new Error('GitHub discussion data was unavailable');
    records.push(
      ...connection.nodes.map(
        (node: any) =>
          ({
            title: node.title,
            status: node.closed ? 'closed' : 'open',
            discussionUrl: node.url,
            createdBy: node.author?.login,
            createdDate: node.createdAt,
            lastActivityDate: node.updatedAt,
            comments: node.comments?.totalCount,
            upvotes: node.upvoteCount
          }) satisfies DiscussionRecord
      )
    );
    hasNextPage = connection.pageInfo.hasNextPage;
    after = connection.pageInfo.endCursor;
  }
  return shapeResults(records, input);
}

export async function searchImageRequests(
  input: SearchInput,
  fetcher: typeof fetch = fetch
) {
  const normalizedInput = {
    ...input,
    status: input.status ?? 'all',
    sort: input.sort ?? 'activity',
    limit: input.limit ?? 20
  } satisfies SearchInput;
  const token = process.env.GITHUB_TOKEN;
  const load = async () => {
    let notice: string | undefined;
    try {
      const results = token
        ? await searchAuthenticated(normalizedInput, token, fetcher)
        : await searchPublicPages(normalizedInput, fetcher);
      if (!token)
        notice =
          'Using GitHub public discussion pages; authenticated metadata enrichment is unavailable.';
      return {
        query: input.query,
        statusSearched: normalizedInput.status!,
        results,
        sourceLinks: [SOURCES.requests],
        searchLimited: false,
        notice
      };
    } catch {
      if (token) {
        try {
          const results = await searchPublicPages(normalizedInput, fetcher);
          return {
            query: input.query,
            statusSearched: normalizedInput.status!,
            results,
            sourceLinks: [SOURCES.requests],
            searchLimited: false,
            notice:
              'Authenticated GitHub lookup failed; results were recovered from public discussion pages.'
          };
        } catch {
          // Return a source link and explicit best-effort state below.
        }
      }
      return {
        query: input.query,
        statusSearched: normalizedInput.status!,
        results: [],
        sourceLinks: [SOURCES.requests],
        searchLimited: true,
        notice:
          'GitHub discussion search was unavailable. Review the linked Image Requests category manually.'
      };
    }
  };

  if (fetcher !== fetch) return load();
  const ttl = Number(process.env.CACHE_TTL_SECONDS ?? 3600);
  const key = `requests:${Boolean(token)}:${JSON.stringify(normalizedInput)}`;
  return cache.getOrSet(key, ttl, load);
}

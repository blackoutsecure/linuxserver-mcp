import { parse } from 'node-html-parser';
import { SOURCES } from '../constants.js';
import { cache } from './cache.js';

type KnownIssueItem = {
  title: string;
  type:
    | 'known_issue'
    | 'deprecation'
    | 'new_container'
    | 'notification'
    | 'security'
    | 'status';
  status?: string;
  url: string;
  lastUpdated?: string;
};

const issueType = (title: string): KnownIssueItem['type'] => {
  if (/deprecat|end of life|\bremoval\b/i.test(title)) return 'deprecation';
  if (/new container/i.test(title)) return 'new_container';
  if (/security|vulnerab|\bcve\b/i.test(title)) return 'security';
  if (/notice|notification|pause|resumed/i.test(title)) return 'notification';
  return 'known_issue';
};

export function parseKnownIssuesHtml(html: string): KnownIssueItem[] {
  const root = parse(html);
  return root.querySelectorAll('a').flatMap((link): KnownIssueItem[] => {
    const href = link.getAttribute('href');
    if (!href?.match(/\/issues\/\d{4}-/)) return [];
    const title = link.querySelector('h3')?.text.replace(/ℹ/g, '').trim();
    if (!title) return [];
    return [
      {
        title,
        type: issueType(title),
        url: new URL(href, SOURCES.knownIssues).toString(),
        lastUpdated: link.querySelector('small')?.getAttribute('data-date')
      }
    ];
  });
}

async function loadKnownIssues(
  input: {
    includeStatus?: boolean;
    includeDeprecations?: boolean;
    includeSecurity?: boolean;
  },
  fetcher: typeof fetch
) {
  const items: KnownIssueItem[] = [];
  const notices: string[] = [];
  try {
    const response = await fetcher(SOURCES.knownIssues, {
      headers: { 'User-Agent': 'linuxserver-mcp/0.1.0' }
    });
    if (!response.ok) throw new Error('Known issues request failed');
    items.push(...parseKnownIssuesHtml(await response.text()));
  } catch {
    notices.push(
      'Known issue summaries could not be parsed; use the provided source link.'
    );
  }

  if (input.includeStatus !== false) {
    try {
      const response = await fetcher(
        'https://status.linuxserver.io/api/v1/endpoints/statuses',
        { headers: { 'User-Agent': 'linuxserver-mcp/0.1.0' } }
      );
      if (!response.ok) throw new Error('Status request failed');
      const endpoints = (await response.json()) as Array<{
        results?: Array<{ success?: boolean; timestamp?: string }>;
      }>;
      const latest = endpoints
        .map((endpoint) => endpoint.results?.[0])
        .filter((result): result is { success?: boolean; timestamp?: string } =>
          Boolean(result)
        );
      const failing = latest.filter(
        (result) => result.success === false
      ).length;
      items.push({
        title: 'LinuxServer.io service status',
        type: 'status',
        status: failing
          ? `${failing} monitored endpoint${failing === 1 ? '' : 's'} reporting failures`
          : 'operational',
        url: SOURCES.status,
        lastUpdated: latest
          .map((result) => result.timestamp ?? '')
          .sort()
          .at(-1)
      });
    } catch {
      items.push({
        title: 'LinuxServer.io service status',
        type: 'status',
        status: 'status details unavailable',
        url: SOURCES.status
      });
      notices.push(
        'Live status details could not be parsed; use the provided dashboard link.'
      );
    }
  }

  return {
    items: items.filter(
      (item) =>
        (input.includeDeprecations !== false || item.type !== 'deprecation') &&
        (input.includeSecurity !== false || item.type !== 'security')
    ),
    sourceLinks: [
      SOURCES.knownIssues,
      ...(input.includeStatus === false ? [] : [SOURCES.status])
    ],
    message: notices.length ? notices.join(' ') : undefined
  };
}

export async function getKnownIssues(
  input: {
    includeStatus?: boolean;
    includeDeprecations?: boolean;
    includeSecurity?: boolean;
  },
  fetcher: typeof fetch = fetch
) {
  if (fetcher !== fetch) return loadKnownIssues(input, fetcher);
  const ttl = Number(process.env.CACHE_TTL_SECONDS ?? 3600);
  return cache.getOrSet(`known-issues:${JSON.stringify(input)}`, ttl, () =>
    loadKnownIssues(input, fetcher)
  );
}

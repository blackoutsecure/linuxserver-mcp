import { SOURCES } from '../constants.js';
import type { Image } from '../types.js';
import { cache } from './cache.js';

export function normalizeImageName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^(lscr\.io|ghcr\.io|docker\.io)\//, '')
    .replace(/^linuxserver\//, '')
    .split(':')[0];
}

const strings = (value: unknown, objectKey?: string): string[] | undefined => {
  if (typeof value === 'string')
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (objectKey && typeof item === 'object' && item) {
        const nested = (item as Record<string, unknown>)[objectKey];
        return typeof nested === 'string' ? nested : undefined;
      }
      return undefined;
    })
    .filter((item): item is string => Boolean(item));
};

export function normalizeApiImage(raw: Record<string, unknown>): Image | null {
  const nameValue = raw.name ?? raw.image_name ?? raw.slug;
  if (typeof nameValue !== 'string' || !nameValue.trim()) return null;
  const name = normalizeImageName(nameValue);
  return {
    name,
    displayName:
      typeof raw.display_name === 'string' ? raw.display_name : undefined,
    description:
      typeof raw.description === 'string' ? raw.description : undefined,
    logoUrl:
      typeof raw.project_logo === 'string' ? raw.project_logo : undefined,
    architectures: strings(raw.architectures ?? raw.architecture, 'arch'),
    tags: strings(raw.tags, 'tag'),
    categories: strings(raw.categories ?? raw.category),
    latestVersion:
      typeof (raw.latest_version ?? raw.version) === 'string'
        ? String(raw.latest_version ?? raw.version)
        : undefined,
    firstBuild:
      typeof (raw.first_build ?? raw.initial_date) === 'string'
        ? String(raw.first_build ?? raw.initial_date)
        : undefined,
    lastBuild:
      typeof (raw.last_build ?? raw.version_timestamp) === 'string'
        ? String(raw.last_build ?? raw.version_timestamp)
        : undefined,
    sourceLinks: [
      SOURCES.catalog,
      `https://docs.linuxserver.io/images/docker-${name}/`,
      ...(typeof raw.github_url === 'string' ? [raw.github_url] : [])
    ]
  };
}

export async function fetchImages(
  fetcher: typeof fetch = fetch
): Promise<Image[]> {
  const baseUrl = process.env.LSIO_API_BASE_URL ?? 'https://api.linuxserver.io';
  const ttl = Number(process.env.CACHE_TTL_SECONDS ?? 3600);
  return cache.getOrSet('images', ttl, async () => {
    try {
      const response = await fetcher(
        `${baseUrl.replace(/\/$/, '')}/api/v1/images`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'linuxserver-mcp-registry/0.1.0'
          }
        }
      );
      if (!response.ok) return [];
      const body = (await response.json()) as unknown;
      const records = Array.isArray(body)
        ? body
        : typeof body === 'object' && body
          ? (((body as any).data?.repositories?.linuxserver as unknown) ??
            (body as Record<string, unknown>).data ??
            (body as Record<string, unknown>).images)
          : [];
      return Array.isArray(records)
        ? records
            .map((record) =>
              typeof record === 'object' && record
                ? normalizeApiImage(record as Record<string, unknown>)
                : null
            )
            .filter((image): image is Image => image !== null)
        : [];
    } catch {
      return [];
    }
  });
}

export async function searchImages(input: {
  query?: string;
  category?: string;
  architecture?: string;
  tag?: string;
  limit?: number;
}) {
  const images = await fetchImages();
  const query = normalizeImageName(input.query ?? '');
  const score = (image: Image) => {
    const name = normalizeImageName(image.name);
    if (!query) return 1;
    if (name === query) return 100;
    if (name.startsWith(query)) return 75;
    const text = [
      name,
      image.displayName,
      image.description,
      ...(image.categories ?? []),
      ...(image.tags ?? [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text.includes(query) ? 25 : 0;
  };
  const results = images
    .filter((image) => score(image) > 0)
    .filter(
      (image) =>
        !input.category ||
        image.categories?.some(
          (value) => value.toLowerCase() === input.category!.toLowerCase()
        )
    )
    .filter(
      (image) =>
        !input.architecture || image.architectures?.includes(input.architecture)
    )
    .filter((image) => !input.tag || image.tags?.includes(input.tag))
    .sort(
      (left, right) =>
        score(right) - score(left) ||
        (right.lastBuild ?? '').localeCompare(left.lastBuild ?? '')
    )
    .slice(0, input.limit ?? 20);
  return {
    query: input.query,
    results,
    sourceLinks: [SOURCES.api, SOURCES.catalog]
  };
}

export async function getImage(imageName: string) {
  const normalized = normalizeImageName(imageName);
  const result = await searchImages({ query: normalized, limit: 10 });
  const image = result.results.find(
    (candidate) => normalizeImageName(candidate.name) === normalized
  );
  return {
    found: Boolean(image),
    image: image
      ? {
          ...image,
          links: {
            catalog: SOURCES.catalog,
            docs: `https://docs.linuxserver.io/images/docker-${image.name}/`,
            github: `https://github.com/linuxserver/docker-${image.name}`,
            registry: `https://lscr.io/linuxserver/${image.name}`
          }
        }
      : undefined,
    sourceLinks: result.sourceLinks
  };
}

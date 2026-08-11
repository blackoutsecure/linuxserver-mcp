import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auditCompose, auditImage } from '../services/audit-rules.js';
import { searchImageRequests } from '../services/github-discussions.js';
import { parseKnownIssuesHtml } from '../services/known-issues.js';
import {
  normalizeApiImage,
  normalizeImageName
} from '../services/linuxserver-api.js';
import { imagePipeline } from '../tools.js';

const imageResponse = [
  {
    name: 'sonarr',
    architectures: ['x86_64', 'arm64'],
    categories: ['Media'],
    tags: ['latest'],
    last_build: '2026-08-01'
  }
];

describe('image normalization', () => {
  it('removes known registries, namespace, and tag', () => {
    expect(normalizeImageName('lscr.io/linuxserver/Sonarr:latest')).toBe(
      'sonarr'
    );
    expect(normalizeImageName('ghcr.io/linuxserver/radarr')).toBe('radarr');
  });

  it('normalizes API response fields without fabricating data', () => {
    expect(normalizeApiImage(imageResponse[0])).toMatchObject({
      name: 'sonarr',
      architectures: ['x86_64', 'arm64'],
      categories: ['Media'],
      tags: ['latest'],
      lastBuild: '2026-08-01'
    });
    expect(normalizeApiImage({ description: 'missing name' })).toBeNull();
  });

  it('normalizes the current LinuxServer.io API record shape', () => {
    expect(
      normalizeApiImage({
        name: 'sonarr',
        initial_date: '2015-01-01',
        version: '4.0.0-ls1',
        version_timestamp: '2026-08-01 00:00:00+00:00',
        category: 'Media,Video',
        tags: [{ tag: 'latest', desc: 'Stable releases' }],
        architectures: [
          { arch: 'x86_64', tag: 'amd64-latest' },
          { arch: 'arm64', tag: 'arm64v8-latest' }
        ]
      })
    ).toMatchObject({
      name: 'sonarr',
      categories: ['Media', 'Video'],
      tags: ['latest'],
      architectures: ['x86_64', 'arm64'],
      latestVersion: '4.0.0-ls1',
      firstBuild: '2015-01-01',
      lastBuild: '2026-08-01 00:00:00+00:00'
    });
  });
});

describe('known issue parsing', () => {
  it('shapes typed issue history without guessing missing fields', () => {
    const items = parseKnownIssuesHtml(
      '<a href="https://info.linuxserver.io/issues/2026-07-16-example/"><small data-date="2026-07-16T22:00:00Z">date</small><h3>Example Deprecation Notice ℹ</h3></a>'
    );
    expect(items[0]).toMatchObject({
      title: 'Example Deprecation Notice',
      type: 'deprecation',
      lastUpdated: '2026-07-16T22:00:00Z'
    });
  });
});

describe('safe audit parsing', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(imageResponse), { status: 200 })
        )
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('detects Compose persistence, identity, restart, and risky mounts', async () => {
    const result = await auditImage({
      imageName: 'sonarr',
      composeYaml:
        'services:\n  sonarr:\n    image: lscr.io/linuxserver/sonarr\n    environment:\n      PUID: "1000"\n      PGID: "1000"\n      TZ: UTC\n    volumes:\n      - ./config:/config\n      - /var/run/docker.sock:/var/run/docker.sock\n    restart: unless-stopped'
    });
    expect(
      result.checks.find((check) => check.id === 'config-volume')?.status
    ).toBe('pass');
    expect(
      result.checks.find((check) => check.id === 'docker-socket')?.status
    ).toBe('warn');
  });

  it('detects docker run flags as text only', async () => {
    const result = await auditImage({
      imageName: 'sonarr',
      dockerRunCommand:
        'docker run --privileged -e PUID=1000 -e PGID=1000 -v ./config:/config lscr.io/linuxserver/sonarr'
    });
    expect(
      result.checks.find((check) => check.id === 'privileged')?.status
    ).toBe('warn');
    expect(result.checks.find((check) => check.id === 'timezone')?.status).toBe(
      'warn'
    );
  });

  it('finds LinuxServer.io Compose services and warns when none exist', async () => {
    const found = await auditCompose(
      'services:\n  app:\n    image: linuxserver/sonarr'
    );
    expect(found.services[0].serviceName).toBe('app');
    const absent = await auditCompose(
      'services:\n  app:\n    image: example/app'
    );
    expect(absent).toMatchObject({ services: [], overall: 'warn' });
  });

  it('audits each matching service configuration in multi-service Compose text', async () => {
    const result = await auditCompose(
      'services:\n  first:\n    image: linuxserver/sonarr\n  second:\n    image: linuxserver/radarr\n    environment:\n      PUID: "1000"\n      PGID: "1000"\n      TZ: UTC\n    volumes:\n      - ./config:/config\n    restart: unless-stopped'
    );
    expect(
      result.services[1].audit.checks.find(
        (check) => check.id === 'config-volume'
      )?.status
    ).toBe('pass');
  });
});

describe('GitHub request shaping', () => {
  beforeEach(() => vi.stubEnv('GITHUB_TOKEN', 'test-token'));
  afterEach(() => vi.unstubAllEnvs());
  const fetcher = (closed: boolean) =>
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              repository: {
                discussionCategories: {
                  nodes: [{ id: 'category-id', slug: 'image-requests' }]
                }
              }
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              repository: {
                discussions: {
                  nodes: [
                    {
                      title: 'Request Sonarr',
                      url: 'https://github.com/orgs/linuxserver/discussions/1',
                      closed,
                      createdAt: '2026-01-01',
                      updatedAt: '2026-02-01',
                      upvoteCount: 3,
                      comments: { totalCount: 2 },
                      author: { login: 'person' }
                    }
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null }
                }
              }
            }
          }),
          { status: 200 }
        )
      ) as unknown as typeof fetch;

  it('shapes open request results', async () => {
    const output = await searchImageRequests(
      { query: 'sonarr', status: 'open' },
      fetcher(false)
    );
    expect(output.results[0]).toMatchObject({
      status: 'open',
      requestInterpretation: 'possible_duplicate',
      communitySignals: { isDuplicateCandidate: true }
    });
  });

  it('shapes closed request results with review guidance', async () => {
    const output = await searchImageRequests(
      { query: 'sonarr', status: 'closed' },
      fetcher(true)
    );
    expect(output.results[0]).toMatchObject({
      status: 'closed',
      requestInterpretation: 'closed_request_found'
    });
  });

  it('parses public discussion pages when no token is available', async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    const html = `<ul><li class="Box-row"><button aria-label="Upvote: 2">2</button><a data-hovercard-type="discussion" href="/orgs/linuxserver/discussions/145">BookOrbit</a><a aria-label="diveroptic (author)">diveroptic</a><relative-time datetime="2026-07-26T01:23:31Z"></relative-time><a aria-label="0 comments: diveroptic">0</a></li></ul>`;
    const output = await searchImageRequests(
      { query: 'BookOrbit', status: 'open' },
      vi
        .fn()
        .mockResolvedValue(new Response(html, { status: 200 })) as typeof fetch
    );
    expect(output).toMatchObject({
      searchLimited: false,
      results: [
        {
          title: 'BookOrbit',
          status: 'open',
          comments: 0,
          communitySignals: { upvotes: 2 }
        }
      ]
    });
  });
});

describe('pipeline recommendations', () => {
  it('prioritizes an existing image', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(imageResponse), { status: 200 })
        )
    );
    const output = await imagePipeline({
      imageName: 'sonarr',
      searchOpenRequests: false,
      searchClosedRequests: false,
      checkKnownIssues: false
    });
    expect(output.recommendation).toBe('image_already_exists');
    vi.unstubAllGlobals();
  });

  it('does not recommend a new request when GitHub history is unavailable', async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network unavailable'))
    );
    const output = await imagePipeline({ imageName: 'definitely-new-app' });
    expect(output.recommendation).toBe('not_enough_information');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

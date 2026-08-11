import { SOURCES } from '../constants.js';

const links = [
  {
    title: 'Documentation',
    url: SOURCES.docs,
    purpose: 'Container and project documentation'
  },
  {
    title: 'API documentation',
    url: SOURCES.api,
    purpose: 'Machine-readable image API reference'
  },
  {
    title: 'Image catalog',
    url: SOURCES.catalog,
    purpose: 'Browse published container images'
  },
  {
    title: 'Images by category',
    url: SOURCES.categories,
    purpose: 'Browse images by category'
  },
  {
    title: 'Known issues',
    url: SOURCES.knownIssues,
    purpose: 'Review notices, deprecations, and security context'
  },
  {
    title: 'Status dashboard',
    url: SOURCES.status,
    purpose: 'Check LinuxServer.io service health'
  },
  {
    title: 'Support',
    url: SOURCES.support,
    purpose: 'Find official community support channels'
  },
  {
    title: 'Donate',
    url: SOURCES.donate,
    purpose: 'Support LinuxServer.io infrastructure'
  },
  {
    title: 'GitHub organization',
    url: SOURCES.github,
    purpose: 'Browse LinuxServer.io source repositories'
  },
  {
    title: 'Image requests',
    url: SOURCES.requests,
    purpose: 'Search open and closed image request discussions'
  }
];

export function getSupportLinks(
  context: 'docs' | 'support' | 'donate' | 'status' | 'all' = 'all'
) {
  if (context === 'all') return { links };
  const terms: Record<Exclude<typeof context, 'all'>, string[]> = {
    docs: [
      'Documentation',
      'API documentation',
      'Image catalog',
      'Images by category'
    ],
    support: ['Support', 'Known issues'],
    donate: ['Donate'],
    status: ['Status dashboard']
  };
  return { links: links.filter((link) => terms[context].includes(link.title)) };
}

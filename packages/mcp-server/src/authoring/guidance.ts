/**
 * LinuxServer.io MCP Server
 * Module: Shared LSIO guidance links, best-practice checklists, and skillset profiles
 * Standards basis: LSIO docs, support policy, and community workflow guidance
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */

export type GuidanceTopic =
  | 'all'
  | 'base-image'
  | 'permissions'
  | 'read-only'
  | 'support'
  | 'compose'
  | 'branding';

export type BestPracticeProfile =
  | 'all'
  | 'docker'
  | 'permissions'
  | 'filesystem'
  | 'docs'
  | 'review'
  | 'skillsets';

export type SkillsetProfile =
  'all' | 'discovery' | 'maintenance' | 'review' | 'release' | 'docs';
export type OptimizationScope =
  'all' | 'server' | 'image' | 'release' | 'quality';

type Skillset = {
  id: Exclude<SkillsetProfile, 'all'>;
  name: string;
  goal: string;
  checks: string[];
  references: string[];
};

const LSIO_LINKS = {
  site: 'https://www.linuxserver.io/',
  images: 'https://www.linuxserver.io/our-images',
  docs: 'https://docs.linuxserver.io/',
  api: 'https://docs.linuxserver.io/API/',
  faq: 'https://docs.linuxserver.io/FAQ/',
  ci: 'https://ci.linuxserver.io/',
  discord: 'https://linuxserver.io/discord',
  forums: 'https://discourse.linuxserver.io/',
  nonRoot: 'https://docs.linuxserver.io/misc/non-root/',
  readOnly: 'https://docs.linuxserver.io/misc/read-only/',
  supportPolicy: 'https://docs.linuxserver.io/misc/support-policy/',
  compose: 'https://docs.linuxserver.io/general/docker-compose/',
  branding: 'https://docs.linuxserver.io/general/container-branding/',
  execution: 'https://docs.linuxserver.io/general/container-execution/',
  puidPgid: 'https://docs.linuxserver.io/general/understanding-puid-and-pgid/'
} as const;

const LINKS_BY_TOPIC: Record<
  Exclude<GuidanceTopic, 'all'>,
  Partial<typeof LSIO_LINKS>
> = {
  'base-image': {
    site: LSIO_LINKS.site,
    docs: LSIO_LINKS.docs,
    execution: LSIO_LINKS.execution
  },
  permissions: { nonRoot: LSIO_LINKS.nonRoot, puidPgid: LSIO_LINKS.puidPgid },
  'read-only': { readOnly: LSIO_LINKS.readOnly },
  support: {
    faq: LSIO_LINKS.faq,
    supportPolicy: LSIO_LINKS.supportPolicy,
    discord: LSIO_LINKS.discord,
    forums: LSIO_LINKS.forums,
    ci: LSIO_LINKS.ci
  },
  compose: { compose: LSIO_LINKS.compose, execution: LSIO_LINKS.execution },
  branding: { branding: LSIO_LINKS.branding }
};

const BEST_PRACTICES = {
  docker: [
    'Use LSIO base image patterns and s6-overlay-compatible service assumptions.',
    'Keep generated Dockerfile snippets aligned with LSIO repo and runtime conventions.',
    'Provide practical compose/run examples for users and maintainers.'
  ],
  permissions: [
    'Document and support PUID/PGID-based runtime permissions.',
    'Prefer non-root guidance patterns from LSIO docs when describing security posture.'
  ],
  filesystem: [
    'Represent /config as persistent storage in examples.',
    'Account for /app and /defaults conventions in scaffolded guidance.',
    'When read-only mode is discussed, document writable exceptions and volume expectations.'
  ],
  docs: [
    'Use LSIO docs as authoritative references in generated guidance.',
    'Avoid claiming official LSIO endorsement unless explicitly approved.',
    'Prefer concise, actionable documentation over generic narrative.'
  ],
  review: [
    'Run validation first, then scaffold generation.',
    'Check for LSIO alignment in base image, permissions, directories, and compose examples.',
    'Keep comments/headers concise with purpose, standards basis, and approval status where applicable.',
    'Use available task-relevant skills/tools; otherwise fall back to LSIO references.'
  ],
  skillsets: [
    'Image discovery: map requests to official LSIO images before proposing custom images.',
    'Image maintenance: validate upstream changes and docs impact before scaffold updates.',
    'Image review: verify base image assumptions, required directories, PUID/PGID, and compose clarity.',
    'Release readiness: run npm release checks and package dry-run before publishing.'
  ]
} as const;

const SKILLSETS: Skillset[] = [
  {
    id: 'discovery',
    name: 'Image Discovery',
    goal: 'Confirm official LSIO support before custom image planning.',
    checks: [
      'Search official image catalog first.',
      'Confirm naming and branding expectations.',
      'Capture links to upstream docs before scaffold proposals.'
    ],
    references: [LSIO_LINKS.images, LSIO_LINKS.site, LSIO_LINKS.branding]
  },
  {
    id: 'maintenance',
    name: 'Image Maintenance',
    goal: 'Keep templates and validation synchronized with upstream and LSIO guidance.',
    checks: [
      'Track upstream app changes and dependency updates.',
      'Re-check base image and runtime assumptions.',
      'Confirm docs references remain current.'
    ],
    references: [LSIO_LINKS.docs, LSIO_LINKS.execution, LSIO_LINKS.api]
  },
  {
    id: 'review',
    name: 'Image Review',
    goal: 'Run a deterministic LSIO checklist before merge/release.',
    checks: [
      'Validate naming, ports, and required directories.',
      'Verify PUID/PGID and non-root posture guidance.',
      'Check read-only and volume guidance for filesystem behavior.'
    ],
    references: [
      LSIO_LINKS.puidPgid,
      LSIO_LINKS.nonRoot,
      LSIO_LINKS.readOnly,
      LSIO_LINKS.compose
    ]
  },
  {
    id: 'release',
    name: 'Release Readiness',
    goal: 'Ensure publish artifacts are tested and support policy language is accurate.',
    checks: [
      'Run npm build and tests.',
      'Run release check and package dry-run.',
      'Keep support links and policy references accurate in README outputs.'
    ],
    references: [LSIO_LINKS.supportPolicy, LSIO_LINKS.faq, LSIO_LINKS.ci]
  },
  {
    id: 'docs',
    name: 'Documentation',
    goal: 'Maintain concise README-first guidance aligned to LSIO standards.',
    checks: [
      'Keep user-facing docs in README unless maintainers request otherwise.',
      'Link to official LSIO docs for policy-sensitive guidance.',
      'Avoid claiming official LSIO endorsement without maintainer confirmation.'
    ],
    references: [
      LSIO_LINKS.docs,
      LSIO_LINKS.supportPolicy,
      'https://github.com/mcp'
    ]
  }
];

const OPTIMIZATION_IDEAS: Record<
  Exclude<OptimizationScope, 'all'>,
  string[]
> = {
  server: [
    'Add JSON schema versioning in tool responses to keep clients backward-compatible.',
    'Add optional strict mode that escalates policy warnings to failures for CI gates.',
    'Add deterministic tool output IDs for easier audit trail correlation across runs.'
  ],
  image: [
    'Run lsio.audit_image_compliance on every PR with candidate Dockerfile/Compose artifacts.',
    'Require explicit read-only posture declaration and writable-path exception notes.',
    'Keep generated compose snippets synchronized with docs examples for each image profile.'
  ],
  release: [
    'Use release check plus package dry-run as required pre-publish status checks.',
    'Add changelog summary generation from validation/audit deltas before release tags.',
    'Gate releases on official image lookup plus compliance score thresholds.'
  ],
  quality: [
    'Expand tests to include network-fallback behavior via mocked fetch adapters.',
    'Add snapshot tests for tool payload contracts to prevent accidental schema drift.',
    'Track frequently failing recommendations to tune validator severity over time.'
  ]
};

export function getGuidanceLinks(
  topic: GuidanceTopic
): Partial<typeof LSIO_LINKS> {
  if (topic === 'all') {
    return LSIO_LINKS;
  }

  return LINKS_BY_TOPIC[topic];
}

export function getBestPractices(
  profile: BestPracticeProfile
): Record<string, readonly string[]> {
  if (profile === 'all') {
    return BEST_PRACTICES;
  }

  return { [profile]: BEST_PRACTICES[profile] };
}

export function getSkillsets(profile: SkillsetProfile): {
  skillsets: Skillset[];
} {
  if (profile === 'all') {
    return { skillsets: SKILLSETS };
  }

  return { skillsets: SKILLSETS.filter((skillset) => skillset.id === profile) };
}

export function getOptimizationIdeas(
  scope: OptimizationScope
): Record<string, string[]> {
  if (scope === 'all') {
    return OPTIMIZATION_IDEAS;
  }

  return { [scope]: OPTIMIZATION_IDEAS[scope] };
}

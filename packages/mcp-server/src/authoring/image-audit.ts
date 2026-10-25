/**
 * LinuxServer.io MCP Server
 * Module: Official image discovery and LSIO compliance audit helpers
 * Standards basis: LSIO image catalog, docs references, and validation/scaffold conventions
 * Approval status: Community-aligned implementation; verify with LSIO maintainers for official acceptance
 */
import { getImage, normalizeImageName } from '../services/linuxserver-api.js';
import { AnalysisError } from '../core/schemas.js';
import { fetchPublicText } from '../services/public-http.js';
import { scaffoldLsioService } from './scaffold.js';
import type {
  ComplianceAuditInput,
  ComplianceAuditResult,
  ComplianceCheck,
  OfficialImageLookupResult,
  ServiceSpec
} from './types.js';
import { validateLsioSpec } from './validation.js';

const LSIO_IMAGES_LISTING_URL = 'https://www.linuxserver.io/our-images';
const LSIO_IMAGE_DOCS_BASE = 'https://docs.linuxserver.io/images/docker-';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getOfficialDocsUrl(imageName: string): string {
  const normalized = normalizeImageName(imageName);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    throw new AnalysisError(
      'VALIDATION_FAILED',
      'An image reference must resolve to a single valid image name.'
    );
  }
  return `${LSIO_IMAGE_DOCS_BASE}${normalized}/`;
}

export function detectImageInCatalogHtml(
  html: string,
  imageName: string
): boolean {
  const normalizedName = normalizeImageName(imageName);
  const escapedName = escapeRegExp(normalizedName);
  const imagePathRegex = new RegExp(
    `/images/docker-${escapedName}(?:/|\\"|')`,
    'i'
  );
  const tableCellRegex = new RegExp(`\\|\\s*\\|\\s*${escapedName}\\s*\\|`, 'i');
  const genericTextRegex = new RegExp(
    `(?:^|[^a-z0-9_-])${escapedName}(?:[^a-z0-9_-]|$)`,
    'i'
  );
  return (
    imagePathRegex.test(html) ||
    tableCellRegex.test(html) ||
    genericTextRegex.test(html)
  );
}

function detectDocsSignals(
  content: string
): NonNullable<OfficialImageLookupResult['docsSignals']> {
  const text = content.toLowerCase();
  return {
    hasPuidPgid: text.includes('puid') && text.includes('pgid'),
    hasConfigPath: text.includes('/config'),
    hasComposeSection:
      text.includes('docker compose') || text.includes('docker-compose'),
    hasReadOnlyGuidance:
      text.includes('read-only') || text.includes('read only')
  };
}

export async function lookupOfficialLsioImage(
  imageName: string
): Promise<OfficialImageLookupResult> {
  const normalizedName = normalizeImageName(imageName);
  const docsUrl = getOfficialDocsUrl(normalizedName);
  const notes: string[] = [];
  const checkedAt = new Date().toISOString();

  const metadata = await getImage(normalizedName);
  const result: OfficialImageLookupResult = {
    imageName: normalizedName,
    exists: metadata.found,
    listingUrl: LSIO_IMAGES_LISTING_URL,
    docsUrl,
    checkedAt,
    notes
  };
  if (!metadata.found) {
    notes.push(
      'No matching image was found in the available structured LinuxServer API catalogue. Historical coverage may be incomplete.'
    );
    return result;
  }
  notes.push(
    'Image found in the structured LinuxServer API catalogue; HTML is not used to infer official image existence.'
  );
  try {
    result.docsSignals = detectDocsSignals(
      await fetchPublicText(docsUrl, 'html', 1_000_000)
    );
    notes.push(
      'Documentation signals describe detected text, not verified capability support.'
    );
  } catch (error) {
    if (!(error instanceof AnalysisError)) throw error;
    notes.push(
      `${error.code}: Optional documentation signals are unavailable; catalogue existence is unchanged.`
    );
  }
  return result;
}

function hasPuidPgidSupport(...artifacts: Array<string | undefined>): boolean {
  const merged = artifacts.filter(Boolean).join('\n').toLowerCase();
  return merged.includes('puid') && merged.includes('pgid');
}

function hasRequiredPaths(dockerfile: string | undefined): boolean {
  if (!dockerfile) {
    return false;
  }

  const normalized = dockerfile.toLowerCase();
  return (
    normalized.includes('/config') &&
    normalized.includes('/app') &&
    normalized.includes('/defaults')
  );
}

function hasConfigVolume(...artifacts: Array<string | undefined>): boolean {
  return artifacts.filter(Boolean).join('\n').toLowerCase().includes('/config');
}

function evaluateCheck(
  id: string,
  ok: boolean,
  passMessage: string,
  failMessage: string
): ComplianceCheck {
  return {
    id,
    status: ok ? 'pass' : 'fail',
    message: ok ? passMessage : failMessage
  };
}

function scoreChecks(checks: ComplianceCheck[]): number {
  if (checks.length === 0) {
    return 0;
  }

  const total = checks.reduce((sum, check) => {
    if (check.status === 'pass') {
      return sum + 1;
    }

    if (check.status === 'warning') {
      return sum + 0.5;
    }

    return sum;
  }, 0);

  return Math.round((total / checks.length) * 100);
}

function buildRecommendations(
  checks: ComplianceCheck[],
  validationWarnings: string[]
): string[] {
  const recommendations: string[] = [];

  for (const check of checks) {
    if (check.status === 'pass') {
      continue;
    }

    if (check.id === 'lsio-base-image') {
      recommendations.push(
        'Use an LSIO base image tag (for example lscr.io/linuxserver/baseimage-alpine or baseimage-ubuntu).'
      );
    }

    if (check.id === 'required-directories') {
      recommendations.push(
        'Ensure scaffold includes /config, /app, and /defaults paths in build/runtime setup.'
      );
    }

    if (check.id === 'puid-pgid') {
      recommendations.push(
        'Add PUID/PGID environment handling in Dockerfile, Compose, and docs examples.'
      );
    }

    if (check.id === 'config-volume') {
      recommendations.push(
        'Expose /config as persistent volume and document the mapping in compose examples.'
      );
    }

    if (check.id === 'healthcheck') {
      recommendations.push(
        'Add a container HEALTHCHECK (or disable intentionally with documented rationale).'
      );
    }

    if (check.id === 'read-only') {
      recommendations.push(
        'For read-only mode, include read_only: true with writable tmpfs/volume exceptions.'
      );
    }

    if (check.id === 's6-service-layout') {
      recommendations.push(
        'Add s6-overlay service layout paths (for example /etc/s6-overlay/s6-rc.d/<service>) for LSIO-style startup.'
      );
    }
  }

  for (const warning of validationWarnings) {
    recommendations.push(`Resolve spec warning: ${warning}`);
  }

  return [...new Set(recommendations)];
}

export function auditImageCompliance(
  input: ComplianceAuditInput,
  officialImage?: OfficialImageLookupResult
): ComplianceAuditResult {
  const validation = validateLsioSpec(input as ServiceSpec);
  const validationErrors = validation.issues.filter(
    (issue) => issue.level === 'error'
  );
  const validationWarnings = validation.issues
    .filter((issue) => issue.level === 'warning')
    .map((issue) => issue.message);

  const artifactJoined = [
    input.candidateDockerfile,
    input.candidateCompose,
    input.candidateReadme
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  const hasArtifacts = artifactJoined.length > 0;
  const dockerfile = input.candidateDockerfile;

  const checks: ComplianceCheck[] = [];

  checks.push(
    evaluateCheck(
      'spec-valid',
      validationErrors.length === 0,
      'Spec passed LSIO baseline validation.',
      `Spec has validation errors: ${validationErrors.map((issue) => issue.code).join(', ')}`
    )
  );

  checks.push(
    evaluateCheck(
      'lsio-base-image',
      !dockerfile || dockerfile.includes('lscr.io/linuxserver/baseimage-'),
      'Dockerfile base image appears LSIO-aligned.',
      'Dockerfile does not appear to use an LSIO base image pattern.'
    )
  );

  checks.push(
    evaluateCheck(
      'required-directories',
      !dockerfile || hasRequiredPaths(dockerfile),
      'Required LSIO directory paths were detected.',
      'Could not verify required LSIO paths (/config, /app, /defaults) in Dockerfile.'
    )
  );

  checks.push(
    evaluateCheck(
      'puid-pgid',
      !hasArtifacts ||
        hasPuidPgidSupport(
          input.candidateDockerfile,
          input.candidateCompose,
          input.candidateReadme
        ),
      'PUID/PGID support was detected in provided artifacts.',
      'PUID/PGID support was not detected in provided artifacts.'
    )
  );

  checks.push(
    evaluateCheck(
      'config-volume',
      !hasArtifacts ||
        hasConfigVolume(
          input.candidateDockerfile,
          input.candidateCompose,
          input.candidateReadme
        ),
      'Persistent /config path was detected in provided artifacts.',
      'Persistent /config path was not detected in provided artifacts.'
    )
  );

  if (input.includeHealthcheck !== false) {
    checks.push(
      evaluateCheck(
        'healthcheck',
        !dockerfile || dockerfile.toLowerCase().includes('healthcheck'),
        'Healthcheck support was detected or will be scaffolded.',
        'Healthcheck was expected but not detected in Dockerfile.'
      )
    );
  }

  if (input.readOnlyRootFs) {
    const readOnlyDetected =
      input.candidateCompose?.toLowerCase().includes('read_only: true') ||
      input.candidateCompose?.toLowerCase().includes('tmpfs');

    checks.push(
      evaluateCheck(
        'read-only',
        Boolean(readOnlyDetected),
        'Read-only runtime hints were detected in compose artifact.',
        'readOnlyRootFs is enabled but compose hints (read_only/tmpfs) were not detected.'
      )
    );
  }

  checks.push(
    evaluateCheck(
      's6-service-layout',
      !dockerfile || dockerfile.includes('/etc/s6-overlay/s6-rc.d'),
      's6-overlay service layout paths were detected.',
      'Could not verify s6-overlay service layout paths in Dockerfile.'
    )
  );

  if (!hasArtifacts) {
    checks.push({
      id: 'artifact-coverage',
      status: 'warning',
      message:
        'No candidate Dockerfile/Compose/README provided; checks are spec-only with limited artifact verification.'
    });
  }

  if (officialImage && !officialImage.exists) {
    checks.push({
      id: 'official-image',
      status: 'warning',
      message:
        'Image was not confirmed in the official LSIO catalog during lookup.'
    });
  }

  const score = scoreChecks(checks);
  const recommendations = buildRecommendations(checks, validationWarnings);

  let remediation;
  if (validationErrors.length === 0) {
    remediation = scaffoldLsioService(input as ServiceSpec);
  }

  const result: ComplianceAuditResult = {
    guidanceBasis: 'project_recommendation',
    disclaimer:
      'This opinionated project checklist is not official LinuxServer.io policy, acceptance, or security certification. Verify image-specific capabilities before applying recommendations.',
    score,
    summary:
      score >= 90
        ? 'Strong LSIO alignment.'
        : score >= 70
          ? 'Partially aligned; improvements recommended.'
          : 'Needs significant alignment work.',
    checks,
    recommendations
  };

  if (remediation) {
    result.remediation = remediation;
  }

  if (officialImage) {
    result.officialImage = officialImage;
  }

  return result;
}

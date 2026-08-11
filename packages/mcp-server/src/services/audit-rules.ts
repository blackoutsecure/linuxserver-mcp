import { parse } from 'yaml';
import { DISCLAIMER, SOURCES } from '../constants.js';
import type { AuditCheck, AuditOutput } from '../types.js';
import { getImage, normalizeImageName } from './linuxserver-api.js';

const pass = (id: string, title: string, message: string): AuditCheck => ({
  id,
  title,
  status: 'pass',
  message
});
const warn = (id: string, title: string, message: string): AuditCheck => ({
  id,
  title,
  status: 'warn',
  message
});

function parseRun(command: string) {
  const volumes = [
    ...command.matchAll(
      /(?:^|\s)(?:-v|--volume)(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+))/g
    )
  ].map((match) => match[1] ?? match[2] ?? match[3]);
  const env = [
    ...command.matchAll(
      /(?:^|\s)(?:-e|--env)(?:=|\s+)([A-Za-z_][A-Za-z0-9_]*)/g
    )
  ].map((match) => match[1]);
  return {
    volumes,
    env,
    privileged: /(?:^|\s)--privileged(?:\s|$)/.test(command),
    hostNetwork: /--network(?:=|\s+)host/.test(command),
    publicPorts: /(?:^|\s)(?:-p|--publish)(?:=|\s+)(?:0\.0\.0\.0:|\d)/.test(
      command
    ),
    image: command
      .match(/(?:^|\s)(?:lscr\.io\/|ghcr\.io\/)?linuxserver\/[^\s]+/)?.[0]
      ?.trim()
  };
}

export async function auditImage(input: {
  imageName: string;
  tag?: string;
  composeYaml?: string;
  dockerRunCommand?: string;
}): Promise<AuditOutput> {
  const checks: AuditCheck[] = [];
  const recommendations: string[] = [];
  const metadata = await getImage(input.imageName);
  checks.push(
    metadata.found
      ? pass(
          'image-exists',
          'Image exists',
          'The image appears in current LinuxServer.io image metadata.'
        )
      : {
          id: 'image-exists',
          title: 'Image exists',
          status: 'fail',
          message:
            'The image was not found in current LinuxServer.io image metadata.'
        }
  );

  let compose: any;
  if (input.composeYaml) {
    try {
      compose = parse(input.composeYaml);
    } catch {
      checks.push({
        id: 'compose-parse',
        title: 'Compose syntax',
        status: 'fail',
        message: 'The Compose YAML could not be parsed safely.'
      });
    }
  }
  const run = input.dockerRunCommand
    ? parseRun(input.dockerRunCommand)
    : undefined;
  const normalizedInput = normalizeImageName(input.imageName);
  const composeServices = Object.values(compose?.services ?? {}) as any[];
  const service =
    composeServices.find(
      (candidate) =>
        candidate?.image &&
        normalizeImageName(candidate.image) === normalizedInput
    ) ?? composeServices[0];
  const hasUsage = Boolean(service || run);
  const volumes: string[] = service
    ? (service.volumes ?? []).map((volume: unknown) =>
        typeof volume === 'string'
          ? volume
          : `${(volume as any).source}:${(volume as any).target}`
      )
    : (run?.volumes ?? []);
  const env = service
    ? Array.isArray(service.environment)
      ? service.environment.map((value: string) => value.split('=')[0])
      : Object.keys(service.environment ?? {})
    : (run?.env ?? []);
  const imageReference = service?.image ?? run?.image ?? input.imageName;

  checks.push(
    /^(?:(?:lscr\.io|ghcr\.io)\/)?linuxserver\//.test(imageReference) ||
      metadata.found
      ? pass(
          'image-reference',
          'Image reference',
          'The reference uses a recognized LinuxServer.io image pattern.'
        )
      : warn(
          'image-reference',
          'Image reference',
          'Use a documented LinuxServer.io registry and image reference when applicable.'
        )
  );

  if (hasUsage) {
    checks.push(
      volumes.some((volume) => volume.split(':')[1] === '/config')
        ? pass(
            'config-volume',
            '/config persistence',
            '/config is mapped to a host path or named volume.'
          )
        : warn(
            'config-volume',
            '/config persistence',
            'No /config mapping was detected; application configuration may not persist.'
          )
    );
    checks.push(
      env.includes('PUID') && env.includes('PGID')
        ? pass('user-mapping', 'PUID and PGID', 'PUID and PGID are present.')
        : warn(
            'user-mapping',
            'PUID and PGID',
            'Add PUID and PGID where supported to align container file ownership.'
          )
    );
    checks.push(
      env.includes('TZ')
        ? pass('timezone', 'Timezone', 'TZ is present.')
        : warn(
            'timezone',
            'Timezone',
            'TZ is recommended for predictable timestamps.'
          )
    );
    if (service)
      checks.push(
        service.restart
          ? pass('restart', 'Restart policy', 'A restart policy is configured.')
          : warn(
              'restart',
              'Restart policy',
              'Add restart: unless-stopped for a typical long-running service.'
            )
      );
  } else {
    checks.push({
      id: 'usage',
      title: 'Runtime configuration',
      status: 'not_applicable',
      message: 'No Compose YAML or docker run command was supplied.'
    });
  }

  const suspiciousVolume = volumes.find((volume) => {
    const [, target] = volume.split(':');
    return !target?.startsWith('/');
  });
  checks.push(
    suspiciousVolume
      ? warn(
          'volume-direction',
          'Volume direction',
          `The mapping ${suspiciousVolume} does not clearly follow host:container order.`
        )
      : pass(
          'volume-direction',
          'Volume direction',
          'Detected volume mappings follow host:container order.'
        )
  );
  const broadMount = volumes.find((volume) =>
    ['/', '/etc', '/home', '/var/run'].includes(volume.split(':')[0])
  );
  checks.push(
    broadMount
      ? warn(
          'broad-host-mount',
          'Broad host mount',
          `${broadMount} exposes a broad host path; narrow the mount where possible.`
        )
      : pass(
          'broad-host-mount',
          'Broad host mount',
          'No broad host filesystem mount was detected.'
        )
  );

  const text = `${input.composeYaml ?? ''}\n${input.dockerRunCommand ?? ''}`;
  const privileged = service?.privileged === true || run?.privileged;
  checks.push(
    privileged
      ? warn(
          'privileged',
          'Privileged mode',
          'Privileged mode grants broad host capabilities and should be justified.'
        )
      : pass(
          'privileged',
          'Privileged mode',
          'Privileged mode was not detected.'
        )
  );
  const tag = input.tag ?? imageReference.split(':').at(-1);
  const hasExplicitTag = imageReference.includes(':') || Boolean(input.tag);
  checks.push(
    !hasExplicitTag || tag === 'latest'
      ? warn(
          'image-tag',
          'Image tag',
          'The image uses an implicit or latest tag. Confirm that this update behavior is intentional.'
        )
      : pass(
          'image-tag',
          'Image tag',
          `The image tag is explicitly set to ${tag}.`
        )
  );
  checks.push(
    /\/var\/run\/docker\.sock/.test(text)
      ? warn(
          'docker-socket',
          'Docker socket',
          'A Docker socket mount grants powerful control of the host Docker daemon.'
        )
      : pass(
          'docker-socket',
          'Docker socket',
          'No Docker socket mount was detected.'
        )
  );
  checks.push(
    /DOCKER_MODS|\/custom-cont-init\.d|\/custom-services\.d/.test(text)
      ? warn(
          'custom-logic',
          'Custom container logic',
          'Docker Mods or custom init/service logic can affect supportability and security.'
        )
      : pass(
          'custom-logic',
          'Custom container logic',
          'No supported custom logic hooks were detected.'
        )
  );
  checks.push(
    service?.network_mode === 'host' || run?.hostNetwork
      ? warn(
          'host-network',
          'Host networking',
          'Host network mode reduces network isolation.'
        )
      : pass(
          'host-network',
          'Host networking',
          'Host network mode was not detected.'
        )
  );
  const hasPublishedPorts = Boolean(
    service?.ports?.length ||
    run?.publicPorts ||
    /(?:^|\s)(?:-p|--publish)/.test(text)
  );
  checks.push(
    hasPublishedPorts
      ? warn(
          'port-exposure',
          'Published ports',
          'Published ports may be reachable beyond the container network; verify each binding is required and appropriately restricted.'
        )
      : pass(
          'port-exposure',
          'Published ports',
          'No explicit host port publication was detected.'
        )
  );
  checks.push(
    /(?:FROM\s+.*linuxserver|LSIO_FIRST_PARTY)/i.test(text)
      ? warn(
          'branding-review',
          'Branding review',
          'Custom or downstream LinuxServer.io image behavior was detected. Review branding requirements, including whether LSIO_FIRST_PARTY=false applies.'
        )
      : {
          id: 'branding-review',
          title: 'Branding review',
          status: 'not_applicable',
          message:
            'No downstream image branding signal was detected in the submitted text.'
        }
  );
  if (hasPublishedPorts)
    recommendations.push(
      'Review every published port and limit public exposure with host firewall or reverse-proxy controls.'
    );
  if (/password|token|secret|api[_-]?key/i.test(text))
    checks.push(
      warn(
        'inline-secrets',
        'Sensitive values',
        'Possible secret-like values were detected; use an external secret mechanism and redact shared output.'
      )
    );
  recommendations.push(
    'Update by pulling the current image and recreating the container, for example with Docker Compose pull and up.'
  );
  recommendations.push(
    'For support, collect OS and Docker versions, inspect output, container logs, and resolved Compose config with sensitive values redacted.'
  );

  const failures = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  return {
    imageName: normalizeImageName(input.imageName),
    overall: failures ? 'fail' : warnings ? 'warn' : 'pass',
    score: Math.max(0, 100 - failures * 30 - warnings * 8),
    checks,
    recommendations,
    disclaimer: DISCLAIMER,
    sourceLinks: [SOURCES.docs, SOURCES.support]
  };
}

export async function auditCompose(composeYaml: string, imageName?: string) {
  let document: any;
  try {
    document = parse(composeYaml);
  } catch {
    return {
      services: [],
      overall: 'fail' as const,
      disclaimer: DISCLAIMER,
      message: 'Compose YAML could not be parsed safely.'
    };
  }
  const services = await Promise.all(
    Object.entries(document?.services ?? {})
      .filter(
        ([, config]: [string, any]) =>
          imageName ||
          /(?:lscr\.io\/|ghcr\.io\/)?linuxserver\//.test(config?.image ?? '')
      )
      .map(async ([serviceName, config]: [string, any]) => ({
        serviceName,
        image: config?.image,
        audit: await auditImage({
          imageName: imageName ?? config.image,
          composeYaml
        })
      }))
  );
  const overall = services.some((item) => item.audit.overall === 'fail')
    ? 'fail'
    : services.some((item) => item.audit.overall === 'warn') || !services.length
      ? 'warn'
      : 'pass';
  return { services, overall, disclaimer: DISCLAIMER };
}

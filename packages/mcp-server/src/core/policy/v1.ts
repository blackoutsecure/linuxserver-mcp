import {
  dockerInstructions,
  dockerEnvironmentValue,
  fileKind,
  finalDockerStage,
  generationMarkerLine,
  inspectionFrom,
  lineOf,
  normalizedArch,
  normalizedPort,
  type AuditContext
} from '../inspection.js';
import type { Evidence, Finding, PolicyRule } from '../models.js';
import { POLICY_VERSION, type CheckGroup } from '../schemas.js';

type Detection = {
  message: string;
  evidence: Evidence[];
  confidence?: Finding['confidence'];
};
export type PolicyCheck = {
  rule: PolicyRule;
  kinds: readonly string[];
  requires?: readonly CheckGroup[];
  evaluate: (context: AuditContext) => Detection[];
};
const builder = 'https://github.com/linuxserver/docker-jenkins-builder';
const docker = 'https://docs.docker.com/reference/dockerfile/';
const s6 =
  'https://github.com/just-containers/s6-overlay#writing-a-serviced-script';
const branding = 'https://docs.linuxserver.io/general/container-branding/';

function define(
  rule: Omit<PolicyRule, 'version' | 'severity' | 'suppressible'> &
    Partial<Pick<PolicyRule, 'severity' | 'suppressible'>>,
  kinds: readonly string[],
  evaluate: PolicyCheck['evaluate'],
  requires?: readonly CheckGroup[]
): PolicyCheck {
  return {
    rule: {
      version: POLICY_VERSION,
      severity: 'warning',
      suppressible: true,
      ...rule
    },
    kinds,
    evaluate,
    requires
  };
}

function documentedPorts(context: AuditContext): string[] | undefined {
  const metadata = context.readme?.value;
  if (!metadata || metadata.param_ports === undefined) return undefined;
  const fields = [...metadata.param_ports, ...(metadata.opt_param_ports ?? [])];
  const ports = fields.map(({ internal_port }) =>
    normalizedPort(internal_port)
  );
  return ports.length && ports.every((port) => port !== undefined)
    ? ports
    : undefined;
}

export const policyChecks: readonly PolicyCheck[] = [
  define(
    {
      id: 'LSIO-GENERATED-001',
      title: 'Generated file changed without its source',
      description:
        'A marked generated file changed while its repository source did not.',
      applicability:
        'Changed marked README/Jenkins outputs with an existing source file.',
      category: 'generated_files',
      classification: 'contextual',
      evidenceKind: 'observed_convention',
      authoritativeSources: [builder],
      remediation:
        'Change the indicated readme-vars.yml or jenkins-vars.yml source and regenerate through the repository build process. Do not patch generated output automatically.'
    },
    ['generated-candidate', 'readme-vars', 'jenkins-vars'],
    (context) => {
      if (!context.snapshot.changedFiles) return [];
      const changed = new Set(context.snapshot.changedFiles);
      return inspectionFrom(context).files.flatMap((file) => {
        if (
          !file.generatedFrom ||
          !changed.has(file.path) ||
          changed.has(file.generatedFrom)
        )
          return [];
        const content = context.files.get(file.path)?.content ?? '';
        return [
          {
            message: `A generated file changed without its likely authoritative source (${file.generatedFrom}). Review the source before changing generated output.`,
            evidence: [
              {
                path: file.path,
                line: generationMarkerLine({ path: file.path, content }) ?? 1
              },
              { path: file.generatedFrom, line: 1 }
            ]
          }
        ];
      });
    }
  ),
  define(
    {
      id: 'LSIO-README-001',
      title: 'Invalid README source metadata',
      description:
        'The README metadata is not safe YAML or has invalid consumed field types.',
      applicability: 'A readme-vars.yml file is present.',
      category: 'readme_vars',
      classification: 'required',
      evidenceKind: 'project_recommendation',
      severity: 'error',
      suppressible: false,
      authoritativeSources: [builder, 'https://yaml.org/spec/1.2.2/'],
      remediation:
        'Fix YAML syntax, duplicate keys, or the types of capability, architecture, and port fields. The tool never executes template expressions.'
    },
    ['readme-vars'],
    ({ readme }) =>
      readme && !readme.valid
        ? [
            {
              message:
                'readme-vars.yml cannot be safely interpreted. Correct its YAML or consumed field types before relying on cross-file checks.',
              evidence: [{ path: readme.file.path, line: readme.line }]
            }
          ]
        : []
  ),
  define(
    {
      id: 'LSIO-JENKINS-001',
      title: 'Invalid build source metadata',
      description:
        'The build metadata is not safe YAML or has invalid consumed field types.',
      applicability: 'A jenkins-vars.yml file is present.',
      category: 'jenkins_vars',
      classification: 'required',
      evidenceKind: 'project_recommendation',
      severity: 'error',
      suppressible: false,
      authoritativeSources: [builder, 'https://yaml.org/spec/1.2.2/'],
      remediation:
        'Fix YAML syntax, duplicate keys, or repo_vars types. Commands in metadata are treated only as data.'
    },
    ['jenkins-vars'],
    ({ jenkins }) =>
      jenkins && !jenkins.valid
        ? [
            {
              message:
                'jenkins-vars.yml cannot be safely interpreted. Correct its YAML or repo_vars field types.',
              evidence: [{ path: jenkins.file.path, line: jenkins.line }]
            }
          ]
        : []
  ),
  define(
    {
      id: 'PROJECT-COMPOSE-001',
      title: 'Invalid Compose metadata',
      description:
        'The supplied Compose document cannot be safely interpreted.',
      applicability: 'A Compose file is present.',
      category: 'dockerfile',
      classification: 'required',
      evidenceKind: 'project_recommendation',
      severity: 'error',
      suppressible: false,
      authoritativeSources: ['https://docs.docker.com/reference/compose-file/'],
      remediation:
        'Fix YAML syntax, duplicate keys, or consumed service field types. No Compose command is executed.'
    },
    ['compose'],
    ({ compose }) =>
      compose
        .filter((item) => !item.valid)
        .map(({ file, line }) => ({
          message:
            'Compose YAML or consumed service field types are invalid; capability checks cannot rely on this document.',
          evidence: [{ path: file.path, line }]
        }))
  ),
  define(
    {
      id: 'LSIO-PORT-001',
      title: 'Dockerfile and documented ports differ',
      description:
        'A literal exposed port in the final build stage is absent from explicit README metadata.',
      applicability:
        'Both a final-stage EXPOSE and fully literal param_ports metadata exist.',
      category: 'dockerfile',
      classification: 'contextual',
      evidenceKind: 'observed_convention',
      authoritativeSources: [builder, `${docker}#expose`],
      remediation:
        'Compare the intended container ports in Dockerfile and readme-vars.yml. Differences can be intentional; document or suppress with a reason rather than changing networking automatically.'
    },
    ['dockerfile', 'readme-vars'],
    (context) => {
      const ports = documentedPorts(context);
      if (!ports) return [];
      return context.dockerfiles.flatMap((file) => {
        return finalDockerStage(file).flatMap((item) => {
          if (item.instruction !== 'EXPOSE') return [];
          return item.value.split(/\s+/).flatMap((token) => {
            const port = normalizedPort(token);
            if (!port || ports.includes(port)) return [];
            return [
              {
                message: `An exposed container port (${port}) is not represented in the literal README port metadata. Verify whether the difference is intentional.`,
                evidence: [
                  { path: file.path, line: item.line, value: port },
                  {
                    path: 'readme-vars.yml',
                    line: lineOf(
                      context.readme?.file.content ?? '',
                      /^param_ports:/m
                    ),
                    value: ports
                  }
                ]
              }
            ];
          });
        });
      });
    },
    ['readme_vars']
  ),
  define(
    {
      id: 'LSIO-ARCH-001',
      title: 'Architecture-specific file and metadata differ',
      description:
        'A recognized architecture-specific Dockerfile is absent from explicit architecture metadata.',
      applicability:
        'All README architecture values are recognized and a suffixed Dockerfile is present.',
      category: 'architectures',
      classification: 'contextual',
      evidenceKind: 'observed_convention',
      authoritativeSources: [
        builder,
        'https://docs.linuxserver.io/general/running-our-containers/'
      ],
      remediation:
        'Review the architecture-specific Dockerfile and available_architectures together. Intentional differences should be documented or suppressed with evidence.'
    },
    ['dockerfile', 'readme-vars'],
    (context) => {
      const architectures = inspectionFrom(context).architectures;
      if (!architectures?.length) return [];
      return context.dockerfiles.flatMap((file) => {
        const suffix = file.path.startsWith('Dockerfile.')
          ? file.path.slice('Dockerfile.'.length)
          : '';
        const arch = normalizedArch(suffix);
        if (!arch || architectures.includes(arch)) return [];
        return [
          {
            message:
              'An architecture-specific Dockerfile is not represented in the explicit README architecture metadata. This is a consistency observation, not proof the architecture is unsupported.',
            evidence: [
              { path: file.path, line: 1, value: arch },
              {
                path: 'readme-vars.yml',
                line: lineOf(
                  context.readme?.file.content ?? '',
                  /^available_architectures:/m
                ),
                value: architectures
              }
            ]
          }
        ];
      });
    },
    ['dockerfile', 'readme_vars']
  ),
  define(
    {
      id: 'LSIO-CI-PORT-001',
      title: 'CI and documented ports differ',
      description:
        'A literal CI_PORT in repo_vars is absent from explicit README port metadata.',
      applicability:
        'Literal CI_PORT and fully literal README port metadata exist.',
      category: 'jenkins_vars',
      classification: 'contextual',
      evidenceKind: 'observed_convention',
      authoritativeSources: [builder],
      remediation:
        'Review the build health-test port and documented application ports together. Internal-only test ports may be intentional; do not expose them automatically.'
    },
    ['jenkins-vars', 'readme-vars'],
    (context) => {
      const ports = documentedPorts(context);
      if (!ports || !context.jenkins?.valid) return [];
      return (context.jenkins.value?.repo_vars ?? []).flatMap((variable) => {
        const match = /^\s*CI_PORT\s*=\s*['"]?(\d+)['"]?\s*$/.exec(variable);
        const port = match && normalizedPort(match[1]);
        if (!port || ports.includes(port)) return [];
        return [
          {
            message:
              'The literal CI test port differs from the documented container ports. Review both sources before deciding whether a change is needed.',
            evidence: [
              {
                path: 'jenkins-vars.yml',
                line: lineOf(
                  context.jenkins?.file.content ?? '',
                  /CI_PORT\s*=/
                ),
                value: port
              },
              {
                path: 'readme-vars.yml',
                line: lineOf(
                  context.readme?.file.content ?? '',
                  /^param_ports:/m
                ),
                value: ports
              }
            ]
          }
        ];
      });
    },
    ['readme_vars']
  ),
  define(
    {
      id: 'LSIO-CAPABILITY-001',
      title: 'Usage contradicts explicit capability metadata',
      description:
        'Compose requests a capability the repository metadata explicitly marks unsupported.',
      applicability:
        'readme-vars.yml explicitly reports readonly_supported or nonroot_supported as false.',
      category: 'readme_vars',
      classification: 'capability',
      evidenceKind: 'observed_convention',
      authoritativeSources: [
        'https://docs.linuxserver.io/misc/read-only/',
        'https://docs.linuxserver.io/misc/non-root/'
      ],
      remediation:
        'Verify the image-specific capability metadata and runtime configuration. Do not change permissions, identities, or filesystem boundaries automatically.'
    },
    ['compose', 'readme-vars'],
    (context) => {
      const capabilities = context.readme?.value;
      if (!capabilities) return [];
      return context.compose
        .filter((item) => item.valid)
        .flatMap(({ file, value }) =>
          Object.values(value?.services ?? {}).flatMap((service) => {
            const detections: Detection[] = [];
            if (
              capabilities.readonly_supported === false &&
              service.read_only === true
            ) {
              detections.push({
                message:
                  'Compose enables read-only mode while this repository explicitly declares it unsupported. Missing metadata would remain unknown.',
                evidence: [
                  {
                    path: file.path,
                    line: lineOf(file.content, /^[ \t]*read_only:/m),
                    value: true
                  },
                  {
                    path: 'readme-vars.yml',
                    line: lineOf(
                      context.readme?.file.content ?? '',
                      /^readonly_supported:/m
                    ),
                    value: false
                  }
                ]
              });
            }
            const user =
              service.user === undefined ? undefined : String(service.user);
            const literalNonRoot =
              user !== undefined &&
              /^[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)?$/.test(user) &&
              !/^(?:root|0)(?::|$)/.test(user);
            if (capabilities.nonroot_supported === false && literalNonRoot) {
              detections.push({
                message:
                  'Compose selects a literal non-root user while this repository explicitly declares non-root mode unsupported. PUID/PGID configuration is a different mechanism.',
                evidence: [
                  {
                    path: file.path,
                    line: lineOf(file.content, /^[ \t]*user:/m)
                  },
                  {
                    path: 'readme-vars.yml',
                    line: lineOf(
                      context.readme?.file.content ?? '',
                      /^nonroot_supported:/m
                    ),
                    value: false
                  }
                ]
              });
            }
            return detections;
          })
        );
    },
    ['dockerfile']
  ),
  define(
    {
      id: 'LSIO-S6-001',
      title: 's6 service definition is incomplete',
      description:
        'An explicit s6-rc service type is invalid or a complete snapshot lacks its required longrun run file.',
      applicability:
        'An s6-rc type file exists; absence checks require a complete snapshot.',
      category: 's6_overlay',
      classification: 'contextual',
      evidenceKind: 'documented_requirement',
      authoritativeSources: [s6],
      remediation:
        'Verify the s6-rc service type and longrun run script against the s6-overlay documentation. Do not execute or generate service commands automatically.'
    },
    ['s6'],
    (context) =>
      context.snapshot.files.flatMap((file) => {
        if (fileKind(file.path) !== 's6' || !file.path.endsWith('/type'))
          return [];
        const type = file.content.trim();
        if (!['oneshot', 'longrun', 'bundle'].includes(type)) {
          return [
            {
              message:
                'The explicit s6-rc service type is not recognized as oneshot, longrun, or bundle.',
              evidence: [{ path: file.path, line: 1 }]
            }
          ];
        }
        const runPath = file.path.slice(0, -'type'.length) + 'run';
        return type === 'longrun' &&
          context.snapshot.complete &&
          !context.files.has(runPath)
          ? [
              {
                message:
                  'A complete snapshot contains an s6 longrun type but no corresponding run file.',
                evidence: [
                  { path: file.path, line: 1 },
                  { path: runPath, line: 1 }
                ]
              }
            ]
          : [];
      })
  ),
  define(
    {
      id: 'LSIO-BRANDING-001',
      title: 'Downstream custom branding can be overwritten',
      description:
        'A custom branding file is used with a non-base LinuxServer image without LSIO_FIRST_PARTY=false.',
      applicability:
        'A custom init-adduser/branding file and a downstream, non-base LSIO FROM exist.',
      category: 'branding',
      classification: 'contextual',
      evidenceKind: 'documented_requirement',
      authoritativeSources: [branding],
      remediation:
        'Review the documented LSIO_FIRST_PARTY=false setting for custom branding of non-base images. Base-image branding follows a different path.'
    },
    ['dockerfile', 's6'],
    (context) => {
      const brandingPath = 'root/etc/s6-overlay/s6-rc.d/init-adduser/branding';
      if (!context.files.has(brandingPath)) return [];
      return context.dockerfiles.flatMap((file) => {
        const instructions = finalDockerStage(file);
        const from = [...instructions]
          .reverse()
          .find((item) => item.instruction === 'FROM');
        if (
          !from ||
          !/(?:^|\s)(?:(?:lscr\.io|ghcr\.io|docker\.io)\/)?linuxserver\/(?!baseimage-)[A-Za-z0-9_-]+(?:[:@\s]|$)/.test(
            from.value
          )
        )
          return [];
        const brandingValue = dockerEnvironmentValue(
          instructions,
          'LSIO_FIRST_PARTY'
        );
        return brandingValue === 'false'
          ? []
          : [
              {
                message:
                  'Custom branding on a downstream LinuxServer image lacks the documented LSIO_FIRST_PARTY=false setting, so upstream init may overwrite it.',
                evidence: [
                  { path: file.path, line: from.line },
                  { path: brandingPath, line: 1 }
                ]
              }
            ];
      });
    },
    ['dockerfile']
  ),
  define(
    {
      id: 'CONTAINER-SECURITY-001',
      title: 'World-writable Dockerfile permissions',
      description: 'A Dockerfile RUN instruction contains a literal chmod 777.',
      applicability: 'A RUN instruction explicitly sets mode 777.',
      category: 'security',
      classification: 'advisory',
      evidenceKind: 'general_security',
      authoritativeSources: ['https://docs.docker.com/engine/security/'],
      remediation:
        'Review the minimum required owner/group permissions. Permission changes need human review and are never applied automatically.'
    },
    ['dockerfile'],
    (context) =>
      context.dockerfiles.flatMap((file) =>
        dockerInstructions(file)
          .filter(
            (item) =>
              item.instruction === 'RUN' &&
              /(?:^|[;&]\s*)chmod\s+(?:-[A-Za-z]+\s+)*0?777\b/.test(item.value)
          )
          .map((item) => ({
            message:
              'A RUN instruction sets world-writable mode 777. This is general container-security guidance, not a LinuxServer-specific requirement.',
            confidence: 'medium' as const,
            evidence: [{ path: file.path, line: item.line }]
          }))
      ),
    ['dockerfile']
  ),
  define(
    {
      id: 'CONTAINER-SUPPLY-001',
      title: 'Remote script piped directly to a shell',
      description:
        'A Dockerfile RUN downloads a script and immediately pipes it to sh/bash.',
      applicability: 'A literal curl/wget pipeline invokes a shell.',
      category: 'supply_chain',
      classification: 'advisory',
      evidenceKind: 'heuristic',
      authoritativeSources: [
        'https://docs.docker.com/build/building/best-practices/'
      ],
      remediation:
        'Review source integrity and a verifiable download workflow. This heuristic is not proof of a malicious script or a LinuxServer policy violation.'
    },
    ['dockerfile'],
    (context) =>
      context.dockerfiles.flatMap((file) =>
        dockerInstructions(file)
          .filter(
            (item) =>
              item.instruction === 'RUN' &&
              /(?:^|&&\s*)(?:curl|wget)\s+[^|&]*\|\s*(?:\/bin\/)?(?:ba)?sh\b/.test(
                item.value
              )
          )
          .map((item) => ({
            message:
              'A RUN instruction pipes a remote download directly to a shell. Review integrity verification; this is a general supply-chain heuristic.',
            confidence: 'medium' as const,
            evidence: [{ path: file.path, line: item.line }]
          }))
      ),
    ['dockerfile']
  )
];

export const policyRules: readonly PolicyRule[] = policyChecks.map(
  ({ rule }) => rule
);

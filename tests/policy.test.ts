import { describe, expect, it } from 'vitest';
import {
  AnalysisError,
  auditReportSchema,
  auditRepository,
  hasFailures,
  inspectRepository,
  LIMITS,
  parseSnapshot,
  policyRules,
  policyRuleSchema,
  toGithubAnnotations,
  toSarif,
  type RepositorySnapshot
} from '../packages/mcp-server/src/core/index.js';
import {
  baseImage,
  customService,
  guiImage,
  normalApplication,
  withFile
} from './fixtures/repositories.js';

const configured = (snapshot: RepositorySnapshot, yaml: string) =>
  withFile(snapshot, '.github/linuxserver-mcp.yml', `version: 1\n${yaml}`);

const invalidCases: {
  id: string;
  snapshot: RepositorySnapshot;
  severity: string;
  primary: string;
}[] = [
  {
    id: 'LSIO-GENERATED-001',
    snapshot: { ...normalApplication, changedFiles: ['README.md'] },
    severity: 'warning',
    primary: 'README.md'
  },
  {
    id: 'LSIO-README-001',
    snapshot: withFile(baseImage, 'readme-vars.yml', 'param_ports: [\n'),
    severity: 'error',
    primary: 'readme-vars.yml'
  },
  {
    id: 'LSIO-JENKINS-001',
    snapshot: withFile(baseImage, 'jenkins-vars.yml', 'repo_vars: 123\n'),
    severity: 'error',
    primary: 'jenkins-vars.yml'
  },
  {
    id: 'PROJECT-COMPOSE-001',
    snapshot: withFile(baseImage, 'compose.yml', 'services: []\n'),
    severity: 'error',
    primary: 'compose.yml'
  },
  {
    id: 'LSIO-PORT-001',
    snapshot: withFile(
      normalApplication,
      'Dockerfile',
      'FROM scratch\nEXPOSE 9090\n'
    ),
    severity: 'warning',
    primary: 'Dockerfile'
  },
  {
    id: 'LSIO-ARCH-001',
    snapshot: withFile(
      normalApplication,
      'readme-vars.yml',
      'available_architectures:\n  - arch: amd64\n'
    ),
    severity: 'warning',
    primary: 'Dockerfile.aarch64'
  },
  {
    id: 'LSIO-CI-PORT-001',
    snapshot: withFile(
      normalApplication,
      'jenkins-vars.yml',
      'repo_vars:\n  - CI_PORT="9090"\n'
    ),
    severity: 'warning',
    primary: 'jenkins-vars.yml'
  },
  {
    id: 'LSIO-CAPABILITY-001',
    snapshot: withFile(
      normalApplication,
      'readme-vars.yml',
      'readonly_supported: false\n'
    ),
    severity: 'warning',
    primary: 'compose.yml'
  },
  {
    id: 'LSIO-S6-001',
    snapshot: {
      ...normalApplication,
      files: normalApplication.files.filter(
        (file) => !file.path.endsWith('/run')
      )
    },
    severity: 'warning',
    primary: 'root/etc/s6-overlay/s6-rc.d/svc-app/type'
  },
  {
    id: 'LSIO-BRANDING-001',
    snapshot: withFile(
      withFile(
        normalApplication,
        'Dockerfile',
        'FROM lscr.io/linuxserver/sonarr:latest\n'
      ),
      'root/etc/s6-overlay/s6-rc.d/init-adduser/branding',
      'Community branding\n'
    ),
    severity: 'warning',
    primary: 'Dockerfile'
  },
  {
    id: 'CONTAINER-SECURITY-001',
    snapshot: withFile(
      baseImage,
      'Dockerfile',
      'FROM scratch\nRUN chmod 777 /app\n'
    ),
    severity: 'warning',
    primary: 'Dockerfile'
  },
  {
    id: 'CONTAINER-SUPPLY-001',
    snapshot: withFile(
      baseImage,
      'Dockerfile',
      'FROM scratch\nRUN curl -fsS https://example.invalid/install | sh\n'
    ),
    severity: 'warning',
    primary: 'Dockerfile'
  }
];

describe('policy v1 contracts', () => {
  it('has an invalid fixture for every versioned, sourced rule', () => {
    expect(invalidCases.map(({ id }) => id).sort()).toEqual(
      policyRules.map(({ id }) => id).sort()
    );
    expect(new Set(policyRules.map(({ id }) => id)).size).toBe(
      policyRules.length
    );
    for (const rule of policyRules)
      expect(policyRuleSchema.safeParse(rule).success).toBe(true);
  });

  it.each([
    ['multi-architecture application', normalApplication],
    ['base image without universal application assumptions', baseImage],
    ['GUI image with explicitly unsupported capabilities', guiImage],
    ['custom s6 bundle service', customService]
  ])('does not invent violations for a valid %s', (_name, snapshot) => {
    const report = auditRepository(snapshot);
    expect(report.findings).toEqual([]);
    expect(auditReportSchema.safeParse(report).success).toBe(true);
  });

  it.each(invalidCases)(
    '$id returns correct severity, locations, sources and manual remediation',
    ({ id, snapshot, severity, primary }) => {
      const report = auditRepository(snapshot);
      expect(report.findings.map((finding) => finding.ruleId)).toEqual([id]);
      const finding = report.findings[0];
      expect(finding.severity).toBe(severity);
      expect(finding.policyVersion).toBe('1.0.0');
      expect(finding.evidence[0].path).toBe(primary);
      expect(
        finding.evidence.every(
          (item) => Number.isInteger(item.line) && item.line > 0
        )
      ).toBe(true);
      expect(finding.authoritativeSources.length).toBeGreaterThan(0);
      expect(finding.remediation).toMatchObject({
        classification: 'MANUAL_FIX',
        summary: expect.any(String)
      });
      expect(auditReportSchema.safeParse(report).success).toBe(true);
    }
  );

  it('retains evidence from both sides of cross-file findings', () => {
    for (const id of [
      'LSIO-GENERATED-001',
      'LSIO-PORT-001',
      'LSIO-ARCH-001',
      'LSIO-CI-PORT-001',
      'LSIO-CAPABILITY-001',
      'LSIO-BRANDING-001'
    ]) {
      const item = invalidCases.find((fixture) => fixture.id === id);
      expect(item).toBeDefined();
      const report = auditRepository(item?.snapshot);
      expect(
        new Set(report.findings[0].evidence.map(({ path }) => path)).size
      ).toBe(2);
    }
    const port = auditRepository(invalidCases[4].snapshot).findings[0];
    expect(port.evidence).toEqual([
      { path: 'Dockerfile', line: 2, value: '9090/tcp' },
      { path: 'readme-vars.yml', line: 6, value: ['8080/tcp'] }
    ]);
  });

  it('preserves unknown and explicit false capabilities without universal findings', () => {
    expect(inspectRepository(baseImage).capabilities).toEqual({
      readOnly: null,
      nonRoot: null
    });
    expect(inspectRepository(guiImage).capabilities).toEqual({
      readOnly: false,
      nonRoot: false
    });
    const unknown = withFile(
      normalApplication,
      'readme-vars.yml',
      'available_architectures:\n  - arch: "{{ future_arch }}"\n'
    );
    expect(inspectRepository(unknown).architectures).toBeNull();
    expect(auditRepository(unknown).findings).toEqual([]);
  });

  it('does not flag generated output regenerated together with its source', () => {
    expect(
      auditRepository({
        ...normalApplication,
        changedFiles: ['README.md', 'readme-vars.yml']
      }).findings
    ).toEqual([]);
  });

  it('requires an actual generation comment, not prose or a Markdown heading', () => {
    const prose = withFile(
      normalApplication,
      'README.md',
      '# Automatically generated examples\nThis page explains auto-generated outputs.\n'
    );
    expect(
      auditRepository({ ...prose, changedFiles: ['README.md'] }).findings
    ).toEqual([]);
    const generated = withFile(
      normalApplication,
      'Jenkinsfile',
      '\n// Automatically generated. Do not edit.\npipeline {}\n'
    );
    const finding = auditRepository({
      ...generated,
      changedFiles: ['Jenkinsfile']
    }).findings[0];
    expect(finding.ruleId).toBe('LSIO-GENERATED-001');
    expect(finding.evidence[0]).toEqual({ path: 'Jenkinsfile', line: 2 });
  });

  it('does not flag missing scripts from a partial snapshot', () => {
    const partial = { ...invalidCases[8].snapshot, complete: false };
    expect(auditRepository(partial).findings).toEqual([]);
    expect(auditRepository(partial).notices.join(' ')).toContain(
      'Partial snapshot'
    );
  });

  it('does not use build-stage ports or dynamic metadata as definitive evidence', () => {
    const stages = withFile(
      normalApplication,
      'Dockerfile',
      'FROM scratch AS build\nEXPOSE 9999\nFROM scratch\nEXPOSE 8080\n'
    );
    expect(auditRepository(stages).findings).toEqual([]);
    const dynamic = withFile(
      invalidCases[4].snapshot,
      'readme-vars.yml',
      'param_ports:\n  - internal_port: "{{ application_port }}"\n'
    );
    expect(auditRepository(dynamic).findings).toEqual([]);
  });

  it('uses explicit literal non-root metadata and does not confuse PUID with user mode', () => {
    const unsupported = withFile(
      normalApplication,
      'readme-vars.yml',
      'nonroot_supported: false\n'
    );
    expect(auditRepository(unsupported).findings[0].ruleId).toBe(
      'LSIO-CAPABILITY-001'
    );
    const variable = withFile(
      unsupported,
      'compose.yml',
      'services:\n  app:\n    user: "${PUID}:${PGID}"\n'
    );
    expect(auditRepository(variable).findings).toEqual([]);
  });

  it('keeps capability evidence on the actual key rather than a preceding blank line', () => {
    const metadata = withFile(
      baseImage,
      'readme-vars.yml',
      'readonly_supported: false\n'
    );
    const input = withFile(
      metadata,
      'compose.yml',
      'services:\n  app:\n\n    read_only: true\n'
    );
    expect(auditRepository(input).findings[0].evidence[0].line).toBe(4);
  });

  it('rejects excessive YAML alias expansion without executing template content', () => {
    const aliases = `a: &a [one, two, three]\nb: &b [${Array(30).fill('*a').join(',')}]\nc: [${Array(30).fill('*b').join(',')}]\n`;
    const report = auditRepository(
      withFile(baseImage, 'readme-vars.yml', aliases)
    );
    expect(report.findings[0].ruleId).toBe('LSIO-README-001');
  });

  it('accepts downstream custom branding with an explicit false setting', () => {
    const fixed = withFile(
      invalidCases[9].snapshot,
      'Dockerfile',
      'FROM lscr.io/linuxserver/sonarr:latest\nENV LSIO_FIRST_PARTY=false\n'
    );
    expect(auditRepository(fixed).findings).toEqual([]);
    const base = withFile(
      invalidCases[9].snapshot,
      'Dockerfile',
      'FROM lscr.io/linuxserver/baseimage-alpine:3.24\n'
    );
    expect(auditRepository(base).findings).toEqual([]);
  });

  it.each([
    'FROM scratch AS builder\nENV LSIO_FIRST_PARTY=false\nFROM lscr.io/linuxserver/sonarr:latest\n',
    'FROM lscr.io/linuxserver/sonarr:latest\nENV LSIO_FIRST_PARTY=false\nENV LSIO_FIRST_PARTY=true\n'
  ])(
    'only accepts the effective final-stage branding setting',
    (dockerfile) => {
      const input = withFile(
        invalidCases[9].snapshot,
        'Dockerfile',
        dockerfile
      );
      expect(auditRepository(input).findings[0].ruleId).toBe(
        'LSIO-BRANDING-001'
      );
    }
  );

  it('distinguishes literal ENV assignments from quoted text mentioning a setting', () => {
    const mention = withFile(
      invalidCases[9].snapshot,
      'Dockerfile',
      'FROM lscr.io/linuxserver/sonarr:latest\nENV MESSAGE="the setting LSIO_FIRST_PARTY=false is documented"\n'
    );
    expect(auditRepository(mention).findings[0].ruleId).toBe(
      'LSIO-BRANDING-001'
    );
    const literal = withFile(
      invalidCases[9].snapshot,
      'Dockerfile',
      'FROM lscr.io/linuxserver/sonarr:latest\nENV MESSAGE="other text" LSIO_FIRST_PARTY="false"\n'
    );
    expect(auditRepository(literal).findings).toEqual([]);
  });

  it('does not mistake comments or verified non-pipelined downloads for remote execution', () => {
    const safe = withFile(
      baseImage,
      'Dockerfile',
      '# RUN chmod 777 /app\nFROM scratch\nRUN curl -o /tmp/archive https://example.invalid/archive && sha256sum -c /tmp/checksum\nRUN chmod 755 /app\n'
    );
    expect(auditRepository(safe).findings).toEqual([]);
  });

  it('only evaluates changed-file-relevant rules, retaining cross-file context', () => {
    const bad = invalidCases[10].snapshot;
    const report = auditRepository({ ...bad, changedFiles: ['README.md'] });
    expect(report.findings).toEqual([]);
    expect(
      report.skippedRules.find(
        ({ ruleId }) => ruleId === 'CONTAINER-SECURITY-001'
      )?.reason
    ).toBe('No relevant changed files.');
    expect(
      auditRepository({
        ...invalidCases[4].snapshot,
        changedFiles: ['readme-vars.yml']
      }).findings[0].ruleId
    ).toBe('LSIO-PORT-001');
    expect(auditRepository({ ...bad, changedFiles: [] }).findings).toEqual([]);
  });

  it('honors profiles, disabled checks and explicit full-review configuration', () => {
    const security = invalidCases[10].snapshot;
    expect(
      auditRepository({ ...security, profile: 'linuxserver' }).findings
    ).toEqual([]);
    expect(
      auditRepository({ ...security, profile: 'security' }).findings[0].ruleId
    ).toBe('CONTAINER-SECURITY-001');
    expect(
      auditRepository(configured(security, 'checks:\n  security: false\n'))
        .findings
    ).toEqual([]);
    const full = configured(
      { ...security, changedFiles: [] },
      'review:\n  changed_files_only: false\n'
    );
    expect(auditRepository(full).findings).toHaveLength(1);
  });

  it('keeps justified suppressions visible and excludes them from failure thresholds', () => {
    const input = configured(
      invalidCases[10].snapshot,
      'severity:\n  fail_on: [warning]\nsuppressions:\n  - rule_id: CONTAINER-SECURITY-001\n    paths: [Dockerfile]\n    reason: "Intentional test fixture; reviewed by maintainer"\n'
    );
    const report = auditRepository(input);
    expect(report.findings).toEqual([]);
    expect(report.suppressedFindings).toHaveLength(1);
    expect(hasFailures(report)).toBe(false);
    expect(toSarif(report).runs[0].results[0].suppressions).toEqual([
      {
        kind: 'external',
        status: 'accepted',
        justification: 'Intentional test fixture; reviewed by maintainer'
      }
    ]);
  });

  it.each([
    'agent:\n  automatic_writes: true\n',
    'github:\n  review_comments: true\n',
    'unknown_key: true\n',
    'suppressions:\n  - rule_id: DOES-NOT-EXIST\n    paths: [Dockerfile]\n    reason: intentional\n',
    'suppressions:\n  - rule_id: LSIO-README-001\n    paths: [readme-vars.yml]\n    reason: intentional\n'
  ])(
    'rejects unsafe/unknown configuration rather than weakening analysis',
    (config) => {
      expect(() => auditRepository(configured(baseImage, config))).toThrow(
        AnalysisError
      );
    }
  );

  it('reports no applicable files without claiming a successful container audit', () => {
    const report = auditRepository({ files: [], complete: true });
    expect(report.status).toBe('not_applicable');
    expect(report.notices.join(' ')).toContain(
      'not a successful container audit'
    );
  });

  it('never returns raw secret-bearing source text in findings', () => {
    const input = withFile(
      baseImage,
      'Dockerfile',
      'FROM scratch\nRUN chmod 777 /app && echo TOKEN=not-a-real-secret\n'
    );
    const serialized = JSON.stringify(auditRepository(input));
    expect(serialized).not.toContain('not-a-real-secret');
  });
});

describe('snapshot resource boundaries', () => {
  it('rejects excessive finding amplification instead of returning a truncated pass', () => {
    const atLimit = withFile(
      baseImage,
      'Dockerfile',
      `FROM scratch\n${'RUN chmod 777 /app\n'.repeat(LIMITS.findings)}`
    );
    expect(auditRepository(atLimit).findings).toHaveLength(LIMITS.findings);
    const snapshot = withFile(
      baseImage,
      'Dockerfile',
      `FROM scratch\n${'RUN chmod 777 /app\n'.repeat(LIMITS.findings + 1)}`
    );
    expect(() => auditRepository(snapshot)).toThrow(
      expect.objectContaining({ code: 'RESOURCE_LIMIT' })
    );
  });

  it.each([
    [
      'readme-vars.yml',
      'available_architectures',
      { arch: 'amd64' },
      'LSIO-README-001'
    ],
    [
      'readme-vars.yml',
      'param_ports',
      { internal_port: '8080' },
      'LSIO-README-001'
    ],
    [
      'readme-vars.yml',
      'opt_param_ports',
      { internal_port: '8080' },
      'LSIO-README-001'
    ],
    ['jenkins-vars.yml', 'repo_vars', 'UNUSED="value"', 'LSIO-JENKINS-001'],
    ['compose.yml', 'services', {}, 'PROJECT-COMPOSE-001']
  ])(
    'enforces the exact consumed-metadata limit for %s %s',
    (path, key, item, ruleId) => {
      const value = (count: number) =>
        key === 'services'
          ? Object.fromEntries(
              Array.from({ length: count }, (_, index) => [`app${index}`, item])
            )
          : Array.from({ length: count }, () => item);
      const valid = withFile(
        baseImage,
        String(path),
        JSON.stringify({ [String(key)]: value(LIMITS.metadataItems) })
      );
      expect(auditRepository(valid).findings).toEqual([]);
      const excessive = withFile(
        baseImage,
        String(path),
        JSON.stringify({ [String(key)]: value(LIMITS.metadataItems + 1) })
      );
      expect(auditRepository(excessive).findings[0].ruleId).toBe(ruleId);
    }
  );
  it.each([
    '../Dockerfile',
    '/etc/passwd',
    'C:/Dockerfile',
    'root\\secret',
    'root/../Dockerfile',
    'root//run',
    'Dockerfile\n::error'
  ])('rejects unsafe path %s', (path) => {
    expect(() => parseSnapshot({ files: [{ path, content: '' }] })).toThrow(
      AnalysisError
    );
  });
  it('checks duplicate paths and exact byte/count thresholds', () => {
    const file = { path: 'Dockerfile', content: 'x'.repeat(LIMITS.fileBytes) };
    expect(parseSnapshot({ files: [file] }).files).toHaveLength(1);
    expect(() => parseSnapshot({ files: [file, file] })).toThrow(AnalysisError);
    expect(() =>
      parseSnapshot({ files: [{ ...file, content: `${file.content}x` }] })
    ).toThrow(AnalysisError);
    expect(() =>
      parseSnapshot({
        files: [{ ...file, content: '\u00e9'.repeat(LIMITS.fileBytes / 2 + 1) }]
      })
    ).toThrow(AnalysisError);
    const files = Array.from({ length: LIMITS.files }, (_, index) => ({
      path: `Dockerfile.v${index}`,
      content: ''
    }));
    expect(parseSnapshot({ files }).files).toHaveLength(LIMITS.files);
    expect(() =>
      parseSnapshot({ files: [...files, { path: 'extra', content: '' }] })
    ).toThrow(AnalysisError);
    const total = Array.from({ length: 8 }, (_, index) => ({
      path: `Dockerfile.v${index}`,
      content: 'x'.repeat(250_000)
    }));
    expect(parseSnapshot({ files: total }).files).toHaveLength(8);
    expect(() =>
      parseSnapshot({ files: [...total, { path: 'extra', content: 'x' }] })
    ).toThrow(AnalysisError);
  });
});

describe('portable report formats', () => {
  it('maps all findings to SARIF rules, locations, help and related evidence', () => {
    const report = auditRepository(invalidCases[4].snapshot);
    const sarif = toSarif(report, 'containers/sample');
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(policyRules.length);
    const result = sarif.runs[0].results[0];
    expect(result.ruleId).toBe('LSIO-PORT-001');
    expect(result.locations[0].physicalLocation).toEqual({
      artifactLocation: {
        uri: 'containers/sample/Dockerfile',
        uriBaseId: '%SRCROOT%'
      },
      region: { startLine: 2 }
    });
    expect(
      result.relatedLocations[0].physicalLocation.artifactLocation.uri
    ).toBe('containers/sample/readme-vars.yml');
    expect(
      sarif.runs[0].tool.driver.rules[result.ruleIndex].help.text
    ).toContain('Applicability:');
  });

  it('escapes workflow-command properties and messages', () => {
    const report = auditRepository(invalidCases[10].snapshot);
    report.findings[0].evidence[0].path = 'Dockerfile,other=bad';
    report.findings[0].message = 'first%value\n::error::injected';
    const result = toGithubAnnotations(report);
    expect(result).toContain('file=Dockerfile%2Cother=bad');
    expect(result).toContain('first%25value%0A::error::injected');
    expect(result.split('\n')).toHaveLength(1);
  });
});

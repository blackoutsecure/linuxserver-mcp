import type { AuditReport, Finding } from './models.js';
import { policyRules } from './policy/v1.js';
import type { OutputFormat } from './schemas.js';

const artifactLocation = (path: string) => ({
  uri: path.split('/').map(encodeURIComponent).join('/'),
  uriBaseId: '%SRCROOT%'
});
const withPrefix = (path: string, prefix: string) =>
  prefix ? `${prefix}/${path}` : path;
const location = (evidence: Finding['evidence'][number], prefix: string) => ({
  physicalLocation: {
    artifactLocation: artifactLocation(withPrefix(evidence.path, prefix)),
    region: {
      startLine: evidence.line,
      ...(evidence.endLine ? { endLine: evidence.endLine } : {})
    }
  }
});

export function toSarif(report: AuditReport, sourcePrefix = '') {
  const result = (finding: Finding, suppression?: string) => ({
    ruleId: finding.ruleId,
    ruleIndex: policyRules.findIndex((rule) => rule.id === finding.ruleId),
    level: finding.severity === 'info' ? 'note' : finding.severity,
    message: { text: finding.message },
    locations: [location(finding.evidence[0], sourcePrefix)],
    relatedLocations: finding.evidence.slice(1).map((evidence, index) => ({
      id: index + 1,
      ...location(evidence, sourcePrefix),
      message: { text: 'Related source evidence.' }
    })),
    properties: {
      policyVersion: finding.policyVersion,
      confidence: finding.confidence,
      classification: finding.classification,
      evidenceKind: finding.evidenceKind,
      evidence: finding.evidence,
      authoritativeSources: finding.authoritativeSources,
      remediation: finding.remediation
    },
    ...(suppression
      ? {
          suppressions: [
            { kind: 'external', status: 'accepted', justification: suppression }
          ]
        }
      : {})
  });
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'linuxserver-mcp',
            informationUri: 'https://github.com/blackoutsecure/linuxserver-mcp',
            rules: policyRules.map((rule) => ({
              id: rule.id,
              name: rule.id,
              shortDescription: { text: rule.title },
              fullDescription: { text: rule.description },
              helpUri: rule.authoritativeSources[0],
              help: {
                text: `${rule.description}\n\nApplicability: ${rule.applicability}\n\n${rule.remediation}\n\nSources:\n${rule.authoritativeSources.join('\n')}`
              },
              defaultConfiguration: {
                level: rule.severity === 'info' ? 'note' : rule.severity
              },
              properties: {
                policyVersion: rule.version,
                classification: rule.classification,
                evidenceKind: rule.evidenceKind
              }
            }))
          }
        },
        invocations: [{ executionSuccessful: true }],
        properties: {
          policyVersion: report.policyVersion,
          snapshotStatus: report.status,
          notices: report.notices
        },
        results: [
          ...report.findings.map((finding) => result(finding)),
          ...report.suppressedFindings.map(({ finding, reason }) =>
            result(finding, reason)
          )
        ]
      }
    ]
  };
}

export function escapeCommandData(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
export function escapeCommandProperty(value: string): string {
  return escapeCommandData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}
export function toGithubAnnotations(
  report: AuditReport,
  sourcePrefix = ''
): string {
  return report.findings
    .map((finding) => {
      const primary = finding.evidence[0];
      const level = finding.severity === 'info' ? 'notice' : finding.severity;
      return `::${level} file=${escapeCommandProperty(withPrefix(primary.path, sourcePrefix))},line=${primary.line},title=${finding.ruleId}::${escapeCommandData(finding.message)}`;
    })
    .join('\n');
}
export function toText(report: AuditReport): string {
  return [
    `LinuxServer MCP ${report.mode} - policy ${report.policyVersion} (${report.status})`,
    ...report.findings.map(
      (finding) =>
        `${finding.severity.toUpperCase()} ${finding.ruleId} ${finding.evidence[0].path}:${finding.evidence[0].line}\n  ${finding.message}\n  ${finding.remediation.summary}`
    ),
    `Findings: ${report.summary.error} error, ${report.summary.warning} warning, ${report.summary.info} info; ${report.suppressedFindings.length} suppressed.`,
    ...report.notices
  ].join('\n');
}
export function formatReport(
  report: AuditReport,
  format: OutputFormat
): string {
  if (format === 'json') return JSON.stringify(report, null, 2);
  if (format === 'sarif') return JSON.stringify(toSarif(report), null, 2);
  return format === 'github' ? toGithubAnnotations(report) : toText(report);
}

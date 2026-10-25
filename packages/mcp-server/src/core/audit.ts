import { createContext, fileKind, inspectionFrom } from './inspection.js';
import type { AuditReport, Finding } from './models.js';
import { policyChecks } from './policy/v1.js';
import {
  AnalysisError,
  CONFIG_PATH,
  LIMITS,
  POLICY_VERSION,
  parseSnapshot,
  type Severity
} from './schemas.js';

export function auditRepository(input: unknown): AuditReport {
  const snapshot = parseSnapshot(input);
  const context = createContext(snapshot);
  const inspection = inspectionFrom(context);
  const changed =
    context.config.review.changed_files_only &&
    snapshot.changedFiles &&
    !snapshot.changedFiles.includes(CONFIG_PATH)
      ? new Set(snapshot.changedFiles)
      : undefined;
  const findings: Finding[] = [];
  const skippedRules: AuditReport['skippedRules'] = [];
  const knownRules = new Map(policyChecks.map(({ rule }) => [rule.id, rule]));
  for (const suppression of context.config.suppressions) {
    const rule = knownRules.get(suppression.rule_id);
    if (!rule || !rule.suppressible) {
      throw new AnalysisError(
        'VALIDATION_FAILED',
        'Suppression names an unknown or non-suppressible rule. Correct .github/linuxserver-mcp.yml.'
      );
    }
  }
  for (const check of policyChecks) {
    const { rule } = check;
    const security =
      rule.category === 'security' || rule.category === 'supply_chain';
    let reason: string | undefined;
    if (
      !context.config.checks[rule.category] ||
      check.requires?.some((group) => !context.config.checks[group])
    ) {
      reason = 'Disabled by repository configuration.';
    } else if (
      (context.config.policy.profile === 'security' && !security) ||
      (context.config.policy.profile === 'linuxserver' && security)
    ) {
      reason = 'Not selected by this policy profile.';
    } else if (
      changed &&
      ![...changed].some((path) =>
        check.kinds.includes(fileKind(path) ?? 'other')
      )
    ) {
      reason = 'No relevant changed files.';
    } else if (
      !snapshot.files.some((file) =>
        check.kinds.includes(fileKind(file.path) ?? 'other')
      )
    ) {
      reason = 'No applicable files in the snapshot.';
    }
    if (reason) {
      skippedRules.push({ ruleId: rule.id, reason });
      continue;
    }
    for (const detection of check.evaluate(context)) {
      if (findings.length >= LIMITS.findings) {
        throw new AnalysisError(
          'RESOURCE_LIMIT',
          'Analysis exceeds the 1000-finding limit. Narrow the snapshot or changed-file scope; no partial success report was returned.'
        );
      }
      findings.push({
        ruleId: rule.id,
        policyVersion: rule.version,
        severity: rule.severity,
        confidence: detection.confidence ?? 'high',
        classification: rule.classification,
        evidenceKind: rule.evidenceKind,
        message: detection.message,
        evidence: detection.evidence,
        authoritativeSources: rule.authoritativeSources,
        remediation: {
          classification:
            rule.severity === 'info' ? 'INFORMATIONAL' : 'MANUAL_FIX',
          summary: rule.remediation
        },
        suppressible: rule.suppressible
      });
    }
  }
  findings.sort(
    (a, b) =>
      a.ruleId.localeCompare(b.ruleId) ||
      a.evidence[0].path.localeCompare(b.evidence[0].path) ||
      a.evidence[0].line - b.evidence[0].line
  );
  const active: Finding[] = [];
  const suppressedFindings: AuditReport['suppressedFindings'] = [];
  for (const finding of findings) {
    const suppression = context.config.suppressions.find(
      (item) =>
        item.rule_id === finding.ruleId &&
        finding.evidence.some((evidence) => item.paths.includes(evidence.path))
    );
    if (suppression)
      suppressedFindings.push({ finding, reason: suppression.reason });
    else active.push(finding);
  }
  const summary = { error: 0, warning: 0, info: 0 };
  for (const finding of active) summary[finding.severity]++;
  const applicable = snapshot.files.some((file) => {
    const kind = fileKind(file.path);
    return kind !== null && kind !== 'config' && kind !== 'generated-candidate';
  });
  return {
    schemaVersion: 1,
    policyVersion: POLICY_VERSION,
    mode: snapshot.changedFiles ? 'review' : 'audit',
    status: applicable ? 'complete' : 'not_applicable',
    config: context.config,
    inspection,
    findings: active,
    suppressedFindings,
    skippedRules,
    summary,
    notices: [
      'Independent community analysis, not LinuxServer.io approval or security certification.',
      ...(!applicable
        ? [
            'No supported container source files were supplied; absence of findings is not a successful container audit.'
          ]
        : []),
      ...(!snapshot.complete
        ? ['Partial snapshot: missing-file checks are disabled.']
        : [])
    ]
  };
}

export function hasFailures(
  report: AuditReport,
  failOn: readonly Severity[] = report.config.severity.fail_on
): boolean {
  return report.findings.some((finding) => failOn.includes(finding.severity));
}

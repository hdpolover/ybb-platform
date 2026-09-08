import {
  ActiveOverride, ReadinessContext, ReadinessReport, ReadinessRule, RuleResult,
} from './readiness-rule.types';

function findOverride(overrides: ActiveOverride[], ruleId: string, now: Date) {
  const match = overrides.find((o) => o.ruleId === ruleId);
  if (!match) return { override: null, expired: false };
  const expired = match.expiresAt !== null && match.expiresAt.getTime() <= now.getTime();
  return { override: expired ? null : match, expired };
}

export function evaluateRules(
  rules: ReadinessRule[],
  ctx: ReadinessContext,
  overrides: ActiveOverride[],
  now: Date = new Date(),
): ReadinessReport {
  const results: RuleResult[] = rules.map((rule) => {
    const base = {
      ruleId: rule.id,
      severity: rule.severity,
      title: rule.title,
      symptom: rule.symptom,
      fix: rule.fix,
    };

    let passed: boolean;
    try {
      passed = rule.evaluate(ctx);
    } catch {
      // A rule that could not be evaluated is reported as unknown. Swallowing
      // the error into a pass would hide exactly the misconfiguration we are
      // looking for.
      return { ...base, status: 'unknown' as const };
    }

    if (passed) return { ...base, status: 'pass' as const };

    const { override, expired } = findOverride(overrides, rule.id, now);
    if (override) {
      return {
        ...base,
        status: 'overridden' as const,
        overrideReason: override.reason,
      };
    }
    return { ...base, status: 'fail' as const, overrideExpired: expired || undefined };
  });

  const blockerCount = results.filter(
    (r) => r.severity === 'BLOCKER' && r.status === 'fail',
  ).length;
  const warningCount = results.filter(
    (r) => r.severity === 'WARNING' && r.status === 'fail',
  ).length;
  const unknownCount = results.filter((r) => r.status === 'unknown').length;

  return {
    results,
    blockerCount,
    warningCount,
    unknownCount,
    isReady: blockerCount === 0 && unknownCount === 0,
    evaluatedAt: now,
  };
}

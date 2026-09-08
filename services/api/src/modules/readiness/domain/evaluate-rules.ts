import {
  ActiveOverride, ReadinessContext, ReadinessReport, ReadinessRule, RuleResult,
} from './readiness-rule.types';

const isExpired = (o: ActiveOverride, now: Date) =>
  o.expiresAt !== null && o.expiresAt.getTime() <= now.getTime();

// A rule can have more than one active override row over time (a fresh one
// issued to replace an expired one, the old row only ever revoked/deleted —
// never guaranteed to be). Whichever the repository returns first must not
// decide the outcome: a non-expired override for this rule always wins over
// an expired one, regardless of query return order.
function findOverride(overrides: ActiveOverride[], ruleId: string, now: Date) {
  const candidates = overrides.filter((o) => o.ruleId === ruleId);
  if (candidates.length === 0) return { override: null, expired: false };
  const active = candidates.find((o) => !isExpired(o, now));
  if (active) return { override: active, expired: false };
  // Every candidate for this rule is expired.
  return { override: null, expired: true };
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

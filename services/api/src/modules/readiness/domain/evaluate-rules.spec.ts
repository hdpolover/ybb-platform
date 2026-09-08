import { evaluateRules } from './evaluate-rules';
import { ReadinessRule, ReadinessContext } from './readiness-rule.types';

const ctx = { brand: { primaryColor: '' } } as unknown as ReadinessContext;

const failingRule: ReadinessRule = {
  id: 'test.always-fails',
  scope: 'brand',
  severity: 'BLOCKER',
  title: 'Always fails',
  symptom: 'Nothing works',
  fix: { label: 'Fix it', href: '/somewhere' },
  evaluate: () => false,
};

describe('evaluateRules', () => {
  it('marks a failing blocker as fail and reports the subject not ready', () => {
    const report = evaluateRules([failingRule], ctx, []);
    expect(report.results[0].status).toBe('fail');
    expect(report.blockerCount).toBe(1);
    expect(report.isReady).toBe(false);
  });

  it('reports an overridden blocker as overridden, never as pass, and unblocks readiness', () => {
    const report = evaluateRules([failingRule], ctx, [
      { ruleId: 'test.always-fails', reason: 'Launching anyway', adminId: 'a1', expiresAt: null },
    ]);
    expect(report.results[0].status).toBe('overridden');
    expect(report.results[0].overrideReason).toBe('Launching anyway');
    expect(report.blockerCount).toBe(0);
    expect(report.isReady).toBe(true);
  });

  it('treats an expired override as not applied', () => {
    const report = evaluateRules([failingRule], ctx, [
      { ruleId: 'test.always-fails', reason: 'stale', adminId: 'a1', expiresAt: new Date('2020-01-01') },
    ]);
    expect(report.results[0].status).toBe('fail');
    expect(report.results[0].overrideExpired).toBe(true);
  });

  it('does not let a failing warning block readiness', () => {
    const warn: ReadinessRule = { ...failingRule, id: 'test.warn', severity: 'WARNING' };
    const report = evaluateRules([warn], ctx, []);
    expect(report.isReady).toBe(true);
    expect(report.warningCount).toBe(1);
  });

  it('reports a rule that throws as unknown rather than passing', () => {
    const boom: ReadinessRule = {
      ...failingRule,
      id: 'test.throws',
      evaluate: () => { throw new Error('payment service unreachable'); },
    };
    const report = evaluateRules([boom], ctx, []);
    expect(report.results[0].status).toBe('unknown');
    expect(report.isReady).toBe(false);
  });
});

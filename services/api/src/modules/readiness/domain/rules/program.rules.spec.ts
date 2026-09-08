import { programRulesFor } from './program.rules';
import { ReadinessContext } from '../readiness-rule.types';

const baseBrand = {
  id: 'b1', name: 'B', primaryColor: '#fff', logoUrl: 'https://cdn.ybbhub.com/a.png',
  logoIconUrl: 'https://cdn.ybbhub.com/i.png', landingUrl: 'https://x.com', tagline: 't',
  defaultCurrency: 'USD', isMaintenanceMode: false, activeSignatureCount: 1,
  legalDocumentCount: 1, publishedProgramCount: 1, supportEmail: 'a@b.com',
};

function ctx(program: Partial<NonNullable<ReadinessContext['program']>> = {}): ReadinessContext {
  return {
    brand: baseBrand,
    program: {
      id: 'p1', name: 'KYS 2027', bannerUrl: 'https://cdn.ybbhub.com/banner.png',
      description: 'A program', registrationOpenDate: new Date('2026-01-01'),
      registrationCloseDate: new Date('2026-06-01'),
      applicationDeadline: new Date('2026-06-15'),
      pricingTierCount: 2, objectiveCount: 3, faqCount: 5, galleryCount: 10,
      testimonialCount: 4,
      paymentMethods: { enabledCount: 2, isConfigured: true },
      ...program,
    },
  };
}

const rule = (id: string) => {
  const found = programRulesFor('p1').find((r) => r.id === id);
  if (!found) throw new Error(`rule ${id} not found`);
  return found;
};

describe('PROGRAM_RULES', () => {
  it('has unique ids and every rule carries a symptom', () => {
    const rules = programRulesFor('p1');
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
    for (const r of rules) expect(r.symptom.length).toBeGreaterThan(0);
  });

  describe('program.has-pricing-tiers', () => {
    it('fails with zero tiers and is a BLOCKER', () => {
      expect(rule('program.has-pricing-tiers').evaluate(ctx({ pricingTierCount: 0 }))).toBe(false);
      expect(rule('program.has-pricing-tiers').severity).toBe('BLOCKER');
    });
    it('passes with one tier', () => {
      expect(rule('program.has-pricing-tiers').evaluate(ctx({ pricingTierCount: 1 }))).toBe(true);
    });
  });

  describe('program.deadline-order-valid', () => {
    const r = rule('program.deadline-order-valid');
    it('passes on correctly ordered dates', () => {
      expect(r.evaluate(ctx())).toBe(true);
    });
    it('fails when close is before open', () => {
      expect(r.evaluate(ctx({
        registrationOpenDate: new Date('2026-06-01'),
        registrationCloseDate: new Date('2026-01-01'),
        applicationDeadline: null,
      }))).toBe(false);
    });
    it('fails when the application deadline precedes registration close', () => {
      expect(r.evaluate(ctx({
        registrationCloseDate: new Date('2026-06-01'),
        applicationDeadline: new Date('2026-05-01'),
      }))).toBe(false);
    });
    it('skips a comparison when either operand is null, matching the validator', () => {
      expect(r.evaluate(ctx({ registrationOpenDate: null, registrationCloseDate: null, applicationDeadline: null }))).toBe(true);
    });
  });

  describe('program.banner-not-placeholder', () => {
    it('fails on a placeholder banner', () => {
      expect(rule('program.banner-not-placeholder').evaluate(ctx({ bannerUrl: 'https://placehold.co/1920x600' }))).toBe(false);
    });
  });

  describe('program.has-testimonials', () => {
    // ProgramTestimonial.programId is nullable: a row can be brand-scoped and
    // still render on the program page. The loader counts both, so this rule
    // only needs the total.
    it('passes when the counted total is non-zero', () => {
      expect(rule('program.has-testimonials').evaluate(ctx({ testimonialCount: 1 }))).toBe(true);
    });
    it('fails at zero', () => {
      expect(rule('program.has-testimonials').evaluate(ctx({ testimonialCount: 0 }))).toBe(false);
    });
  });

  it('throws no error when program context is absent', () => {
    const brandOnly = { brand: baseBrand } as ReadinessContext;
    expect(() => rule('program.has-pricing-tiers').evaluate(brandOnly)).not.toThrow();
  });
});

describe('payment method rules', () => {
  it('fails when the program has no enabled payment method', () => {
    expect(rule('program.has-enabled-payment-method')
      .evaluate(ctx({ paymentMethods: { enabledCount: 0, isConfigured: true } }))).toBe(false);
  });

  it('passes when at least one method is enabled', () => {
    expect(rule('program.has-enabled-payment-method')
      .evaluate(ctx({ paymentMethods: { enabledCount: 1, isConfigured: true } }))).toBe(true);
  });

  it('fails when the program inherits the global master instructions', () => {
    expect(rule('program.payment-methods-configured')
      .evaluate(ctx({ paymentMethods: { enabledCount: 3, isConfigured: false } }))).toBe(false);
  });

  it('throws when the payment service was unreachable, so the evaluator records unknown rather than pass', () => {
    expect(() => rule('program.has-enabled-payment-method')
      .evaluate(ctx({ paymentMethods: null }))).toThrow();
    expect(() => rule('program.payment-methods-configured')
      .evaluate(ctx({ paymentMethods: null }))).toThrow();
  });

  it('makes both rules blockers', () => {
    expect(rule('program.has-enabled-payment-method').severity).toBe('BLOCKER');
    expect(rule('program.payment-methods-configured').severity).toBe('BLOCKER');
  });
});

// services/api/src/modules/readiness/domain/rules/brand.rules.spec.ts
import { BRAND_RULES, brandRulesFor } from './brand.rules';
import { ReadinessContext } from '../readiness-rule.types';

function ctx(overrides: Partial<ReadinessContext['brand']> = {}): ReadinessContext {
  return {
    brand: {
      id: 'b1', name: 'Korea Youth Summit',
      primaryColor: '#7C3AED', logoUrl: 'https://cdn.ybbhub.com/a.png',
      logoIconUrl: 'https://cdn.ybbhub.com/i.png', landingUrl: 'https://kys.com',
      tagline: 'Living culture', defaultCurrency: 'USD', isMaintenanceMode: false,
      activeSignatureCount: 1, legalDocumentCount: 1, publishedProgramCount: 4,
      supportEmail: 'help@kys.com',
      ...overrides,
    },
  };
}

function ruleById(id: string) {
  const rule = BRAND_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`rule ${id} not found`);
  return rule;
}

describe('BRAND_RULES', () => {
  it('has unique, stable ids', () => {
    const ids = BRAND_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every rule a symptom and a fix link', () => {
    for (const rule of BRAND_RULES) {
      expect(rule.symptom.length).toBeGreaterThan(0);
      expect(rule.fix.href.length).toBeGreaterThan(0);
    }
  });

  describe('brand.primary-color-set', () => {
    const rule = ruleById('brand.primary-color-set');

    it('passes on a real hex', () => {
      expect(rule.evaluate(ctx({ primaryColor: '#7C3AED' }))).toBe(true);
    });

    // The production bug: primary_color is '' , not null. A null check passes it.
    it('fails on empty string, which is how Korea Youth Summit slipped through', () => {
      expect(rule.evaluate(ctx({ primaryColor: '' }))).toBe(false);
    });

    it('fails on null and on whitespace', () => {
      expect(rule.evaluate(ctx({ primaryColor: null }))).toBe(false);
      expect(rule.evaluate(ctx({ primaryColor: '  ' }))).toBe(false);
    });

    it('is a BLOCKER', () => {
      expect(rule.severity).toBe('BLOCKER');
    });
  });

  describe('brand.has-active-signature', () => {
    const rule = ruleById('brand.has-active-signature');
    it('fails with zero active signatures', () => {
      expect(rule.evaluate(ctx({ activeSignatureCount: 0 }))).toBe(false);
    });
    it('passes with one', () => {
      expect(rule.evaluate(ctx({ activeSignatureCount: 1 }))).toBe(true);
    });
  });

  describe('brand.logo-not-placeholder', () => {
    const rule = ruleById('brand.logo-not-placeholder');
    it('fails on the placeholder logo live in production today', () => {
      expect(rule.evaluate(ctx({ logoUrl: 'https://placehold.co/400x100/EF4444/FFF?text=JYS+Logo' }))).toBe(false);
    });
    it('passes on a real asset', () => {
      expect(rule.evaluate(ctx({ logoUrl: 'https://cdn.ybbhub.com/prod/x.png' }))).toBe(true);
    });
  });

  describe('brand.not-in-maintenance-while-published', () => {
    const rule = ruleById('brand.not-in-maintenance-while-published');
    it('fails when maintenance is on and programs are live', () => {
      expect(rule.evaluate(ctx({ isMaintenanceMode: true, publishedProgramCount: 4 }))).toBe(false);
    });
    it('passes when maintenance is on but nothing is live', () => {
      expect(rule.evaluate(ctx({ isMaintenanceMode: true, publishedProgramCount: 0 }))).toBe(true);
    });
  });

  describe('brand.has-legal-documents', () => {
    // Red for all 8 brands today. INFO on purpose: a rule that is red
    // fleet-wide on day one trains admins to ignore the whole board.
    it('is INFO, not a blocker', () => {
      expect(ruleById('brand.has-legal-documents').severity).toBe('INFO');
    });
  });
});

describe('brandRulesFor', () => {
  it('binds every fix link to the given brand id, except the signature rule (no brand-scoped signature UI exists)', () => {
    for (const rule of brandRulesFor('b-123')) {
      if (rule.id === 'brand.has-active-signature') continue;
      expect(rule.fix.href).toContain('/platform/brands/b-123/edit');
    }
  });

  it('routes settings-tab rules to the settings tab', () => {
    const rule = brandRulesFor('b-123').find((r) => r.id === 'brand.support-email-set');
    expect(rule?.fix.href).toContain('tab=settings');
  });

  // MINOR d: signatures are managed inside a specific program's LOA template
  // editor, not on the brand edit page — routing this rule's fix link to
  // ?tab=identity would land the admin on a tab with no signature UI at all.
  it('does not send brand.has-active-signature to a brand-edit tab that cannot manage signatures', () => {
    const rule = brandRulesFor('b-123').find((r) => r.id === 'brand.has-active-signature');
    expect(rule?.fix.href).not.toContain('tab=identity');
    expect(rule?.fix.href).not.toContain('/edit');
  });
});

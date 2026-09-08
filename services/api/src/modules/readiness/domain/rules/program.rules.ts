import { ReadinessRule } from '../readiness-rule.types';
import { isUsableImageUrl } from '../placeholder-url.util';

const filled = (v: string | null): boolean => !!v && v.trim().length > 0;

// Mirrors assertProgramDeadlineOrder (program-deadline-order.validator.ts:27-70)
// as a boolean. Each comparison is skipped when either operand is null, exactly
// as the validator does.
function deadlinesOrdered(p: {
  registrationOpenDate: Date | null;
  registrationCloseDate: Date | null;
  applicationDeadline: Date | null;
}): boolean {
  const { registrationOpenDate: open, registrationCloseDate: close, applicationDeadline: deadline } = p;
  if (close && open && close.getTime() < open.getTime()) return false;
  if (deadline && open && deadline.getTime() < open.getTime()) return false;
  if (deadline && close && deadline.getTime() < close.getTime()) return false;
  return true;
}

const PROGRAM_RULES: ReadinessRule[] = [
  {
    id: 'program.has-pricing-tiers',
    scope: 'program',
    severity: 'BLOCKER',
    title: 'No pricing tiers configured',
    // registration-editions.util.ts:33-46 returns an empty array silently.
    symptom: 'The public program page shows no fee information at all.',
    fix: { label: 'Add pricing tiers', href: '' },
    evaluate: (ctx) => (ctx.program?.pricingTierCount ?? 0) > 0,
  },
  {
    id: 'program.deadline-order-valid',
    scope: 'program',
    severity: 'BLOCKER',
    title: 'Registration dates are out of order',
    symptom:
      'Countdowns and registration windows compute from contradictory dates, so the public page can advertise a window that is already closed.',
    fix: { label: 'Fix registration dates', href: '' },
    evaluate: (ctx) => (ctx.program ? deadlinesOrdered(ctx.program) : true),
  },
  {
    id: 'program.banner-set',
    scope: 'program',
    severity: 'WARNING',
    title: 'Program banner not set',
    // home.strategy.ts:538-541 falls back to brand.bannerUrl || ''.
    symptom: 'The hero falls back to the brand banner, or to nothing at all.',
    fix: { label: 'Upload banner', href: '' },
    evaluate: (ctx) => filled(ctx.program?.bannerUrl ?? null),
  },
  {
    id: 'program.banner-not-placeholder',
    scope: 'program',
    severity: 'WARNING',
    title: 'Program banner is a placeholder image',
    symptom: 'The hero shows a grey placeholder image.',
    fix: { label: 'Upload a real banner', href: '' },
    evaluate: (ctx) => {
      const url = ctx.program?.bannerUrl ?? null;
      return !filled(url) || isUsableImageUrl(url);
    },
  },
  {
    id: 'program.description-set',
    scope: 'program',
    severity: 'WARNING',
    title: 'Program description not set',
    symptom: 'The about section falls back to the brand description, which is not program specific.',
    fix: { label: 'Write a description', href: '' },
    evaluate: (ctx) => filled(ctx.program?.description ?? null),
  },
  {
    id: 'program.has-objectives',
    scope: 'program',
    severity: 'WARNING',
    title: 'No objectives added',
    symptom: 'The objectives section renders empty on the public page.',
    fix: { label: 'Add objectives', href: '' },
    evaluate: (ctx) => (ctx.program?.objectiveCount ?? 0) > 0,
  },
  {
    id: 'program.has-faqs',
    scope: 'program',
    severity: 'WARNING',
    title: 'No FAQs added',
    // faqs.strategy.ts:100-142 returns sections: [] when there are no rows.
    symptom: 'The FAQ page renders with no sections.',
    fix: { label: 'Add FAQs', href: '' },
    evaluate: (ctx) => (ctx.program?.faqCount ?? 0) > 0,
  },
  {
    id: 'program.has-gallery',
    scope: 'program',
    severity: 'WARNING',
    title: 'No gallery images',
    symptom: 'The gallery falls back to brand-wide images, which may be from another program.',
    fix: { label: 'Add gallery images', href: '' },
    evaluate: (ctx) => (ctx.program?.galleryCount ?? 0) > 0,
  },
  {
    id: 'program.has-testimonials',
    scope: 'program',
    severity: 'WARNING',
    title: 'No testimonials',
    symptom: 'The testimonials section renders empty.',
    fix: { label: 'Add testimonials', href: '' },
    evaluate: (ctx) => (ctx.program?.testimonialCount ?? 0) > 0,
  },
  {
    id: 'program.has-enabled-payment-method',
    scope: 'program',
    severity: 'BLOCKER',
    title: 'No payment method enabled',
    symptom: 'Participants reach the payment step with no way to pay.',
    fix: { label: 'Enable payment methods', href: '' },
    evaluate: (ctx) => {
      const methods = ctx.program?.paymentMethods;
      // Throwing is deliberate: the evaluator turns it into 'unknown', which
      // blocks publishing. Returning true here would let a payment-service
      // outage wave an unpayable program into production.
      if (!methods) throw new Error('Payment service unavailable');
      return methods.enabledCount > 0;
    },
  },
  {
    id: 'program.payment-methods-configured',
    scope: 'program',
    severity: 'BLOCKER',
    title: 'Payment methods not configured for this program',
    // With no overlay rows the read path falls back to the global master, so
    // the program shows another brand's account details and instructions.
    symptom:
      'Payment instructions fall back to the global master text, showing generic account details instead of this program\'s.',
    fix: { label: 'Configure payment methods', href: '' },
    evaluate: (ctx) => {
      const methods = ctx.program?.paymentMethods;
      if (!methods) throw new Error('Payment service unavailable');
      return methods.isConfigured;
    },
  },
];

export function programRulesFor(programId: string): ReadinessRule[] {
  const hrefByRule: Record<string, string> = {
    'program.has-pricing-tiers': `/programs/${programId}/master-data/program-payments`,
    'program.deadline-order-valid': `/programs/${programId}/master-data/program-details`,
    'program.banner-set': `/programs/${programId}/media`,
    'program.banner-not-placeholder': `/programs/${programId}/media`,
    'program.has-gallery': `/programs/${programId}/media`,
    'program.has-enabled-payment-method': `/programs/${programId}/master-data/payment-methods`,
    'program.payment-methods-configured': `/programs/${programId}/master-data/payment-methods`,
  };
  const fallback = `/programs/${programId}/master-data/program-details`;
  return PROGRAM_RULES.map((rule) => ({
    ...rule,
    fix: { ...rule.fix, href: hrefByRule[rule.id] ?? fallback },
  }));
}

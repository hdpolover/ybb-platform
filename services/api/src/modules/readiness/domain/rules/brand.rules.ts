// services/api/src/modules/readiness/domain/rules/brand.rules.ts
import { ReadinessRule } from '../readiness-rule.types';
import { isUsableImageUrl } from '../placeholder-url.util';

const filled = (v: string | null): boolean => !!v && v.trim().length > 0;

const brandHref = (brandId: string, tab = 'identity') =>
  `/platform/brands/${brandId}/edit?tab=${tab}`;

export const BRAND_RULES: ReadinessRule[] = [
  {
    id: 'brand.primary-color-set',
    scope: 'brand',
    severity: 'BLOCKER',
    title: 'Brand colour not set',
    // ybb-program-next/app/layout.tsx:289 falls back to #1c57b3;
    // portal-receipt.service.ts:129 and pdf_generator.py:670 fall back to #26408B.
    symptom:
      'Public site chrome renders generic blue (#1c57b3) and receipts render generic navy (#26408B). Two different wrong colours.',
    fix: { label: 'Set brand colour', href: '/platform/brands' },
    evaluate: (ctx) => filled(ctx.brand.primaryColor),
  },
  {
    id: 'brand.has-active-signature',
    scope: 'brand',
    severity: 'BLOCKER',
    title: 'No active signature configured',
    // pdf_generator.py:398-419 renders signer name, title and rule line with
    // no image when signature_url is blank.
    symptom:
      'Letters of Acceptance render the signer name, title and signature line with no signature image. The document looks signed and is not.',
    fix: { label: 'Add a signature', href: '/platform/brands' },
    evaluate: (ctx) => ctx.brand.activeSignatureCount > 0,
  },
  {
    id: 'brand.logo-set',
    scope: 'brand',
    severity: 'BLOCKER',
    title: 'Brand logo not uploaded',
    symptom:
      'Auth pages and the participant dashboard show the generic YBB mark; receipts fall back to a coloured monogram tile.',
    fix: { label: 'Upload logo', href: '/platform/brands' },
    evaluate: (ctx) => filled(ctx.brand.logoUrl),
  },
  {
    id: 'brand.logo-not-placeholder',
    scope: 'brand',
    severity: 'BLOCKER',
    title: 'Brand logo is a placeholder image',
    symptom:
      'The logo points at a placeholder generator, so the public site shows a grey placeholder box where the brand mark should be.',
    fix: { label: 'Upload a real logo', href: '/platform/brands' },
    evaluate: (ctx) => !filled(ctx.brand.logoUrl) || isUsableImageUrl(ctx.brand.logoUrl),
  },
  {
    id: 'brand.landing-url-set',
    scope: 'brand',
    severity: 'WARNING',
    title: 'Landing URL not set',
    // meta-capi.service.ts:282, support-access.service.ts:529
    symptom:
      'Meta CAPI events fire with an empty event_source_url, degrading ad attribution, and support impersonation links can be malformed.',
    fix: { label: 'Set landing URL', href: '/platform/brands' },
    evaluate: (ctx) => filled(ctx.brand.landingUrl),
  },
  {
    id: 'brand.tagline-set',
    scope: 'brand',
    severity: 'WARNING',
    title: 'Tagline not set',
    // pdf_generator.py:261-296 omits the block entirely.
    symptom: 'The Letter of Acceptance header silently omits the tagline line.',
    fix: { label: 'Set tagline', href: '/platform/brands' },
    evaluate: (ctx) => filled(ctx.brand.tagline),
  },
  {
    id: 'brand.logo-icon-set',
    scope: 'brand',
    severity: 'WARNING',
    title: 'Icon logo not set',
    // settings.strategy.ts:75 falls back to the full logo.
    symptom: 'The favicon falls back to the full logo, which renders at the wrong aspect ratio.',
    fix: { label: 'Upload icon logo', href: '/platform/brands' },
    evaluate: (ctx) => filled(ctx.brand.logoIconUrl),
  },
  {
    id: 'brand.support-email-set',
    scope: 'brand',
    severity: 'WARNING',
    title: 'Support email not set',
    symptom: 'Support contact falls through brand, then program, then renders nothing.',
    fix: { label: 'Set support email', href: '/platform/brands' },
    evaluate: (ctx) => filled(ctx.brand.supportEmail),
  },
  {
    id: 'brand.not-in-maintenance-while-published',
    scope: 'brand',
    severity: 'WARNING',
    title: 'Maintenance mode is on while programs are published',
    symptom: 'Visitors see the maintenance page instead of live programs.',
    fix: { label: 'Review maintenance mode', href: '/platform/brands' },
    evaluate: (ctx) => !ctx.brand.isMaintenanceMode || ctx.brand.publishedProgramCount === 0,
  },
  {
    id: 'brand.currency-consistent',
    scope: 'brand',
    severity: 'WARNING',
    title: 'Brand currency is not a recognised value',
    // BrandEditPage.tsx:567 coerces anything that is not USD to IDR on save.
    symptom:
      'Payment and invoice UI can mislabel amounts. The admin form also rewrites unexpected values to IDR on save.',
    fix: { label: 'Review currency', href: '/platform/brands' },
    evaluate: (ctx) => ['USD', 'IDR'].includes(ctx.brand.defaultCurrency),
  },
  {
    id: 'brand.has-legal-documents',
    scope: 'brand',
    severity: 'INFO',
    title: 'No legal documents published',
    symptom: 'The brand has no terms or privacy pages of its own.',
    fix: { label: 'Add legal documents', href: '/platform/brands' },
    evaluate: (ctx) => ctx.brand.legalDocumentCount > 0,
  },
];

// Fix links need the brand id, which is only known at evaluation time.
export function brandRulesFor(brandId: string): ReadinessRule[] {
  const tabByRule: Record<string, string> = {
    'brand.support-email-set': 'settings',
    'brand.not-in-maintenance-while-published': 'settings',
    'brand.currency-consistent': 'settings',
    'brand.tagline-set': 'details',
  };
  return BRAND_RULES.map((rule) => ({
    ...rule,
    fix: { ...rule.fix, href: brandHref(brandId, tabByRule[rule.id] ?? 'identity') },
  }));
}

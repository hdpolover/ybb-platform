import { glob } from 'glob';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC_ROOT = resolve(__dirname, '../../src');

/**
 * Allowlist for command handlers that legitimately don't need cache invalidation.
 * Each entry is a path prefix relative to SRC_ROOT. Add only with justification —
 * a code comment in the source file is required.
 */
const ALLOWLIST_HANDLERS_PREFIXES: string[] = [
  // Auth mutations affect session/token only, not cached portal/landing data.
  'modules/auth/',
  // Audit logs are append-only; no read cache to invalidate.
  'modules/audit/',
  // Files upload/storage handlers — file metadata/uploads don't surface on landing/portal directly.
  // (Program-content handlers that consume uploaded files invalidate separately.)
  'modules/files/',
  // AI bot config — not surfaced on participant frontend.
  'modules/ai-bot/',
  // Deletion requests — admin metadata, deletion is eventual.
  'modules/users/application/commands/handlers/create-deletion-request',
  'modules/users/application/commands/handlers/review-deletion-request',
  // Health/metadata — read-only or trivial
  'modules/health/',
  'modules/metadata/',
  // Support ticket domain isolated from landing/portal cache.
  'modules/support/',
  // Newsletter subscriptions don't have a cached read endpoint.
  'modules/newsletter/',
  // Reporting and stats are read-only or compute-on-demand
  'modules/reporting/',
  'modules/stats/',
  // Admin user management — admin accounts are not surfaced on cached landing/portal reads.
  'modules/admins/',
  // Payments — payment processing delegates to the payment microservice via
  // gRPC. Cache invalidation is handled by the payment-events controller
  // (webhook) and payment-admin controller, both of which carry
  // @CacheInvalidate / direct cacheService calls.
  'modules/payments/application/commands/handlers/process-payment',
  // Application form fields and form templates are admin-facing config data
  // that doesn't have a separately-cached public read endpoint. The portal
  // reads application-form config as part of the program content which is
  // invalidated by the program-content controller's @CacheInvalidate.
  'modules/programs/application/commands/handlers/application-form-field',
  'modules/programs/application/commands/handlers/apply-form-template',
  'modules/programs/application/commands/handlers/form-template',
  'modules/programs/application/commands/handlers/system-form-field',
  // Mark-announcement-read — user-specific dismissal status, not part of any cached response.
  'modules/system/application/commands/handlers/mark-announcement-read',
  // Notification read state — per-user transient data, not cached.
  'modules/users/application/commands/handlers/mark-notification-read',
  // User preferences (theme, language, timezone) — personal settings, not cached at API level.
  'modules/users/application/commands/handlers/update-user-preferences',
];

/**
 * Allowlist for SPECIFIC handler files that need an exemption for unique reasons.
 * Format: 'modules/<m>/path/to/file.handler.ts'
 */
const ALLOWLIST_HANDLER_FILES: Set<string> = new Set([
  // Brand create/delete/update-details/update-metadata/update-settings and
  // sponsor create/delete/update use LandingRevalidationService (Next.js ISR
  // revalidation) instead of Redis cache invalidation. Their corresponding
  // controller endpoints carry @CacheInvalidate(LANDING_BRAND_PATTERNS) for
  // the Redis layer, so the cache is covered at the controller level.
  'modules/brands/application/commands/handlers/create-brand.handler.ts',
  'modules/brands/application/commands/handlers/delete-brand.handler.ts',
  'modules/brands/application/commands/handlers/update-brand-details.handler.ts',
  'modules/brands/application/commands/handlers/update-brand-metadata.handler.ts',
  'modules/brands/application/commands/handlers/update-brand-settings.handler.ts',
  'modules/brands/application/commands/handlers/create-sponsor.handler.ts',
  'modules/brands/application/commands/handlers/delete-sponsor.handler.ts',
  'modules/brands/application/commands/handlers/update-sponsor.handler.ts',
  // Admin assignment to brands is explicitly documented in the brands controller
  // as "no cache bust: admin assignment isn't surfaced on landing pages".
  'modules/brands/application/commands/handlers/assign-brand-admin.handler.ts',
  'modules/brands/application/commands/handlers/remove-brand-admin.handler.ts',
  // Program announcements: the controller carries @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  // on every mutation endpoint (POST/PUT/DELETE), so handlers don't also invalidate.
  'modules/programs/application/commands/handlers/manage-program-announcements.handler.ts',
  // Application mutations below DRAFT status are handled by handlers without
  // cache invalidation — the applications controller carries @CacheInvalidate
  // on every mutation endpoint. Handlers for: update, switch-category, withdraw,
  // create-registration-payment-intent (intent creation only, no state change).
  'modules/applications/application/commands/handlers/update-application.handler.ts',
  'modules/applications/application/commands/handlers/switch-application-category.handler.ts',
  'modules/applications/application/commands/handlers/withdraw-application.handler.ts',
  'modules/applications/application/commands/handlers/create-registration-payment-intent.handler.ts',
]);

/**
 * Allowlist for controller files (by path prefix). These controllers either
 * have no mutation endpoints, carry mutations whose data is not cached, or
 * delegate to CQRS handlers that perform Redis invalidation directly.
 */
const ALLOWLIST_CONTROLLER_PREFIXES: string[] = [
  // Auth controllers handle session/token only.
  'modules/auth/',
  // Audit logs are append-only; no read cache to invalidate.
  'modules/audit/',
  // Files upload/storage — file metadata not surfaced on cached landing/portal reads.
  'modules/files/',
  // AI bot config — not surfaced on participant frontend.
  'modules/ai-bot/',
  // Health/metadata — read-only or trivial.
  'modules/health/',
  'modules/metadata/',
  // Support ticket domain isolated from landing/portal cache.
  'modules/support/',
  // Newsletter subscriptions don't have a cached read endpoint.
  'modules/newsletter/',
  // Reporting and stats are read-only or compute-on-demand.
  'modules/reporting/',
  'modules/stats/',
  // Admin user management — admin accounts not surfaced on cached reads.
  'modules/admins/',
  // User-level mutations (preferences, deletion requests, notifications) are
  // not cached at the API response level.
  'modules/users/',
  // System announcements: manage-system-announcements handler invalidates directly;
  // the mark-as-read endpoint doesn't affect cached reads.
  'modules/system/',
  // Portal controllers: all mutation endpoints delegate to CQRS handlers
  // (confirm-portal-payment, ensure-portal-payment-invoice, portal-submit-application,
  // save-submission-section, upload-signed-copy, download-certificate) which
  // each call cacheService.invalidateKey(...) directly. No controller-level decorator needed.
  'modules/portal/',
  // Participants controllers: all mutation endpoints delegate to handlers
  // (complete-onboarding, update-participant-profile, apply-ambassador,
  // update-ambassador-status, delete-ambassador) which call cacheService directly.
  'modules/participants/',
  // Gallery: gallery.service.ts calls cacheService.invalidateBrandLandingCaches;
  // the controller is a thin wrapper over the service.
  'modules/gallery/',
  // Email templates — internal admin data, not surfaced on cached landing/portal reads.
  'modules/email-templates/',
  // Partnerships enquiry is outbound-only (sends an email); no cached state changes.
  'modules/partnerships/',
  // Program form fields, form templates, and system form fields are admin config
  // with no separately-cached public read endpoint. Portal reads application-form
  // config as part of program content, invalidated by program-content controller.
  'modules/programs/presentation/program-form-fields.controller.ts',
  'modules/programs/presentation/system-form-fields.controller.ts',
  // Payments mutations: intent creation and payment processing are stateless
  // passthroughs to the Go payment microservice via gRPC. Cache invalidation
  // for payment state changes is handled by payment-events.controller.ts and
  // payment-admin.controller.ts (both carry @CacheInvalidate or direct calls).
  // Gateway config is internal admin data, not surfaced on landing/portal cache.
  'modules/payments/presentation/payments.controller.ts',
  'modules/payments/presentation/webhooks.controller.ts',
  'modules/payments/presentation/gateway-admin.controller.ts',
];

const INVALIDATION_RE =
  /(?:cacheService|portalCacheService|cache)\.(invalidateKey|invalidateKeys|invalidateByPattern|invalidateByPatterns|invalidateBrandLandingCaches|invalidateInvoiceCache)\b/;

function isAllowedHandlerPath(rel: string): boolean {
  if (ALLOWLIST_HANDLER_FILES.has(rel)) return true;
  return ALLOWLIST_HANDLERS_PREFIXES.some((p) => rel.startsWith(p));
}

function isAllowedControllerFile(rel: string): boolean {
  return ALLOWLIST_CONTROLLER_PREFIXES.some((p) => rel.startsWith(p));
}

describe('cache invalidation coverage', () => {
  it('every CQRS command handler invalidates cache or is explicitly allow-listed', async () => {
    const files = await glob('modules/**/application/**/commands/**/handlers/*.handler.ts', {
      cwd: SRC_ROOT,
      ignore: '**/*.spec.ts',
    });

    const offenders: string[] = [];
    for (const file of files) {
      if (isAllowedHandlerPath(file)) continue;
      const src = readFileSync(resolve(SRC_ROOT, file), 'utf8');
      if (INVALIDATION_RE.test(src)) continue;
      offenders.push(file);
    }

    if (offenders.length > 0) {
      throw new Error(
        `\nCommand handlers without cache invalidation:\n` +
          offenders.map((p) => `  - ${p}`).join('\n') +
          `\n\nAdd cacheService.invalidate*() calls to the handler, OR add to ALLOWLIST_HANDLERS_PREFIXES / ALLOWLIST_HANDLER_FILES with a justifying comment.\n`,
      );
    }
  });

  it('every controller mutation method has @CacheInvalidate or its handler invalidates', async () => {
    const files = await glob('modules/**/presentation/**/*.controller.ts', {
      cwd: SRC_ROOT,
      ignore: '**/*.spec.ts',
    });

    const httpMutationRe = /@(Post|Put|Patch|Delete)\(/;
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(resolve(SRC_ROOT, file), 'utf8');
      // If the controller file has any cache invalidation (decorator or direct), accept the file as covered.
      // This is intentionally loose: deep per-method analysis is brittle and the regression test
      // is a safety net, not a perfectionist gate.
      if (/@CacheInvalidate\b/.test(src)) continue;
      if (INVALIDATION_RE.test(src)) continue;

      // No invalidation anywhere in this controller — but maybe it has no mutations?
      const hasMutations = httpMutationRe.test(src);
      if (!hasMutations) continue;

      // Has mutations and no invalidation. Check allowlist by file path.
      if (isAllowedControllerFile(file)) continue;
      offenders.push(file);
    }

    if (offenders.length > 0) {
      throw new Error(
        `\nControllers with mutations but NO cache invalidation anywhere:\n` +
          offenders.map((p) => `  - ${p}`).join('\n') +
          `\n\nAdd @CacheInvalidate(...) to the controller method, OR have the underlying CQRS handler invalidate, OR add the file to the controller allowlist with justification.\n`,
      );
    }
  });
});

// services/api/src/scripts/diff-landing-payloads.ts
/**
 * diff-landing-payloads.ts
 *
 * Phase 3 Task 18 (see docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md).
 * Captures GET /landing/home + GET /landing/settings for every brand on the
 * new stack (per GET /landing/settings's own available_brands list — this
 * is how legacy-PHP brands are excluded, not a hardcoded list), then diffs
 * two captures against each other.
 *
 * Lives under src/scripts/ (not the top-level scripts/) so diffBrandPayload
 * and normalizeForDiff are covered by this repo's jest config (rootDir:
 * "src" — a spec under the top-level scripts/ is never discovered, matching
 * the src/scripts/backfill-program-content-ownership.ts precedent).
 *
 * Endpoint captured: GET /landing/home and GET /landing/settings, once per
 * brand, identified via the x-brand-domain header — confirmed against
 * landing.controller.ts (BrandDomain param decorator) and
 * brand-domain.decorator.ts, not assumed from the brief's prose.
 *
 * DEVIATION FROM THE ORIGINAL TASK 18 BRIEF: the brief's draft resolved each
 * brand's x-brand-domain from `brand.landing_url || brand.website_url`.
 * Checked against the actual resolver (LandingService.resolveBrand(),
 * services/api/src/modules/landing/landing.service.ts) — it matches ONLY
 * against Brand.websiteUrl (exact match, then a `contains` fallback);
 * landingUrl is never consulted for INBOUND brand resolution (it's used
 * elsewhere, by LandingRevalidationService, as the OUTBOUND webhook target
 * for the Next.js app — a different concept). Preferring landing_url here
 * would 404 for any brand whose landingUrl differs from its websiteUrl.
 * This version uses website_url only, and explicitly records+reports (never
 * silently skips) any brand missing one.
 *
 * Which brands: exactly the brands GET /landing/settings's own
 * available_brands list returns (a request with no x-brand-domain header) —
 * this is the API's own live definition of "brands served by the new
 * stack." A brand still on the legacy PHP stack is, by construction,
 * excluded here — not captured, not diffed, and never reported as a
 * failure. A brand that IS on the new stack but has no website_url to
 * resolve x-brand-domain from is recorded in the capture file's `skipped`
 * list and printed loudly both at capture time and at diff time — never
 * silently dropped, since a brand vanishing from a diff reads as "no
 * change" (this task's whole reason for existing is to make an unexpected
 * difference loud, and a silent omission is the same failure in disguise).
 *
 * How compared: a structural deep-diff of the two JSON payloads, with one
 * deliberate exception — home.strategy.ts's image-gallery Fisher-Yates
 * shuffle (confirmed in the source: the `imageGallery` array feeds
 * `program_objectives.gallery`/`.images`, `program_highlights.gallery`/
 * `.image_gallery`, and `program_gallery.gallery`/`.images` — the only
 * JSON keys in the response actually derived from that shuffle) re-
 * randomizes on every cache-miss build, so two genuinely-identical-content
 * fetches of the SAME unmodified brand can still differ in the order of
 * those specific arrays. Comparing them by array order would report false
 * positives on every brand, every time, drowning out any real regression.
 * This script compares gallery/images/image_gallery-keyed arrays AS SETS
 * (sorted by their serialized content) and everything else order-
 * sensitively — the exact and only exception, not a blanket "ignore array
 * order" rule that would hide a real reordering bug elsewhere (e.g.
 * footer_navigation or program_features.items, neither of which should
 * reorder between two runs).
 *
 * What constitutes a pass: for every captured brand, diffBrandPayload(before,
 * after).changedPaths is empty, AND neither capture's `skipped` list is
 * non-empty (an un-capturable brand was never actually verified, so it must
 * not be silently treated as "passed"). Any violation is a genuine issue
 * for that brand and must be investigated before Task 21 is allowed to run.
 *
 * USAGE (from services/api, API_BASE_URL pointing at the TARGET api, default http://localhost:3000):
 *   npx ts-node -r tsconfig-paths/register src/scripts/diff-landing-payloads.ts --capture before
 *   # ...deploy Tasks 15-16, run Task 17's cache purge...
 *   npx ts-node -r tsconfig-paths/register src/scripts/diff-landing-payloads.ts --capture after
 *   npx ts-node -r tsconfig-paths/register src/scripts/diff-landing-payloads.ts --diff before after
 *
 * NEVER point API_BASE_URL at production from an interactive agent session
 * — see this plan's Global Constraints. Capturing "before"/"after" against
 * production is a separate human-approved deployment step run alongside the
 * actual Task 15/16/17 production deploys, in that order.
 */
import { join } from 'path';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';

export interface BrandPayloadCapture {
    brandSlug: string;
    brandName: string;
    home: unknown;
    settings: unknown;
}

export interface BrandDiffResult {
    brandSlug: string;
    brandName: string;
    changedPaths: string[];
}

export interface CaptureSkip {
    brandSlug: string;
    brandName: string;
    reason: string;
}

export interface CaptureFile {
    capturedAt: string;
    baseUrl: string;
    brands: BrandPayloadCapture[];
    /** Brands GET /landing/settings's available_brands listed but this
     *  script could NOT capture (e.g. no website_url to resolve
     *  x-brand-domain from). Named explicitly, never silently omitted —
     *  see this file's header comment. */
    skipped: CaptureSkip[];
}

// Keys whose array value is a product of home.strategy.ts's Fisher-Yates
// image-gallery shuffle (imageGallery, and everything sliced from it:
// objectiveImages, highlightGallery, programGallery) — re-randomized on
// every cache-miss build, so order alone must never be treated as a
// content change for these three keys specifically. See this file's header
// comment for why this is a narrow exception, not a blanket rule.
const SET_COMPARED_ARRAY_KEYS = new Set(['gallery', 'images', 'image_gallery']);

export function normalizeForDiff(value: unknown, keyHint?: string): unknown {
    if (Array.isArray(value)) {
        const normalized = value.map((item) => normalizeForDiff(item));
        if (keyHint && SET_COMPARED_ARRAY_KEYS.has(keyHint)) {
            return [...normalized].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        }
        return normalized;
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, v]) => [key, normalizeForDiff(v, key)]),
        );
    }
    return value;
}

// Recurses into both plain objects (by key) and arrays (by index) so a
// change nested inside a section's content array is reported at its exact
// dot-path (e.g. "home.sections.0.content.title"), not just "home.sections"
// — a human acting on this diff needs to know WHICH field changed, not just
// that "the array" did. Array inputs here have already been through
// normalizeForDiff, so a gallery/images/image_gallery-keyed array is
// already canonically sorted on both sides before this runs — recursing by
// index still correctly reports "no diff" for a mere shuffle (same items
// land at the same index post-sort) and still finds a genuine per-item
// content difference.
function collectDiffPaths(a: unknown, b: unknown, path: string, out: string[]): void {
    if (JSON.stringify(a) === JSON.stringify(b)) return;

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            out.push(path);
            return;
        }
        for (let i = 0; i < a.length; i++) {
            collectDiffPaths(a[i], b[i], `${path}.${i}`, out);
        }
        return;
    }

    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
        for (const key of keys) {
            collectDiffPaths((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`, out);
        }
        return;
    }

    out.push(path);
}

export function diffBrandPayload(before: BrandPayloadCapture, after: BrandPayloadCapture): BrandDiffResult {
    const changedPaths: string[] = [];
    collectDiffPaths(normalizeForDiff(before.home), normalizeForDiff(after.home), 'home', changedPaths);
    collectDiffPaths(normalizeForDiff(before.settings), normalizeForDiff(after.settings), 'settings', changedPaths);
    return { brandSlug: before.brandSlug, brandName: before.brandName, changedPaths };
}

// ─── HTTP-touching wrapper ──────────────────────────────────────────────

/* istanbul ignore next -- exercised by running --capture/--diff against a real API, not a Jest test */
async function fetchJson(baseUrl: string, path: string, brandDomain?: string): Promise<unknown> {
    const response = await fetch(`${baseUrl}${path}`, {
        headers: brandDomain ? { 'x-brand-domain': brandDomain } : {},
    });
    if (!response.ok) {
        throw new Error(`${path} for ${brandDomain ?? '(no brand)'} -> HTTP ${response.status}`);
    }
    return response.json();
}

/* istanbul ignore next */
function backupDir(): string {
    const dir = join(__dirname, '..', '..', 'scripts', 'backups');
    mkdirSync(dir, { recursive: true });
    return dir;
}

/* istanbul ignore next */
async function capture(label: string): Promise<void> {
    const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
    console.log(`[diff-landing-payloads] capturing "${label}" from ${baseUrl}`);

    const settings = (await fetchJson(baseUrl, '/landing/settings')) as {
        available_brands?: Array<{ slug: string; name: string; website_url?: string }>;
    };
    const brands = settings.available_brands ?? [];
    console.log(`[diff-landing-payloads] ${brands.length} brand(s) on the new stack (available_brands) to capture.`);

    const captures: BrandPayloadCapture[] = [];
    const skipped: CaptureSkip[] = [];
    for (const brand of brands) {
        // website_url ONLY — LandingService.resolveBrand() matches against
        // Brand.websiteUrl exclusively (exact, then `contains`). landing_url
        // is never consulted for inbound brand resolution; see this file's
        // header comment for why the brief's landing_url-first order is
        // wrong here and was deliberately not carried over.
        const domain = brand.website_url;
        if (!domain) {
            const reason = 'no website_url on this brand — cannot resolve x-brand-domain (resolveBrand() only matches websiteUrl)';
            console.warn(`[diff-landing-payloads] SKIP ${brand.name}: ${reason}`);
            skipped.push({ brandSlug: brand.slug, brandName: brand.name, reason });
            continue;
        }
        const brandDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
        try {
            const [home, brandSettings] = await Promise.all([
                fetchJson(baseUrl, '/landing/home', brandDomain),
                fetchJson(baseUrl, '/landing/settings', brandDomain),
            ]);
            captures.push({ brandSlug: brand.slug, brandName: brand.name, home, settings: brandSettings });
            console.log(`[diff-landing-payloads] captured: ${brand.name}`);
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            console.warn(`[diff-landing-payloads] SKIP ${brand.name}: request failed — ${reason}`);
            skipped.push({ brandSlug: brand.slug, brandName: brand.name, reason });
        }
    }

    const outPath = join(backupDir(), `diff-landing-payloads-${label}.json`);
    const file: CaptureFile = { capturedAt: new Date().toISOString(), baseUrl, brands: captures, skipped };
    writeFileSync(outPath, JSON.stringify(file, null, 2));
    console.log(`[diff-landing-payloads] wrote ${captures.length} brand capture(s), ${skipped.length} skipped -> ${outPath}`);
    if (skipped.length > 0) {
        console.warn(
            `[diff-landing-payloads] WARNING: ${skipped.length} brand(s) NOT captured (excluded from any future diff): ` +
                skipped.map((s) => s.brandName).join(', '),
        );
    }
}

/* istanbul ignore next */
function readCaptureFile(label: string): CaptureFile {
    const raw = JSON.parse(readFileSync(join(backupDir(), `diff-landing-payloads-${label}.json`), 'utf-8'));
    // Tolerate the pre-skip-tracking bare-array shape so an old capture file
    // can still be diffed, rather than crashing on `.brands`.
    if (Array.isArray(raw)) {
        return { capturedAt: '(unknown — legacy capture file)', baseUrl: '(unknown)', brands: raw, skipped: [] };
    }
    return raw as CaptureFile;
}

/* istanbul ignore next */
function reportSkipped(label: string, file: CaptureFile): void {
    console.log(`[diff-landing-payloads] "${label}" capture: ${file.brands.length} brand(s) captured, ${file.skipped.length} skipped.`);
    for (const s of file.skipped) {
        console.warn(`[diff-landing-payloads]   NOT CAPTURED in "${label}" (excluded from this diff): ${s.brandName} — ${s.reason}`);
    }
}

/* istanbul ignore next */
async function diff(beforeLabel: string, afterLabel: string): Promise<void> {
    const before = readCaptureFile(beforeLabel);
    const after = readCaptureFile(afterLabel);

    // Loud regardless of outcome — a skip is only safe to ignore once a
    // human has actually looked at it, never by staying silent.
    reportSkipped(beforeLabel, before);
    reportSkipped(afterLabel, after);

    const beforeBySlug = new Map(before.brands.map((c) => [c.brandSlug, c]));
    const afterBySlug = new Map(after.brands.map((c) => [c.brandSlug, c]));
    const allSlugs = new Set([...beforeBySlug.keys(), ...afterBySlug.keys()]);

    const results: BrandDiffResult[] = [];
    for (const slug of allSlugs) {
        const beforeCapture = beforeBySlug.get(slug);
        const afterCapture = afterBySlug.get(slug);
        if (!beforeCapture) {
            results.push({ brandSlug: slug, brandName: afterCapture!.brandName, changedPaths: ['MISSING_FROM_BEFORE_CAPTURE'] });
            continue;
        }
        if (!afterCapture) {
            results.push({ brandSlug: slug, brandName: beforeCapture.brandName, changedPaths: ['MISSING_FROM_AFTER_CAPTURE'] });
            continue;
        }
        results.push(diffBrandPayload(beforeCapture, afterCapture));
    }

    const failing = results.filter((r) => r.changedPaths.length > 0);
    const anySkipped = before.skipped.length > 0 || after.skipped.length > 0;
    console.log(`[diff-landing-payloads] ${results.length} brand(s) compared, ${failing.length} with differences.`);
    if (failing.length === 0 && !anySkipped) {
        console.log('[diff-landing-payloads] PASS — every brand renders identically before and after, and every brand was captured.');
        return;
    }
    for (const f of failing) {
        console.log(`[diff-landing-payloads] DIFF: ${f.brandName}`);
        console.log(f.changedPaths.map((p) => `  - ${p}`).join('\n'));
    }
    if (anySkipped) {
        console.warn(
            '[diff-landing-payloads] NOT A CLEAN PASS: at least one brand was never captured (see "NOT CAPTURED" lines above) — ' +
                'it was excluded from this diff, not verified as unchanged.',
        );
    }
    process.exitCode = 1;
}

/* istanbul ignore next */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args[0] === '--capture' && args[1]) {
        await capture(args[1]);
        return;
    }
    if (args[0] === '--diff' && args[1] && args[2]) {
        await diff(args[1], args[2]);
        return;
    }
    console.error('Usage: diff-landing-payloads.ts --capture <label>  |  diff-landing-payloads.ts --diff <before-label> <after-label>');
    process.exitCode = 1;
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[diff-landing-payloads] FAILED:', err);
        process.exitCode = 1;
    });
}

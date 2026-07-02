// services/api/src/scripts/backfill-orphaned-cancellations.ts
/**
 * One-off remediation for the 262 live-orphan cancelled invoices identified in the
 * 2026-07-01 prod audit: a cancelled invoice whose linked Go transaction is still
 * PENDING/NEEDS_REVIEW (never settled, never voided). Re-queries live gateway state
 * at execution time (does NOT trust the audit snapshot, which is known to be
 * growing). Excludes and reports the 1 danger case (SUCCESS at gateway) for manual
 * refund/un-cancel review.
 *
 * DRY RUN BY DEFAULT. Prints a full action list (void N / skip M / danger K) and
 * writes nothing until re-run with --apply.
 *
 * Run (dry run, from services/api):
 *   DATABASE_URL=... PAYMENT_SERVICE_URL=... PAYMENT_SERVICE_INTERNAL_KEY=... \
 *     npm run backfill:orphaned-cancellations
 *
 * Run (apply, only after reviewing the dry-run report):
 *   ... --apply
 *
 * Prod execution follows the standard prod one-off-script pattern: compile
 * locally, ship the compiled JS into the API container, exec there against
 * ybb_platform_db / the payment service's internal URL. See the prod-access
 * reference before running this against prod.
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync, writeFileSync } from 'node:fs';
import * as dotenv from 'dotenv';
import {
    extractTopLevelStatus,
    isSettledStatus,
    isTerminalNonSettledStatus,
    isAwaitingReviewStatus,
} from '../modules/payments/infrastructure/services/gateway-transaction-status.util';

dotenv.config();

export type OrphanClassification =
    | 'void'
    | 'skip_already_terminal'
    | 'skip_needs_review'
    | 'danger_settled'
    | 'skip_no_reference'
    | 'unchecked_error';

export interface OrphanCandidate {
    invoiceId: string;
    applicationId: string;
    transactionId: string;
    invoiceStatus: string;
}

export interface OrphanActionResult {
    invoiceId: string;
    transactionId: string;
    classification: OrphanClassification;
    detail: string;
}

/** Pure classification — no I/O. Kept separate from fetch/void so it's unit-testable. */
export function classifyOrphan(gatewayStatus: string | null): OrphanClassification {
    if (gatewayStatus === null) return 'skip_no_reference';
    if (isSettledStatus(gatewayStatus)) return 'danger_settled';
    if (isTerminalNonSettledStatus(gatewayStatus)) return 'skip_already_terminal';
    // NEEDS_REVIEW means a manual-transfer proof is awaiting admin approve/reject —
    // it is genuinely "live" at the gateway (not terminal), but voiding it would
    // kill a payment a human still needs to act on, so it must NOT be routed to
    // 'void' alongside a plain still-live PENDING transaction.
    if (isAwaitingReviewStatus(gatewayStatus)) return 'skip_needs_review';
    return 'void'; // PENDING / unknown-but-live
}

export type FetchOutcomeKind = 'ok' | 'not_found' | 'auth_failure' | 'other_failure';

/**
 * Pure classification of an HTTP status (or a 'network_error' sentinel for thrown
 * fetch errors) into a fetch outcome kind. Distinguishes auth failures (bad/missing
 * PAYMENT_SERVICE_INTERNAL_KEY) from genuine not-found and other failures — a mass
 * 401 must never be indistinguishable from "nothing to fix" (skip_no_reference).
 */
export function classifyFetchOutcome(status: number | 'network_error'): FetchOutcomeKind {
    if (status === 'network_error') return 'other_failure';
    if (status === 401 || status === 403) return 'auth_failure';
    if (status === 404) return 'not_found';
    if (status >= 200 && status < 300) return 'ok';
    return 'other_failure';
}

export interface GatewayStatusResult {
    kind: FetchOutcomeKind;
    /** Gateway status string (e.g. PENDING/SUCCESS/VOID). Only meaningful when kind === 'ok'. */
    status: string | null;
    httpStatus: number | 'network_error';
}

export interface PostVoidRecheckDecision {
    action: 'flag_danger' | 'treat_as_voided';
}

/**
 * Pure decision for handling an ambiguous HTTP 400 from the cancel/void endpoint.
 * The gateway returns 400 for ANY terminal state, including SUCCESS — so a bare 400
 * can never be trusted as "already voided, safe to reconcile". The caller re-fetches
 * gateway state and re-runs classifyOrphan on it; this decides what to do with that
 * fresh classification. Only a confirmed terminal-non-settled re-check is safe to
 * record as voided — everything else (danger_settled, still-live, or unchecked)
 * defaults to the conservative flag_danger branch so a race-window settlement is
 * never silently written over.
 */
export function decidePostVoidRecheck(reclassification: OrphanClassification): PostVoidRecheckDecision {
    if (reclassification === 'skip_already_terminal') {
        return { action: 'treat_as_voided' };
    }
    return { action: 'flag_danger' };
}

function createPrismaClient(): { prisma: PrismaClient; pool: Pool } {
    let connectionString =
        process.env.DATABASE_URL || 'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';

    const isDocker =
        process.env.IS_DOCKER === 'true' ||
        existsSync('/.dockerenv') ||
        (process.env.HOSTNAME && process.env.HOSTNAME.includes('ybb-api'));

    if (connectionString.includes('postgres-api') && !isDocker) {
        connectionString = connectionString.replace('postgres-api:5432', 'localhost:5438');
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    return { prisma, pool };
}

function paymentServiceBaseUrl(): string {
    return (process.env.PAYMENT_SERVICE_URL || 'http://localhost:8002').replace(/\/+$/, '');
}

function internalHeaders(): Record<string, string> {
    const key = process.env.PAYMENT_SERVICE_INTERNAL_KEY || '';
    return key ? { 'X-Internal-Service-Key': key } : {};
}

async function fetchGatewayStatus(transactionId: string): Promise<GatewayStatusResult> {
    let httpStatus: number | 'network_error';
    try {
        const response = await fetch(`${paymentServiceBaseUrl()}/api/v1/payments/${transactionId}`, {
            headers: internalHeaders(),
        });
        httpStatus = response.status;
        const kind = classifyFetchOutcome(httpStatus);
        if (kind !== 'ok') {
            return { kind, status: null, httpStatus };
        }
        const body = (await response.json()) as Record<string, unknown>;
        const record = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>;
        return { kind: 'ok', status: extractTopLevelStatus(record) || null, httpStatus };
    } catch {
        return { kind: 'other_failure', status: null, httpStatus: 'network_error' };
    }
}

export type VoidOutcome = { outcome: 'ok' } | { outcome: 'http_400' };

async function voidTransaction(transactionId: string, reason: string): Promise<VoidOutcome> {
    const response = await fetch(`${paymentServiceBaseUrl()}/api/v1/payments/${transactionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...internalHeaders() },
        body: JSON.stringify({ reason }),
    });
    if (response.status === 400) {
        // Ambiguous: the gateway returns 400 for ANY terminal state, including SUCCESS.
        // Caller must re-fetch + re-classify before assuming this was a safe no-op.
        return { outcome: 'http_400' };
    }
    if (!response.ok) {
        throw new Error(`cancel failed: HTTP ${response.status}`);
    }
    return { outcome: 'ok' };
}

function assertNotAuthFailure(fetchResult: GatewayStatusResult): void {
    if (fetchResult.kind === 'auth_failure') {
        throw new Error(
            `ABORT: PAYMENT_SERVICE_INTERNAL_KEY rejected (HTTP ${fetchResult.httpStatus}) — cannot trust results, no report written`,
        );
    }
}

function describeFetchResult(fetchResult: GatewayStatusResult): string {
    if (fetchResult.kind === 'ok') return fetchResult.status ?? 'unfetchable';
    if (fetchResult.kind === 'not_found') return 'not_found';
    return fetchResult.httpStatus === 'network_error' ? 'network_error' : `http_${fetchResult.httpStatus}`;
}

interface GatewayCheckResult {
    fetchResult: GatewayStatusResult;
    classification: OrphanClassification;
}

/** Fetches gateway state and classifies it in one step. `not_found` maps to the
 * genuine skip_no_reference path; `auth_failure`/`other_failure` are surfaced via
 * `unchecked_error` so the caller can decide (abort, or tag+warn) rather than having
 * them silently masquerade as "nothing to fix". */
async function checkGateway(transactionId: string): Promise<GatewayCheckResult> {
    const fetchResult = await fetchGatewayStatus(transactionId);
    if (fetchResult.kind === 'ok' || fetchResult.kind === 'not_found') {
        const status = fetchResult.kind === 'ok' ? fetchResult.status : null;
        return { fetchResult, classification: classifyOrphan(status) };
    }
    return { fetchResult, classification: 'unchecked_error' };
}

async function findOrphanCandidates(prisma: PrismaClient): Promise<OrphanCandidate[]> {
    const rows = await prisma.applicationInvoice.findMany({
        where: {
            status: 'cancelled',
            externalTransactionId: { not: null },
        },
        select: { id: true, applicationId: true, externalTransactionId: true, status: true },
    });
    return rows
        .filter((row): row is typeof row & { externalTransactionId: string } => Boolean(row.externalTransactionId))
        .map((row) => ({
            invoiceId: row.id,
            applicationId: row.applicationId,
            transactionId: row.externalTransactionId,
            invoiceStatus: row.status,
        }));
}

async function main(): Promise<void> {
    const apply = process.argv.includes('--apply');
    const { prisma, pool } = createPrismaClient();
    const results: OrphanActionResult[] = [];

    try {
        const candidates = await findOrphanCandidates(prisma);
        console.log(`Found ${candidates.length} cancelled invoices with a linked transaction. Re-checking gateway state...`);

        for (const candidate of candidates) {
            const initial = await checkGateway(candidate.transactionId);
            assertNotAuthFailure(initial.fetchResult);

            let classification = initial.classification;
            let detail = describeFetchResult(initial.fetchResult);

            if (classification === 'void' && apply) {
                const voidResult = await voidTransaction(
                    candidate.transactionId,
                    'Backfill: orphaned cancelled invoice (2026-07-01 audit)',
                );

                if (voidResult.outcome === 'http_400') {
                    // 400 is ambiguous (returned for ANY terminal state, including SUCCESS) —
                    // never assume success. Re-fetch + re-classify before writing anything.
                    const recheck = await checkGateway(candidate.transactionId);
                    assertNotAuthFailure(recheck.fetchResult);

                    const decision = decidePostVoidRecheck(recheck.classification);
                    detail = `post-400 recheck: ${describeFetchResult(recheck.fetchResult)}`;

                    if (decision.action === 'flag_danger') {
                        classification = 'danger_settled';
                    } else {
                        classification = 'skip_already_terminal';
                        await prisma.applicationInvoice.update({
                            where: { id: candidate.invoiceId },
                            data: { lastReconciledAt: new Date() },
                        });
                    }
                } else {
                    await prisma.applicationInvoice.update({
                        where: { id: candidate.invoiceId },
                        data: { lastReconciledAt: new Date() },
                    });
                }
            }

            results.push({
                invoiceId: candidate.invoiceId,
                transactionId: candidate.transactionId,
                classification,
                detail,
            });
        }

        const voided = results.filter((r) => r.classification === 'void').length;
        const skipped = results.filter((r) => r.classification === 'skip_already_terminal').length;
        const skippedNeedsReview = results.filter((r) => r.classification === 'skip_needs_review').length;
        const danger = results.filter((r) => r.classification === 'danger_settled').length;
        const noRef = results.filter((r) => r.classification === 'skip_no_reference').length;
        const unchecked = results.filter((r) => r.classification === 'unchecked_error').length;

        console.log(
            `\n${apply ? 'APPLIED' : 'DRY RUN'} — void=${voided} skip_already_terminal=${skipped} skip_needs_review=${skippedNeedsReview} danger_settled=${danger} skip_no_reference=${noRef} unchecked_error=${unchecked}`,
        );
        if (skippedNeedsReview > 0) {
            console.log('\nSKIPPED — AWAITING MANUAL REVIEW (needs admin approve/reject via verify action):');
            for (const r of results.filter((r) => r.classification === 'skip_needs_review')) {
                console.log(`  invoice=${r.invoiceId} txn=${r.transactionId} detail=${r.detail}`);
            }
        }
        if (danger > 0) {
            console.log('\nDANGER CASES (needs human refund/un-cancel review):');
            for (const r of results.filter((r) => r.classification === 'danger_settled')) {
                console.log(`  invoice=${r.invoiceId} txn=${r.transactionId} detail=${r.detail}`);
            }
        }
        if (unchecked > 0) {
            console.warn(
                `\nWARNING: ${unchecked} records could not be checked due to network/5xx errors — treat report as incomplete`,
            );
        }

        const reportPath = `backfill-orphaned-cancellations.${apply ? 'applied' : 'dry-run'}.${Date.now()}.json`;
        writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`\nFull report written to ${reportPath}`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

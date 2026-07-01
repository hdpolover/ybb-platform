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
} from '../modules/payments/infrastructure/services/gateway-transaction-status.util';

dotenv.config();

export type OrphanClassification = 'void' | 'skip_already_terminal' | 'danger_settled' | 'skip_no_reference';

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
    return 'void'; // PENDING / NEEDS_REVIEW / unknown-but-live
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

async function fetchGatewayStatus(transactionId: string): Promise<string | null> {
    try {
        const response = await fetch(`${paymentServiceBaseUrl()}/api/v1/payments/${transactionId}`, {
            headers: internalHeaders(),
        });
        if (!response.ok) return null;
        const body = (await response.json()) as Record<string, unknown>;
        const record = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>;
        return extractTopLevelStatus(record) || null;
    } catch {
        return null;
    }
}

async function voidTransaction(transactionId: string, reason: string): Promise<void> {
    const response = await fetch(`${paymentServiceBaseUrl()}/api/v1/payments/${transactionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...internalHeaders() },
        body: JSON.stringify({ reason }),
    });
    if (!response.ok && response.status !== 400) {
        throw new Error(`cancel failed: HTTP ${response.status}`);
    }
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
            const gatewayStatus = await fetchGatewayStatus(candidate.transactionId);
            const classification = classifyOrphan(gatewayStatus);

            if (classification === 'void' && apply) {
                await voidTransaction(candidate.transactionId, 'Backfill: orphaned cancelled invoice (2026-07-01 audit)');
                await prisma.applicationInvoice.update({
                    where: { id: candidate.invoiceId },
                    data: { lastReconciledAt: new Date() },
                });
            }

            results.push({
                invoiceId: candidate.invoiceId,
                transactionId: candidate.transactionId,
                classification,
                detail: gatewayStatus ?? 'unfetchable',
            });
        }

        const voided = results.filter((r) => r.classification === 'void').length;
        const skipped = results.filter((r) => r.classification === 'skip_already_terminal').length;
        const danger = results.filter((r) => r.classification === 'danger_settled').length;
        const noRef = results.filter((r) => r.classification === 'skip_no_reference').length;

        console.log(`\n${apply ? 'APPLIED' : 'DRY RUN'} — void=${voided} skip_already_terminal=${skipped} danger_settled=${danger} skip_no_reference=${noRef}`);
        if (danger > 0) {
            console.log('\nDANGER CASES (needs human refund/un-cancel review):');
            for (const r of results.filter((r) => r.classification === 'danger_settled')) {
                console.log(`  invoice=${r.invoiceId} txn=${r.transactionId} gatewayStatus=${r.detail}`);
            }
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

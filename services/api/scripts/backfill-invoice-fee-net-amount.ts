/**
 * backfill-invoice-fee-net-amount.ts
 *
 * One-off backfill: application_invoices.fee_provider / net_amount are new
 * columns (see prisma/migrations/20260701000000_add_invoice_fee_net_amount)
 * populated going forward by payment-events.controller.ts /
 * payment-reconciliation.service.ts off the payment.succeeded event and the
 * reconciliation gateway payload. Rows settled BEFORE that change (and any
 * event that landed before the producer started emitting the new fields) have
 * NULL fee_provider/net_amount and need a one-time backfill straight from the
 * Go payment service's payment_transactions table.
 *
 * Cross-DB join by convention only (no FK): application_invoices lives in the
 * api Postgres DB (ybb_platform_db, via Prisma/DATABASE_URL), payment_transactions
 * lives in a SEPARATE Postgres DB owned by the Go payment service
 * (ybb_payments_db). They are linked by
 *   application_invoices.external_transaction_id = payment_transactions.id
 *
 * SAFETY: DRY RUN by default (read-only, prints a report, no writes).
 * Pass --apply to write. In --apply mode, only rows where
 * feeProvider IS NULL OR netAmount IS NULL are touched (per-column: an
 * already-populated column is left untouched even if its sibling is null) -
 * this keeps the script idempotent and never clobbers a value a newer event
 * already wrote correctly.
 *
 * USAGE (from services/api, with DATABASE_URL pointing at the TARGET api db
 * AND PAYMENT_DATABASE_URL pointing at the payment service's db):
 *   PAYMENT_DATABASE_URL=postgres://... npx ts-node scripts/backfill-invoice-fee-net-amount.ts            # dry run
 *   PAYMENT_DATABASE_URL=postgres://... npx ts-node scripts/backfill-invoice-fee-net-amount.ts --apply    # execute
 *
 * PAYMENT_DATABASE_URL is intentionally NOT stored in services/api/.env (this
 * service has no business reading the payment DB in normal operation) - pass
 * it explicitly on the command line, or export it in your shell, for this
 * one-off run only. It matches services/payment/.env's own DATABASE_URL value.
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Load services/api/.env regardless of the directory the script is invoked from.
loadEnv({ path: join(__dirname, '..', '.env') });

const apiConnectionString = process.env.DATABASE_URL;
if (!apiConnectionString) {
    throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
}

const paymentConnectionString = process.env.PAYMENT_DATABASE_URL;
if (!paymentConnectionString) {
    throw new Error(
        'PAYMENT_DATABASE_URL is not set. Point it at the payment service\'s Postgres ' +
        '(ybb_payments_db) - see services/payment/.env DATABASE_URL for the value to reuse.',
    );
}

const apiPool = new Pool({ connectionString: apiConnectionString });
const adapter = new PrismaPg(apiPool);
const prisma = new PrismaClient({ adapter });
const paymentPool = new Pool({ connectionString: paymentConnectionString });

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 500;

interface PaidInvoiceRow {
    id: string;
    externalTransactionId: string;
    currency: string;
    amount: unknown; // Prisma.Decimal
    feeProvider: unknown | null;
    netAmount: unknown | null;
}

interface PaymentTxnRow {
    id: string;
    currency: string;
    amount_total: string; // numeric comes back as string from pg
    fee_provider: string | null;
    net_amount: string | null;
}

async function fetchAllPaidInvoices(): Promise<PaidInvoiceRow[]> {
    const rows: PaidInvoiceRow[] = [];
    let cursor: string | undefined;
    for (;;) {
        const page = await prisma.applicationInvoice.findMany({
            where: {
                status: 'paid',
                externalTransactionId: { not: null },
            },
            select: {
                id: true,
                externalTransactionId: true,
                currency: true,
                amount: true,
                feeProvider: true,
                netAmount: true,
            },
            orderBy: { id: 'asc' },
            take: BATCH_SIZE,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (page.length === 0) break;
        rows.push(
            ...page.map((p) => ({
                id: p.id,
                externalTransactionId: p.externalTransactionId as string,
                currency: p.currency,
                amount: p.amount,
                feeProvider: p.feeProvider,
                netAmount: p.netAmount,
            })),
        );
        cursor = page[page.length - 1].id;
        if (page.length < BATCH_SIZE) break;
    }
    return rows;
}

async function fetchPaymentTransactions(ids: string[]): Promise<Map<string, PaymentTxnRow>> {
    const map = new Map<string, PaymentTxnRow>();
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const { rows } = await paymentPool.query<PaymentTxnRow>(
            `SELECT id, currency, amount_total, fee_provider, net_amount
             FROM payment_transactions
             WHERE id = ANY($1::uuid[])`,
            [chunk],
        );
        for (const row of rows) {
            map.set(row.id, row);
        }
    }
    return map;
}

async function main(): Promise<void> {
    console.log(`[backfill-invoice-fee-net-amount] mode: ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);

    const invoices = await fetchAllPaidInvoices();
    console.log(`[backfill-invoice-fee-net-amount] paid invoices with external_transaction_id: ${invoices.length}`);

    const txnMap = await fetchPaymentTransactions(invoices.map((i) => i.externalTransactionId));

    let matched = 0;
    let currencyMismatches = 0;
    let alreadyPopulated = 0;
    let needsUpdate = 0;
    let sumAmountTotal = 0;
    let sumFeeProvider = 0;
    let sumNetAmount = 0;

    const toUpdate: Array<{ id: string; feeProvider: number | null; netAmount: number | null }> = [];

    for (const invoice of invoices) {
        const txn = txnMap.get(invoice.externalTransactionId);
        if (!txn || txn.fee_provider === null) {
            continue; // no matching payment_transactions row, or fee_provider not set at source
        }
        matched += 1;

        if (txn.currency && invoice.currency && txn.currency !== invoice.currency) {
            currencyMismatches += 1;
        }

        sumAmountTotal += Number(txn.amount_total ?? 0);
        sumFeeProvider += Number(txn.fee_provider ?? 0);
        sumNetAmount += Number(txn.net_amount ?? 0);

        const needsFeeProvider = invoice.feeProvider === null;
        const needsNetAmount = invoice.netAmount === null;
        if (!needsFeeProvider && !needsNetAmount) {
            alreadyPopulated += 1;
            continue;
        }

        needsUpdate += 1;
        toUpdate.push({
            id: invoice.id,
            feeProvider: needsFeeProvider ? Number(txn.fee_provider) : null,
            netAmount: needsNetAmount && txn.net_amount !== null ? Number(txn.net_amount) : null,
        });
    }

    console.log(`[backfill-invoice-fee-net-amount] matched payment_transactions rows (fee_provider present): ${matched}`);
    console.log(`[backfill-invoice-fee-net-amount] currency mismatches (invoice.currency != txn.currency): ${currencyMismatches}`);
    console.log(`[backfill-invoice-fee-net-amount] already fully populated (skipped): ${alreadyPopulated}`);
    console.log(`[backfill-invoice-fee-net-amount] rows needing update: ${needsUpdate}`);
    console.log(
        `[backfill-invoice-fee-net-amount] SUM across matched set -> amount_total=${sumAmountTotal.toFixed(2)} ` +
        `fee_provider=${sumFeeProvider.toFixed(2)} net_amount=${sumNetAmount.toFixed(2)}`,
    );

    if (!APPLY) {
        console.log('[backfill-invoice-fee-net-amount] DRY RUN complete. Re-run with --apply to write.');
        return;
    }

    if (toUpdate.length === 0) {
        console.log('[backfill-invoice-fee-net-amount] nothing to update.');
        return;
    }

    // Per-row updates (not a single transaction): each write is independently
    // idempotent (guarded by the null check above), so a partial failure just
    // means re-running the script picks up where it left off.
    let updated = 0;
    for (const row of toUpdate) {
        await prisma.applicationInvoice.update({
            where: { id: row.id },
            data: {
                ...(row.feeProvider !== null ? { feeProvider: row.feeProvider } : {}),
                ...(row.netAmount !== null ? { netAmount: row.netAmount } : {}),
            },
        });
        updated += 1;
    }
    console.log(`[backfill-invoice-fee-net-amount] updated ${updated} invoice(s).`);
}

main()
    .catch((err) => {
        console.error('[backfill-invoice-fee-net-amount] FAILED:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await apiPool.end();
        await paymentPool.end();
    });

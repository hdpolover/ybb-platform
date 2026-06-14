/**
 * reconcile-paid-intents.ts
 *
 * One-off data repair: a small set of registration-fee payments SUCCEEDED at
 * the gateway (verified directly against the payment service DB:
 * payment_intents.status='SUCCEEDED' + payment_transactions.status='SUCCESS'),
 * but the payment.succeeded event never synced to the api DB, leaving the
 * ApplicationInvoice stuck at 'processing' and registrationPaymentStatus
 * 'unpaid'. This re-syncs the api DB to the gateway truth so these (genuinely
 * paid) participants are NOT swept up by the unpaid-submission revert.
 *
 * For each intent id below: find its registration_fee ApplicationInvoice, set
 * status='paid' (+ paidAt if missing), and set the application's
 * registrationPaymentStatus='paid'. Idempotent: already-paid rows are skipped.
 *
 * The INTENT_IDS were verified SUCCEEDED on 2026-06-14 against
 * ybb-prod-postgres-payment (ybb_payments_db.payment_intents).
 *
 * SAFETY: DRY RUN by default. Pass --apply to write (single transaction).
 *
 * USAGE (inside the api container, or with DATABASE_URL set):
 *   node reconcile-paid-intents.js            # dry run
 *   node reconcile-paid-intents.js --apply    # execute
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');

// Intents verified SUCCEEDED at the gateway but not synced to the api DB.
const INTENT_IDS = [
    'b3f5292d-74f0-4e6a-83aa-c5debdf98879',
    'e1eea5ab-2d3f-4a75-a20c-51a3468f7793',
    'e475d08b-ed10-4290-bcee-9485ee05a09d',
];

async function main(): Promise<void> {
    console.log(`[reconcile-paid-intents] mode: ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);

    const invoices = await prisma.applicationInvoice.findMany({
        where: {
            externalIntentId: { in: INTENT_IDS },
            pricingTier: { feeType: 'registration_fee' },
        },
        select: { id: true, applicationId: true, status: true, externalIntentId: true, paidAt: true },
    });

    console.log(`[reconcile-paid-intents] matched ${invoices.length} registration_fee invoice(s) for ${INTENT_IDS.length} intent id(s).`);
    for (const inv of invoices) {
        console.log(
            `  intent=${inv.externalIntentId} invoice=${inv.id} application=${inv.applicationId} ` +
            `currentStatus=${inv.status} -> paid`,
        );
    }

    const missing = INTENT_IDS.filter((id) => !invoices.some((i) => i.externalIntentId === id));
    if (missing.length > 0) {
        console.warn(`[reconcile-paid-intents] WARNING: no registration_fee invoice found for: ${missing.join(', ')}`);
    }

    const toFix = invoices.filter((i) => i.status !== 'paid');
    console.log(`[reconcile-paid-intents] ${toFix.length} need updating (${invoices.length - toFix.length} already paid).`);

    if (!APPLY || toFix.length === 0) {
        console.log(APPLY ? '[reconcile-paid-intents] nothing to update.' : '[reconcile-paid-intents] DRY RUN complete. Re-run with --apply to write.');
        return;
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
        for (const inv of toFix) {
            await tx.applicationInvoice.update({
                where: { id: inv.id },
                data: { status: 'paid', paidAt: inv.paidAt ?? now },
            });
            await tx.participantApplication.update({
                where: { id: inv.applicationId },
                data: { registrationPaymentStatus: 'paid' },
            });
        }
    });
    console.log(`[reconcile-paid-intents] reconciled ${toFix.length} invoice(s) + application(s) to paid.`);
}

main()
    .catch((err) => {
        console.error('[reconcile-paid-intents] FAILED:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });

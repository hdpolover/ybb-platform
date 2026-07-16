/**
 * revert-unpaid-submissions.ts
 *
 * One-off remediation for the registration-fee gate bug: prior to the
 * fail-closed gate (see RegistrationFeeGateService), participants could reach
 * status='submitted' WITHOUT having paid the program's registration fee
 * (fully_funded auto-bypass + historical fail-open gate). This reverts those
 * applications back to 'draft' so they must pay before re-submitting.
 *
 * The "should have paid but didn't" criterion mirrors RegistrationFeeGateService,
 * then adds a SAFETY net so we never revert someone who actually paid:
 *
 *   base = status === 'submitted'
 *     AND the program has an ACTIVE registration_fee pricing tier   (fee required)
 *     AND registrationPaymentStatus NOT IN ('paid','refunded')
 *
 *   Of the base set, classify each application by its registration_fee invoices:
 *     - PAID:  any reg_fee invoice status IN ('paid','refunded')  -> excluded (they paid)
 *     - HOLD:  any reg_fee invoice status='processing' with an external intent/txn id
 *              -> AMBIGUOUS. Payment may have succeeded at the gateway but the
 *                 payment.succeeded event never synced to our DB. NOT reverted.
 *                 Verify against the Go payment service before deciding.
 *     - REVERT: everything else (no payment evidence at all) -> safe to revert.
 *
 * Only the REVERT bucket is mutated by --apply. HOLD + PAID are reported, not touched.
 *
 * NOTE: the api Postgres has NO payment/transaction table — PaymentIntents live
 * only in the Go payment service. So 'processing'+external-id is the strongest
 * "maybe paid" signal available here; confirming it requires the Go service.
 *
 * Soft-delete: ParticipantApplication and ProgramPricingTier carry deletedAt,
 * so we filter deletedAt:null to match what the app's PrismaService extension
 * applies at runtime. ApplicationInvoice has no deletedAt column.
 *
 * Action on REVERT rows: status -> 'draft', submittedAt -> null.
 *
 * SAFETY:
 *   - DRY RUN by default. Prints the count + a sample and writes a FULL backup
 *     JSON of every affected row to ./backups/ . Makes NO changes.
 *   - Pass --apply to actually perform the revert (still writes the backup
 *     first, then mutates inside a single transaction).
 *
 * USAGE (from services/api, with DATABASE_URL pointing at the TARGET db):
 *   npx ts-node scripts/revert-unpaid-submissions.ts            # dry run
 *   npx ts-node scripts/revert-unpaid-submissions.ts --apply    # execute
 *
 * ALWAYS run the dry run first, eyeball the count + backup file, then --apply.
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Load services/api/.env regardless of the directory the script is invoked from.
loadEnv({ path: join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
}

// Mirror PrismaService: Prisma 7 uses the pg driver adapter.
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');

interface AffectedRow {
    id: string;
    participantId: string;
    programId: string | null;
    registrationPaymentStatus: string;
    submittedAt: Date | null;
}

interface HoldRow extends AffectedRow {
    invoiceId: string;
    invoiceStatus: string;
    externalIntentId: string | null;
    externalTransactionId: string | null;
}

interface Buckets {
    revert: AffectedRow[]; // safe to revert: no payment evidence at all
    hold: HoldRow[];       // ambiguous: processing + external id -> verify vs Go service
    paidExcluded: number;  // had a paid/refunded reg_fee invoice -> they paid
}

const PAID_STATUSES = new Set(['paid', 'refunded']);

// Intent ids whose 'processing' api invoice was VERIFIED at the gateway
// (ybb_payments_db.payment_intents on 2026-06-14) to be NOT paid — gateway
// status REQUIRES_PAYMENT_METHOD with an abandoned PENDING transaction. These
// are safe to revert despite looking ambiguous. Intentionally EXCLUDED:
//   - 3 SUCCEEDED intents -> already reconciled to paid (see reconcile-paid-intents.ts)
//   - 3 NEEDS_REVIEW intents (manual transfer proof awaiting admin) -> stay HOLD
// Any processing+id invoice NOT in this set still defaults to HOLD (fail-safe).
const VERIFIED_UNPAID_INTENT_IDS = new Set([
    '05837565-8519-4628-bab4-dc6048338029',
    '07ddab6b-5ee0-4c0a-887f-d75b3b1d4284',
    '1b5b5ded-92e7-40a9-b085-b74b817959b4',
    '21a9b362-61a6-4feb-a8d8-d94c689000cc',
    '41bc5e02-5533-4f4c-b8d4-d9b4dc58f1a4',
    '771aed05-b399-4951-a90a-49df38b8167a',
    '82bdb397-e005-482a-8534-180025c6eb85',
    '9dad9c41-dcf8-4bce-8776-0bc6b2a76896',
    'a977e83d-4b78-4626-96a6-de8f8f8f2c64',
    'baa1b68c-abae-44cc-9f67-8d996dc7e20d',
    'bb0341fe-9e1f-4682-9e9d-ff3e4a75a670',
    'c2576e67-8133-40ad-bcf1-149afdf916b3',
    'c8e8dc19-7816-45da-aded-b41381b150cb',
    'ca5ac3e0-a97e-40ac-8265-206ed5f8693a',
    'd8a89250-4f99-474d-8efe-8caecc8faf18',
    'eebf04ae-bb81-4fb9-805c-7316ed6519a4',
    'eef4df0b-e355-4206-8007-73ecb80536a7',
    'f1787d1b-9ddb-42e5-8a45-d4dd2d456fb5',
    'f8fc1373-5f65-497e-b7f9-641b91a42535',
    'fd9393ca-5297-4003-936f-bb636f5622f0',
    'ff536e6c-a554-4824-9717-0f904a6e4671',
]);

async function classify(): Promise<Buckets> {
    // 1. Programs that actually charge a registration fee (active, non-deleted tier).
    const regFeeTiers = await prisma.programPricingTier.findMany({
        where: { isActive: true, feeType: 'registration_fee', deletedAt: null },
        select: { programId: true },
    });
    const programsWithRegFee = new Set(regFeeTiers.map((t) => t.programId));

    // 2. All currently-submitted, non-deleted applications.
    const submitted = await prisma.participantApplication.findMany({
        where: { status: 'submitted', deletedAt: null },
        select: {
            id: true,
            participantId: true,
            programId: true,
            registrationPaymentStatus: true,
            submittedAt: true,
        },
    });

    // 3. Base set: program requires a fee AND the denormalised status is not a
    //    paid/refunded state. (Cheap pre-filter before the invoice lookup.)
    const candidates = submitted.filter(
        (a) =>
            a.programId != null &&
            programsWithRegFee.has(a.programId) &&
            !PAID_STATUSES.has(a.registrationPaymentStatus),
    );
    if (candidates.length === 0) return { revert: [], hold: [], paidExcluded: 0 };

    // 4. Pull every registration_fee invoice for the candidates so we can detect
    //    paid/refunded (they paid) and processing+external-id (ambiguous, hold).
    const invoices = await prisma.applicationInvoice.findMany({
        where: {
            applicationId: { in: candidates.map((c) => c.id) },
            pricingTier: { feeType: 'registration_fee' },
        },
        select: {
            applicationId: true,
            id: true,
            status: true,
            externalIntentId: true,
            externalTransactionId: true,
        },
    });

    const byApp = new Map<string, typeof invoices>();
    for (const inv of invoices) {
        const list = byApp.get(inv.applicationId) ?? [];
        list.push(inv);
        byApp.set(inv.applicationId, list);
    }

    const buckets: Buckets = { revert: [], hold: [], paidExcluded: 0 };

    for (const c of candidates) {
        const invs = byApp.get(c.id) ?? [];

        // PAID: any reg_fee invoice already settled (paid or refunded) -> they paid.
        if (invs.some((i) => PAID_STATUSES.has(i.status))) {
            buckets.paidExcluded += 1;
            continue;
        }

        // HOLD: a processing invoice that has a gateway intent/txn id may have
        // actually succeeded without the success event reaching our DB.
        // Exception: if its intent id was VERIFIED at the gateway to be unpaid,
        // it is safe to revert (fall through). Anything else stays HOLD.
        const ambiguous = invs.find(
            (i) =>
                i.status === 'processing' &&
                ((i.externalIntentId != null && i.externalIntentId.trim().length > 0) ||
                    (i.externalTransactionId != null && i.externalTransactionId.trim().length > 0)),
        );
        if (ambiguous) {
            const verifiedUnpaid =
                ambiguous.externalIntentId != null &&
                VERIFIED_UNPAID_INTENT_IDS.has(ambiguous.externalIntentId);
            if (!verifiedUnpaid) {
                buckets.hold.push({
                    id: c.id,
                    participantId: c.participantId,
                    programId: c.programId,
                    registrationPaymentStatus: c.registrationPaymentStatus,
                    submittedAt: c.submittedAt,
                    invoiceId: ambiguous.id,
                    invoiceStatus: ambiguous.status,
                    externalIntentId: ambiguous.externalIntentId,
                    externalTransactionId: ambiguous.externalTransactionId,
                });
                continue;
            }
            // verified unpaid at gateway -> safe to revert; fall through.
        }

        // REVERT: no payment evidence at all.
        buckets.revert.push({
            id: c.id,
            participantId: c.participantId,
            programId: c.programId,
            registrationPaymentStatus: c.registrationPaymentStatus,
            submittedAt: c.submittedAt,
        });
    }

    return buckets;
}

async function main(): Promise<void> {
    console.log(`[revert-unpaid-submissions] mode: ${APPLY ? 'APPLY (will mutate REVERT bucket)' : 'DRY RUN (no changes)'}`);

    const { revert, hold, paidExcluded } = await classify();
    console.log(
        `[revert-unpaid-submissions] buckets -> REVERT(safe): ${revert.length}  |  ` +
        `HOLD(ambiguous, verify vs Go service): ${hold.length}  |  ` +
        `PAID/REFUNDED(excluded): ${paidExcluded}`,
    );

    if (revert.length === 0 && hold.length === 0) {
        console.log('[revert-unpaid-submissions] nothing to do.');
        return;
    }

    // Always write a full backup of both buckets before doing anything.
    const backupDir = join(__dirname, 'backups');
    mkdirSync(backupDir, { recursive: true });
    // Timestamp comes from the OS at runtime; this is a one-off operational script.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `revert-unpaid-submissions-${stamp}.json`);
    writeFileSync(backupPath, JSON.stringify({ revert, hold, paidExcluded }, null, 2));
    console.log(`[revert-unpaid-submissions] backup written: ${backupPath}`);

    if (hold.length > 0) {
        console.log(`[revert-unpaid-submissions] HOLD sample (NOT reverted — verify these actually paid at the gateway):`);
        console.table(
            hold.slice(0, 20).map((h) => ({
                id: h.id,
                participantId: h.participantId,
                invoiceStatus: h.invoiceStatus,
                intentId: h.externalIntentId,
                txnId: h.externalTransactionId,
            })),
        );
        if (hold.length > 20) console.log(`[revert-unpaid-submissions] ...and ${hold.length - 20} more HOLD (see backup).`);
    }

    console.log(`[revert-unpaid-submissions] REVERT sample (safe to revert — no payment evidence):`);
    console.table(
        revert.slice(0, 20).map((a) => ({
            id: a.id,
            participantId: a.participantId,
            programId: a.programId,
            regStatus: a.registrationPaymentStatus,
            submittedAt: a.submittedAt?.toISOString() ?? null,
        })),
    );
    if (revert.length > 20) {
        console.log(`[revert-unpaid-submissions] ...and ${revert.length - 20} more REVERT (see backup).`);
    }

    if (!APPLY) {
        console.log('[revert-unpaid-submissions] DRY RUN complete. Re-run with --apply to revert ONLY the REVERT bucket to draft.');
        return;
    }

    const ids = revert.map((a) => a.id);
    if (ids.length === 0) {
        console.log('[revert-unpaid-submissions] REVERT bucket empty — nothing mutated.');
        return;
    }
    const result = await prisma.$transaction(async (tx) => {
        return tx.participantApplication.updateMany({
            where: { id: { in: ids }, status: 'submitted', deletedAt: null },
            data: { status: 'draft', submittedAt: null },
        });
    });
    console.log(`[revert-unpaid-submissions] reverted ${result.count} application(s) to draft. (HOLD bucket of ${hold.length} left untouched.)`);
}

main()
    .catch((err) => {
        console.error('[revert-unpaid-submissions] FAILED:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });

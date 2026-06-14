/**
 * revert-unpaid-submissions.ts
 *
 * One-off remediation for the registration-fee gate bug: prior to the
 * fail-closed gate (see RegistrationFeeGateService), participants could reach
 * status='submitted' WITHOUT having paid the program's registration fee
 * (fully_funded auto-bypass + historical fail-open gate). This reverts those
 * applications back to 'draft' so they must pay before re-submitting.
 *
 * The "should have paid but didn't" criterion mirrors RegistrationFeeGateService
 * EXACTLY so this cleanup cannot drift from the live gate:
 *   affected = status === 'submitted'
 *     AND the program has an ACTIVE registration_fee pricing tier   (fee required)
 *     AND registrationPaymentStatus !== 'paid'
 *     AND no PAID registration_fee ApplicationInvoice exists for the app
 *
 * Action on affected rows: status -> 'draft', submittedAt -> null.
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
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

interface AffectedRow {
    id: string;
    participantId: string;
    programId: string | null;
    registrationPaymentStatus: string;
    submittedAt: Date | null;
}

async function findAffected(): Promise<AffectedRow[]> {
    // 1. Programs that actually charge a registration fee (active tier).
    const regFeeTiers = await prisma.programPricingTier.findMany({
        where: { isActive: true, feeType: 'registration_fee' },
        select: { programId: true },
    });
    const programsWithRegFee = new Set(regFeeTiers.map((t) => t.programId));

    // 2. All currently-submitted applications.
    const submitted = await prisma.participantApplication.findMany({
        where: { status: 'submitted' },
        select: {
            id: true,
            participantId: true,
            programId: true,
            registrationPaymentStatus: true,
            submittedAt: true,
        },
    });

    // 3. Of those, the ones whose program requires a fee and who are not paid
    //    by the denormalised status field. (Cheap pre-filter before the invoice
    //    lookup.)
    const candidates = submitted.filter(
        (a) =>
            a.programId != null &&
            programsWithRegFee.has(a.programId) &&
            a.registrationPaymentStatus !== 'paid',
    );
    if (candidates.length === 0) return [];

    // 4. Race-condition guard: exclude any candidate that DOES have a paid
    //    registration_fee invoice (status field may simply lag the invoice).
    const paidInvoices = await prisma.applicationInvoice.findMany({
        where: {
            applicationId: { in: candidates.map((c) => c.id) },
            status: 'paid',
            pricingTier: { feeType: 'registration_fee' },
        },
        select: { applicationId: true },
    });
    const paidAppIds = new Set(paidInvoices.map((i) => i.applicationId));

    return candidates.filter((c) => !paidAppIds.has(c.id));
}

async function main(): Promise<void> {
    console.log(`[revert-unpaid-submissions] mode: ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);

    const affected = await findAffected();
    console.log(`[revert-unpaid-submissions] affected applications: ${affected.length}`);

    if (affected.length === 0) {
        console.log('[revert-unpaid-submissions] nothing to do.');
        return;
    }

    // Always write a full backup of the affected rows before doing anything.
    const backupDir = join(process.cwd(), 'backups');
    mkdirSync(backupDir, { recursive: true });
    // Timestamp comes from the OS at runtime; this is a one-off operational script.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `revert-unpaid-submissions-${stamp}.json`);
    writeFileSync(backupPath, JSON.stringify(affected, null, 2));
    console.log(`[revert-unpaid-submissions] backup written: ${backupPath}`);

    // Show a sample for eyeballing.
    console.table(
        affected.slice(0, 20).map((a) => ({
            id: a.id,
            participantId: a.participantId,
            programId: a.programId,
            regStatus: a.registrationPaymentStatus,
            submittedAt: a.submittedAt?.toISOString() ?? null,
        })),
    );
    if (affected.length > 20) {
        console.log(`[revert-unpaid-submissions] ...and ${affected.length - 20} more (see backup file).`);
    }

    if (!APPLY) {
        console.log('[revert-unpaid-submissions] DRY RUN complete. Re-run with --apply to revert these to draft.');
        return;
    }

    const ids = affected.map((a) => a.id);
    const result = await prisma.$transaction(async (tx) => {
        return tx.participantApplication.updateMany({
            where: { id: { in: ids }, status: 'submitted' },
            data: { status: 'draft', submittedAt: null },
        });
    });
    console.log(`[revert-unpaid-submissions] reverted ${result.count} application(s) to draft.`);
}

main()
    .catch((err) => {
        console.error('[revert-unpaid-submissions] FAILED:', err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());

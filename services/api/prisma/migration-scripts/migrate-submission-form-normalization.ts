import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { normalizePhoneCountryCodeDetailed } from '../../src/shared/utils/phone-country-code';

type MigrationReport = {
    deactivatedPictureFields: number;
    participantsScanned: number;
    participantsUpdated: number;
    participantValuesNormalized: number;
    applicationsScanned: number;
    applicationsUpdated: number;
    applicationValuesNormalized: number;
    unresolvedValues: number;
    unresolvedSamples: string[];
};

const PROFILE_PICTURE_FIELD_NAMES = [
    'picture_url',
    'profile_photo_url',
    'profile_picture_url',
];

const APPLICATION_PHONE_COUNTRY_KEYS = [
    'phone_country_code',
    'phoneCountryCode',
    'emergency_country_code',
    'emergencyCountryCode',
    'emergency_contact_country_code',
    'emergencyContactCountryCode',
];

const PARTICIPANT_PHONE_COUNTRY_KEYS: Array<'phoneCountryCode' | 'emergencyContactCountryCode'> = [
    'phoneCountryCode',
    'emergencyContactCountryCode',
];

const BATCH_SIZE = 300;
const UNRESOLVED_SAMPLE_LIMIT = 25;

function pushUnresolvedSample(report: MigrationReport, sample: string): void {
    if (report.unresolvedSamples.length >= UNRESOLVED_SAMPLE_LIMIT) return;
    report.unresolvedSamples.push(sample);
}

async function deactivateLegacyPictureUrlFields(
    prisma: PrismaClient,
    dryRun: boolean,
): Promise<number> {
    const where = {
        deletedAt: null,
        isActive: true,
        OR: PROFILE_PICTURE_FIELD_NAMES.map((name) => ({
            name: { equals: name, mode: 'insensitive' as const },
        })),
    };

    const affected = await prisma.applicationFormField.count({ where });
    if (dryRun || affected === 0) return affected;

    await prisma.applicationFormField.updateMany({
        where,
        data: {
            isActive: false,
            updatedAt: new Date(),
        },
    });

    return affected;
}

async function backfillParticipantCountryCodes(
    prisma: PrismaClient,
    report: MigrationReport,
    dryRun: boolean,
): Promise<void> {
    let cursor: string | undefined;

    for (;;) {
        const rows = await prisma.participant.findMany({
            where: {
                deletedAt: null,
                ...(cursor ? { id: { gt: cursor } } : {}),
            },
            orderBy: { id: 'asc' },
            take: BATCH_SIZE,
            select: {
                id: true,
                phoneCountryCode: true,
                emergencyContactCountryCode: true,
            },
        });

        if (rows.length === 0) break;

        for (const row of rows) {
            report.participantsScanned += 1;

            const updateData: Partial<Record<'phoneCountryCode' | 'emergencyContactCountryCode', string | null>> = {};

            for (const key of PARTICIPANT_PHONE_COUNTRY_KEYS) {
                const currentValue = row[key];
                if (typeof currentValue !== 'string') continue;

                const normalized = normalizePhoneCountryCodeDetailed(currentValue);

                if (normalized.changed) {
                    updateData[key] = normalized.value ?? null;
                }

                if (normalized.resolved && normalized.changed) {
                    report.participantValuesNormalized += 1;
                }

                if (!normalized.resolved) {
                    report.unresolvedValues += 1;
                    pushUnresolvedSample(
                        report,
                        `participants:${row.id}:${key}=${JSON.stringify(currentValue)}`,
                    );
                }
            }

            if (Object.keys(updateData).length > 0) {
                report.participantsUpdated += 1;

                if (!dryRun) {
                    await prisma.participant.update({
                        where: { id: row.id },
                        data: updateData,
                    });
                }
            }
        }

        cursor = rows[rows.length - 1].id;
        if (rows.length < BATCH_SIZE) break;
    }
}

async function backfillApplicationCountryCodes(
    prisma: PrismaClient,
    report: MigrationReport,
    dryRun: boolean,
): Promise<void> {
    let cursor: string | undefined;

    for (;;) {
        const rows = await prisma.participantApplication.findMany({
            where: {
                deletedAt: null,
                ...(cursor ? { id: { gt: cursor } } : {}),
            },
            orderBy: { id: 'asc' },
            take: BATCH_SIZE,
            select: {
                id: true,
                personalData: true,
            },
        });

        if (rows.length === 0) break;

        for (const row of rows) {
            report.applicationsScanned += 1;

            const currentData =
                row.personalData && typeof row.personalData === 'object' && !Array.isArray(row.personalData)
                    ? (row.personalData as Record<string, unknown>)
                    : {};

            const nextData: Record<string, unknown> = { ...currentData };
            let changed = false;

            for (const key of APPLICATION_PHONE_COUNTRY_KEYS) {
                const currentValue = nextData[key];
                if (typeof currentValue !== 'string') continue;

                const normalized = normalizePhoneCountryCodeDetailed(currentValue);

                if (normalized.changed) {
                    nextData[key] = normalized.value;
                    changed = true;
                }

                if (normalized.resolved && normalized.changed) {
                    report.applicationValuesNormalized += 1;
                }

                if (!normalized.resolved) {
                    report.unresolvedValues += 1;
                    pushUnresolvedSample(
                        report,
                        `participant_applications:${row.id}:${key}=${JSON.stringify(currentValue)}`,
                    );
                }
            }

            if (changed) {
                report.applicationsUpdated += 1;

                if (!dryRun) {
                    await prisma.participantApplication.update({
                        where: { id: row.id },
                        data: { personalData: nextData as never },
                    });
                }
            }
        }

        cursor = rows[rows.length - 1].id;
        if (rows.length < BATCH_SIZE) break;
    }
}

export async function migrateSubmissionFormNormalization(
    prisma: PrismaClient,
    options: { dryRun?: boolean } = {},
): Promise<MigrationReport> {
    const { dryRun = false } = options;

    const report: MigrationReport = {
        deactivatedPictureFields: 0,
        participantsScanned: 0,
        participantsUpdated: 0,
        participantValuesNormalized: 0,
        applicationsScanned: 0,
        applicationsUpdated: 0,
        applicationValuesNormalized: 0,
        unresolvedValues: 0,
        unresolvedSamples: [],
    };

    report.deactivatedPictureFields = await deactivateLegacyPictureUrlFields(prisma, dryRun);
    await backfillParticipantCountryCodes(prisma, report, dryRun);
    await backfillApplicationCountryCodes(prisma, report, dryRun);

    return report;
}

if (require.main === module) {
    const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
    const connectionString =
        process.env.DATABASE_URL ||
        'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    // eslint-disable-next-line no-console
    console.log(
        dryRun
            ? '>>> DRY RUN: submission-form normalization will not write changes.'
            : '>>> APPLYING submission-form normalization migration.',
    );

    migrateSubmissionFormNormalization(prisma, { dryRun })
        .then((report) => {
            // eslint-disable-next-line no-console
            console.log(
                dryRun
                    ? 'Submission-form normalization dry run report:'
                    : 'Submission-form normalization complete:',
                report,
            );
        })
        .catch((error) => {
            // eslint-disable-next-line no-console
            console.error(error);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
            await pool.end();
        });
}

/**
 * Phone normalization backfill report (STRICTLY READ-ONLY, dry-run only).
 *
 * Scans every `participant_applications` row that has a phone value in its
 * `personal_data` JSON (either the `phone` or `phone_number` key), runs it
 * through the same `sanitizePhone` logic used by exports and save-time
 * normalization, and writes a CSV report of what WOULD change. This script
 * makes NO writes of any kind — it exists to size up the cleanup before any
 * future backfill migration is written.
 *
 * Run:
 *   cd services/api
 *   pnpm report:phone-normalization
 *   # or directly:
 *   DATABASE_URL=... npx ts-node -r tsconfig-paths/register \
 *     prisma/migration-scripts/report-phone-normalization.ts
 *
 * Output: ./phone-normalization-report.csv (relative to the working directory
 * the script is run from) + summary counts printed to stdout.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { writeFileSync } from 'node:fs';
import { stringify } from 'csv-stringify/sync';
import { sanitizePhone } from '@shared/utils/phone-e164';

const REPORT_PATH = './phone-normalization-report.csv';

type ReportRow = {
  application_id: string;
  program_name: string;
  participant_email: string;
  nationality: string;
  raw_phone: string;
  normalized_phone: string;
  is_valid: boolean;
  changed: boolean;
};

function readPersonalDataPhone(personalData: unknown): string | undefined {
  if (!personalData || typeof personalData !== 'object') return undefined;
  const pd = personalData as Record<string, unknown>;

  if (typeof pd.phone === 'string' && pd.phone.trim()) return pd.phone.trim();
  if (typeof pd.phone_number === 'string' && pd.phone_number.trim()) {
    return pd.phone_number.trim();
  }

  return undefined;
}

function readNationality(personalData: unknown): string {
  if (!personalData || typeof personalData !== 'object') return '';
  const nationality = (personalData as Record<string, unknown>).nationality;
  return typeof nationality === 'string' ? nationality : '';
}

export async function reportPhoneNormalization(
  prisma: PrismaClient,
): Promise<{ rows: ReportRow[]; total: number; valid: number; invalid: number; changed: number; unchanged: number }> {
  // Filter is applied in JS (not the DB) since personal_data is untyped JSON —
  // this is a one-off report script, not a hot path, so a full scan is fine.
  const applications = await prisma.participantApplication.findMany({
    select: {
      id: true,
      personalData: true,
      program: { select: { name: true } },
      participant: { select: { user: { select: { email: true } } } },
    },
  });

  const rows: ReportRow[] = [];

  for (const application of applications) {
    const rawPhone = readPersonalDataPhone(application.personalData);
    if (!rawPhone) continue;

    const nationality = readNationality(application.personalData);
    const { value, isValid } = sanitizePhone(rawPhone, nationality || undefined);

    rows.push({
      application_id: application.id,
      program_name: application.program?.name ?? '',
      participant_email: application.participant?.user?.email ?? '',
      nationality,
      raw_phone: rawPhone,
      normalized_phone: value,
      is_valid: isValid,
      changed: rawPhone !== value,
    });
  }

  const valid = rows.filter((r) => r.is_valid).length;
  const changed = rows.filter((r) => r.changed).length;

  return {
    rows,
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    changed,
    unchanged: rows.length - changed,
  };
}

if (require.main === module) {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // eslint-disable-next-line no-console
  console.log('>>> DRY RUN (read-only): scanning phone values in personal_data, no writes.');

  reportPhoneNormalization(prisma)
    .then((result) => {
      const csv = stringify(result.rows, {
        header: true,
        columns: [
          'application_id',
          'program_name',
          'participant_email',
          'nationality',
          'raw_phone',
          'normalized_phone',
          'is_valid',
          'changed',
        ],
      });
      writeFileSync(REPORT_PATH, csv);

      /* eslint-disable no-console */
      console.log(`Total applications with a phone: ${result.total}`);
      console.log(`Valid: ${result.valid}`);
      console.log(`Invalid: ${result.invalid}`);
      console.log(`Would change on normalization: ${result.changed}`);
      console.log(`Unchanged: ${result.unchanged}`);
      console.log(`Full report written to ${REPORT_PATH}`);
      /* eslint-enable no-console */
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

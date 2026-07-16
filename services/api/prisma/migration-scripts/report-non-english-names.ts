/**
 * Non-English name audit + transliteration (dry-run by default).
 *
 * Finds participant/ambassador names (and submission `personal_data` name keys)
 * that contain non-ASCII characters which break the Letter of Acceptance export,
 * and previews the transliterated (English) replacement.
 *
 *   - Default (DRY RUN): scans, classifies, writes a JSON report, writes NOTHING.
 *   - `--apply`: rewrites AUTO-fixable values with their transliteration. NEVER
 *     touches MANUAL ones (non-Latin scripts that don't romanize cleanly).
 *
 * Run (dry run):
 *   cd services/api
 *   DATABASE_URL=... npx ts-node -r tsconfig-paths/register \
 *     prisma/migration-scripts/report-non-english-names.ts --dry-run
 *
 * Review the printed report + report-non-english-names.<ts>.json, THEN (only
 * after sign-off) re-run with --apply.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { writeFileSync } from 'node:fs';
import { transliterate as libTransliterate } from 'transliteration';

// Latin letters that do NOT decompose under NFKD and need an explicit mapping.
const LATIN_SPECIALS: Record<string, string> = {
    đ: 'd', Đ: 'D', ı: 'i', İ: 'I', ø: 'o', Ø: 'O', ł: 'l', Ł: 'L',
    ð: 'd', Ð: 'D', þ: 'th', Þ: 'Th', ß: 'ss', æ: 'ae', Æ: 'Ae',
    œ: 'oe', Œ: 'Oe', ŋ: 'ng', Ŋ: 'Ng', ħ: 'h', Ħ: 'H',
};

const NAME_DISALLOWED = /[^A-Za-z .'-]/g; // strict name rule (post-transliteration)
const NON_ASCII = /[^\x00-\x7F]/; // anything that can break the LoA font
// CJK ranges (Han, Hiragana, Katakana, Hangul) — pinyin/romaji romanization is decent.
const CJK = /[㐀-鿿぀-ヿ가-힯豈-﫿　-〿]/;

/**
 * Confidence of the romanization:
 *  - high   : pure Latin-script diacritics (NFKD strips cleanly) — e.g. Nguyễn, KONATÉ
 *  - medium : CJK — library produces reasonable pinyin/romaji (no tones)
 *  - low    : Arabic / Bengali / other abjad/abugida — vowels dropped, needs human review
 */
export type Confidence = 'high' | 'medium' | 'low';

/** Strip Latin diacritics via NFKD + the special-letter map (no library needed). */
function stripLatinDiacritics(input: string): string {
    const mapped = Array.from(input)
        .map((ch) => (ch in LATIN_SPECIALS ? LATIN_SPECIALS[ch] : ch))
        .join('');
    return mapped.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * Romanize any script to Latin. Latin diacritics are handled losslessly by
 * NFKD; remaining non-Latin scripts go through the transliteration library.
 */
export function transliterate(input: string): string {
    const latinStripped = stripLatinDiacritics(input);
    if (!NON_ASCII.test(latinStripped)) return latinStripped; // pure Latin-diacritic case
    return libTransliterate(latinStripped);
}

export function confidenceOf(value: string): Confidence {
    if (!NON_ASCII.test(stripLatinDiacritics(value))) return 'high';
    if (CJK.test(value)) return 'medium';
    return 'low';
}

type Status = 'clean' | 'auto' | 'manual';

/** Classify a value and compute its English replacement. */
export function analyze(value: string): {
    status: Status;
    transliterated: string;
    nameSafe: string;
    confidence: Confidence | null;
} {
    const transliterated = transliterate(value);
    const nameSafe = transliterated.replace(NAME_DISALLOWED, '').replace(/\s+/g, ' ').trim();
    if (!NON_ASCII.test(value)) {
        return { status: 'clean', transliterated, nameSafe, confidence: null };
    }
    const confidence = confidenceOf(value);
    // Auto-fixable when the romanization yields a non-empty ASCII name.
    const status: Status = NON_ASCII.test(transliterated) || nameSafe === '' ? 'manual' : 'auto';
    return { status, transliterated, nameSafe, confidence };
}

type Finding = {
    source: string; // table or 'personal_data'
    id: string;
    field: string;
    original: string;
    suggestion: string;
    status: Status;
    confidence: Confidence | null;
};

const NAME_KEY = /name/i;

async function scan(prisma: PrismaClient): Promise<Finding[]> {
    const findings: Finding[] = [];

    const pushIfDirty = (
        source: string,
        id: string,
        field: string,
        value: unknown,
    ) => {
        if (typeof value !== 'string' || value === '') return;
        if (!NON_ASCII.test(value)) return;
        const { status, nameSafe, confidence } = analyze(value);
        findings.push({ source, id, field, original: value, suggestion: nameSafe, status, confidence });
    };

    // participants table
    const participants = await prisma.participant.findMany({
        select: {
            id: true,
            fullName: true,
            nickName: true,
            displayName: true,
            emergencyContactName: true,
        },
    });
    for (const p of participants) {
        pushIfDirty('participants', p.id, 'full_name', p.fullName);
        pushIfDirty('participants', p.id, 'nick_name', p.nickName);
        pushIfDirty('participants', p.id, 'display_name', p.displayName);
        pushIfDirty('participants', p.id, 'emergency_contact_name', p.emergencyContactName);
    }

    // ambassadors table
    const ambassadors = await prisma.ambassador.findMany({
        select: { id: true, fullName: true },
    });
    for (const a of ambassadors) {
        pushIfDirty('ambassadors', a.id, 'full_name', a.fullName);
    }

    // participant_applications.personal_data JSON (name-like keys only)
    const applications = await prisma.participantApplication.findMany({
        select: { id: true, personalData: true },
    });
    for (const app of applications) {
        const data = app.personalData as Record<string, unknown> | null;
        if (!data || typeof data !== 'object') continue;
        for (const [key, val] of Object.entries(data)) {
            if (!NAME_KEY.test(key)) continue;
            pushIfDirty('personal_data', app.id, key, val);
        }
    }

    return findings;
}

export async function reportNonEnglishNames(
    prisma: PrismaClient,
    opts: { apply: boolean; confidences?: Set<Confidence> },
): Promise<{
    total: number;
    auto: number;
    manual: number;
    applied: number;
    findings: Finding[];
}> {
    const findings = await scan(prisma);
    const auto = findings.filter((f) => f.status === 'auto').length;
    const manual = findings.filter((f) => f.status === 'manual').length;

    let applied = 0;
    if (opts.apply) {
        // Rewrite every AUTO-fixable value (MANUAL ones are left untouched).
        // Columns are updated directly; personal_data JSON is updated per-application.
        const allow = opts.confidences;
        const pdByApp = new Map<string, Finding[]>();
        for (const f of findings) {
            if (f.status !== 'auto') continue;
            if (allow && f.confidence && !allow.has(f.confidence)) continue;
            if (f.source === 'participants') {
                const col = {
                    full_name: 'fullName',
                    nick_name: 'nickName',
                    display_name: 'displayName',
                    emergency_contact_name: 'emergencyContactName',
                }[f.field];
                if (!col) continue;
                await prisma.participant.update({ where: { id: f.id }, data: { [col]: f.suggestion } });
                applied += 1;
            } else if (f.source === 'ambassadors' && f.field === 'full_name') {
                await prisma.ambassador.update({ where: { id: f.id }, data: { fullName: f.suggestion } });
                applied += 1;
            } else if (f.source === 'personal_data') {
                const list = pdByApp.get(f.id) ?? [];
                list.push(f);
                pdByApp.set(f.id, list);
            }
        }
        // Apply personal_data JSON fixes: re-read each app's blob, patch the keys, write back.
        for (const [appId, fixes] of pdByApp) {
            const app = await prisma.participantApplication.findUnique({
                where: { id: appId },
                select: { personalData: true },
            });
            const data = (app?.personalData as Record<string, unknown> | null) ?? null;
            if (!data || typeof data !== 'object') continue;
            const next = { ...data };
            for (const f of fixes) next[f.field] = f.suggestion;
            await prisma.participantApplication.update({
                where: { id: appId },
                data: { personalData: next },
            });
            applied += fixes.length;
        }
    }

    return { total: findings.length, auto, manual, applied, findings };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    // --confidence=high,medium  (default: all). Controls which AUTO fixes get written.
    const confArg = process.argv.find((a) => a.startsWith('--confidence='));
    const confidences = confArg
        ? new Set(confArg.split('=')[1].split(',').map((s) => s.trim()) as Confidence[])
        : undefined;
    const connectionString =
        process.env.DATABASE_URL ||
        'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    // eslint-disable-next-line no-console
    console.log(
        apply
            ? '>>> APPLYING transliteration to AUTO-fixable names (columns + personal_data).'
            : '>>> DRY RUN: scanning non-English names, no writes.',
    );

    reportNonEnglishNames(prisma, { apply, confidences })
        .then((result) => {
            const stamp = process.env.REPORT_STAMP || 'latest';
            const file = `report-non-english-names.${stamp}.json`;
            writeFileSync(file, JSON.stringify(result, null, 2));
            /* eslint-disable no-console */
            const byConf = (c: string) =>
                result.findings.filter((f) => f.status === 'auto' && f.confidence === c).length;
            console.log(
                `Found ${result.total} non-English name value(s): ${result.auto} auto-fixable ` +
                    `(high:${byConf('high')} medium:${byConf('medium')} low:${byConf('low')}), ` +
                    `${result.manual} unrecoverable (manual).`,
            );
            if (apply) console.log(`Applied ${result.applied} update(s).`);
            console.log(`Full report written to ${file}`);
            for (const f of result.findings.slice(0, 50)) {
                console.log(
                    `[${f.status}${f.confidence ? '/' + f.confidence : ''}] ${f.source}.${f.field} ${f.id}: "${f.original}" -> "${f.suggestion}"`,
                );
            }
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

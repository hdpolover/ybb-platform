// src/modules/stats/participant-analytics.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaReadService } from '../../shared/infrastructure/prisma/prisma-read.service';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../shared/constants/cache-keys';
import {
  CrossTabResult,
  KnowledgeSourceAnalyticsResponse,
  NationalityAnalyticsResponse,
  GenderAnalyticsResponse,
  AgeAnalyticsResponse,
  RegistrationsAnalyticsResponse,
  AmbassadorsAnalyticsResponse,
} from './participant-analytics.types';

// ── SQL fragments ─────────────────────────────────────────────────────────────

const SOURCE_CASE = `
  CASE
    WHEN p.knowledge_source IS NULL OR TRIM(p.knowledge_source) = '' THEN 'Not Specified'
    WHEN LOWER(p.knowledge_source) IN ('instagram','ig') THEN 'Instagram'
    WHEN LOWER(p.knowledge_source) IN ('facebook','fb') THEN 'Facebook'
    WHEN LOWER(p.knowledge_source) = 'linkedin' THEN 'LinkedIn'
    WHEN LOWER(p.knowledge_source) IN ('twitter','x') THEN 'Twitter'
    WHEN LOWER(p.knowledge_source) IN ('website','web') THEN 'Website'
    WHEN LOWER(p.knowledge_source) IN ('friend','friends','friends/family','family') THEN 'Friends/Family'
    WHEN LOWER(p.knowledge_source) IN ('youtube','yt') THEN 'YouTube'
    WHEN LOWER(p.knowledge_source) IN ('tiktok','tik tok') THEN 'TikTok'
    WHEN LOWER(p.knowledge_source) IN ('email','e-mail','newsletter','email/newsletter','email / newsletter') THEN 'Email/Newsletter'
    WHEN LOWER(p.knowledge_source) IN ('other','others') THEN 'Others'
    ELSE p.knowledge_source
  END
`;

const GENDER_CASE = `
  CASE
    WHEN LOWER(p.gender::text) = 'male' THEN 'Male'
    WHEN LOWER(p.gender::text) = 'female' THEN 'Female'
    ELSE 'Not Specified'
  END
`;

// Country lives in `nationality` for some programs and ISO-2 `origin_country`
// (or `current_country`) for others. Prefer the first populated one.
const NATIONALITY_EXPR = `COALESCE(NULLIF(TRIM(p.nationality), ''), NULLIF(TRIM(p.origin_country), ''), NULLIF(TRIM(p.current_country), ''))`;
const NATIONALITY_CASE = `
  CASE
    WHEN ${NATIONALITY_EXPR} IS NULL THEN 'Not Specified'
    ELSE ${NATIONALITY_EXPR}
  END
`;

const AGE_CASE = `
  CASE
    WHEN p.birthdate IS NULL THEN 'Unknown'
    WHEN date_part('year', age(p.birthdate::date)) < 18 THEN 'Under 18'
    WHEN date_part('year', age(p.birthdate::date)) <= 24 THEN '18-24'
    WHEN date_part('year', age(p.birthdate::date)) <= 34 THEN '25-34'
    WHEN date_part('year', age(p.birthdate::date)) <= 44 THEN '35-44'
    WHEN date_part('year', age(p.birthdate::date)) <= 54 THEN '45-54'
    ELSE '55+'
  END
`;

const AGE_BAND_ORDER = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55+', 'Unknown'];

// Country values are often stored as ISO-2 codes (e.g. "PK"). Humanize 2-letter
// codes to country names for display; pass anything else (full names, "Not
// Specified") through untouched.
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
function toCountryName(value: string): string {
  if (/^[A-Za-z]{2}$/.test(value)) {
    try {
      return regionNames.of(value.toUpperCase()) ?? value;
    } catch {
      return value;
    }
  }
  return value;
}
function mapAxis(
  rows: { row_key: string; col_key: string; count: bigint }[],
  field: 'row_key' | 'col_key',
  fn: (v: string) => string,
): { row_key: string; col_key: string; count: bigint }[] {
  return rows.map(r => ({ ...r, [field]: fn(r[field]) }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface BuildMatrixOptions {
  colOrder?: string[];
  rowOrder?: string[];
  capCols?: number; // cap columns to top-N by column total (for unbounded axes like nationality)
}

function buildMatrix(
  rows: { row_key: string; col_key: string; count: bigint }[],
  opts: BuildMatrixOptions = {},
): CrossTabResult {
  const { colOrder, rowOrder, capCols } = opts;
  const grouped: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const columnTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const r of rows) {
    const count = Number(r.count);
    if (!grouped[r.row_key]) grouped[r.row_key] = {};
    grouped[r.row_key][r.col_key] = (grouped[r.row_key][r.col_key] || 0) + count;
    rowTotals[r.row_key] = (rowTotals[r.row_key] || 0) + count;
    columnTotals[r.col_key] = (columnTotals[r.col_key] || 0) + count;
    grandTotal += count;
  }

  let columns: string[];
  if (colOrder) {
    const inOrder = colOrder.filter(c => c in columnTotals);
    const rest = Object.keys(columnTotals).filter(c => !colOrder.includes(c));
    columns = [...inOrder, ...rest];
  } else {
    columns = Object.keys(columnTotals).sort((a, b) => columnTotals[b] - columnTotals[a]);
  }
  if (typeof capCols === 'number') {
    columns = [...columns].sort((a, b) => columnTotals[b] - columnTotals[a]).slice(0, capCols);
  }

  let orderedRowKeys: string[];
  if (rowOrder) {
    const inOrder = rowOrder.filter(k => k in grouped);
    const rest = Object.keys(grouped)
      .filter(k => !rowOrder.includes(k))
      .sort((a, b) => rowTotals[b] - rowTotals[a]);
    orderedRowKeys = [...inOrder, ...rest];
  } else {
    orderedRowKeys = Object.keys(grouped).sort((a, b) => rowTotals[b] - rowTotals[a]);
  }

  const resultRows = orderedRowKeys.map(key => ({
    key,
    total: rowTotals[key],
    cells: grouped[key],
  }));

  return { columns, rows: resultRows, columnTotals, grandTotal };
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ParticipantAnalyticsService {
  constructor(
    private readonly readPrisma: PrismaReadService,
    private readonly cacheService: CacheService,
  ) {}

  private async ensureProgramExists(programId: string): Promise<void> {
    const program = await this.readPrisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });
    if (!program) throw new NotFoundException(`Program ${programId} not found`);
  }

  // ── Knowledge Source ────────────────────────────────────────────────────────

  async getKnowledgeSourceAnalytics(programId: string): Promise<KnowledgeSourceAnalyticsResponse> {
    const cacheKey = CACHE_KEYS.ANALYTICS_KNOWLEDGE_SOURCE(programId);
    const cached = await this.cacheService.get<KnowledgeSourceAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    await this.ensureProgramExists(programId);

    const [distribRows, crossTabRows] = await Promise.all([
      this.readPrisma.$queryRaw<{ source: string; count: bigint }[]>(Prisma.sql`
        SELECT
          ${Prisma.raw(SOURCE_CASE)} AS source,
          COUNT(DISTINCT p.id)::bigint AS count
        FROM participants p
        JOIN participant_applications pa ON pa.participant_id = p.id
        WHERE pa.program_id = ${programId}::uuid
          AND pa.deleted_at IS NULL
        GROUP BY source
        ORDER BY count DESC
      `),
      this.readPrisma.$queryRaw<{ row_key: string; col_key: string; count: bigint }[]>(Prisma.sql`
        WITH base AS (
          SELECT DISTINCT
            p.id AS pid,
            ${Prisma.raw(NATIONALITY_CASE)} AS row_key,
            ${Prisma.raw(SOURCE_CASE)} AS col_key
          FROM participants p
          JOIN participant_applications pa ON pa.participant_id = p.id
          WHERE pa.program_id = ${programId}::uuid
            AND pa.deleted_at IS NULL
        )
        SELECT row_key, col_key, COUNT(*)::bigint AS count
        FROM base
        GROUP BY row_key, col_key
      `),
    ]);

    const distribution = distribRows.map(r => ({ source: r.source, count: Number(r.count) }));
    const grandTotal = distribution.reduce((a, b) => a + b.count, 0);

    const withKnownSource = distribution.filter(d => d.source !== 'Not Specified').reduce((a, b) => a + b.count, 0);
    const topChannelRow = distribution
      .filter(d => d.source !== 'Not Specified' && d.source !== 'Others')
      .sort((a, b) => b.count - a.count)[0];
    const notSpecifiedCount = distribution.find(d => d.source === 'Not Specified')?.count ?? 0;

    const summary = {
      total: grandTotal,
      withKnownSource,
      topChannel: topChannelRow ? topChannelRow.source : null,
      topChannelPct: topChannelRow ? Number((topChannelRow.count / grandTotal * 100).toFixed(1)) : null,
      pctNotSpecified: grandTotal > 0 ? Number((notSpecifiedCount / grandTotal * 100).toFixed(1)) : 0,
    };

    const countryBySource = buildMatrix(mapAxis(crossTabRows, 'row_key', toCountryName)); // rows = nationality, cols = source

    const result: KnowledgeSourceAnalyticsResponse = { summary, distribution, countryBySource };
    await this.cacheService.set(cacheKey, result, CACHE_TTL.LONG);
    return result;
  }

  // ── Nationality ─────────────────────────────────────────────────────────────

  async getNationalityAnalytics(programId: string): Promise<NationalityAnalyticsResponse> {
    const cacheKey = CACHE_KEYS.ANALYTICS_NATIONALITY(programId);
    const cached = await this.cacheService.get<NationalityAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    await this.ensureProgramExists(programId);

    const [distribRows, bySourceRows, byGenderRows] = await Promise.all([
      this.readPrisma.$queryRaw<{ country: string; count: bigint }[]>(Prisma.sql`
        SELECT
          ${Prisma.raw(NATIONALITY_CASE)} AS country,
          COUNT(DISTINCT p.id)::bigint AS count
        FROM participants p
        JOIN participant_applications pa ON pa.participant_id = p.id
        WHERE pa.program_id = ${programId}::uuid
          AND pa.deleted_at IS NULL
        GROUP BY country
        ORDER BY count DESC
      `),
      this.readPrisma.$queryRaw<{ row_key: string; col_key: string; count: bigint }[]>(Prisma.sql`
        WITH base AS (
          SELECT DISTINCT
            p.id AS pid,
            ${Prisma.raw(NATIONALITY_CASE)} AS row_key,
            ${Prisma.raw(SOURCE_CASE)} AS col_key
          FROM participants p
          JOIN participant_applications pa ON pa.participant_id = p.id
          WHERE pa.program_id = ${programId}::uuid
            AND pa.deleted_at IS NULL
        )
        SELECT row_key, col_key, COUNT(*)::bigint AS count
        FROM base
        GROUP BY row_key, col_key
      `),
      this.readPrisma.$queryRaw<{ row_key: string; col_key: string; count: bigint }[]>(Prisma.sql`
        WITH base AS (
          SELECT DISTINCT
            p.id AS pid,
            ${Prisma.raw(NATIONALITY_CASE)} AS row_key,
            ${Prisma.raw(GENDER_CASE)} AS col_key
          FROM participants p
          JOIN participant_applications pa ON pa.participant_id = p.id
          WHERE pa.program_id = ${programId}::uuid
            AND pa.deleted_at IS NULL
        )
        SELECT row_key, col_key, COUNT(*)::bigint AS count
        FROM base
        GROUP BY row_key, col_key
      `),
    ]);

    const distribution = distribRows.map(r => ({ country: toCountryName(r.country), count: Number(r.count) }));
    const grandTotal = distribution.reduce((a, b) => a + b.count, 0);

    const knownRows = distribution.filter(d => d.country !== 'Not Specified');
    const distinctCountries = knownRows.length;
    const topRow = knownRows[0] ?? null;
    const notSpecifiedCount = distribution.find(d => d.country === 'Not Specified')?.count ?? 0;

    const summary = {
      total: grandTotal,
      distinctCountries,
      topCountry: topRow ? topRow.country : null,
      topCountryPct: topRow && grandTotal > 0 ? Number((topRow.count / grandTotal * 100).toFixed(1)) : null,
      pctNotSpecified: grandTotal > 0 ? Number((notSpecifiedCount / grandTotal * 100).toFixed(1)) : 0,
    };

    const countryBySource = buildMatrix(mapAxis(bySourceRows, 'row_key', toCountryName)); // rows = nationality (uncapped), cols = source
    const countryByGender = buildMatrix(mapAxis(byGenderRows, 'row_key', toCountryName), { colOrder: ['Male', 'Female', 'Not Specified'] });

    const result: NationalityAnalyticsResponse = { summary, distribution, countryBySource, countryByGender };
    await this.cacheService.set(cacheKey, result, CACHE_TTL.LONG);
    return result;
  }

  // ── Gender ──────────────────────────────────────────────────────────────────

  async getGenderAnalytics(programId: string): Promise<GenderAnalyticsResponse> {
    const cacheKey = CACHE_KEYS.ANALYTICS_GENDER(programId);
    const cached = await this.cacheService.get<GenderAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    await this.ensureProgramExists(programId);

    const [distribRows, byNationalityRows, byAgeRows] = await Promise.all([
      this.readPrisma.$queryRaw<{ gender: string; count: bigint }[]>(Prisma.sql`
        SELECT
          ${Prisma.raw(GENDER_CASE)} AS gender,
          COUNT(DISTINCT p.id)::bigint AS count
        FROM participants p
        JOIN participant_applications pa ON pa.participant_id = p.id
        WHERE pa.program_id = ${programId}::uuid
          AND pa.deleted_at IS NULL
        GROUP BY gender
        ORDER BY count DESC
      `),
      this.readPrisma.$queryRaw<{ row_key: string; col_key: string; count: bigint }[]>(Prisma.sql`
        WITH base AS (
          SELECT DISTINCT
            p.id AS pid,
            ${Prisma.raw(GENDER_CASE)} AS row_key,
            ${Prisma.raw(NATIONALITY_CASE)} AS col_key
          FROM participants p
          JOIN participant_applications pa ON pa.participant_id = p.id
          WHERE pa.program_id = ${programId}::uuid
            AND pa.deleted_at IS NULL
        )
        SELECT row_key, col_key, COUNT(*)::bigint AS count
        FROM base
        GROUP BY row_key, col_key
      `),
      this.readPrisma.$queryRaw<{ row_key: string; col_key: string; count: bigint }[]>(Prisma.sql`
        WITH base AS (
          SELECT DISTINCT
            p.id AS pid,
            ${Prisma.raw(GENDER_CASE)} AS row_key,
            ${Prisma.raw(AGE_CASE)} AS col_key
          FROM participants p
          JOIN participant_applications pa ON pa.participant_id = p.id
          WHERE pa.program_id = ${programId}::uuid
            AND pa.deleted_at IS NULL
        )
        SELECT row_key, col_key, COUNT(*)::bigint AS count
        FROM base
        GROUP BY row_key, col_key
      `),
    ]);

    const distribution = distribRows.map(r => ({ gender: r.gender, count: Number(r.count) }));
    const grandTotal = distribution.reduce((a, b) => a + b.count, 0);

    const maleCount = distribution.find(d => d.gender === 'Male')?.count ?? 0;
    const femaleCount = distribution.find(d => d.gender === 'Female')?.count ?? 0;
    const notSpecCount = distribution.find(d => d.gender === 'Not Specified')?.count ?? 0;

    const summary = {
      total: grandTotal,
      pctMale: grandTotal > 0 ? Number((maleCount / grandTotal * 100).toFixed(1)) : 0,
      pctFemale: grandTotal > 0 ? Number((femaleCount / grandTotal * 100).toFixed(1)) : 0,
      pctNotSpecified: grandTotal > 0 ? Number((notSpecCount / grandTotal * 100).toFixed(1)) : 0,
    };

    // genderByNationality columns capped to top 10 nationalities by column total
    const genderByNationality = buildMatrix(mapAxis(byNationalityRows, 'col_key', toCountryName), {
      rowOrder: ['Male', 'Female', 'Not Specified'],
      capCols: 10,
    });
    const genderByAge = buildMatrix(byAgeRows, {
      rowOrder: ['Male', 'Female', 'Not Specified'],
      colOrder: AGE_BAND_ORDER,
    });

    const result: GenderAnalyticsResponse = { summary, distribution, genderByNationality, genderByAge };
    await this.cacheService.set(cacheKey, result, CACHE_TTL.LONG);
    return result;
  }

  // ── Age ─────────────────────────────────────────────────────────────────────

  async getAgeAnalytics(programId: string): Promise<AgeAnalyticsResponse> {
    const cacheKey = CACHE_KEYS.ANALYTICS_AGE(programId);
    const cached = await this.cacheService.get<AgeAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    await this.ensureProgramExists(programId);

    const [distribRows, byGenderRows, byNationalityRows] = await Promise.all([
      this.readPrisma.$queryRaw<{ band: string; count: bigint }[]>(Prisma.sql`
        SELECT
          ${Prisma.raw(AGE_CASE)} AS band,
          COUNT(DISTINCT p.id)::bigint AS count
        FROM participants p
        JOIN participant_applications pa ON pa.participant_id = p.id
        WHERE pa.program_id = ${programId}::uuid
          AND pa.deleted_at IS NULL
        GROUP BY band
      `),
      this.readPrisma.$queryRaw<{ row_key: string; col_key: string; count: bigint }[]>(Prisma.sql`
        WITH base AS (
          SELECT DISTINCT
            p.id AS pid,
            ${Prisma.raw(AGE_CASE)} AS row_key,
            ${Prisma.raw(GENDER_CASE)} AS col_key
          FROM participants p
          JOIN participant_applications pa ON pa.participant_id = p.id
          WHERE pa.program_id = ${programId}::uuid
            AND pa.deleted_at IS NULL
        )
        SELECT row_key, col_key, COUNT(*)::bigint AS count
        FROM base
        GROUP BY row_key, col_key
      `),
      this.readPrisma.$queryRaw<{ row_key: string; col_key: string; count: bigint }[]>(Prisma.sql`
        WITH base AS (
          SELECT DISTINCT
            p.id AS pid,
            ${Prisma.raw(AGE_CASE)} AS row_key,
            ${Prisma.raw(NATIONALITY_CASE)} AS col_key
          FROM participants p
          JOIN participant_applications pa ON pa.participant_id = p.id
          WHERE pa.program_id = ${programId}::uuid
            AND pa.deleted_at IS NULL
        )
        SELECT row_key, col_key, COUNT(*)::bigint AS count
        FROM base
        GROUP BY row_key, col_key
      `),
    ]);

    const distribMap = new Map(distribRows.map(r => [r.band, Number(r.count)]));
    const distribution = AGE_BAND_ORDER.map(band => ({ band, count: distribMap.get(band) ?? 0 }));
    const grandTotal = distribution.reduce((a, b) => a + b.count, 0);

    const knownBands = distribution.filter(d => d.band !== 'Unknown' && d.count > 0);
    const dominantBandEntry = knownBands.sort((a, b) => b.count - a.count)[0] ?? null;
    const unknownCount = distribMap.get('Unknown') ?? 0;

    const summary = {
      total: grandTotal,
      dominantBand: dominantBandEntry ? dominantBandEntry.band : null,
      dominantBandPct: dominantBandEntry && grandTotal > 0
        ? Number((dominantBandEntry.count / grandTotal * 100).toFixed(1))
        : null,
      activeBands: knownBands.length,
      pctUnknown: grandTotal > 0 ? Number((unknownCount / grandTotal * 100).toFixed(1)) : 0,
    };

    const ageByGender = buildMatrix(byGenderRows, {
      rowOrder: AGE_BAND_ORDER,
      colOrder: ['Male', 'Female', 'Not Specified'],
    });
    // ageByNationality columns capped to top 10 nationalities by column total
    const ageByNationality = buildMatrix(mapAxis(byNationalityRows, 'col_key', toCountryName), {
      rowOrder: AGE_BAND_ORDER,
      capCols: 10,
    });

    const result: AgeAnalyticsResponse = { summary, distribution, ageByGender, ageByNationality };
    await this.cacheService.set(cacheKey, result, CACHE_TTL.LONG);
    return result;
  }

  // ── Registrations ───────────────────────────────────────────────────────────

  async getRegistrationsAnalytics(programId: string): Promise<RegistrationsAnalyticsResponse> {
    const cacheKey = CACHE_KEYS.ANALYTICS_REGISTRATIONS(programId);
    const cached = await this.cacheService.get<RegistrationsAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    await this.ensureProgramExists(programId);

    const [dailyRows, monthlyRows, byCountryRows, bySourceRows, summaryRows] = await Promise.all([
      this.readPrisma.$queryRaw<{ day: string; count: bigint }[]>(Prisma.sql`
        SELECT
          TO_CHAR(DATE(pa.created_at), 'YYYY-MM-DD') AS day,
          COUNT(*)::bigint AS count
        FROM participant_applications pa
        WHERE pa.program_id = ${programId}::uuid
          AND pa.deleted_at IS NULL
        GROUP BY day
        ORDER BY day DESC
        LIMIT 90
      `),
      this.readPrisma.$queryRaw<{ month: string; count: bigint }[]>(Prisma.sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', pa.created_at), 'YYYY-MM') AS month,
          COUNT(*)::bigint AS count
        FROM participant_applications pa
        WHERE pa.program_id = ${programId}::uuid
          AND pa.deleted_at IS NULL
        GROUP BY month
        ORDER BY month DESC
        LIMIT 24
      `),
      this.readPrisma.$queryRaw<{ country: string; count: bigint }[]>(Prisma.sql`
        SELECT
          ${Prisma.raw(NATIONALITY_CASE)} AS country,
          COUNT(DISTINCT p.id)::bigint AS count
        FROM participants p
        JOIN participant_applications pa ON pa.participant_id = p.id
        WHERE pa.program_id = ${programId}::uuid
          AND pa.deleted_at IS NULL
        GROUP BY country
        ORDER BY count DESC
      `),
      this.readPrisma.$queryRaw<{ source: string; count: bigint }[]>(Prisma.sql`
        SELECT
          ${Prisma.raw(SOURCE_CASE)} AS source,
          COUNT(DISTINCT p.id)::bigint AS count
        FROM participants p
        JOIN participant_applications pa ON pa.participant_id = p.id
        WHERE pa.program_id = ${programId}::uuid
          AND pa.deleted_at IS NULL
        GROUP BY source
        ORDER BY count DESC
      `),
      this.readPrisma.$queryRaw<{ total: bigint; active_days: bigint; peak_day: string | null; peak_day_count: bigint; first_reg: Date | null; last_reg: Date | null }[]>(Prisma.sql`
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(DISTINCT DATE(pa.created_at))::bigint AS active_days,
          TO_CHAR((
            SELECT DATE(created_at)
            FROM participant_applications
            WHERE program_id = ${programId}::uuid AND deleted_at IS NULL
            GROUP BY DATE(created_at)
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ), 'YYYY-MM-DD') AS peak_day,
          (
            SELECT COUNT(*)::bigint
            FROM participant_applications
            WHERE program_id = ${programId}::uuid AND deleted_at IS NULL
            GROUP BY DATE(created_at)
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) AS peak_day_count,
          MIN(pa.created_at) AS first_reg,
          MAX(pa.created_at) AS last_reg
        FROM participant_applications pa
        WHERE pa.program_id = ${programId}::uuid
          AND pa.deleted_at IS NULL
      `),
    ]);

    const summaryRow = summaryRows[0];
    const total = Number(summaryRow?.total ?? 0);
    const peakDayRaw = summaryRow?.peak_day ?? null;
    const peakDayCount = Number(summaryRow?.peak_day_count ?? 0);
    const firstReg = summaryRow?.first_reg ?? null;
    const lastReg = summaryRow?.last_reg ?? null;

    // Queries return most-recent-first (LIMIT keeps the latest active days/months);
    // reverse for chronological display.
    const dailyTrend = dailyRows.map(r => ({ day: r.day, count: Number(r.count) })).reverse();
    const monthlyTotals = monthlyRows.map(r => ({ month: r.month, count: Number(r.count) })).reverse();
    const byCountry = byCountryRows.map(r => ({ country: toCountryName(r.country), count: Number(r.count) }));
    const bySource = bySourceRows.map(r => ({ source: r.source, count: Number(r.count) }));

    // Average per active day: total ÷ distinct days that had ≥1 registration (all-time).
    const activeDays = Number(summaryRow?.active_days ?? 0);
    const avgPerDay = activeDays > 0 ? Number((total / activeDays).toFixed(1)) : 0;

    const summary = {
      total,
      peakDay: peakDayRaw ? formatDate(peakDayRaw) : null,
      peakDayCount,
      avgPerDay,
      firstRegistration: firstReg ? formatDate(firstReg) : null,
      lastRegistration: lastReg ? formatDate(lastReg) : null,
    };

    const result: RegistrationsAnalyticsResponse = { summary, dailyTrend, monthlyTotals, byCountry, bySource };
    await this.cacheService.set(cacheKey, result, CACHE_TTL.LONG);
    return result;
  }

  // ── Ambassadors ─────────────────────────────────────────────────────────────

  async getAmbassadorsAnalytics(programId: string): Promise<AmbassadorsAnalyticsResponse> {
    const cacheKey = CACHE_KEYS.ANALYTICS_AMBASSADORS(programId);
    const cached = await this.cacheService.get<AmbassadorsAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    await this.ensureProgramExists(programId);

    // Ambassadors are directly scoped to program_id in the Ambassador model.
    // AmbassadorReferral tracks which participants each ambassador referred.
    const [ambassadorRows, referralCountRow] = await Promise.all([
      this.readPrisma.$queryRaw<{ name: string; total_referrals: number; successful_referrals: number }[]>(Prisma.sql`
        SELECT
          a.full_name AS name,
          a.total_referrals,
          a.successful_referrals
        FROM ambassadors a
        WHERE a.program_id = ${programId}::uuid
          AND a.deleted_at IS NULL
        ORDER BY a.successful_referrals DESC, a.total_referrals DESC
      `),
      this.readPrisma.$queryRaw<{ total_referred: bigint }[]>(Prisma.sql`
        SELECT COUNT(DISTINCT ar.participant_id)::bigint AS total_referred
        FROM ambassador_referrals ar
        JOIN ambassadors a ON a.id = ar.ambassador_id
        WHERE a.program_id = ${programId}::uuid
          AND a.deleted_at IS NULL
          AND ar.deleted_at IS NULL
      `),
    ]);

    const totalAmbassadors = ambassadorRows.length;
    const totalReferred = Number(referralCountRow[0]?.total_referred ?? 0);
    const avgReferrals = totalAmbassadors > 0
      ? Number((totalReferred / totalAmbassadors).toFixed(1))
      : 0;

    const topAmbassadorRow = ambassadorRows[0] ?? null;
    const topAmbassadorCount = topAmbassadorRow
      ? Math.max(topAmbassadorRow.successful_referrals, topAmbassadorRow.total_referrals)
      : 0;

    const summary = {
      totalAmbassadors,
      totalReferred,
      avgReferrals,
      topAmbassador: topAmbassadorRow
        ? { name: topAmbassadorRow.name, count: topAmbassadorCount }
        : null,
    };

    const leaderboard = ambassadorRows.map(r => ({
      name: r.name,
      totalReferrals: Number(r.total_referrals),
      successfulReferrals: Number(r.successful_referrals),
    }));

    const result: AmbassadorsAnalyticsResponse = { summary, leaderboard };
    await this.cacheService.set(cacheKey, result, CACHE_TTL.LONG);
    return result;
  }
}

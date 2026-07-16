// src/modules/stats/participant-analytics.types.ts

export interface CrossTabResult {
  columns: string[];
  rows: { key: string; total: number; cells: Record<string, number> }[];
  columnTotals: Record<string, number>;
  grandTotal: number;
}

// ── Knowledge Source ──────────────────────────────────────────────────────────

export interface KnowledgeSourceSummary {
  total: number;
  withKnownSource: number;
  topChannel: string | null;
  topChannelPct: number | null;
  pctNotSpecified: number;
}

export interface SourceAccountEntry {
  name: string | null; // null means unnamed/blank
  count: number;
}

export interface SourceAccountBreakdown {
  source: string; // matches a distribution[].source key
  accounts: SourceAccountEntry[]; // named accounts sorted by count desc, unnamed last
}

export interface KnowledgeSourceAnalyticsResponse {
  summary: KnowledgeSourceSummary;
  distribution: { source: string; count: number }[];
  countryBySource: CrossTabResult; // rows = nationality, cols = source (uncapped)
  accountsBySource: SourceAccountBreakdown[]; // only sources with at least one named account
}

// ── Nationality ───────────────────────────────────────────────────────────────

export interface NationalitySummary {
  total: number;
  distinctCountries: number;
  topCountry: string | null;
  topCountryPct: number | null;
  pctNotSpecified: number;
}

export interface NationalityAnalyticsResponse {
  summary: NationalitySummary;
  distribution: { country: string; count: number }[];
  countryByGender: CrossTabResult;  // rows = nationality (uncapped), cols = gender
}

// ── Gender ────────────────────────────────────────────────────────────────────

export interface GenderSummary {
  total: number;
  pctMale: number;
  pctFemale: number;
  pctNotSpecified: number;
}

export interface GenderAnalyticsResponse {
  summary: GenderSummary;
  distribution: { gender: string; count: number }[];
  genderByAge: CrossTabResult;         // rows = gender, cols = age band order
}

// ── Age ───────────────────────────────────────────────────────────────────────

export interface AgeSummary {
  total: number;
  dominantBand: string | null;
  dominantBandPct: number | null;
  activeBands: number;
  pctUnknown: number;
}

export interface AgeAnalyticsResponse {
  summary: AgeSummary;
  distribution: { band: string; count: number }[];
  ageByNationality: CrossTabResult; // rows = age band order, cols = nationality (capped top 10)
}

// ── Registrations ─────────────────────────────────────────────────────────────

export interface RegistrationsSummary {
  total: number;
  peakDay: string | null;
  peakDayCount: number;
  avgPerDay: number;
  firstRegistration: string | null;
  lastRegistration: string | null;
}

export interface RegistrationsAnalyticsResponse {
  summary: RegistrationsSummary;
  dailyTrend: { day: string; count: number }[];
  monthlyTotals: { month: string; count: number }[];
  byCountry: { country: string; count: number }[];
  bySource: { source: string; count: number }[];
}

// ── Ambassadors ───────────────────────────────────────────────────────────────

export interface AmbassadorSummary {
  totalAmbassadors: number;
  totalReferred: number;
  avgReferrals: number;
  topAmbassador: { name: string; count: number } | null;
}

export interface AmbassadorLeaderboardEntry {
  name: string;
  totalReferrals: number;
  successfulReferrals: number;
}

export interface AmbassadorsAnalyticsResponse {
  summary: AmbassadorSummary;
  leaderboard: AmbassadorLeaderboardEntry[];
}

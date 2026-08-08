import { getCountryDisplayName } from '../../../shared/utils/country-display';

export type ActivityType = 'registered' | 'accepted';

export interface ActivityRow {
  status: string;
  // Sourced from participant_applications.personal_data (JSON), not the participants
  // table -- see the query comment in activity.strategy.ts for why.
  full_name: string | null;
  // ISO 3166-1 alpha-2 code, e.g. "ID". Also sourced from personal_data.
  nationality: string | null;
  program_name: string;
}

export interface ActivityItem {
  type: ActivityType;
  name: string;
  country: string;
  countryCode: string;
  programName: string;
}

const ACCEPTED_STATUS = 'accepted';
const REGISTERED_STATUSES = ['submitted', 'under_review', 'interview_scheduled', 'waitlisted'];

export const ACTIVITY_SOURCE_STATUSES: readonly string[] = [
  ACCEPTED_STATUS,
  ...REGISTERED_STATUSES,
];

export const MIN_ACTIVITY_POOL_SIZE = 10;
export const MAX_ACTIVITY_POOL_SIZE = 60;

export function maskFullName(fullName: string): string | null {
  const trimmed = fullName.trim();
  // Guards against garbage like a literal "X" full name -- a one-character name isn't a
  // real masked identity, it's bad input, and "X from Kyrgyzstan just registered" is worse
  // than showing nothing.
  if (trimmed.length < 2) return null;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  const first = parts[0];
  // Array.from splits by code point so surrogate pairs are not cut in half.
  const lastInitial = Array.from(parts[parts.length - 1])[0];
  return `${first} ${lastInitial}.`;
}

export function resolveCountry(row: ActivityRow): { country: string; countryCode: string } | null {
  const isoCode = (row.nationality ?? '').trim().toUpperCase();
  if (!isoCode) return null;

  // getCountryDisplayName is backed by country-state-city and turns an ISO alpha-2 code
  // into a real display name (e.g. "ID" -> "Indonesia"). Never fall back to emitting the
  // raw code as if it were a name -- that is exactly the bug this fixes. An unrecognised
  // value means the row gets skipped instead of shown.
  const country = getCountryDisplayName(isoCode);
  if (!country) return null;

  return { country, countryCode: isoCode };
}

export function mapStatusToActivityType(status: string): ActivityType | null {
  if (status === ACCEPTED_STATUS) return 'accepted';
  if (REGISTERED_STATUSES.includes(status)) return 'registered';
  return null;
}

export function mapRowToActivityItem(row: ActivityRow): ActivityItem | null {
  const type = mapStatusToActivityType(row.status);
  if (!type) return null;

  const name = maskFullName(row.full_name ?? '');
  if (!name) return null;

  const country = resolveCountry(row);
  if (!country) return null;

  const programName = row.program_name?.trim();
  if (!programName) return null;

  return { type, name, country: country.country, countryCode: country.countryCode, programName };
}

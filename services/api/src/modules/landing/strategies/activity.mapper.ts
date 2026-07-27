export type ActivityType = 'registered' | 'accepted';

export interface ActivityRow {
  status: string;
  full_name: string;
  nationality: string | null;
  nationality_code: string | null;
  origin_country: string | null;
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
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  const first = parts[0];
  // Array.from splits by code point so surrogate pairs are not cut in half.
  const lastInitial = Array.from(parts[parts.length - 1])[0];
  return `${first} ${lastInitial}.`;
}

export function resolveCountry(row: ActivityRow): { country: string; countryCode: string } | null {
  const country = (row.nationality ?? '').trim() || (row.origin_country ?? '').trim();
  if (!country) return null;

  return { country, countryCode: (row.nationality_code ?? '').trim().toUpperCase() };
}

export function mapStatusToActivityType(status: string): ActivityType | null {
  if (status === ACCEPTED_STATUS) return 'accepted';
  if (REGISTERED_STATUSES.includes(status)) return 'registered';
  return null;
}

export function mapRowToActivityItem(row: ActivityRow): ActivityItem | null {
  const type = mapStatusToActivityType(row.status);
  if (!type) return null;

  const name = maskFullName(row.full_name);
  if (!name) return null;

  const country = resolveCountry(row);
  if (!country) return null;

  const programName = row.program_name?.trim();
  if (!programName) return null;

  return { type, name, country: country.country, countryCode: country.countryCode, programName };
}

import { getCountryDisplayName } from './country-display';

export type ParticipantDistributionLevel = 'high' | 'medium' | 'low' | 'none';

export function resolveCountryName(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const normalized = getCountryDisplayName(value);
    if (normalized) return normalized;
  }

  return null;
}

export function normalizeCountryGroups(
  groups: Array<{ country: string | null | undefined; count: number }>,
): Array<{ country: string; count: number }> {
  const counts = new Map<string, number>();

  for (const group of groups) {
    const country = resolveCountryName(group.country);
    if (!country) continue;
    counts.set(country, (counts.get(country) ?? 0) + group.count);
  }

  return Array.from(counts.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}

export function buildParticipantDistributionLevels(
  countryParticipants: Record<string, number>,
): Record<string, ParticipantDistributionLevel> {
  const entries = Object.entries(countryParticipants).filter(([, count]) => count > 0);
  if (entries.length === 0) return {};

  const maxCount = Math.max(...entries.map(([, count]) => count));
  if (maxCount <= 0) return {};

  return Object.fromEntries(
    entries.map(([country, count]) => {
      const ratio = count / maxCount;

      if (ratio >= 0.67) return [country, 'high'];
      if (ratio >= 0.34) return [country, 'medium'];
      return [country, 'low'];
    }),
  );
}

// services/api/src/modules/landing/strategies/impact-stats-section.util.ts

/** The four curated figures the `impact_stats` PlatformSetting row can carry. */
export type ImpactStatId = 'participants' | 'countries' | 'alumni' | 'editions';

export interface ImpactStat {
  id: ImpactStatId;
  label: string;
  value: string;
  icon: ImpactStatId;
}

export interface ImpactStatsSection {
  type: 'program_impact';
  content: {
    eyebrow: string;
    title: string;
    stats: ImpactStat[];
  };
}

const FIELDS: ReadonlyArray<{ id: ImpactStatId; label: string; key: string }> = [
  { id: 'participants', label: 'Total Participants', key: 'total_participants' },
  { id: 'countries', label: 'Total Countries', key: 'total_countries' },
  { id: 'alumni', label: 'Total Alumni', key: 'total_alumni' },
  // Stored + editable in the admin settings screen since day one, but the
  // home section builder used to emit only the first three, so it never
  // reached any frontend.
  { id: 'editions', label: 'Editions Held', key: 'editions_held' },
];

/**
 * Map the single `impact_stats` PlatformSetting row onto landing stats.
 *
 * A field that is missing or blank is DROPPED, never defaulted. These are
 * human-curated claims published on live brand domains and nothing in the
 * schema can derive them, so an absent figure has to disappear rather than
 * fall back to an invented literal. An empty result therefore means "emit no
 * section at all" — see buildImpactStatsSection.
 */
export function buildImpactStats(row: { value?: unknown } | null | undefined): ImpactStat[] {
  const raw = (row?.value ?? {}) as Record<string, unknown>;
  return FIELDS.flatMap(({ id, label, key }) => {
    const cell = raw[key];
    const value = typeof cell === 'number' ? String(cell) : typeof cell === 'string' ? cell.trim() : '';
    return value ? [{ id, label, value, icon: id }] : [];
  });
}

/**
 * Spreadable `program_impact` section: `[]` when no figure survives, so the
 * caller's sections array simply has no impact section instead of an empty
 * shell for a frontend to render as blank cards.
 */
export function buildImpactStatsSection(row: { value?: unknown } | null | undefined): ImpactStatsSection[] {
  const stats = buildImpactStats(row);
  if (stats.length === 0) return [];
  return [
    {
      type: 'program_impact',
      content: { eyebrow: 'Global Reach', title: 'Global Program Impact', stats },
    },
  ];
}

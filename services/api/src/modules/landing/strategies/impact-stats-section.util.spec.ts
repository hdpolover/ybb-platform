// services/api/src/modules/landing/strategies/impact-stats-section.util.spec.ts
import { buildImpactStats, buildImpactStatsSection } from './impact-stats-section.util';

describe('buildImpactStats', () => {
    it('emits all four figures, editions_held included (it used to be stored, editable and never emitted)', () => {
        expect(
            buildImpactStats({
                value: {
                    total_alumni: '1700+',
                    editions_held: '15+',
                    total_countries: '50+',
                    total_participants: '1700+',
                },
            }),
        ).toEqual([
            { id: 'participants', label: 'Total Participants', value: '1700+', icon: 'participants' },
            { id: 'countries', label: 'Total Countries', value: '50+', icon: 'countries' },
            { id: 'alumni', label: 'Total Alumni', value: '1700+', icon: 'alumni' },
            { id: 'editions', label: 'Editions Held', value: '15+', icon: 'editions' },
        ]);
    });

    it('drops an individual missing or blank figure rather than defaulting it to a literal', () => {
        const stats = buildImpactStats({
            value: { total_participants: '1700+', total_countries: '   ', total_alumni: null },
        });

        expect(stats.map((s) => s.id)).toEqual(['participants']);
        expect(JSON.stringify(stats)).not.toContain('undefined');
    });

    it('returns nothing when the impact_stats row is missing entirely', () => {
        expect(buildImpactStats(null)).toEqual([]);
        expect(buildImpactStats(undefined)).toEqual([]);
        expect(buildImpactStats({ value: {} })).toEqual([]);
    });

    it('accepts a numeric cell (a JSON blob edited by hand can hold one) instead of dropping it', () => {
        expect(buildImpactStats({ value: { total_countries: 50 } })).toEqual([
            { id: 'countries', label: 'Total Countries', value: '50', icon: 'countries' },
        ]);
    });
});

describe('buildImpactStatsSection', () => {
    it('is spreadable and empty when no figure survives — no empty-shell section reaches a frontend', () => {
        expect(buildImpactStatsSection(null)).toEqual([]);
        expect(buildImpactStatsSection({ value: { total_alumni: '' } })).toEqual([]);
    });

    it('emits one program_impact section carrying only the surviving figures', () => {
        const sections = buildImpactStatsSection({ value: { total_participants: '1700+' } });

        expect(sections).toHaveLength(1);
        expect(sections[0].type).toBe('program_impact');
        expect(sections[0].content.stats).toEqual([
            { id: 'participants', label: 'Total Participants', value: '1700+', icon: 'participants' },
        ]);
    });
});

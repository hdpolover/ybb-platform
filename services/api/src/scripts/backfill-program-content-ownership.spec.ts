// services/api/src/scripts/backfill-program-content-ownership.spec.ts
import {
  planContactBackfill,
  planLandingContentBackfill,
  planImpactStatsBackfill,
} from './backfill-program-content-ownership';

describe('planContactBackfill', () => {
  it('plans a write when the brand has contact info and the active program has none yet', () => {
    const plan = planContactBackfill({
      brandId: 'b1', brandName: 'Istanbul Youth Summit',
      brand: { contactEmail: 'x@ist.com', contactPhone: '+90', contactWhatsapp: null, contactAddress: 'Istanbul' },
      activeProgram: { id: 'p1', name: 'IYS 2026', contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null },
    });
    expect(plan).toEqual({
      brandId: 'b1', brandName: 'Istanbul Youth Summit', programId: 'p1', programName: 'IYS 2026',
      contactEmail: 'x@ist.com', contactPhone: '+90', contactAddress: 'Istanbul',
    });
  });

  it('returns null when the brand has no contact info to backfill (all null)', () => {
    const plan = planContactBackfill({
      brandId: 'b2', brandName: 'Japan Youth Summit',
      brand: { contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null },
      activeProgram: { id: 'p2', name: 'JYS 2026', contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null },
    });
    expect(plan).toBeNull();
  });

  it('returns a skip plan (with reason) when there is no resolvable active program for this brand', () => {
    const plan = planContactBackfill({
      brandId: 'b3', brandName: 'Some Brand',
      brand: { contactEmail: 'x@x.com', contactPhone: null, contactWhatsapp: null, contactAddress: null },
      activeProgram: null,
    });
    expect(plan).toEqual({
      brandId: 'b3', brandName: 'Some Brand',
      skippedReason: 'no resolvable program for this brand (resolver rule 3 -- brand has no non-deleted programs at all)',
    });
  });

  it('does not overwrite a program contact field that is already populated', () => {
    const plan = planContactBackfill({
      brandId: 'b4', brandName: 'Korea Youth Summit',
      brand: { contactEmail: 'brand@korea.com', contactPhone: '+82', contactWhatsapp: null, contactAddress: null },
      activeProgram: { id: 'p4', name: 'KYS 2026', contactEmail: 'already-set@korea.com', contactPhone: null, contactWhatsapp: null, contactAddress: null },
    });
    expect(plan).toEqual({
      brandId: 'b4', brandName: 'Korea Youth Summit', programId: 'p4', programName: 'KYS 2026',
      contactPhone: '+82',
      // contactEmail omitted — the program already has a value.
    });
  });
});

describe('planLandingContentBackfill', () => {
  it('returns null for a brand with empty metadata ({}) — Japan/World Youth Fest no-op case', () => {
    const plan = planLandingContentBackfill({
      brandId: 'b1', brandName: 'Japan Youth Summit',
      metadata: {}, activeProgram: { id: 'p1', name: 'JYS 2026', landingContent: {} },
    });
    expect(plan).toBeNull();
  });

  it('plans a landingContent write containing only the 7 allow-listed keys present in metadata', () => {
    const plan = planLandingContentBackfill({
      brandId: 'b2', brandName: 'China Youth Summit',
      metadata: {
        benefits: { eyebrow: 'e', title: 't', groups: [] },
        impact_stats: { total_alumni: '1700+' }, // NOT one of the 7 — must be dropped, handled by planImpactStatsBackfill instead
        section_background: { desktop_url: 'x' }, // stays on Brand — must be dropped
        promo_cta: { title: 'Apply now' },
      },
      activeProgram: { id: 'p2', name: 'CYS 2026', landingContent: {} },
    });
    expect(plan).toEqual({
      brandId: 'b2', brandName: 'China Youth Summit', programId: 'p2', programName: 'CYS 2026',
      landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, promo_cta: { title: 'Apply now' } },
    });
  });

  it('returns a skip plan when there is no resolvable active program for this brand', () => {
    const plan = planLandingContentBackfill({
      brandId: 'b3', brandName: 'Some Brand',
      metadata: { benefits: { eyebrow: 'e', title: 't', groups: [] } },
      activeProgram: null,
    });
    expect(plan).toEqual({
      brandId: 'b3', brandName: 'Some Brand',
      skippedReason: 'no resolvable program for this brand (resolver rule 3 -- brand has no non-deleted programs at all)',
    });
  });

  it('merges into (does not replace) a landingContent that already has some keys set', () => {
    const plan = planLandingContentBackfill({
      brandId: 'b4', brandName: 'Istanbul Youth Summit',
      metadata: { features: [{ id: 'f1', icon: 'star', title: 'X', description: 'Y' }] },
      activeProgram: { id: 'p4', name: 'IYS 2026', landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] } } },
    });
    expect(plan).toEqual({
      brandId: 'b4', brandName: 'Istanbul Youth Summit', programId: 'p4', programName: 'IYS 2026',
      landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, features: [{ id: 'f1', icon: 'star', title: 'X', description: 'Y' }] },
    });
  });
});

describe('planImpactStatsBackfill', () => {
  it('returns null when no brand carries impact_stats', () => {
    expect(planImpactStatsBackfill([])).toBeNull();
  });

  it('plans a single platform-wide write when every carrying brand agrees (the documented byte-identical case)', () => {
    const stats = { total_alumni: '1700+', editions_held: '15+', total_countries: '50+', total_participants: '1700+' };
    const plan = planImpactStatsBackfill([
      { brandName: 'China Youth Summit', value: stats },
      { brandName: 'Middle East Youth Summit', value: stats },
      { brandName: 'Korea Youth Summit', value: stats },
    ]);
    expect(plan).toEqual({ value: stats, sourceBrands: ['China Youth Summit', 'Middle East Youth Summit', 'Korea Youth Summit'], disagreement: false });
  });

  it('flags disagreement instead of silently picking one value when carrying brands differ', () => {
    const plan = planImpactStatsBackfill([
      { brandName: 'China Youth Summit', value: { total_alumni: '1700+' } },
      { brandName: 'Middle East Youth Summit', value: { total_alumni: '1800+' } },
    ]);
    expect(plan?.disagreement).toBe(true);
    expect(plan?.value).toEqual({ total_alumni: '1700+' }); // first-seen value, used only if a human proceeds anyway
  });
});

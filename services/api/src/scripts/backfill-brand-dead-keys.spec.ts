// services/api/src/scripts/backfill-brand-dead-keys.spec.ts
import { fixMojibakeBullets, planBrandDeadKeysBackfill } from './backfill-brand-dead-keys';

describe('fixMojibakeBullets', () => {
  it('replaces the UTF-8-read-as-Latin-1 bullet artifact with a real bullet', () => {
    expect(fixMojibakeBullets('Leadership â€¢ Networking â€¢ Culture')).toBe('Leadership • Networking • Culture');
  });

  it('leaves text with no mojibake artifact unchanged', () => {
    expect(fixMojibakeBullets('Leadership, Networking, Culture')).toBe('Leadership, Networking, Culture');
  });

  it('leaves an already-correct bullet character unchanged', () => {
    expect(fixMojibakeBullets('Leadership • Networking')).toBe('Leadership • Networking');
  });

  it('leaves a clean string containing other non-ASCII characters untouched — proves the fix cannot corrupt correctly-encoded rows', () => {
    const clean = 'Đà Nẵng, Café résumé, 日本語テキスト, emoji 🚀';
    expect(fixMojibakeBullets(clean)).toBe(clean);
  });
});

describe('planBrandDeadKeysBackfill', () => {
  it('returns null for a brand with empty metadata ({}) — Japan/World Youth Fest no-op case', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-japan', brandName: 'Japan Youth Summit', metadata: {},
      currentVision: null, currentMission: null, currentTagline: null,
    });
    expect(plan).toBeNull();
  });

  it('returns null for a brand whose metadata has other keys but none of the three dead keys', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-china', brandName: 'China Youth Summit',
      metadata: { benefits: {}, impact_stats: {} },
      currentVision: null, currentMission: null, currentTagline: null,
    });
    expect(plan).toBeNull();
  });

  it('plans vision/mission/tagline from objectives/coreValues/tagline when all three typed columns are currently empty', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-korea', brandName: 'Korea Youth Summit',
      metadata: { objectives: 'Lead. Connect. Grow.', coreValues: 'Integrity, Excellence, Unity', tagline: 'Shape Tomorrow, Today' },
      currentVision: null, currentMission: null, currentTagline: null,
    });
    expect(plan).toEqual({
      brandId: 'b-korea', brandName: 'Korea Youth Summit',
      vision: 'Lead. Connect. Grow.', mission: 'Integrity, Excellence, Unity', tagline: 'Shape Tomorrow, Today',
    });
  });

  it('fixes the mojibake bullet inside objectives while mapping it to vision (the Vietnam case)', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-vietnam', brandName: 'Vietnam Youth Summit',
      metadata: { objectives: 'Leadership â€¢ Networking â€¢ Culture', coreValues: 'Respect, Growth', tagline: 'Break the Boundaries' },
      currentVision: null, currentMission: null, currentTagline: null,
    });
    expect(plan?.vision).toBe('Leadership • Networking • Culture');
  });

  it('does not overwrite a typed column that already has content — never clobber a value an admin may have already set directly', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-yaf', brandName: 'Youth Academic Forum',
      metadata: { objectives: 'Meta objectives text', coreValues: 'Meta core values text', tagline: 'Meta tagline' },
      currentVision: 'Already-set vision from elsewhere', currentMission: null, currentTagline: null,
    });
    expect(plan).toEqual({
      brandId: 'b-yaf', brandName: 'Youth Academic Forum',
      mission: 'Meta core values text', tagline: 'Meta tagline',
      // vision omitted — currentVision already populated, not overwritten.
    });
  });

  it('returns a plan with skippedReason and no field writes when every target typed column is already populated', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-x', brandName: 'Some Brand',
      metadata: { objectives: 'x', coreValues: 'y', tagline: 'z' },
      currentVision: 'already set', currentMission: 'already set', currentTagline: 'already set',
    });
    expect(plan).toEqual({
      brandId: 'b-x', brandName: 'Some Brand',
      skippedReason: 'typed columns already populated; metadata key(s) present but would be overwritten, not applied',
    });
  });

  it('treats a whitespace-only dead-key value as absent, same as a missing key', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-y', brandName: 'Blank Brand',
      metadata: { objectives: '   ', coreValues: '', tagline: null },
      currentVision: null, currentMission: null, currentTagline: null,
    });
    expect(plan).toBeNull();
  });
});

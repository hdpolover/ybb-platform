// services/api/src/scripts/diff-landing-payloads.spec.ts
import { diffBrandPayload, normalizeForDiff, type BrandPayloadCapture } from './diff-landing-payloads';

function mkCapture(overrides: Partial<BrandPayloadCapture> = {}): BrandPayloadCapture {
  return {
    brandSlug: 'istanbul-youth-summit',
    brandName: 'Istanbul Youth Summit',
    home: { title: 'IYS', sections: [{ type: 'program_benefits', content: { eyebrow: 'e', title: 't' } }] },
    settings: { brand: { name: 'IYS', contact_phone: '+90' } },
    ...overrides,
  };
}

describe('diffBrandPayload', () => {
  it('reports no changed paths for two identical captures', () => {
    const capture = mkCapture();
    const result = diffBrandPayload(capture, { ...capture });
    expect(result.changedPaths).toEqual([]);
  });

  it('reports the exact dot-path of a real content difference', () => {
    const before = mkCapture();
    const after = mkCapture({
      home: { title: 'IYS', sections: [{ type: 'program_benefits', content: { eyebrow: 'e', title: 'CHANGED' } }] },
    });
    const result = diffBrandPayload(before, after);
    expect(result.changedPaths).toEqual(['home.sections.0.content.title']);
  });

  it('reports a settings-side difference under the settings prefix', () => {
    const before = mkCapture();
    const after = mkCapture({ settings: { brand: { name: 'IYS', contact_phone: '+90-CHANGED' } } });
    const result = diffBrandPayload(before, after);
    expect(result.changedPaths).toEqual(['settings.brand.contact_phone']);
  });

  // The core false-positive this script exists to suppress: home.strategy.ts's
  // Fisher-Yates gallery shuffle reorders the SAME items on every build.
  it('does NOT report a gallery reorder (same items, different order) as a change', () => {
    const before = mkCapture({
      home: { sections: [{ type: 'program_gallery', content: { gallery: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } }] },
    });
    const after = mkCapture({
      home: { sections: [{ type: 'program_gallery', content: { gallery: [{ id: 'c' }, { id: 'a' }, { id: 'b' } ] } }] },
    });
    const result = diffBrandPayload(before, after);
    expect(result.changedPaths).toEqual([]);
  });

  // But a genuinely DIFFERENT gallery (an item added/removed/changed, not
  // merely reordered) must still be caught — set comparison, not "ignore".
  it('DOES report a gallery with an actually different item, even though it is set-compared', () => {
    const before = mkCapture({
      home: { sections: [{ type: 'program_gallery', content: { gallery: [{ id: 'a' }, { id: 'b' }] } }] },
    });
    const after = mkCapture({
      home: { sections: [{ type: 'program_gallery', content: { gallery: [{ id: 'a' }, { id: 'DIFFERENT' }] } }] },
    });
    const result = diffBrandPayload(before, after);
    expect(result.changedPaths.length).toBeGreaterThan(0);
  });

  // A non-gallery array (e.g. footer_navigation, or program_features.items)
  // stays order-sensitive — reordering IS a real, reportable change there.
  it('reports a reorder of a non-gallery-keyed array as a change', () => {
    const before = mkCapture({
      home: { sections: [{ type: 'program_features', content: { items: [{ id: 'f1' }, { id: 'f2' }] } }] },
    });
    const after = mkCapture({
      home: { sections: [{ type: 'program_features', content: { items: [{ id: 'f2' }, { id: 'f1' }] } }] },
    });
    const result = diffBrandPayload(before, after);
    expect(result.changedPaths.length).toBeGreaterThan(0);
  });
});

describe('normalizeForDiff', () => {
  it('sorts a gallery-keyed array into a canonical order', () => {
    const a = normalizeForDiff([{ id: 'b' }, { id: 'a' }], 'gallery');
    const b = normalizeForDiff([{ id: 'a' }, { id: 'b' }], 'gallery');
    expect(a).toEqual(b);
  });

  it('leaves a non-gallery-keyed array in its original order', () => {
    const result = normalizeForDiff([{ id: 'b' }, { id: 'a' }], 'items');
    expect(result).toEqual([{ id: 'b' }, { id: 'a' }]);
  });
});

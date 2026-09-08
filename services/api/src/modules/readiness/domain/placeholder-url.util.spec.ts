// services/api/src/modules/readiness/domain/placeholder-url.util.spec.ts
import { isUsableImageUrl } from './placeholder-url.util';

describe('isUsableImageUrl', () => {
  it('rejects null, empty and whitespace', () => {
    expect(isUsableImageUrl(null)).toBe(false);
    expect(isUsableImageUrl('')).toBe(false);
    expect(isUsableImageUrl('   ')).toBe(false);
  });

  it('rejects known placeholder hosts, including the two live in production', () => {
    expect(isUsableImageUrl('https://placehold.co/400x100/EF4444/FFF?text=JYS+Logo')).toBe(false);
    expect(isUsableImageUrl('https://placehold.co/400x100/F59E0B/FFF?text=WYF+Logo')).toBe(false);
    expect(isUsableImageUrl('https://via.placeholder.com/150')).toBe(false);
    expect(isUsableImageUrl('https://placeholder.com/x.png')).toBe(false);
    expect(isUsableImageUrl('https://dummyimage.com/600x400')).toBe(false);
  });

  it('is case insensitive and ignores subdomains', () => {
    expect(isUsableImageUrl('https://CDN.PLACEHOLD.CO/x.png')).toBe(false);
  });

  it('accepts a real uploaded asset', () => {
    expect(isUsableImageUrl('https://cdn.ybbhub.com/prod/abc/brand/f1a2.png')).toBe(true);
  });

  it('rejects a malformed url rather than treating it as usable', () => {
    expect(isUsableImageUrl('not a url')).toBe(false);
  });
});

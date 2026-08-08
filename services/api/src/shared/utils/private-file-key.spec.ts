import { deriveStorageKeyFromUrl, isPrivateCategoryKey, looksLikePrivateCategoryUrl } from './private-file-key';

describe('deriveStorageKeyFromUrl', () => {
  it('derives the key from a normal CDN url', () => {
    const url = 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/documents/file1.pdf';
    expect(deriveStorageKeyFromUrl(url)).toBe('prod/brandx/programs/prog1/documents/file1.pdf');
  });

  it('is robust to a changed host (does not hardcode cdn.ybbhub.com)', () => {
    const url = 'https://some-other-cdn.example.net/staging/brandy/programs/prog2/signed-copies/file2.pdf';
    expect(deriveStorageKeyFromUrl(url)).toBe('staging/brandy/programs/prog2/signed-copies/file2.pdf');
  });

  it('returns null when no /prod|staging|dev/ segment is present', () => {
    const url = 'https://cdn.ybbhub.com/v1/files/123e4567-e89b-12d3-a456-426614174000/download';
    expect(deriveStorageKeyFromUrl(url)).toBeNull();
  });
});

describe('isPrivateCategoryKey', () => {
  it.each(['documents', 'signed-copies'])('returns true for %s category', (category) => {
    const key = `prod/brandx/programs/prog1/${category}/file1.pdf`;
    expect(isPrivateCategoryKey(key)).toBe(true);
  });

  it.each(['gallery', 'avatars', 'resources'])('returns false for %s category', (category) => {
    const key = `prod/brandx/programs/prog1/${category}/file1.png`;
    expect(isPrivateCategoryKey(key)).toBe(false);
  });

  it('returns false when there are not enough path segments', () => {
    expect(isPrivateCategoryKey('file1.pdf')).toBe(false);
  });
});

describe('looksLikePrivateCategoryUrl', () => {
  it.each(['documents', 'signed-copies'])(
    'returns true when the url contains a /%s/ segment, even without a /prod|staging|dev/ segment',
    (category) => {
      const url = `https://cdn.ybbhub.com/some-other-host-format/${category}/file1.pdf`;
      expect(looksLikePrivateCategoryUrl(url)).toBe(true);
    },
  );

  it.each(['gallery', 'avatars', 'resources'])('returns false for %s category', (category) => {
    const url = `https://cdn.ybbhub.com/some-other-host-format/${category}/file1.png`;
    expect(looksLikePrivateCategoryUrl(url)).toBe(false);
  });

  it('returns false for a masked download url', () => {
    const url = 'https://cdn.ybbhub.com/v1/files/123e4567-e89b-12d3-a456-426614174000/download';
    expect(looksLikePrivateCategoryUrl(url)).toBe(false);
  });
});

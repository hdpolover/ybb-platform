import { cleanDomain } from './brand-domain.decorator';

describe('cleanDomain', () => {
  it('returns undefined/empty input unchanged', () => {
    expect(cleanDomain(undefined)).toBeUndefined();
    expect(cleanDomain('')).toBe('');
  });

  it('lowercases and trims whitespace', () => {
    expect(cleanDomain('  IstanbulYouthSummit.com  ')).toBe('istanbulyouthsummit.com');
  });

  it('strips known environment subdomains', () => {
    expect(cleanDomain('www.istanbulyouthsummit.com')).toBe('istanbulyouthsummit.com');
    expect(cleanDomain('staging.istanbulyouthsummit.com')).toBe('istanbulyouthsummit.com');
  });

  it('strips a trailing dot from a fully-qualified host (RFC 2181 FQDN)', () => {
    expect(cleanDomain('istanbulyouthsummit.com.')).toBe('istanbulyouthsummit.com');
  });

  it('strips a trailing slash and dot combination', () => {
    expect(cleanDomain('istanbulyouthsummit.com./')).toBe('istanbulyouthsummit.com');
    expect(cleanDomain('istanbulyouthsummit.com/')).toBe('istanbulyouthsummit.com');
  });

  it('leaves a clean domain unchanged', () => {
    expect(cleanDomain('istanbulyouthsummit.com')).toBe('istanbulyouthsummit.com');
  });
});

import { isSwaggerEnabled } from './swagger.config';

describe('isSwaggerEnabled', () => {
  it('serves docs outside production', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'test' })).toBe(true);
    expect(isSwaggerEnabled({})).toBe(true);
  });

  it('does not serve docs in production by default', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('allows an explicit production break-glass', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).toBe(true);
  });

  it('fails safe on anything that is not exactly "true"', () => {
    for (const SWAGGER_ENABLED of ['TRUE', 'True', '1', 'yes', 'on', '', ' true']) {
      expect(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED })).toBe(false);
    }
  });
});

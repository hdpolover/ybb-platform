// src/config/env.validation.spec.ts
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validConfig = {
    RABBITMQ_URL: 'amqp://real-user:real-pass@rabbitmq:5672/',
    REDIS_PASSWORD: 'YbbPlatfrom123@', // deliberately the real misspelled fleet password, not "corrected"
    OTHER_VAR: 'whatever',
  };

  it('returns the config unchanged when all required vars are present and non-empty', () => {
    expect(validateEnv(validConfig)).toEqual(validConfig);
  });

  it('throws when RABBITMQ_URL is missing', () => {
    const { RABBITMQ_URL: _RABBITMQ_URL, ...rest } = validConfig;
    expect(() => validateEnv(rest)).toThrow(/RABBITMQ_URL/);
  });

  it('throws when RABBITMQ_URL is an empty string', () => {
    expect(() => validateEnv({ ...validConfig, RABBITMQ_URL: '' })).toThrow(/RABBITMQ_URL/);
  });

  it('throws when REDIS_PASSWORD is missing', () => {
    const { REDIS_PASSWORD: _REDIS_PASSWORD, ...rest } = validConfig;
    expect(() => validateEnv(rest)).toThrow(/REDIS_PASSWORD/);
  });

  it('throws when REDIS_PASSWORD is an empty string', () => {
    expect(() => validateEnv({ ...validConfig, REDIS_PASSWORD: '' })).toThrow(/REDIS_PASSWORD/);
  });

  it('reports every missing var in one error, not just the first', () => {
    expect(() => validateEnv({})).toThrow(/RABBITMQ_URL[\s\S]*REDIS_PASSWORD/);
  });

  it('never silently substitutes a fallback value - a missing RABBITMQ_URL throws instead of resolving to a config with one filled in', () => {
    // Regression guard for the actual vulnerability: even with everything
    // else present, a missing RABBITMQ_URL must not silently resolve to a
    // usable (insecure-default) config.
    const { RABBITMQ_URL: _RABBITMQ_URL, ...rest } = validConfig;
    expect(() => validateEnv(rest)).toThrow();
    expect(rest).not.toHaveProperty('RABBITMQ_URL');
  });
});

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';

// Mirrors the global ValidationPipe config in main.ts (whitelist +
// forbidNonWhitelisted) — RegisterDto is unauthenticated public input, so
// nested adAttribution must be exercised through it (not the bare
// AdAttributionDto) to prove the whole pipeline actually strips/rejects.
const VALIDATOR_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

const basePayload = { email: 'user@example.com', providerId: '123e4567-e89b-12d3-a456-426614174000' };

describe('RegisterDto.adAttribution', () => {
  it('accepts the four known click id keys', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...basePayload,
      adAttribution: { fbp: 'fb.1.111.222', fbc: 'fb.1.111.click', ttp: 'tt.p.1', ttclid: 'tt-click-1' },
    });

    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown key inside adAttribution rather than silently storing it', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...basePayload,
      adAttribution: { fbp: 'fb.1.111.222', evil: '<script>alert(1)</script>' },
    });

    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors.some((e) => e.property === 'adAttribution')).toBe(true);
  });

  it('rejects a click id value over the 256-char cap', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...basePayload,
      adAttribution: { fbp: 'a'.repeat(257) },
    });

    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors.some((e) => e.property === 'adAttribution')).toBe(true);
  });

  it('accepts a click id exactly at the 256-char cap', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...basePayload,
      adAttribution: { fbc: 'a'.repeat(256) },
    });

    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors).toHaveLength(0);
  });

  it('is omittable entirely (no attribution captured on this signup)', async () => {
    const dto = plainToInstance(RegisterDto, { ...basePayload });

    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors).toHaveLength(0);
  });
});

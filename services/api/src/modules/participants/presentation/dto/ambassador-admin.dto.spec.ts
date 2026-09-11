import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAmbassadorAdminDto, UpdateAmbassadorAdminDto, AmbassadorReferralAnalyticsQueryDto, AmbassadorRecapQueryDto } from './ambassador.dto';

const basePayload = {
  email: 'jane@example.com',
  fullName: 'Jane Doe',
  programId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
};

describe('CreateAmbassadorAdminDto', () => {
  it('passes with valid fields', async () => {
    const dto = plainToInstance(CreateAmbassadorAdminDto, basePayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts phoneNumber/fullName/institution exactly at their column limits', async () => {
    const dto = plainToInstance(CreateAmbassadorAdminDto, {
      ...basePayload,
      fullName: 'a'.repeat(255),
      institution: 'b'.repeat(255),
      phoneNumber: '1'.repeat(25),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a phoneNumber over the 25-char column limit', async () => {
    const dto = plainToInstance(CreateAmbassadorAdminDto, { ...basePayload, phoneNumber: '1'.repeat(26) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'phoneNumber')).toBe(true);
  });

  it('rejects an institution over the 255-char column limit', async () => {
    const dto = plainToInstance(CreateAmbassadorAdminDto, { ...basePayload, institution: 'b'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'institution')).toBe(true);
  });

  it('rejects a fullName over the 255-char column limit', async () => {
    const dto = plainToInstance(CreateAmbassadorAdminDto, { ...basePayload, fullName: 'a'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'fullName')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(CreateAmbassadorAdminDto, { ...basePayload, email: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('strips unknown fields under the global whitelist ValidationPipe config (verifies the DTO metatype is no longer erased to Object)', async () => {
    const dto = plainToInstance(CreateAmbassadorAdminDto, { ...basePayload, isAdmin: true });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((e) => e.property === 'isAdmin')).toBe(true);
  });
});

describe('UpdateAmbassadorAdminDto', () => {
  it('passes with all fields omitted (every field optional)', async () => {
    const dto = plainToInstance(UpdateAmbassadorAdminDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts phoneNumber/fullName/institution exactly at their column limits', async () => {
    const dto = plainToInstance(UpdateAmbassadorAdminDto, {
      fullName: 'a'.repeat(255),
      institution: 'b'.repeat(255),
      phoneNumber: '1'.repeat(25),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a phoneNumber over the 25-char column limit', async () => {
    const dto = plainToInstance(UpdateAmbassadorAdminDto, { phoneNumber: '1'.repeat(26) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'phoneNumber')).toBe(true);
  });

  it('rejects an institution over the 255-char column limit', async () => {
    const dto = plainToInstance(UpdateAmbassadorAdminDto, { institution: 'b'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'institution')).toBe(true);
  });
});

describe('AmbassadorReferralAnalyticsQueryDto', () => {
  it('passes with both from/to omitted', async () => {
    const dto = plainToInstance(AmbassadorReferralAnalyticsQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid date-only from/to', async () => {
    const dto = plainToInstance(AmbassadorReferralAnalyticsQueryDto, { from: '2026-07-01', to: '2026-07-30' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an unparseable from date', async () => {
    const dto = plainToInstance(AmbassadorReferralAnalyticsQueryDto, { from: 'not-a-date' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('rejects an unparseable to date', async () => {
    const dto = plainToInstance(AmbassadorReferralAnalyticsQueryDto, { to: '2026-13-45' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });
});

describe('AmbassadorRecapQueryDto', () => {
  it('passes with only programId, stage/from/to all omitted', async () => {
    const dto = plainToInstance(AmbassadorRecapQueryDto, { programId: 'meys-7th' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with each of the 5 allowed stage values', async () => {
    for (const stage of ['referred', 'registered', 'applied', 'accepted', 'completed']) {
      const dto = plainToInstance(AmbassadorRecapQueryDto, { programId: 'meys-7th', stage });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects a stage outside the 5 allowed values', async () => {
    const dto = plainToInstance(AmbassadorRecapQueryDto, { programId: 'meys-7th', stage: 'rejected' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'stage')).toBe(true);
  });

  it('rejects a missing programId', async () => {
    const dto = plainToInstance(AmbassadorRecapQueryDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'programId')).toBe(true);
  });

  it('rejects an unparseable from/to date', async () => {
    const dto = plainToInstance(AmbassadorRecapQueryDto, { programId: 'meys-7th', from: 'not-a-date' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });
});

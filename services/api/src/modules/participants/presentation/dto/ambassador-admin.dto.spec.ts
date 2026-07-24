import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAmbassadorAdminDto, UpdateAmbassadorAdminDto } from './ambassador.dto';

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

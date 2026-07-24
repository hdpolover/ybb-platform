import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProgramDto } from './create-program.dto';

const basePayload = {
  brandId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  year: 2026,
  startDate: '2026-01-01',
  endDate: '2026-01-10',
  applicationDeadline: '2025-12-31',
};

describe('CreateProgramDto.name/.slug MaxLength(255)', () => {
  it('accepts a name/slug exactly at the 255-char limit', async () => {
    const dto = plainToInstance(CreateProgramDto, {
      ...basePayload,
      name: 'a'.repeat(255),
      slug: 'b'.repeat(255),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a name over the 255-char limit', async () => {
    const dto = plainToInstance(CreateProgramDto, { ...basePayload, name: 'a'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a slug over the 255-char limit', async () => {
    const dto = plainToInstance(CreateProgramDto, {
      ...basePayload,
      name: 'Valid Name',
      slug: 'b'.repeat(256),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'slug')).toBe(true);
  });
});

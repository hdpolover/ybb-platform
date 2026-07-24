import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBrandDto } from './create-brand.dto';
import { UpdateBrandDto } from './update-brand.dto';

const basePayload = { name: 'Istanbul Youth Summit', slug: 'istanbul-youth-summit' };

describe('CreateBrandDto.name/.slug MaxLength(100)', () => {
  it('accepts a name/slug exactly at the 100-char limit', async () => {
    const dto = plainToInstance(CreateBrandDto, {
      name: 'a'.repeat(100),
      slug: 'b'.repeat(100),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a name over the 100-char limit', async () => {
    const dto = plainToInstance(CreateBrandDto, { ...basePayload, name: 'a'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a slug over the 100-char limit', async () => {
    const dto = plainToInstance(CreateBrandDto, { ...basePayload, slug: 'b'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'slug')).toBe(true);
  });
});

describe('CreateBrandDto.primaryColor MaxLength(7) alongside @IsHexColor', () => {
  it('accepts a valid 7-char hex color', async () => {
    const dto = plainToInstance(CreateBrandDto, { ...basePayload, primaryColor: '#FF0000' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'primaryColor')).toBe(false);
  });

  it('rejects an 8-hex-digit alpha form that passes @IsHexColor but overflows VARCHAR(7)', async () => {
    const dto = plainToInstance(CreateBrandDto, { ...basePayload, primaryColor: '#12345678' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'primaryColor')).toBe(true);
  });
});

describe('UpdateBrandDto.name/.slug MaxLength(100) (inherited via PartialType)', () => {
  it('accepts a name/slug exactly at the 100-char limit', async () => {
    const dto = plainToInstance(UpdateBrandDto, {
      name: 'a'.repeat(100),
      slug: 'b'.repeat(100),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a name over the 100-char limit', async () => {
    const dto = plainToInstance(UpdateBrandDto, { name: 'a'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a slug over the 100-char limit', async () => {
    const dto = plainToInstance(UpdateBrandDto, { slug: 'b'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'slug')).toBe(true);
  });
});

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateBrandDetailsDto } from './update-brand-details.dto';

describe('UpdateBrandDetailsDto.primaryColor @IsHexColor (matches CreateBrandDto)', () => {
  it('accepts a valid hex color', async () => {
    const dto = plainToInstance(UpdateBrandDetailsDto, { primaryColor: '#FF0000' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-hex-color value that previously slipped through as a plain string', async () => {
    const dto = plainToInstance(UpdateBrandDetailsDto, { primaryColor: 'not-a-color' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'primaryColor')).toBe(true);
  });

  it('rejects an 8-hex-digit alpha form that passes @IsHexColor but overflows VARCHAR(7)', async () => {
    const dto = plainToInstance(UpdateBrandDetailsDto, { primaryColor: '#12345678' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'primaryColor')).toBe(true);
  });
});

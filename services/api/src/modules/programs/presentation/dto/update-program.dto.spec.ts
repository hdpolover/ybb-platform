import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProgramDto } from './update-program.dto';

describe('UpdateProgramDto.name/.slug MaxLength(255)', () => {
  it('accepts a name/slug exactly at the 255-char limit', async () => {
    const dto = plainToInstance(UpdateProgramDto, {
      name: 'a'.repeat(255),
      slug: 'b'.repeat(255),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a name over the 255-char limit', async () => {
    const dto = plainToInstance(UpdateProgramDto, { name: 'a'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a slug over the 255-char limit', async () => {
    const dto = plainToInstance(UpdateProgramDto, { slug: 'b'.repeat(256) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'slug')).toBe(true);
  });
});

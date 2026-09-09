// src/modules/programs/presentation/dto/list-programs.dto.spec.ts

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListProgramsDto } from './list-programs.dto';

describe('ListProgramsDto - M42 unbounded limit', () => {
  // Regression guard: on the pre-fix DTO (no @Max on `limit`), this resolves
  // with zero validation errors because @Min(1) alone never rejects a large
  // value. Post-fix, @Max(100) makes it fail.
  it('rejects a limit above 100', async () => {
    const dto = plainToInstance(ListProgramsDto, { limit: 99999999999 });
    const errors = await validate(dto);

    const limitError = errors.find((e) => e.property === 'limit');
    expect(limitError).toBeDefined();
    expect(limitError?.constraints).toHaveProperty('max');
  });

  it('accepts a limit within bounds', async () => {
    const dto = plainToInstance(ListProgramsDto, { limit: 50 });
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'limit')).toBeUndefined();
  });

  it('accepts exactly the boundary value of 100', async () => {
    const dto = plainToInstance(ListProgramsDto, { limit: 100 });
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'limit')).toBeUndefined();
  });
});

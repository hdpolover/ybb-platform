// src/modules/programs/presentation/dto/get-program-detail.dto.spec.ts

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetProgramDetailQueryDto } from './get-program-detail.dto';

// Audit M33/M23: GET /programs/:identifier used to bind these as raw
// @Query() params with no DTO at all, so @Min/@Max never ran — the Redis
// cache key was minted from whatever the caller sent. GetProgramDetailQueryDto
// is now bound in the controller; these tests exercise the validation that
// only actually runs once it is wired up.
describe('GetProgramDetailQueryDto - M33 unbounded query params', () => {
  it('rejects a testimonialsLimit above 50 (the value that used to reach Prisma unclamped)', async () => {
    const dto = plainToInstance(GetProgramDetailQueryDto, { testimonialsLimit: 999999999 });
    const errors = await validate(dto);

    const error = errors.find((e) => e.property === 'testimonialsLimit');
    expect(error).toBeDefined();
    expect(error?.constraints).toHaveProperty('max');
  });

  it('rejects an announcementsLimit above 50', async () => {
    const dto = plainToInstance(GetProgramDetailQueryDto, { announcementsLimit: 500 });
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'announcementsLimit')).toBeDefined();
  });

  it('rejects a resourcesLimit above 50', async () => {
    const dto = plainToInstance(GetProgramDetailQueryDto, { resourcesLimit: 500 });
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'resourcesLimit')).toBeDefined();
  });

  it('rejects a non-integer limit (the float-into-Prisma-take bug)', async () => {
    const dto = plainToInstance(GetProgramDetailQueryDto, { testimonialsLimit: 1.5 });
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'testimonialsLimit')).toBeDefined();
  });

  it('accepts a request with no query params at all (identifier is a route param, not here)', async () => {
    const dto = plainToInstance(GetProgramDetailQueryDto, {});
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts values within bounds', async () => {
    const dto = plainToInstance(GetProgramDetailQueryDto, {
      include: 'all',
      testimonialsLimit: 25,
      announcementsLimit: 10,
      resourcesLimit: 5,
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});

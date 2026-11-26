// services/api/src/shared/infrastructure/prisma/soft-delete-includes.spec.ts
import { applyDeletedAtToIncludes } from './prisma.service';

// Uses the real generated Prisma client dmmf (deletedAt scalars) plus LIST_RELATIONS.
describe('applyDeletedAtToIncludes', () => {
  it('adds deletedAt: null to a to-many soft-deletable relation with a config object', () => {
    expect(applyDeletedAtToIncludes('Program', { schedules: { orderBy: { id: 'asc' } } })).toEqual({
      schedules: { orderBy: { id: 'asc' }, where: { deletedAt: null } },
    });
  });

  it('turns `true` into { where: { deletedAt: null } }', () => {
    expect(applyDeletedAtToIncludes('Program', { schedules: true })).toEqual({
      schedules: { where: { deletedAt: null } },
    });
  });

  it('keeps an explicit caller where.deletedAt and merges other where keys', () => {
    expect(applyDeletedAtToIncludes('Program', { schedules: { where: { deletedAt: { not: null } } } })).toEqual({
      schedules: { where: { deletedAt: { not: null } } },
    });
    expect(applyDeletedAtToIncludes('Program', { schedules: { where: { day: 1 } } })).toEqual({
      schedules: { where: { deletedAt: null, day: 1 } },
    });
  });

  it('recurses through nested include and select', () => {
    expect(
      applyDeletedAtToIncludes('Brand', { programs: { include: { schedules: true }, select: undefined } }),
    ).toEqual({
      programs: { where: { deletedAt: null }, include: { schedules: { where: { deletedAt: null } } } },
    });
    expect(applyDeletedAtToIncludes('Brand', { programs: { select: { speakers: true } } })).toEqual({
      programs: { where: { deletedAt: null }, select: { speakers: { where: { deletedAt: null } } } },
    });
  });

  it('never adds where to a to-one relation but still recurses into it', () => {
    expect(applyDeletedAtToIncludes('ProgramSchedule', { program: true })).toEqual({ program: true });
    expect(applyDeletedAtToIncludes('ProgramSchedule', { program: { include: { schedules: true } } })).toEqual({
      program: { include: { schedules: { where: { deletedAt: null } } } },
    });
  });

  it('leaves non-relation keys and unknown models untouched', () => {
    expect(applyDeletedAtToIncludes('Program', { id: true })).toEqual({ id: true });
    expect(applyDeletedAtToIncludes('Nope', { schedules: true })).toEqual({ schedules: true });
  });
});

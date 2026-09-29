// src/modules/applications/infrastructure/persistence/application-search.filter.spec.ts
import { buildApplicationSearchFilter } from './application-search.filter';
import { ApplicationRepository } from './application.repository';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ApplicationMapper } from '../mappers/application.mapper';

describe('buildApplicationSearchFilter', () => {
  // Two separate `participant` relation filters make Prisma emit two LEFT JOINs
  // of `participants`; the planner then builds two parallel hash tables, and the
  // Postgres container's 64MB /dev/shm overflows ("could not resize shared
  // memory segment") -> 500 on admin search. One relation filter = one join.
  it('filters the participant relation exactly once', () => {
    const clauses = buildApplicationSearchFilter('Waseem Saifi');

    const participantClauses = clauses.filter((c) => 'participant' in c);
    expect(participantClauses).toHaveLength(1);
  });

  it('still matches name and email through that single relation filter', () => {
    const clauses = buildApplicationSearchFilter('Waseem Saifi');
    const participant = clauses.find((c) => 'participant' in c)!.participant as {
      OR: unknown[];
    };

    expect(participant.OR).toEqual([
      { fullName: { contains: 'Waseem Saifi', mode: 'insensitive' } },
      { user: { email: { contains: 'Waseem Saifi', mode: 'insensitive' } } },
    ]);
  });

  it('still searches the free-text application fields', () => {
    const clauses = buildApplicationSearchFilter('x');
    expect(clauses).toEqual(
      expect.arrayContaining([
        { motivationLetter: { contains: 'x', mode: 'insensitive' } },
        { achievements: { contains: 'x', mode: 'insensitive' } },
        { experiences: { contains: 'x', mode: 'insensitive' } },
      ]),
    );
  });
});

describe('ApplicationRepository search wiring', () => {
  const build = () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = { participantApplication: { findMany, count } } as unknown as PrismaService;
    return { findMany, repo: new ApplicationRepository(prisma, {} as ApplicationMapper) };
  };

  it.each(['findByProgram', 'findByBrand'] as const)(
    '%s uses one participant filter for search',
    async (method) => {
      const { findMany, repo } = build();
      await repo[method]('id-1', { search: 'Waseem Saifi' });

      const { where } = findMany.mock.calls[0][0];
      expect(where.OR.filter((c: object) => 'participant' in c)).toHaveLength(1);
    },
  );
});

// src/modules/applications/infrastructure/persistence/application.repository.spec.ts
import { ApplicationRepository } from './application.repository';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ApplicationMapper } from '../mappers/application.mapper';

describe('ApplicationRepository - findByProgram createdAt filter', () => {
  let findMany: jest.Mock;
  let count: jest.Mock;
  let repo: ApplicationRepository;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    count = jest.fn().mockResolvedValue(0);
    const prismaStub = { participantApplication: { findMany, count } } as unknown as PrismaService;
    repo = new ApplicationRepository(prismaStub, {} as ApplicationMapper);
  });

  it('anchors a "startDate=endDate" filter to the WIB calendar day, not UTC midnight', async () => {
    await repo.findByProgram('program-1', { startDate: '2026-08-31', endDate: '2026-08-31' });

    const { where } = findMany.mock.calls[0][0];
    const { gte, lte } = where.createdAt;

    // 1 Sept 06:10 WIB — must be excluded from a "31 Aug only" filter. The
    // old `new Date('2026-08-31T23:59:59.999Z')` upper bound wrongly kept it.
    const excludedInstant = new Date('2026-08-31T23:10:00.000Z');
    // 31 Aug 07:30 WIB — must be included.
    const includedInstant = new Date('2026-08-31T00:30:00.000Z');

    expect(excludedInstant >= gte && excludedInstant <= lte).toBe(false);
    expect(includedInstant >= gte && includedInstant <= lte).toBe(true);
  });
});

describe('ApplicationRepository - stable list ordering', () => {
  let findMany: jest.Mock;
  let repo: ApplicationRepository;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    const prismaStub = {
      participantApplication: { findMany, count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    repo = new ApplicationRepository(prismaStub, {} as ApplicationMapper);
  });

  // Scoring writes updatedAt. If it is anywhere in the ordering for a sort the
  // reviewer queue uses, scored rows jump up the list mid-review and the
  // positional "#" column (how mentors divide the queue) stops being stable.
  it.each(['createdAt', 'submittedAt', 'participantName', 'status', 'scoreStatus'] as const)(
    'never tie-breaks a %s sort on updatedAt',
    async sortBy => {
      await repo.findByProgram('program-1', { sortBy, sortOrder: 'asc' });

      const { orderBy } = findMany.mock.calls[0][0];
      expect(JSON.stringify(orderBy)).not.toContain('updatedAt');
      expect(orderBy[orderBy.length - 1]).toEqual({ id: 'asc' });
    },
  );
});

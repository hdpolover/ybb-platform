// services/api/src/modules/programs/application/queries/handlers/get-program-landing.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { GetProgramLandingHandler } from './get-program-landing.handler';
import { GetProgramLandingQuery } from '../get-program-landing.query';

describe('GetProgramLandingHandler', () => {
  const award = {
    id: 'award-1',
    name: 'Best Delegate',
    description: 'd',
    category: null,
    tier: 'gold',
    tags: ['leadership'],
    winnerCount: 2,
    color: '#123456',
    badgeUrl: null,
    iconUrl: 'https://cdn.example.com/i.png',
    recipients: [
      {
        id: 'r-1',
        awardedAt: new Date('2026-08-01'),
        notes: null,
        application: {
          participant: { fullName: 'A B', institution: 'U', profilePictureUrl: null, nationality: 'ID' },
        },
      },
    ],
  };
  let prisma: Record<string, { findMany?: jest.Mock; findUnique?: jest.Mock }>;
  let handler: GetProgramLandingHandler;

  beforeEach(() => {
    prisma = {
      program: { findUnique: jest.fn().mockResolvedValue({ id: 'p-1', name: 'P' }) },
      programAnnouncement: { findMany: jest.fn().mockResolvedValue([]) },
      programAward: { findMany: jest.fn().mockResolvedValue([award]) },
      programParticipationInfo: { findMany: jest.fn().mockResolvedValue([]) },
      programTimeline: { findMany: jest.fn().mockResolvedValue([]) },
    };
    handler = new GetProgramLandingHandler(prisma as any);
  });

  it('selects only display columns for awards on this public route', async () => {
    await handler.execute(new GetProgramLandingQuery('p-1', 3, 6));

    const args = prisma.programAward.findMany!.mock.calls[0][0];
    expect(args.include).toBeUndefined();
    expect(Object.keys(args.select).sort()).toEqual(
      ['badgeUrl', 'category', 'color', 'description', 'iconUrl', 'id', 'name', 'recipients', 'tags', 'tier', 'winnerCount'],
    );
    expect(args.select.certificateTemplateId).toBeUndefined();
    expect(args.select.legacyId).toBeUndefined();
    expect(Object.keys(args.select.recipients.select).sort()).toEqual(['application', 'awardedAt', 'id', 'notes']);
  });

  it('flattens recipients to the public participant shape', async () => {
    const result = await handler.execute(new GetProgramLandingQuery('p-1', 3, 6));

    expect(result.awards[0]).toMatchObject({
      id: 'award-1',
      color: '#123456',
      iconUrl: 'https://cdn.example.com/i.png',
      recipients: [
        {
          id: 'r-1',
          participant: { name: 'A B', institution: 'U', avatar: null, nationality: 'ID' },
        },
      ],
    });
  });

  it('404s when the program does not exist', async () => {
    prisma.program.findUnique!.mockResolvedValue(null);
    await expect(handler.execute(new GetProgramLandingQuery('nope', 3, 6))).rejects.toBeInstanceOf(NotFoundException);
  });
});

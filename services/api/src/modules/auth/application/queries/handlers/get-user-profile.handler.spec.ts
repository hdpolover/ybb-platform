import { Test, TestingModule } from '@nestjs/testing';
import { GetUserProfileHandler } from './get-user-profile.handler';
import { GetUserProfileQuery } from '../get-user-profile.query';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

// Regression: the `applications` include had no orderBy, so
// registeredPrograms[0] (which the frontend's active-program selector falls
// back to - see ybb-program-next/lib/dashboard/activeProgram.ts) was
// whichever row Postgres happened to return first for a multi-program
// participant, rather than a deterministic one.
describe('GetUserProfileHandler', () => {
  let handler: GetUserProfileHandler;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetUserProfileHandler, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    handler = module.get<GetUserProfileHandler>(GetUserProfileHandler);
    jest.clearAllMocks();
  });

  it('orders applications by createdAt desc so registeredPrograms[0] is deterministic', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      brandId: 'brand-1',
      isOnboardingCompleted: true,
      identities: [],
      participant: { id: 'participant-1', profileCompletedAt: new Date(), applications: [] },
    });

    await handler.execute(new GetUserProfileQuery('user-1', 'brand-1'));

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          participant: expect.objectContaining({
            include: expect.objectContaining({
              applications: expect.objectContaining({
                orderBy: { createdAt: 'desc' },
              }),
            }),
          }),
        }),
      }),
    );
  });
});

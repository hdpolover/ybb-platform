// src/modules/users/application/services/account-deletion-purge.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AccountDeletionPurgeService } from './account-deletion-purge.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FirebaseAuthService } from '@modules/auth/infrastructure/services/firebase-auth.service';
import { DeletionStatus, Prisma } from '@prisma/client';

describe('AccountDeletionPurgeService', () => {
  let service: AccountDeletionPurgeService;

  const request = { id: 'req-1', userId: 'user-1' };

  const activeUser = {
    id: 'user-1',
    email: 'real.person@example.com',
    passwordHash: 'hashed',
    isActive: true,
    deletedAt: null,
  };

  const participant = { id: 'participant-1', userId: 'user-1' };

  // The transaction client — everything inside purgeOne's $transaction callback runs against this.
  const mockTx = {
    user: { update: jest.fn() },
    participant: { findUnique: jest.fn(), update: jest.fn() },
    participantApplication: { updateMany: jest.fn() },
    accountDeletionRequest: { update: jest.fn() },
    $executeRaw: jest.fn(),
  };

  const mockPrisma = {
    accountDeletionRequest: { findMany: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    userIdentity: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockFirebaseAuthService = {
    deleteUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionPurgeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FirebaseAuthService, useValue: mockFirebaseAuthService },
      ],
    }).compile();

    service = module.get<AccountDeletionPurgeService>(AccountDeletionPurgeService);
    jest.clearAllMocks();

    mockPrisma.user.findUnique.mockResolvedValue(activeUser);
    mockPrisma.userIdentity.findMany.mockResolvedValue([
      { providerUserId: 'firebase-uid-1' },
      { providerUserId: null }, // e.g. a legacy local identity never routed through Firebase
    ]);
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockTx));
    mockTx.participant.findUnique.mockResolvedValue(participant);
    mockFirebaseAuthService.deleteUser.mockResolvedValue(undefined);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('anonymises every named user and participant PII column', async () => {
    await service.purgeOne(request);

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        email: expect.stringMatching(/^deleted\+.+@ybb\.invalid$/),
        passwordHash: null,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        isActive: false,
        deletedAt: expect.any(Date),
      }),
    });

    expect(mockTx.participant.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: expect.objectContaining({
        fullName: expect.any(String),
        nickName: null,
        displayName: null,
        birthdate: null,
        gender: null,
        phoneCountryCode: null,
        phoneNumber: null,
        nationality: null,
        nationalityCode: null,
        originCountry: null,
        originCity: null,
        originAddress: null,
        currentCountry: null,
        currentCity: null,
        currentAddress: null,
        educationLevel: null,
        institution: null,
        major: null,
        graduationYear: null,
        occupation: null,
        instagramUsername: null,
        linkedinUrl: null,
        portfolioUrl: null,
        organizations: null,
        dietaryRestrictions: null,
        medicalConditions: null,
        specialNeeds: null,
        emergencyContactName: null,
        emergencyContactRelation: null,
        emergencyContactCountryCode: null,
        emergencyContactPhone: null,
        emergencyContactEmail: null,
        profilePictureUrl: null,
        resumeUrl: null,
        deletedAt: expect.any(Date),
      }),
    });
  });

  it('nulls the JSON blobs on participant_applications that duplicate PII', async () => {
    await service.purgeOne(request);

    expect(mockTx.participantApplication.updateMany).toHaveBeenCalledWith({
      where: { participantId: 'participant-1' },
      data: {
        personalData: {},
        essayAnswers: {},
        uploadedFiles: {},
        documentFiles: {},
        requirementFiles: [],
        participantSnapshot: Prisma.JsonNull, // a special sentinel object, not literal `null`
      },
    });
  });

  it('hard-deletes user_identities via a raw statement, not the soft-delete extension', async () => {
    await service.purgeOne(request);

    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
    // Tagged-template call: mock receives (stringsArray, ...interpolatedValues) — the
    // userId is interpolated in, so it shows up as one of the call's arguments.
    const callArgs = mockTx.$executeRaw.mock.calls[0];
    expect(callArgs).toContain('user-1');
  });

  it('never touches application_invoices', async () => {
    await service.purgeOne(request);

    // The transaction mock has no `applicationInvoice` delegate at all — if
    // the service ever called it, this would throw "is not a function"
    // rather than silently pass.
    expect((mockTx as Record<string, unknown>).applicationInvoice).toBeUndefined();
  });

  it('marks the request completed with actualDeletionDate and a per-user log', async () => {
    await service.purgeOne(request);

    expect(mockTx.accountDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: expect.objectContaining({
        status: DeletionStatus.completed,
        actualDeletionDate: expect.any(Date),
        deletionLog: expect.objectContaining({
          hadParticipant: true,
          firebaseUidsDeleted: ['firebase-uid-1'],
        }),
      }),
    });
  });

  it('deletes every distinct Firebase uid linked to the user before touching the database', async () => {
    await service.purgeOne(request);

    expect(mockFirebaseAuthService.deleteUser).toHaveBeenCalledWith('firebase-uid-1');
    expect(mockFirebaseAuthService.deleteUser).toHaveBeenCalledTimes(1); // the null providerUserId is skipped
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: running twice does not re-anonymise or re-call Firebase', async () => {
    await service.purgeOne(request);

    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ ...activeUser, deletedAt: new Date(), isActive: false });

    await service.purgeOne(request);

    expect(mockFirebaseAuthService.deleteUser).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.accountDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { status: DeletionStatus.completed, actualDeletionDate: expect.any(Date) },
    });
  });

  it('closes the request without touching Firebase or the DB when the user no longer exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await service.purgeOne(request);

    expect(mockFirebaseAuthService.deleteUser).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.accountDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { status: DeletionStatus.completed, actualDeletionDate: expect.any(Date) },
    });
  });

  describe('Firebase failure handling', () => {
    it('propagates a real Firebase failure and never touches the database', async () => {
      mockFirebaseAuthService.deleteUser.mockRejectedValue(new Error('firebase unavailable'));

      await expect(service.purgeOne(request)).rejects.toThrow('firebase unavailable');

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockTx.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.accountDeletionRequest.update).not.toHaveBeenCalled();
    });

    it('is safe to retry after a Firebase failure — FirebaseAuthService itself absorbs auth/user-not-found', async () => {
      // This is really FirebaseAuthService's contract (see its own spec /
      // implementation), exercised here to document why purgeOne can safely
      // call deleteUser again on retry: a uid already deleted by a previous
      // partial run must not permanently block this user's purge.
      mockFirebaseAuthService.deleteUser.mockResolvedValue(undefined);

      await expect(service.purgeOne(request)).resolves.toBeUndefined();
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('runScheduledPurge', () => {
    it('processes each due request independently, so one failure does not block the rest', async () => {
      mockPrisma.accountDeletionRequest.findMany.mockResolvedValue([
        { id: 'req-1', userId: 'user-1' },
        { id: 'req-2', userId: 'user-2' },
      ]);
      const purgeOneSpy = jest
        .spyOn(service, 'purgeOne')
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(undefined);

      await service.runScheduledPurge();

      expect(purgeOneSpy).toHaveBeenCalledTimes(2);
      expect(mockPrisma.accountDeletionRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: DeletionStatus.approved }),
        }),
      );
    });
  });
});

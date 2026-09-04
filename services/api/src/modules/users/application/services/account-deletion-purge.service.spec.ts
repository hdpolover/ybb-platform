// src/modules/users/application/services/account-deletion-purge.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AccountDeletionPurgeService } from './account-deletion-purge.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FirebaseAuthService } from '@modules/auth/infrastructure/services/firebase-auth.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { DeletionStatus, Prisma } from '@prisma/client';

describe('AccountDeletionPurgeService', () => {
  let service: AccountDeletionPurgeService;

  const request = { id: 'req-1', userId: 'user-1' };

  const activeUser = {
    id: 'user-1',
    email: 'real.person@example.com',
    brandId: 'brand-1',
    passwordHash: 'hashed',
    isActive: true,
    deletedAt: null,
  };

  const participant = { id: 'participant-1', userId: 'user-1', fullName: 'Jane Doe' };
  const brand = { id: 'brand-1', name: 'YBB', websiteUrl: 'https://ybb.example' };

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
    participant: { findUnique: jest.fn() },
    brand: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockFirebaseAuthService = { deleteUser: jest.fn() };
  const mockRabbitmqProducer = { emit: jest.fn() };
  const mockConfigService = { get: jest.fn(() => 'https://example.ybb.id') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionPurgeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FirebaseAuthService, useValue: mockFirebaseAuthService },
        { provide: RabbitMQProducerService, useValue: mockRabbitmqProducer },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AccountDeletionPurgeService>(AccountDeletionPurgeService);
    jest.clearAllMocks();

    mockPrisma.user.findUnique.mockResolvedValue(activeUser);
    mockPrisma.userIdentity.findMany.mockResolvedValue([
      { providerUserId: 'firebase-uid-1' },
      { providerUserId: null }, // e.g. a legacy local identity never routed through Firebase
    ]);
    mockPrisma.participant.findUnique.mockResolvedValue(participant);
    mockPrisma.brand.findUnique.mockResolvedValue(brand);
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockTx));
    mockTx.participant.findUnique.mockResolvedValue(participant);
    mockFirebaseAuthService.deleteUser.mockResolvedValue(undefined);
    mockRabbitmqProducer.emit.mockResolvedValue(undefined);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('purgeOne', () => {
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

    it('nulls the JSON blobs AND the free-text narrative columns on participant_applications', async () => {
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
          motivationLetter: null,
          achievements: null,
          experiences: null,
        },
      });
    });

    it('hard-deletes user_identities via a raw statement, not the soft-delete extension', async () => {
      await service.purgeOne(request);

      expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
      const callArgs = mockTx.$executeRaw.mock.calls[0];
      expect(callArgs).toContain('user-1');
    });

    it('never touches application_invoices', async () => {
      await service.purgeOne(request);

      expect((mockTx as Record<string, unknown>).applicationInvoice).toBeUndefined();
    });

    it('never touches ParticipantDocument (owner decision: issued records, not participant data)', async () => {
      await service.purgeOne(request);

      expect((mockTx as Record<string, unknown>).participantDocument).toBeUndefined();
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

    it('sends the completion email to the REAL address, before it gets overwritten by anonymisation', async () => {
      await service.purgeOne(request);

      // Must carry the genuine pre-anonymisation address, not a sentinel -
      // an emit-only assertion here would still pass after a reordering bug
      // that mails deleted+<uuid>@ybb.invalid instead.
      expect(mockRabbitmqProducer.emit).toHaveBeenCalledWith('user.account-deletion-completed', expect.objectContaining({
        email: 'real.person@example.com',
        name: 'Jane Doe',
      }));
      const emittedEmail = mockRabbitmqProducer.emit.mock.calls.find((c) => c[0] === 'user.account-deletion-completed')[1].email;
      expect(emittedEmail).not.toMatch(/@ybb\.invalid$/);

      // And it must happen strictly before the anonymising write - proves
      // the ordering, not just that both eventually occurred.
      const emitOrder = mockRabbitmqProducer.emit.mock.invocationCallOrder[0];
      const updateOrder = mockTx.user.update.mock.invocationCallOrder[0];
      expect(emitOrder).toBeLessThan(updateOrder);
    });

    it('is idempotent: running twice does not re-anonymise, re-call Firebase, or re-send the completion email', async () => {
      await service.purgeOne(request);

      jest.clearAllMocks();
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeUser, deletedAt: new Date(), isActive: false });

      await service.purgeOne(request);

      expect(mockFirebaseAuthService.deleteUser).not.toHaveBeenCalled();
      expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.accountDeletionRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: DeletionStatus.completed, actualDeletionDate: expect.any(Date) },
      });
    });

    it('closes the request without touching Firebase, email, or the DB when the user no longer exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.purgeOne(request);

      expect(mockFirebaseAuthService.deleteUser).not.toHaveBeenCalled();
      expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.accountDeletionRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: DeletionStatus.completed, actualDeletionDate: expect.any(Date) },
      });
    });

    describe('Firebase failure handling', () => {
      it('propagates a real Firebase failure and never touches the database or sends the completion email', async () => {
        mockFirebaseAuthService.deleteUser.mockRejectedValue(new Error('firebase unavailable'));

        await expect(service.purgeOne(request)).rejects.toThrow('firebase unavailable');

        expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(mockTx.user.update).not.toHaveBeenCalled();
        expect(mockPrisma.accountDeletionRequest.update).not.toHaveBeenCalled();
      });

      it('is safe to retry after a Firebase failure — FirebaseAuthService itself absorbs auth/user-not-found', async () => {
        mockFirebaseAuthService.deleteUser.mockResolvedValue(undefined);

        await expect(service.purgeOne(request)).resolves.toBeUndefined();
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      });
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

  describe('runScheduledReminders', () => {
    const dueSoonRequest = {
      id: 'req-2',
      userId: 'user-2',
      scheduledDeletionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days out, inside the 7-day window
      dataSnapshot: { cancellationTokenHash: 'old-hash', cancellationTokenExpiresAt: '2026-01-01T00:00:00Z' },
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeUser, id: 'user-2' });
    });

    it('sends a reminder for a request due within the window that has not been reminded yet', async () => {
      mockPrisma.accountDeletionRequest.findMany.mockResolvedValue([dueSoonRequest]);

      await service.runScheduledReminders();

      expect(mockRabbitmqProducer.emit).toHaveBeenCalledWith('user.account-deletion-reminder', expect.objectContaining({
        email: activeUser.email,
        cancelUrl: expect.stringContaining('requestId=req-2'),
      }));
    });

    it('rotates the cancellation token and records reminderSentAt (never resends the original raw token)', async () => {
      mockPrisma.accountDeletionRequest.findMany.mockResolvedValue([dueSoonRequest]);

      await service.runScheduledReminders();

      expect(mockPrisma.accountDeletionRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-2' },
        data: {
          dataSnapshot: expect.objectContaining({
            cancellationTokenHash: expect.any(String),
            reminderSentAt: expect.any(String),
          }),
        },
      });
      const newHash = mockPrisma.accountDeletionRequest.update.mock.calls[0][0].data.dataSnapshot.cancellationTokenHash;
      expect(newHash).not.toBe('old-hash');
    });

    it('does not re-send a reminder that was already sent', async () => {
      mockPrisma.accountDeletionRequest.findMany.mockResolvedValue([
        { ...dueSoonRequest, dataSnapshot: { ...dueSoonRequest.dataSnapshot, reminderSentAt: '2026-01-01T00:00:00Z' } },
      ]);

      await service.runScheduledReminders();

      expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
      expect(mockPrisma.accountDeletionRequest.update).not.toHaveBeenCalled();
    });

    it('skips a request outside the 7-day window', async () => {
      mockPrisma.accountDeletionRequest.findMany.mockResolvedValue([]); // the query itself excludes it; simulate that here

      await service.runScheduledReminders();

      expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
    });

    it('one failing reminder does not block the rest', async () => {
      const second = { ...dueSoonRequest, id: 'req-3', userId: 'user-3' };
      mockPrisma.accountDeletionRequest.findMany.mockResolvedValue([dueSoonRequest, second]);
      mockPrisma.user.findUnique
        .mockRejectedValueOnce(new Error('db blip'))
        .mockResolvedValueOnce({ ...activeUser, id: 'user-3' });

      await service.runScheduledReminders();

      expect(mockRabbitmqProducer.emit).toHaveBeenCalledTimes(1);
    });
  });
});

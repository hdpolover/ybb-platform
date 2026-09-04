import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { CreateRegistrationPaymentIntentHandler } from './create-registration-payment-intent.handler';
import { CreateRegistrationPaymentIntentCommand } from '../create-registration-payment-intent.command';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';

/** Minimal application stub returned by the repository. */
const makeApp = (overrides: Record<string, unknown> = {}) => ({
  id: 'app-1',
  participantId: 'participant-1',
  programId: 'program-1',
  pricingTierId: 'tier-reg-1',
  ...overrides,
});

describe('CreateRegistrationPaymentIntentHandler (admin path)', () => {
  let handler: CreateRegistrationPaymentIntentHandler;

  const mockAppRepository = { findById: jest.fn() };
  const mockPaymentClient = { createIntent: jest.fn() };
  const mockPrisma = {
    participant: { findUnique: jest.fn() },
    programPricingTier: { findFirst: jest.fn() },
    program: { findUnique: jest.fn() },
    brandSetting: { findFirst: jest.fn() },
  };
  const mockRegistrationFeeGate = { isRegistrationFeePaid: jest.fn() };

  const command = new CreateRegistrationPaymentIntentCommand('app-1', 'participant-1');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateRegistrationPaymentIntentHandler,
        { provide: APPLICATION_REPOSITORY, useValue: mockAppRepository },
        { provide: PaymentGrpcClient, useValue: mockPaymentClient },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RegistrationFeeGateService, useValue: mockRegistrationFeeGate },
      ],
    }).compile();

    handler = module.get(CreateRegistrationPaymentIntentHandler);
    jest.clearAllMocks();

    // Happy-path defaults: dual-priced registration tier + configured rate + not yet paid.
    mockAppRepository.findById.mockResolvedValue(makeApp());
    // Participant.id and User.id are deliberately different values throughout
    // this suite: the payment service keys intents on users.id, and sending a
    // Participant.id there is the whole point of audit M98.
    mockPrisma.participant.findUnique.mockResolvedValue({ userId: 'user-1' });
    mockPrisma.programPricingTier.findFirst.mockResolvedValue({
      price: 10,
      currency: 'USD',
      usdPrice: 10,
    });
    mockPrisma.program.findUnique.mockResolvedValue({ usdInIdr: 16000, brandId: 'brand-1' });
    mockPrisma.brandSetting.findFirst.mockResolvedValue({ usdInIdr: 16000 });
    mockPaymentClient.createIntent.mockResolvedValue({ intent_id: 'pi-1', status: 'REQUIRES_PAYMENT_METHOD' });
    mockRegistrationFeeGate.isRegistrationFeePaid.mockResolvedValue(false);
  });

  // ── guard rails ───────────────────────────────────────────────────────────

  it('throws NotFoundException when the application does not exist', async () => {
    mockAppRepository.findById.mockResolvedValue(null);
    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when the caller does not own the application', async () => {
    mockAppRepository.findById.mockResolvedValue(makeApp({ participantId: 'someone-else' }));
    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when no pricing tier is selected', async () => {
    mockAppRepository.findById.mockResolvedValue(makeApp({ pricingTierId: null }));
    await expect(handler.execute(command)).rejects.toThrow(/No pricing tier selected/);
  });

  it('throws BadRequestException when the selected tier is not an active registration_fee tier', async () => {
    // The findFirst is scoped to feeType=registration_fee+isActive — a non-matching
    // tier (e.g. a program_fee tier) resolves to null. This is the core hardening:
    // a "registration" intent must never charge a non-registration fee.
    mockPrisma.programPricingTier.findFirst.mockResolvedValue(null);
    await expect(handler.execute(command)).rejects.toThrow(/No active registration fee tier/);
    expect(mockPaymentClient.createIntent).not.toHaveBeenCalled();
  });

  // ── duplicate-payment guard ────────────────────────────────────────────────

  it('throws BadRequestException when the registration fee has already been paid', async () => {
    mockRegistrationFeeGate.isRegistrationFeePaid.mockResolvedValue(true);
    await expect(handler.execute(command)).rejects.toThrow(
      new BadRequestException('Registration fee has already been paid.'),
    );
    expect(mockPaymentClient.createIntent).not.toHaveBeenCalled();
  });

  it('proceeds to create intent when the registration fee has not been paid', async () => {
    mockRegistrationFeeGate.isRegistrationFeePaid.mockResolvedValue(false);
    await expect(handler.execute(command)).resolves.toEqual(
      expect.objectContaining({ intent_id: 'pi-1' }),
    );
    expect(mockPaymentClient.createIntent).toHaveBeenCalledTimes(1);
  });

  it('scopes the tier lookup to the program + active registration_fee tier', async () => {
    await handler.execute(command);
    expect(mockPrisma.programPricingTier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'tier-reg-1',
          programId: 'program-1',
          isActive: true,
          feeType: 'registration_fee',
        }),
      }),
    );
  });

  // ── pricing ───────────────────────────────────────────────────────────────

  it('charges the canonical usdPrice (USD) when dual pricing is present', async () => {
    mockPrisma.programPricingTier.findFirst.mockResolvedValue({
      price: 999, // legacy/stale value must be ignored in favour of usdPrice
      currency: 'IDR',
      usdPrice: 15,
    });

    await handler.execute(command);

    expect(mockPaymentClient.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 15, currency: 'USD', exchange_rate: 16000 }),
    );
  });

  it('falls back to legacy price/currency for tiers without dual pricing', async () => {
    mockPrisma.programPricingTier.findFirst.mockResolvedValue({
      price: 176000,
      currency: 'IDR',
      usdPrice: null,
    });

    await handler.execute(command);

    expect(mockPaymentClient.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 176000, currency: 'IDR' }),
    );
  });

  // Audit M98. `userId` on this command is a Participant.id - the ownership
  // check asserts it equals application.participantId - but the payment service
  // keys intents on users.id and enforces ownership against it, so forwarding
  // the Participant.id minted an intent the participant could never claim. The
  // portal path (confirm-portal-payment.handler.ts) has always sent the real
  // users.id plus participant_id separately.
  it('sends the real users.id as user_id and the participant id separately', async () => {
    await handler.execute(command);

    expect(mockPrisma.participant.findUnique).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      select: { userId: true },
    });
    expect(mockPaymentClient.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        participant_id: 'participant-1',
      }),
    );
  });

  it('fails loudly when the application has no participant row', async () => {
    mockPrisma.participant.findUnique.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    expect(mockPaymentClient.createIntent).not.toHaveBeenCalled();
  });

  it('tags the intent with the registration payment_category', async () => {
    await handler.execute(command);
    expect(mockPaymentClient.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_type: 'application',
        reference_id: 'app-1',
        metadata: expect.objectContaining({ payment_category: 'registration' }),
      }),
    );
  });

  // ── exchange rate precondition ──────────────────────────────────────────────

  it('throws PreconditionFailedException for a USD intent with no configured rate', async () => {
    mockPrisma.program.findUnique.mockResolvedValue({ usdInIdr: null, brandId: 'brand-1' });
    mockPrisma.brandSetting.findFirst.mockResolvedValue({ usdInIdr: null });

    await expect(handler.execute(command)).rejects.toThrow(PreconditionFailedException);
    expect(mockPaymentClient.createIntent).not.toHaveBeenCalled();
  });

  it('falls back to the brand exchange rate when the program rate is missing', async () => {
    mockPrisma.program.findUnique.mockResolvedValue({ usdInIdr: null, brandId: 'brand-1' });
    mockPrisma.brandSetting.findFirst.mockResolvedValue({ usdInIdr: 15500 });

    await handler.execute(command);

    expect(mockPaymentClient.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({ exchange_rate: 15500 }),
    );
  });
});

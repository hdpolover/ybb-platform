import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetMyParticipantProfileHandler } from './get-my-participant-profile.handler';
import { GetMyParticipantProfileQuery } from '../get-my-participant-profile.query';
import { Participant } from '../../../../../core/entities/participant.entity';

describe('GetMyParticipantProfileHandler', () => {
    let handler: GetMyParticipantProfileHandler;

    const mockParticipantRepository = {
        findByUserId: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    };

    const baseParticipant: Participant = {
        id: 'participant-1',
        userId: 'user-1',
        fullName: 'Alya Putri',
        gender: 'Female',
        currentCountry: 'Indonesia',
        currentCity: 'Jakarta',
        originCountry: 'Vietnam',
        originCity: 'Hanoi',
        knowledgeSource: 'Instagram',
        referralCode: 'ABC-123',
        profileCompletionPercentage: 40,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetMyParticipantProfileHandler,
                { provide: 'IParticipantRepository', useValue: mockParticipantRepository },
            ],
        }).compile();

        handler = module.get<GetMyParticipantProfileHandler>(GetMyParticipantProfileHandler);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should map origin, knowledge source, and referral code fields distinctly from current location', async () => {
        mockParticipantRepository.findByUserId.mockResolvedValue(baseParticipant);

        const result = await handler.execute(new GetMyParticipantProfileQuery('user-1'));

        expect(result.knowledgeSource).toBe('Instagram');
        expect(result.originCountry).toBe('Vietnam');
        expect(result.originCity).toBe('Hanoi');
        expect(result.referralCode).toBe('ABC-123');

        // Distinct from current* — must not be conflated even when both are set
        expect(result.currentCountry).toBe('Indonesia');
        expect(result.currentCity).toBe('Jakarta');
    });

    it('should still return previously mapped fields unchanged', async () => {
        mockParticipantRepository.findByUserId.mockResolvedValue(baseParticipant);

        const result = await handler.execute(new GetMyParticipantProfileQuery('user-1'));

        expect(result.id).toBe('participant-1');
        expect(result.fullName).toBe('Alya Putri');
        expect(result.gender).toBe('Female');
        expect(result.profileCompletionPercentage).toBe(40);
    });

    it('should map new fields to undefined when null on the entity', async () => {
        mockParticipantRepository.findByUserId.mockResolvedValue({
            ...baseParticipant,
            originCountry: null,
            originCity: null,
            knowledgeSource: null,
            referralCode: null,
        });

        const result = await handler.execute(new GetMyParticipantProfileQuery('user-1'));

        expect(result.originCountry).toBeUndefined();
        expect(result.originCity).toBeUndefined();
        expect(result.knowledgeSource).toBeUndefined();
        expect(result.referralCode).toBeUndefined();
    });

    it('should throw NotFoundException when participant profile does not exist', async () => {
        mockParticipantRepository.findByUserId.mockResolvedValue(null);

        await expect(
            handler.execute(new GetMyParticipantProfileQuery('unknown-user')),
        ).rejects.toThrow(NotFoundException);
    });
});

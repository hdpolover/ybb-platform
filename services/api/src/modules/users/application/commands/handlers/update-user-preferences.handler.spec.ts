
import { Test, TestingModule } from '@nestjs/testing';
import { UpdateUserPreferencesHandler } from './update-user-preferences.handler';
import { UpdateUserPreferencesCommand } from '../update-user-preferences.command';
import { IUserPreferenceRepository } from '@core/interfaces/repositories/user-preference.repository.interface';
import { UserPreference } from '@core/entities/user-preference.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('UpdateUserPreferencesHandler', () => {
    let handler: UpdateUserPreferencesHandler;
    let repository: any;

    const mockRepository = {
        findByUserId: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    };

    const mockPrisma = {
        userPrivacyConsent: { create: jest.fn() },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateUserPreferencesHandler,
                { provide: IUserPreferenceRepository, useValue: mockRepository },
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        handler = module.get<UpdateUserPreferencesHandler>(UpdateUserPreferencesHandler);
        repository = module.get(IUserPreferenceRepository);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should create new preferences if not found', async () => {
        const command = new UpdateUserPreferencesCommand('user-1', { theme: 'dark' });
        
        mockRepository.findByUserId.mockResolvedValue(null);
        mockRepository.create.mockImplementation((pref) => Promise.resolve(pref));

        const result = await handler.execute(command);

        expect(mockRepository.create).toHaveBeenCalled();
        const createdPref = mockRepository.create.mock.calls[0][0];
        expect(createdPref.userId).toBe('user-1');
        expect(createdPref.theme).toBe('dark');
        expect(createdPref.language).toBe('en'); // default
        expect(result.theme).toBe('dark');
    });

    it('should update existing preferences', async () => {
        const command = new UpdateUserPreferencesCommand('user-1', { language: 'id', emailNotifications: false });
        
        const existingPref = new UserPreference(
            'pref-1', 'user-1',
            'light', 'en', 'UTC', 'YYYY-MM-DD', true, false, false, false, true, true, true, {}, new Date(), new Date()
        );

        mockRepository.findByUserId.mockResolvedValue(existingPref);
        mockRepository.update.mockImplementation((pref) => Promise.resolve(pref));

        const result = await handler.execute(command);

        expect(mockRepository.update).toHaveBeenCalled();
        const updatedPref = mockRepository.update.mock.calls[0][0];
        expect(updatedPref.language).toBe('id');
        expect(updatedPref.emailNotifications).toBe(false);
        expect(updatedPref.theme).toBe('light'); // unchanged
        expect(result.language).toBe('id');
    });
    describe('marketing email consent audit', () => {
        const ctx = { ipAddress: '203.0.113.7', userAgent: 'jest' };
        const existing = (marketingEmails: boolean) => new UserPreference(
            'pref-1', 'user-1',
            'light', 'en', 'UTC', 'YYYY-MM-DD', true, false, marketingEmails, false, true, true, true, {}, new Date(), new Date()
        );

        beforeEach(() => {
            mockRepository.update.mockImplementation((pref) => Promise.resolve(pref));
            mockRepository.create.mockImplementation((pref) => Promise.resolve(pref));
        });

        it('defaults to not subscribed and writes no audit row when marketingEmails is not touched', async () => {
            mockRepository.findByUserId.mockResolvedValue(null);

            const result = await handler.execute(new UpdateUserPreferencesCommand('user-1', { theme: 'dark' }, ctx));

            expect(result.marketingEmails).toBe(false);
            expect(mockPrisma.userPrivacyConsent.create).not.toHaveBeenCalled();
        });

        it('records a granted row with text, version and request context on opt-in', async () => {
            mockRepository.findByUserId.mockResolvedValue(existing(false));

            const result = await handler.execute(new UpdateUserPreferencesCommand('user-1', { marketingEmails: true }, ctx));

            expect(result.marketingEmails).toBe(true);
            expect(mockPrisma.userPrivacyConsent.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-1',
                    consentType: 'marketing_emails',
                    consentText: expect.any(String),
                    consentVersion: expect.any(String),
                    isGranted: true,
                    grantedAt: expect.any(Date),
                    revokedAt: null,
                    ipAddress: '203.0.113.7',
                    userAgent: 'jest',
                }),
            });
        });

        it('records a revoked row on opt-out', async () => {
            mockRepository.findByUserId.mockResolvedValue(existing(true));

            const result = await handler.execute(new UpdateUserPreferencesCommand('user-1', { marketingEmails: false }, ctx));

            expect(result.marketingEmails).toBe(false);
            expect(mockPrisma.userPrivacyConsent.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ isGranted: false, grantedAt: null, revokedAt: expect.any(Date) }),
            });
        });

        it('writes no audit row when the submitted value matches the stored one', async () => {
            mockRepository.findByUserId.mockResolvedValue(existing(true));

            await handler.execute(new UpdateUserPreferencesCommand('user-1', { marketingEmails: true, language: 'id' }, ctx));

            expect(mockPrisma.userPrivacyConsent.create).not.toHaveBeenCalled();
        });

        it('does not change the preference when the audit write fails', async () => {
            mockRepository.findByUserId.mockResolvedValue(existing(false));
            mockPrisma.userPrivacyConsent.create.mockRejectedValueOnce(new Error('db down'));

            await expect(
                handler.execute(new UpdateUserPreferencesCommand('user-1', { marketingEmails: true }, ctx)),
            ).rejects.toThrow('db down');
            expect(mockRepository.update).not.toHaveBeenCalled();
        });
    });
});

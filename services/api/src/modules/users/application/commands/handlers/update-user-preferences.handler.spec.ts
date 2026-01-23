
import { Test, TestingModule } from '@nestjs/testing';
import { UpdateUserPreferencesHandler } from './update-user-preferences.handler';
import { UpdateUserPreferencesCommand } from '../update-user-preferences.command';
import { IUserPreferenceRepository } from '@core/interfaces/repositories/user-preference.repository.interface';
import { UserPreference } from '@core/entities/user-preference.entity';

describe('UpdateUserPreferencesHandler', () => {
    let handler: UpdateUserPreferencesHandler;
    let repository: any;

    const mockRepository = {
        findByUserId: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateUserPreferencesHandler,
                { provide: IUserPreferenceRepository, useValue: mockRepository },
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
});

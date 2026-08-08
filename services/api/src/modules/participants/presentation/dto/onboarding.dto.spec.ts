import { plainToInstance } from 'class-transformer';
import { OnboardingDto, Gender } from './onboarding.dto';

const validPayload = {
    fullName: 'John Doe',
    gender: Gender.male,
    originCountry: 'ID',
    originCity: 'Jakarta',
    birthDate: '2000-01-01',
    knowledgeSource: 'Instagram',
};

describe('OnboardingDto referralCode transform', () => {
    it('drops a code longer than the DB column limit (VarChar(20)) instead of rejecting it', () => {
        const oversized = 'A'.repeat(21);
        const dto = plainToInstance(OnboardingDto, { ...validPayload, referralCode: oversized });
        expect(dto.referralCode).toBeUndefined();
    });

    it('keeps a code that is exactly 20 characters', () => {
        const exact = 'A'.repeat(20);
        const dto = plainToInstance(OnboardingDto, { ...validPayload, referralCode: exact });
        expect(dto.referralCode).toBe(exact);
    });

    it('trims a padded code so a 20-char value can never overflow VarChar(20) on write', () => {
        const exact = 'A'.repeat(20);
        const dto = plainToInstance(OnboardingDto, { ...validPayload, referralCode: `  ${exact}  ` });
        expect(dto.referralCode).toBe(exact);
        expect((dto.referralCode as string).length).toBeLessThanOrEqual(20);
    });

    it('drops an empty string', () => {
        const dto = plainToInstance(OnboardingDto, { ...validPayload, referralCode: '' });
        expect(dto.referralCode).toBeUndefined();
    });

    it('drops a whitespace-only string, even if it exceeds 20 chars only after trimming is ignored', () => {
        const dto = plainToInstance(OnboardingDto, { ...validPayload, referralCode: '   ' });
        expect(dto.referralCode).toBeUndefined();
    });

    it('keeps a normal, valid-length code untouched', () => {
        const dto = plainToInstance(OnboardingDto, { ...validPayload, referralCode: 'K9X2M4P1' });
        expect(dto.referralCode).toBe('K9X2M4P1');
    });

    it('leaves referralCode undefined when omitted entirely', () => {
        const dto = plainToInstance(OnboardingDto, { ...validPayload });
        expect(dto.referralCode).toBeUndefined();
    });
});

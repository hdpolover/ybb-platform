import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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

// Audit M99: fullName (VarChar(255)) and originCountry/originCity (VarChar(100))
// had no @MaxLength, so an oversized value reached Postgres as an unnamed
// 22001/500 rather than a named 400 here. On the pre-fix DTO these `validate()`
// calls resolve with zero errors for the offending field.
describe('OnboardingDto - M99 VarChar overflow guards', () => {
    it('rejects a fullName longer than 255 characters (participants.full_name VarChar(255))', async () => {
        const dto = plainToInstance(OnboardingDto, { ...validPayload, fullName: 'A'.repeat(256) });
        const errors = await validate(dto);

        const error = errors.find((e) => e.property === 'fullName');
        expect(error).toBeDefined();
        expect(error?.constraints).toHaveProperty('maxLength');
    });

    it('accepts a fullName at exactly 255 characters', async () => {
        const dto = plainToInstance(OnboardingDto, { ...validPayload, fullName: 'A'.repeat(255) });
        const errors = await validate(dto);

        expect(errors.find((e) => e.property === 'fullName')).toBeUndefined();
    });

    it('rejects an originCity longer than 100 characters (participants.origin_city VarChar(100))', async () => {
        const dto = plainToInstance(OnboardingDto, { ...validPayload, originCity: 'A'.repeat(101) });
        const errors = await validate(dto);

        expect(errors.find((e) => e.property === 'originCity')).toBeDefined();
    });

    it('rejects an originCountry longer than 100 characters', async () => {
        const dto = plainToInstance(OnboardingDto, { ...validPayload, originCountry: 'A'.repeat(101) });
        const errors = await validate(dto);

        expect(errors.find((e) => e.property === 'originCountry')).toBeDefined();
    });
});

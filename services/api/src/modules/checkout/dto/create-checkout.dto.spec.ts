// services/api/src/modules/checkout/dto/create-checkout.dto.spec.ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '@modules/auth/presentation/dto/register.dto';
import { CreateCheckoutDto } from './create-checkout.dto';

const valid = {
    programSlug: 'meys-7',
    tierId: '123e4567-e89b-12d3-a456-426614174000',
    category: 'self_funded',
    email: 'A@B.co',
    password: 'Passw0rd!',
    fullName: "Ada O'Neil-Lovelace Jr.",
    consent: true,
    turnstileToken: 'tok',
};
const errorsFor = async (patch: object) =>
    (await validate(plainToInstance(CreateCheckoutDto, { ...valid, ...patch }))).map((e) => e.property);

describe('CreateCheckoutDto', () => {
    it('accepts a valid body and lowercases the email', async () => {
        const dto = plainToInstance(CreateCheckoutDto, valid);
        expect(await validate(dto)).toHaveLength(0);
        expect(dto.email).toBe('a@b.co');
    });

    it.each([
        ['fullName', { fullName: 'Ada 42' }],
        ['fullName', { fullName: 'Adá' }],
        ['consent', { consent: false }],
        ['consent', { consent: 'true' }],
        ['turnstileToken', { turnstileToken: '' }],
        ['tierId', { tierId: 'nope' }],
        ['category', { category: 'free' }],
    ])('rejects a bad %s', async (prop, patch) => {
        expect(await errorsFor(patch)).toContain(prop);
    });

    it.each(['short1A', 'alllowercase1', 'ALLUPPERCASE1', 'NoDigitsOrSymbols'])('applies the register password rule to %s', async (password) => {
        const registerErrors = (await validate(plainToInstance(RegisterDto, { email: 'a@b.co', providerId: valid.tierId, password }))).map((e) => e.property);
        const checkoutErrors = await errorsFor({ password });
        expect(checkoutErrors.includes('password')).toBe(registerErrors.includes('password'));
    });
});

// services/api/src/modules/checkout/checkout.handler.spec.ts
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CheckoutHandler } from './checkout.handler';

const OFFER = {
    brandId: 'brand-1',
    programId: 'prog-1',
    programName: 'MEYS 7th',
    programSlug: 'meys-7',
    tierId: 'tier-1',
    category: 'self_funded',
};
const SESSION = {
    accessToken: 'at',
    refreshToken: 'rt',
    user: { id: 'user-1', email: 'a@b.co', brandId: 'brand-1', isActive: true, isOnboardingCompleted: false, registeredPrograms: [] },
};
const DTO = {
    programSlug: 'meys-7',
    tierId: 'tier-1',
    category: 'self_funded',
    email: 'a@b.co',
    password: 'Passw0rd!',
    fullName: 'Ada Lovelace',
    consent: true,
    turnstileToken: 'tok',
} as never;
const CTX = { brandDomain: 'meys.org', ip: '1.2.3.4', userAgent: 'jest' };

function build(env: Record<string, string | undefined> = { CHECKOUT_ENABLED: 'true' }) {
    const calls: string[] = [];
    const track = <T>(name: string, value: T) => jest.fn().mockImplementation(async () => (calls.push(name), value));
    const prisma = {
        user: { findFirst: jest.fn().mockResolvedValue(null) },
        authProvider: { findFirst: jest.fn().mockResolvedValue({ id: 'local-id' }) },
        participant: { update: track('fullName', {}) },
        userPrivacyConsent: { create: track('consent', {}) },
        brand: { findUnique: jest.fn().mockResolvedValue({ landingUrl: 'https://meys.org/', websiteUrl: 'meys.org' }) },
    };
    const turnstile = { isConfigured: jest.fn().mockReturnValue(true), verify: track('turnstile', true) };
    const policy = { resolveBrandId: jest.fn().mockResolvedValue('brand-1'), resolveOffer: track('offer', OFFER) };
    const register = { execute: track('register', SESSION) };
    const ensureInvoice = { execute: track('invoice', { invoice_id: 'inv-1' }) };
    const confirm = { execute: track('pay', { status: 'REQUIRES_ACTION', action: { type: 'redirect', url: 'https://xendit/pay' } }) };
    const gateway = { resolveCode: track('method', 'midtrans_cc') };
    const handler = new CheckoutHandler(
        prisma as never,
        { get: (k: string) => env[k] } as never,
        turnstile as never,
        policy as never,
        register as never,
        ensureInvoice as never,
        confirm as never,
        gateway as never,
    );
    return { handler, calls, prisma, turnstile, policy, register, ensureInvoice, confirm, gateway };
}

describe('CheckoutHandler', () => {
    it('verifies captcha, resolves the offer, registers, mints the invoice and starts the payment, in order', async () => {
        const t = build();
        const res = await t.handler.execute(DTO, CTX);

        expect(t.calls).toEqual(['turnstile', 'offer', 'register', 'consent', 'fullName', 'invoice', 'method', 'pay']);
        expect(res).toEqual({ ...SESSION, invoiceId: 'inv-1', redirectUrl: 'https://xendit/pay' });
        expect(t.turnstile.verify).toHaveBeenCalledWith('tok', '1.2.3.4');
    });

    it('registers for the offer program and category through RegisterHandler, with the local provider', async () => {
        const t = build();
        await t.handler.execute(DTO, CTX);
        const cmd = t.register.execute.mock.calls[0][0];
        expect(cmd).toMatchObject({
            email: 'a@b.co',
            providerId: 'local-id',
            password: 'Passw0rd!',
            brandId: 'brand-1',
            programSlug: 'meys-7',
            applicationCategory: 'self_funded',
            ipAddress: '1.2.3.4',
        });
        expect(t.register.execute.mock.calls[0][1]).toBe('meys.org');
    });

    it('starts a gateway payment on the minted invoice with the onboarding return url', async () => {
        const t = build();
        await t.handler.execute(DTO, CTX);
        expect(t.ensureInvoice.execute.mock.calls[0][0]).toMatchObject({ userId: 'user-1', pricingTierId: 'tier-1', programId: 'prog-1' });
        expect(t.confirm.execute.mock.calls[0][0]).toMatchObject({
            userId: 'user-1',
            invoiceId: 'inv-1',
            paymentType: 'gateway',
            paymentMethodId: 'midtrans_cc',
            details: { callbackUrl: 'https://meys.org/onboarding?checkout=return' },
        });
    });

    it('stores the full name on the participant and the consent record', async () => {
        const t = build();
        await t.handler.execute(DTO, CTX);
        expect(t.prisma.participant.update).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { fullName: 'Ada Lovelace' } });
        expect(t.prisma.userPrivacyConsent.create.mock.calls[0][0].data).toMatchObject({ userId: 'user-1', isGranted: true, ipAddress: '1.2.3.4' });
    });

    it('answers 404 and does nothing when the flag is off', async () => {
        const t = build({ CHECKOUT_ENABLED: 'false' });
        await expect(t.handler.execute(DTO, CTX)).rejects.toBeInstanceOf(NotFoundException);
        expect(t.turnstile.verify).not.toHaveBeenCalled();
        expect(t.register.execute).not.toHaveBeenCalled();
    });

    it('answers 503 when the flag is on but the Turnstile secret is missing', async () => {
        const t = build();
        t.turnstile.isConfigured.mockReturnValue(false);
        await expect(t.handler.execute(DTO, CTX)).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(t.register.execute).not.toHaveBeenCalled();
    });

    it('answers 400 CAPTCHA_FAILED and creates nothing when Turnstile rejects', async () => {
        const t = build();
        t.turnstile.verify.mockResolvedValue(false);
        const err = await t.handler.execute(DTO, CTX).catch((e) => e);
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toMatchObject({ code: 'CAPTCHA_FAILED' });
        expect(t.policy.resolveOffer).not.toHaveBeenCalled();
        expect(t.register.execute).not.toHaveBeenCalled();
    });

    it('answers 409 ACCOUNT_EXISTS when the email is already registered in the brand', async () => {
        const t = build();
        t.prisma.user.findFirst.mockResolvedValue({ id: 'old' });
        const err = await t.handler.execute(DTO, CTX).catch((e) => e);
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toMatchObject({ code: 'ACCOUNT_EXISTS' });
        expect(t.register.execute).not.toHaveBeenCalled();
    });

    it('maps a register-time conflict (signup race) to ACCOUNT_EXISTS', async () => {
        const t = build();
        t.register.execute.mockRejectedValue(new ConflictException('dup'));
        const err = await t.handler.execute(DTO, CTX).catch((e) => e);
        expect(err.getResponse()).toMatchObject({ code: 'ACCOUNT_EXISTS' });
    });

    it('rejects an invalid offer before any account is created', async () => {
        const t = build();
        t.policy.resolveOffer.mockRejectedValue(new BadRequestException('closed'));
        await expect(t.handler.execute(DTO, CTX)).rejects.toBeInstanceOf(BadRequestException);
        expect(t.prisma.user.findFirst).not.toHaveBeenCalled();
        expect(t.register.execute).not.toHaveBeenCalled();
    });

    it('still returns the session with PAYMENT_START_FAILED when the gateway call fails', async () => {
        const t = build();
        t.confirm.execute.mockRejectedValue(new Error('gateway down'));
        const res = await t.handler.execute(DTO, CTX);
        expect(res).toEqual({ ...SESSION, invoiceId: 'inv-1', redirectUrl: null, code: 'PAYMENT_START_FAILED' });
    });

    it('still returns the session (no invoiceId) when minting the invoice fails', async () => {
        const t = build();
        t.ensureInvoice.execute.mockRejectedValue(new Error('boom'));
        const res = await t.handler.execute(DTO, CTX);
        expect(res).toEqual({ ...SESSION, invoiceId: null, redirectUrl: null, code: 'PAYMENT_START_FAILED' });
    });

    it('reports PAYMENT_START_FAILED when no gateway method is available', async () => {
        const t = build();
        t.gateway.resolveCode.mockResolvedValue(null);
        const res = await t.handler.execute(DTO, CTX);
        expect(res.code).toBe('PAYMENT_START_FAILED');
        expect(t.confirm.execute).not.toHaveBeenCalled();
    });

    it('keeps the account when saving the name or consent fails', async () => {
        const t = build();
        t.prisma.participant.update.mockRejectedValue(new Error('db'));
        t.prisma.userPrivacyConsent.create.mockRejectedValue(new Error('db'));
        const res = await t.handler.execute(DTO, CTX);
        expect(res.redirectUrl).toBe('https://xendit/pay');
    });
});

// services/api/src/modules/checkout/turnstile.service.spec.ts
import { ServiceUnavailableException } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
    const env: Record<string, string | undefined> = { TURNSTILE_SECRET_KEY: 'secret' };
    const service = new TurnstileService({ get: (k: string) => env[k] } as never);
    const fetchMock = jest.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        (global as { fetch: unknown }).fetch = fetchMock;
        env.TURNSTILE_SECRET_KEY = 'secret';
    });

    it('posts secret, response and remoteip to siteverify and returns success', async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
        await expect(service.verify('tok', '1.2.3.4')).resolves.toBe(true);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
        expect(init.body.toString()).toBe('secret=secret&response=tok&remoteip=1.2.3.4');
    });

    it('returns false when Cloudflare rejects the token', async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
        await expect(service.verify('tok')).resolves.toBe(false);
    });

    it('fails closed with 503 when siteverify is unreachable', async () => {
        fetchMock.mockRejectedValue(new Error('network'));
        await expect(service.verify('tok')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('fails closed with 503 and never calls out when the secret is missing', async () => {
        env.TURNSTILE_SECRET_KEY = undefined;
        expect(service.isConfigured()).toBe(false);
        await expect(service.verify('tok')).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

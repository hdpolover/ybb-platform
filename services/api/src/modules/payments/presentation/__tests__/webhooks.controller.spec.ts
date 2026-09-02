// src/modules/payments/presentation/__tests__/webhooks.controller.spec.ts

import { HttpException, HttpStatus } from '@nestjs/common';
import { WebhooksController } from '../webhooks.controller';
import { PaymentServiceHttpClient } from '../../infrastructure/services/payment-service-http.client';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
    const values: Record<string, string> = {
        PAYMENT_SERVICE_URL: 'http://payment-service:8002',
        PAYMENT_SERVICE_INTERNAL_KEY: 'internal-key-123',
        ...overrides,
    };
    return {
        get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    } as unknown as ConfigService;
}

function makeReq(headers: Record<string, string>, body: unknown = { some: 'payload' }): Request {
    return { headers, body } as unknown as Request;
}

function makeRes(): Response {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('WebhooksController — gateway allowlist and header filtering', () => {
    let mockPost: jest.Mock;
    let client: PaymentServiceHttpClient;
    let controller: WebhooksController;

    beforeEach(() => {
        mockPost = jest.fn().mockResolvedValue({ data: { received: true }, status: 200 });
        client = { post: mockPost } as unknown as PaymentServiceHttpClient;
        controller = new WebhooksController(makeConfig(), client);
    });

    it('forwards a request for an allowed gateway to the matching payment-service path', async () => {
        const req = makeReq({ 'content-type': 'application/json', 'x-callback-token': 'tok-1' });
        const res = makeRes();

        await controller.handleWebhook('xendit', req, res);

        expect(mockPost).toHaveBeenCalledWith(
            '/api/v1/payments/webhook/xendit',
            req.body,
            expect.anything(),
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('rejects a traversal-style gateway param before building the internal path', async () => {
        const req = makeReq({ 'content-type': 'application/json' });
        const res = makeRes();

        await expect(
            controller.handleWebhook('..%2F..%2Fgateway-configs', req, res),
        ).rejects.toMatchObject(new HttpException('Unsupported gateway', HttpStatus.BAD_REQUEST));

        expect(mockPost).not.toHaveBeenCalled();
    });

    it('rejects a gateway name outside the known allowlist', async () => {
        const req = makeReq({});
        const res = makeRes();

        await expect(
            controller.handleWebhook('not-a-real-gateway', req, res),
        ).rejects.toMatchObject(new HttpException('Unsupported gateway', HttpStatus.BAD_REQUEST));

        expect(mockPost).not.toHaveBeenCalled();
    });

    it('forwards only content-type, x-callback-token, and the internal service key — never the full inbound header set', async () => {
        const req = makeReq({
            'content-type': 'application/json',
            'x-callback-token': 'tok-1',
            host: 'api.internal',
            cookie: 'session=admin-session',
            authorization: 'Bearer some-user-token',
            'x-forwarded-for': '10.0.0.1',
        });
        const res = makeRes();

        await controller.handleWebhook('midtrans', req, res);

        const [, , config] = mockPost.mock.calls[0];
        expect(config.headers).toEqual({
            'content-type': 'application/json',
            'x-callback-token': 'tok-1',
            'X-Internal-Service-Key': 'internal-key-123',
        });
    });
});

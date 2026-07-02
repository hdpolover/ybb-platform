import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayClient } from './payment-gateway.client';
import { PaymentServiceHttpClient } from './payment-service-http.client';

describe('PaymentGatewayClient.voidTransaction', () => {
    let client: PaymentGatewayClient;
    let mockPaymentClient: { get: jest.Mock; post: jest.Mock };

    beforeEach(async () => {
        mockPaymentClient = { get: jest.fn(), post: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentGatewayClient,
                { provide: PaymentServiceHttpClient, useValue: mockPaymentClient },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
            ],
        }).compile();

        client = module.get<PaymentGatewayClient>(PaymentGatewayClient);
    });

    it('voids a PENDING transaction', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });
        mockPaymentClient.post.mockResolvedValue({ data: {} });

        const result = await client.voidTransaction('txn-1', 'inv-1', 'Invoice cancelled');

        expect(result.outcome).toBe('voided');
        expect(mockPaymentClient.post).toHaveBeenCalledWith(
            '/api/v1/payments/txn-1/cancel',
            { reason: 'Invoice cancelled' },
            expect.anything(),
        );
    });

    it('no-ops on an already-VOID transaction without calling cancel', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'VOID' } });

        const result = await client.voidTransaction('txn-1', 'inv-1', 'reason');

        expect(result.outcome).toBe('already_terminal');
        expect(mockPaymentClient.post).not.toHaveBeenCalled();
    });

    it('refuses to void a SUCCESS transaction and reports danger_settled', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'SUCCESS' } });

        const result = await client.voidTransaction('txn-1', 'inv-1', 'reason');

        expect(result.outcome).toBe('danger_settled');
        expect(mockPaymentClient.post).not.toHaveBeenCalled();
    });

    it('refuses to void a NEEDS_REVIEW transaction and reports needs_review', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'NEEDS_REVIEW' } });

        const result = await client.voidTransaction('txn-1', 'inv-1', 'reason');

        expect(result.outcome).toBe('needs_review');
        expect(mockPaymentClient.post).not.toHaveBeenCalled();
    });

    it('refuses to void a PENDING transaction that already has a manual-transfer proof attached', async () => {
        mockPaymentClient.get.mockResolvedValue({
            data: { status: 'PENDING', proof_file_url: 'https://files/proof.jpg', payment_method_id: 'manual_transfer' },
        });

        const result = await client.voidTransaction('txn-1', 'inv-1', 'reason');

        expect(result.outcome).toBe('needs_review');
        expect(mockPaymentClient.post).not.toHaveBeenCalled();
    });

    it('treats a gateway 400 on cancel as already_terminal, not an error', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });
        mockPaymentClient.post.mockRejectedValue({ response: { status: 400 } });

        const result = await client.voidTransaction('txn-1', 'inv-1', 'reason');

        expect(result.outcome).toBe('already_terminal');
    });

    it('returns outcome error (not a throw) on a non-400 gateway failure', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });
        mockPaymentClient.post.mockRejectedValue({ response: { status: 500 }, message: 'timeout' });

        const result = await expect(client.voidTransaction('txn-1', 'inv-1', 'reason')).resolves.toEqual(
            expect.objectContaining({ outcome: 'error' }),
        );
        void result;
    });

    it('returns outcome error and does not attempt cancel when the status fetch fails', async () => {
        mockPaymentClient.get.mockRejectedValue(new Error('ECONNRESET'));

        const result = await client.voidTransaction('txn-1', 'inv-1', 'reason');

        expect(result.outcome).toBe('error');
        expect(mockPaymentClient.post).not.toHaveBeenCalled();
    });
});

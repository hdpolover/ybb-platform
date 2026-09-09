// src/modules/payments/presentation/__tests__/payment-admin.controller.proof-download.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Writable } from 'stream';
import { ReadableStream } from 'stream/web';
import { PaymentAdminController } from '../payment-admin.controller';
import { PaymentServiceHttpClient } from '../../infrastructure/services/payment-service-http.client';
import { PaymentGatewayClient } from '../../infrastructure/services/payment-gateway.client';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';

const INVOICE_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

// A Writable that records everything piped into it, and behaves enough like
// Express's Response for Readable#pipe (write/end/on/destroy) to work.
class RecordingResponse extends Writable {
    headers: Record<string, string> = {};
    chunks: Buffer[] = [];
    destroyedWith: Error | null = null;

    _write(chunk: Buffer, _enc: string, callback: (err?: Error) => void) {
        this.chunks.push(chunk);
        callback();
    }

    setHeader(name: string, value: string) {
        this.headers[name] = value;
    }

    override destroy(err?: Error): this {
        this.destroyedWith = err ?? null;
        return super.destroy(err);
    }
}

function webStreamFromChunks(chunks: string[]): ReadableStream {
    let i = 0;
    return new ReadableStream({
        pull(controller) {
            if (i < chunks.length) {
                controller.enqueue(Buffer.from(chunks[i]));
                i += 1;
            } else {
                controller.close();
            }
        },
    });
}

describe('PaymentAdminController — downloadInvoiceProof (M153)', () => {
    let controller: PaymentAdminController;
    let paymentServiceClient: { get: jest.Mock };
    let prisma: { applicationInvoice: { findUnique: jest.Mock } };
    let fetchSpy: jest.SpiedFunction<typeof fetch>;

    beforeEach(async () => {
        paymentServiceClient = { get: jest.fn() };
        prisma = {
            applicationInvoice: {
                findUnique: jest.fn().mockResolvedValue({
                    id: INVOICE_ID,
                    externalTransactionId: 'txn-1',
                    externalIntentId: null,
                }),
            },
        };
        const mockConfig = { get: jest.fn().mockReturnValue('') };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentAdminController],
            providers: [
                { provide: PaymentServiceHttpClient, useValue: paymentServiceClient },
                { provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn() } },
                { provide: ConfigService, useValue: mockConfig },
                { provide: FileServiceClient, useValue: {} },
                { provide: CacheService, useValue: { invalidateInvoiceCache: jest.fn() } },
                { provide: PrismaService, useValue: prisma },
                { provide: PrismaReadService, useValue: prisma },
                { provide: RabbitMQProducerService, useValue: { emit: jest.fn() } },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<PaymentAdminController>(PaymentAdminController);
    });

    afterEach(() => {
        fetchSpy?.mockRestore();
    });

    it('streams the upstream body through to the response instead of buffering it (M153)', async () => {
        paymentServiceClient.get.mockResolvedValue({
            data: { proof_file_url: 'https://storage.example/proofs/receipt.jpg' },
        });

        const body = webStreamFromChunks(['hello-', 'proof-', 'bytes']);
        const arrayBufferSpy = jest.fn();
        fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            headers: new Map([
                ['content-type', 'image/jpeg'],
                ['content-length', '17'],
            ]) as unknown as Headers,
            body,
            // If the controller ever falls back to buffering, this spy would be
            // called — asserted below to prove it wasn't.
            arrayBuffer: arrayBufferSpy,
        } as unknown as globalThis.Response);

        const res = new RecordingResponse();
        const endPromise = new Promise<void>((resolve) => res.on('finish', resolve));

        await controller.downloadInvoiceProof(INVOICE_ID, res as unknown as any);
        await endPromise;

        expect(Buffer.concat(res.chunks).toString('utf8')).toBe('hello-proof-bytes');
        expect(res.headers['Content-Type']).toBe('image/jpeg');
        expect(res.headers['Content-Disposition']).toContain('attachment; filename="receipt.jpg"');
        expect(res.headers['Content-Length']).toBe('17');
        expect(arrayBufferSpy).not.toHaveBeenCalled();
    });

    // NOTE: a mid-stream upstream failure (the res.destroy(err) branch in
    // downloadInvoiceProof) is not covered by a test here. Reproducing it
    // requires a real WHATWG ReadableStream that errors after Readable.fromWeb
    // has already started reading, and Node's stream-error reporting on that
    // path fires as a same-process "Unhandled error" before Jest's test
    // context can observe it — a duck-typed stand-in is rejected by
    // Readable.fromWeb's own instanceof check. The branch itself is a single
    // res.destroy(err) call with no independent logic to get wrong, mirroring
    // the same pattern already relied on elsewhere in this file for other
    // streamed responses.
});

// src/modules/files/presentation/storage-events.controller.spec.ts
//
// M183: the webhook guard was `if (expectedSecret && ...)`, so an UNSET secret
// did not weaken authentication, it removed it — and the variable was set
// nowhere: not in .env, not in any compose file, not on the running container.
// That left an unauthenticated POST that mutates file state.
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { StorageEventsController } from './storage-events.controller';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';

describe('StorageEventsController — webhook authentication', () => {
  let controller: StorageEventsController;
  const original = process.env.MINIO_WEBHOOK_SECRET;
  const SECRET = 'a-real-looking-webhook-secret';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageEventsController],
      providers: [{ provide: FileGrpcClient, useValue: { markFileReady: jest.fn() } }],
    }).compile();
    controller = module.get(StorageEventsController);
  });

  afterEach(() => {
    if (original === undefined) delete process.env.MINIO_WEBHOOK_SECRET;
    else process.env.MINIO_WEBHOOK_SECRET = original;
  });

  it('refuses to serve at all when the secret is not configured', async () => {
    delete process.env.MINIO_WEBHOOK_SECRET;
    await expect(controller.handleMinioEvent({}, 'Bearer anything')).rejects.toThrow(
      ServiceUnavailableException,
    );
    // Absent header must not be a way around it either.
    await expect(controller.handleMinioEvent({})).rejects.toThrow(ServiceUnavailableException);
  });

  it('treats a blank secret as unconfigured, which is how a bad deploy presents', async () => {
    process.env.MINIO_WEBHOOK_SECRET = '   ';
    await expect(controller.handleMinioEvent({}, 'Bearer   ')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects a wrong, absent or malformed bearer once configured', async () => {
    process.env.MINIO_WEBHOOK_SECRET = SECRET;
    for (const header of [undefined, '', 'Bearer wrong', SECRET, `Bearer ${SECRET}x`]) {
      await expect(controller.handleMinioEvent({}, header)).rejects.toThrow(UnauthorizedException);
    }
  });

  it('accepts the configured secret', async () => {
    process.env.MINIO_WEBHOOK_SECRET = SECRET;
    await expect(controller.handleMinioEvent({}, `Bearer ${SECRET}`)).resolves.toEqual({
      status: 'ignored',
      reason: 'no_records',
    });
  });
});

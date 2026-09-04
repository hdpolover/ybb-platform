// services/api/src/modules/files/presentation/documents.controller.spec.ts
//
// Audit M186. GET /documents/verify/:hash is @Public(), and its path parameter
// was forwarded straight into a URL built for the internal file service. A path
// segment that a caller controls should never reach an outbound URL unchecked:
// the HTTP client resolves the finished string with the WHATWG URL parser, so a
// segment can change which endpoint is actually called.
//
// This file did not exist before; the route had no coverage at all.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';

describe('DocumentsController — verifyCertificate (audit M186)', () => {
    let controller: DocumentsController;
    const mockFileServiceClient = {
        verifyCertificate: jest.fn().mockResolvedValue({ valid: true }),
    };

    // A verification hash is the first 16 characters of a sha256 hexdigest, so
    // it is always 16 lowercase hex characters.
    const VALID = 'a1b2c3d4e5f60718';

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [DocumentsController],
            providers: [
                { provide: FileServiceClient, useValue: mockFileServiceClient },
                { provide: FileGrpcClient, useValue: {} },
            ],
        })
            // The controller class carries JwtAuthGuard; this route is @Public()
            // but the guard still has to resolve for the module to compile.
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get<DocumentsController>(DocumentsController);
    });

    it('forwards a well-formed hash', async () => {
        await controller.verifyCertificate(VALID);
        expect(mockFileServiceClient.verifyCertificate).toHaveBeenCalledWith(VALID);
    });

    it.each([
        ['a path segment', '../media/program/some-id'],
        ['an encoded path segment', '..%2F..%2Fmedia%2Fprogram%2Fsome-id'],
        ['a query string', 'a1b2c3d4e5f60718?brand_id=other'],
        ['the wrong length', 'a1b2c3'],
        ['non-hex characters', 'zzzzzzzzzzzzzzzz'],
        ['empty', ''],
    ])('rejects %s without calling the file service', async (_label, hash) => {
        await expect(controller.verifyCertificate(hash)).rejects.toBeInstanceOf(
            BadRequestException,
        );
        expect(mockFileServiceClient.verifyCertificate).not.toHaveBeenCalled();
    });

    it('does not swallow the rejection into the route generic failure response', async () => {
        // The handler has a try/catch that turns errors into
        // { success: false, message: 'Certificate verification failed' }. The
        // validation must sit OUTSIDE it, or a malformed hash returns 200 with a
        // soft failure and nothing is actually rejected.
        await expect(controller.verifyCertificate('nope')).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });
});

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
import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { DocumentsController } from './documents.controller';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

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
                // AdminScopeGuard on the generator routes needs it to resolve.
                { provide: PrismaReadService, useValue: {} },
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

// The generators render body-supplied data with no tenant id to scope by, so
// they are platform-only. Real AdminScopeGuard against the real route metadata.
describe('DocumentsController generators are platform-only (real AdminScopeGuard)', () => {
    const BASE = { canManageAdmins: false, canAssignRoles: false, customPermissions: [], role: { name: 'admin', permissions: [] } };
    const BRAND_ADMIN = { ...BASE, accessLevel: 3, adminBrands: [{ brandId: 'brand-a', permissions: [] }], adminPrograms: [] };
    const ASSIGNED_ADMIN = { ...BASE, accessLevel: 1, adminBrands: [], adminPrograms: [{ programId: 'prog-a', permissions: [] }] };
    const PLATFORM_ADMIN = { ...BASE, accessLevel: 10, role: { name: 'super admin', permissions: ['*'] }, adminBrands: [], adminPrograms: [] };

    const prismaRead = { admin: { findUnique: jest.fn() } };
    const guard = new AdminScopeGuard(new Reflector(), prismaRead as unknown as PrismaReadService);

    function contextFor(handler: (...args: never[]) => unknown): ExecutionContext {
        const request = { user: { adminId: 'admin-1' }, params: {} };
        return {
            getHandler: () => handler,
            getClass: () => DocumentsController,
            switchToHttp: () => ({ getRequest: () => request }),
        } as unknown as ExecutionContext;
    }

    const p = DocumentsController.prototype;
    const routes: Array<[string, (...args: never[]) => unknown]> = [
        ['export/participants', p.exportParticipantReport],
        ['export/payments', p.exportPaymentReport],
        ['export/custom', p.exportCustomReport],
        ['generate/receipt', p.generateReceipt],
        ['generate/offer-letter', p.generateOfferLetter],
        ['generate/certificate', p.generateCertificate],
    ];

    beforeEach(() => jest.clearAllMocks());

    it.each(routes)('%s: brand-scoped and assigned admins get 403', async (_n, handler) => {
        for (const admin of [BRAND_ADMIN, ASSIGNED_ADMIN]) {
            prismaRead.admin.findUnique.mockResolvedValue(admin);
            await expect(guard.canActivate(contextFor(handler))).rejects.toThrow(ForbiddenException);
        }
    });

    it.each(routes)('%s: platform admin passes', async (_n, handler) => {
        prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
        await expect(guard.canActivate(contextFor(handler))).resolves.toBe(true);
    });

    it('public verify/:hash stays unscoped', async () => {
        await expect(guard.canActivate(contextFor(p.verifyCertificate))).resolves.toBe(true);
        expect(prismaRead.admin.findUnique).not.toHaveBeenCalled();
    });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { FilesController } from './files.controller';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';
import { StorageService } from '../application/storage.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';

// BLOCKER regression coverage: GET /v1/files/:fileId/download is @Public() and must
// never 302-redirect to a private-category (documents, signed-copies) file's raw
// permanent URL. Private files are served exclusively via presigned URLs from the
// authenticated portal/admin listings now — this masked endpoint must deny (404) them,
// indistinguishable from an unresolvable id, so it leaks no existence information.
describe('FilesController — downloadFile (masked public download)', () => {
    let controller: FilesController;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockPrisma: any;
    let mockRes: jest.Mocked<Response>;

    const FILE_ID = '123e4567-e89b-12d3-a456-426614174000';

    beforeEach(async () => {
        mockPrisma = {
            file: {
                findFirst: jest.fn().mockResolvedValue(null),
            },
            programResource: {
                findMany: jest.fn().mockResolvedValue([]),
            },
            documentTemplate: {
                findMany: jest.fn().mockResolvedValue([]),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [FilesController],
            providers: [
                { provide: FileServiceClient, useValue: {} },
                { provide: FileGrpcClient, useValue: {} },
                { provide: StorageService, useValue: {} },
                { provide: MetricsService, useValue: { fileUploadsTotal: { inc: jest.fn() } } },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: PrismaReadService, useValue: {} },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<FilesController>(FilesController);

        mockRes = {
            setHeader: jest.fn(),
            redirect: jest.fn(),
        } as unknown as jest.Mocked<Response>;
    });

    it('404s (does not redirect) for a File row in the documents category', async () => {
        mockPrisma.file.findFirst.mockResolvedValueOnce({
            url: 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/documents/file1.pdf',
            storagePath: 'prod/brandx/programs/prog1/documents/file1.pdf',
        });

        await expect(controller.downloadFile(FILE_ID, mockRes)).rejects.toThrow(NotFoundException);
        expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('404s (does not redirect) for a File row in the signed-copies category', async () => {
        mockPrisma.file.findFirst.mockResolvedValueOnce({
            url: 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/signed-copies/file2.pdf',
            storagePath: 'prod/brandx/programs/prog1/signed-copies/file2.pdf',
        });

        await expect(controller.downloadFile(FILE_ID, mockRes)).rejects.toThrow(NotFoundException);
        expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('still 302-redirects for a File row in a public category (gallery)', async () => {
        const publicUrl = 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/gallery/photo.jpg';
        mockPrisma.file.findFirst.mockResolvedValueOnce({
            url: publicUrl,
            storagePath: 'prod/brandx/programs/prog1/gallery/photo.jpg',
        });

        await controller.downloadFile(FILE_ID, mockRes);

        expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
        expect(mockRes.redirect).toHaveBeenCalledWith(302, publicUrl);
    });

    it('still 302-redirects for a File row in a public category (avatars)', async () => {
        const publicUrl = 'https://cdn.ybbhub.com/prod/brandx/users/u1/avatars/photo.jpg';
        mockPrisma.file.findFirst.mockResolvedValueOnce({
            url: publicUrl,
            storagePath: 'prod/brandx/users/u1/avatars/photo.jpg',
        });

        await controller.downloadFile(FILE_ID, mockRes);

        expect(mockRes.redirect).toHaveBeenCalledWith(302, publicUrl);
    });

    it('404s (does not redirect) when only a DocumentTemplate matches', async () => {
        // No File-table match at all — falls through to the templateCandidates lookup.
        mockPrisma.documentTemplate.findMany.mockResolvedValueOnce([
            { templateUrl: `https://cdn.ybbhub.com/prod/brandx/programs/prog1/documents/${FILE_ID}.pdf` },
        ]);

        await expect(controller.downloadFile(FILE_ID, mockRes)).rejects.toThrow(NotFoundException);
        expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('404s for an unresolvable id (no File, ProgramResource, or DocumentTemplate match)', async () => {
        await expect(controller.downloadFile(FILE_ID, mockRes)).rejects.toThrow(NotFoundException);
        expect(mockRes.redirect).not.toHaveBeenCalled();
    });
});

// Regression coverage for fix/file-brand-attribution: a program-scoped upload must be
// stamped with the PROGRAM's own brand, never the uploader's JWT home brand. user_id is
// always forced from the JWT regardless.
describe('FilesController — requestUploadUrl (brand attribution)', () => {
    let controller: FilesController;
    let mockPrisma: { program: { findUnique: jest.Mock } };
    let mockPrismaRead: { admin: { findUnique: jest.Mock }; program: { findUnique: jest.Mock } };
    let mockFileServiceClient: { createUploadUrl: jest.Mock };

    const PROGRAM_ID = 'prog-1';
    const PROGRAM_BRAND_ID = 'brand-program-owner';
    const JWT_HOME_BRAND_ID = 'brand-jwt-home';

    const baseDto = {
        filename: 'photo.jpg',
        content_type: 'image/jpeg',
        size: 1024,
        user_id: 'caller-supplied-should-be-ignored',
        brand_id: 'caller-supplied-should-be-ignored',
    };

    beforeEach(async () => {
        mockPrisma = {
            program: { findUnique: jest.fn() },
        };
        mockPrismaRead = {
            admin: { findUnique: jest.fn() },
            program: { findUnique: jest.fn() },
        };
        mockFileServiceClient = {
            createUploadUrl: jest.fn().mockResolvedValue({
                file_id: 'file-1',
                upload_url: 'https://storage.example.com/upload',
                storage_path: 'path',
                bucket: 'gallery',
                public_url: null,
                expires_in_seconds: 600,
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [FilesController],
            providers: [
                { provide: FileServiceClient, useValue: mockFileServiceClient },
                { provide: FileGrpcClient, useValue: {} },
                { provide: StorageService, useValue: {} },
                { provide: MetricsService, useValue: { fileUploadsTotal: { inc: jest.fn() } } },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: PrismaReadService, useValue: mockPrismaRead },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<FilesController>(FilesController);
    });

    it('stamps the PROGRAM brand, not the JWT brand, for a same-org participant upload', async () => {
        mockPrisma.program.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            brandId: JWT_HOME_BRAND_ID,
            deletedAt: null,
        });
        const user = { userId: 'user-1', email: 'p@x.com', brandId: JWT_HOME_BRAND_ID };

        await controller.requestUploadUrl({ ...baseDto, program_id: PROGRAM_ID }, user);

        expect(mockFileServiceClient.createUploadUrl).toHaveBeenCalledWith(
            expect.objectContaining({ brand_id: JWT_HOME_BRAND_ID, user_id: 'user-1' }),
        );
    });

    it('stamps the PROGRAM brand (not the caller JWT brand) for a multi-brand admin uploading cross-brand', async () => {
        mockPrisma.program.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            brandId: PROGRAM_BRAND_ID,
            deletedAt: null,
        });
        mockPrismaRead.program.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            brandId: PROGRAM_BRAND_ID,
            name: 'Test Program',
            deletedAt: null,
        });
        mockPrismaRead.admin.findUnique.mockResolvedValue({
            accessLevel: 10, // platform/super admin
            canManageAdmins: false,
            canAssignRoles: false,
            customPermissions: null,
            role: null,
            adminBrands: [],
            adminPrograms: [],
        });
        const superAdminUser = {
            userId: 'admin-1',
            email: 'super@ybbhub.com',
            brandId: JWT_HOME_BRAND_ID,
            adminId: 'admin-1',
        };

        await controller.requestUploadUrl({ ...baseDto, program_id: PROGRAM_ID }, superAdminUser);

        expect(mockFileServiceClient.createUploadUrl).toHaveBeenCalledWith(
            expect.objectContaining({ brand_id: PROGRAM_BRAND_ID, user_id: 'admin-1' }),
        );
    });

    it('rejects a non-admin caller uploading cross-brand to a program they do not own', async () => {
        mockPrisma.program.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            brandId: PROGRAM_BRAND_ID,
            deletedAt: null,
        });
        const otherBrandUser = { userId: 'user-2', email: 'p2@x.com', brandId: JWT_HOME_BRAND_ID };

        await expect(
            controller.requestUploadUrl({ ...baseDto, program_id: PROGRAM_ID }, otherBrandUser),
        ).rejects.toThrow();
        expect(mockFileServiceClient.createUploadUrl).not.toHaveBeenCalled();
    });

    it('keeps the old JWT-brand behavior when no program_id is supplied', async () => {
        const user = { userId: 'user-3', email: 'p3@x.com', brandId: JWT_HOME_BRAND_ID };

        await controller.requestUploadUrl({ ...baseDto }, user);

        expect(mockPrisma.program.findUnique).not.toHaveBeenCalled();
        expect(mockFileServiceClient.createUploadUrl).toHaveBeenCalledWith(
            expect.objectContaining({ brand_id: JWT_HOME_BRAND_ID, user_id: 'user-3' }),
        );
    });

    it('always forces user_id from the JWT, never from the caller-supplied body', async () => {
        const user = { userId: 'real-jwt-user', email: 'p4@x.com', brandId: JWT_HOME_BRAND_ID };

        await controller.requestUploadUrl({ ...baseDto, user_id: 'spoofed-user-id' }, user);

        expect(mockFileServiceClient.createUploadUrl).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: 'real-jwt-user' }),
        );
    });
});

describe('FilesController — identifiers forwarded to the file service (audit M186)', () => {
    let controller: FilesController;
    const mockFileServiceClient = {
        getFile: jest.fn().mockResolvedValue({ id: 'x' }),
        markFileReady: jest.fn().mockResolvedValue({ id: 'x' }),
    };
    const user = { userId: 'user-1', brandId: 'brand-1', email: 'a@b.c' } as never;

    // A file id ends up inside a URL path sent to the file service, so its shape
    // is checked before it is used. The controller already carried a UUID_PATTERN
    // for the public download path; these two handlers simply never called it.
    const TRAVERSAL = '..%2F..%2Fmedia%2Fprogram%2Fother';

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [FilesController],
            providers: [
                { provide: FileServiceClient, useValue: mockFileServiceClient },
                { provide: FileGrpcClient, useValue: {} },
                { provide: StorageService, useValue: {} },
                { provide: MetricsService, useValue: { fileUploadsTotal: { inc: jest.fn() } } },
                { provide: PrismaService, useValue: {} },
                { provide: PrismaReadService, useValue: {} },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get<FilesController>(FilesController);
    });

    it('getFile refuses an id that is not a uuid, without calling the file service', async () => {
        await expect(controller.getFile(TRAVERSAL, user)).rejects.toBeInstanceOf(BadRequestException);
        expect(mockFileServiceClient.getFile).not.toHaveBeenCalled();
    });

    it('getFile still forwards a well-formed id', async () => {
        await controller.getFile('123e4567-e89b-12d3-a456-426614174000', user);
        expect(mockFileServiceClient.getFile).toHaveBeenCalled();
    });

    it('markFileReady refuses an id that is not a uuid, without calling the file service', async () => {
        await expect(controller.markFileReady(TRAVERSAL, user)).rejects.toBeInstanceOf(
            BadRequestException,
        );
        expect(mockFileServiceClient.markFileReady).not.toHaveBeenCalled();
    });

    it('markFileReady still forwards a well-formed id', async () => {
        await controller.markFileReady('123e4567-e89b-12d3-a456-426614174000', user);
        expect(mockFileServiceClient.markFileReady).toHaveBeenCalled();
    });
});

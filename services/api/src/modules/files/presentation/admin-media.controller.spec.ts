import { ForbiddenException } from '@nestjs/common';
import { AdminMediaController } from './admin-media.controller';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { StorageService } from '../application/storage.service';
import { PrivateFileUrlResolver, PRIVATE_FILE_UNAVAILABLE } from '../application/private-file-url-resolver.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';

describe('AdminMediaController — listMedia', () => {
    let controller: AdminMediaController;
    let mockFileServiceClient: { listProgramMedia: jest.Mock };
    let mockPrivateFileUrlResolver: { resolveByKey: jest.Mock };
    let mockPrismaRead: { admin: { findUnique: jest.Mock }; program: { findUnique: jest.Mock } };

    const PROGRAM_ID = 'prog-1';
    const PROGRAM_BRAND_ID = 'brand-1';
    const PRESIGNED_URL = 'https://storage.example.com/signed?X-Amz-Signature=abc';

    const platformAdminUser: CurrentUserData = {
        userId: 'admin-user-1',
        email: 'admin@ybbhub.com',
        brandId: 'brand-home',
        adminId: 'admin-1',
    };

    const brandScopedAdminUser: CurrentUserData = {
        userId: 'admin-user-2',
        email: 'brandadmin@ybbhub.com',
        brandId: 'brand-1',
        adminId: 'admin-2',
    };

    function mockAdmin(overrides: Partial<{
        accessLevel: number;
        canManageAdmins: boolean;
        canAssignRoles: boolean;
        customPermissions: unknown;
        role: { name: string; permissions: unknown } | null;
        adminBrands: Array<{ brandId: string; permissions: unknown }>;
        adminPrograms: Array<{ programId: string; permissions: unknown }>;
    }>) {
        return {
            accessLevel: 1,
            canManageAdmins: false,
            canAssignRoles: false,
            customPermissions: null,
            role: null,
            adminBrands: [],
            adminPrograms: [],
            ...overrides,
        };
    }

    beforeEach(() => {
        mockFileServiceClient = { listProgramMedia: jest.fn() };
        mockPrivateFileUrlResolver = { resolveByKey: jest.fn() };
        mockPrismaRead = {
            admin: { findUnique: jest.fn() },
            program: { findUnique: jest.fn() },
        };

        controller = new AdminMediaController(
            mockFileServiceClient as unknown as FileServiceClient,
            {} as StorageService,
            mockPrivateFileUrlResolver as unknown as PrivateFileUrlResolver,
            mockPrismaRead as unknown as PrismaReadService,
        );

        mockPrismaRead.program.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            brandId: PROGRAM_BRAND_ID,
            name: 'Test Program',
            deletedAt: null,
        });
    });

    it('derives brand_id from the program (super admin), ignoring any caller-supplied value', async () => {
        mockPrismaRead.admin.findUnique.mockResolvedValue(mockAdmin({ accessLevel: 10 }));
        mockFileServiceClient.listProgramMedia.mockResolvedValue({ files: [], total: 0 });

        await controller.listMedia(PROGRAM_ID, platformAdminUser);

        expect(mockFileServiceClient.listProgramMedia).toHaveBeenCalledWith(
            expect.objectContaining({ programId: PROGRAM_ID, brandId: PROGRAM_BRAND_ID }),
        );
    });

    it('allows a brand-scoped admin to list media for a program in their own brand', async () => {
        mockPrismaRead.admin.findUnique.mockResolvedValue(
            mockAdmin({ adminBrands: [{ brandId: PROGRAM_BRAND_ID, permissions: null }] }),
        );
        mockFileServiceClient.listProgramMedia.mockResolvedValue({ files: [], total: 0 });

        await controller.listMedia(PROGRAM_ID, brandScopedAdminUser);

        expect(mockFileServiceClient.listProgramMedia).toHaveBeenCalledWith(
            expect.objectContaining({ brandId: PROGRAM_BRAND_ID }),
        );
    });

    it('rejects a brand-scoped admin from listing media for a program outside their brand', async () => {
        mockPrismaRead.admin.findUnique.mockResolvedValue(
            mockAdmin({ adminBrands: [{ brandId: 'some-other-brand', permissions: null }] }),
        );

        await expect(controller.listMedia(PROGRAM_ID, brandScopedAdminUser)).rejects.toThrow(ForbiddenException);
        expect(mockFileServiceClient.listProgramMedia).not.toHaveBeenCalled();
    });

    it('replaces url/download_url with a fresh presigned url for a private-category file', async () => {
        mockPrismaRead.admin.findUnique.mockResolvedValue(mockAdmin({ accessLevel: 10 }));
        mockFileServiceClient.listProgramMedia.mockResolvedValue({
            files: [
                {
                    id: 'file-1',
                    storage_path: 'prod/brandx/programs/prog1/documents/agreement.pdf',
                    url: 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/documents/agreement.pdf',
                    download_url: 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/documents/agreement.pdf',
                },
            ],
            total: 1,
        });
        mockPrivateFileUrlResolver.resolveByKey.mockResolvedValue(PRESIGNED_URL);

        const result = await controller.listMedia(PROGRAM_ID, platformAdminUser);

        expect(mockPrivateFileUrlResolver.resolveByKey).toHaveBeenCalledWith(
            'prod/brandx/programs/prog1/documents/agreement.pdf',
        );
        expect((result.files as Array<Record<string, unknown>>)[0].url).toBe(PRESIGNED_URL);
        expect((result.files as Array<Record<string, unknown>>)[0].download_url).toBe(PRESIGNED_URL);
    });

    it('leaves a public-category file (gallery) untouched', async () => {
        mockPrismaRead.admin.findUnique.mockResolvedValue(mockAdmin({ accessLevel: 10 }));
        const publicFile = {
            id: 'file-2',
            storage_path: 'prod/brandx/programs/prog1/gallery/photo.jpg',
            url: 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/gallery/photo.jpg',
            download_url: 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/gallery/photo.jpg',
        };
        mockFileServiceClient.listProgramMedia.mockResolvedValue({ files: [publicFile], total: 1 });

        const result = await controller.listMedia(PROGRAM_ID, platformAdminUser);

        expect(mockPrivateFileUrlResolver.resolveByKey).not.toHaveBeenCalled();
        expect(result.files).toEqual([publicFile]);
    });

    it('clears url/download_url (fails closed) when a private file cannot be presigned', async () => {
        mockPrismaRead.admin.findUnique.mockResolvedValue(mockAdmin({ accessLevel: 10 }));
        mockFileServiceClient.listProgramMedia.mockResolvedValue({
            files: [
                {
                    id: 'file-3',
                    storage_path: 'prod/brandx/programs/prog1/signed-copies/signed.pdf',
                    url: 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/signed-copies/signed.pdf',
                    download_url: 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/signed-copies/signed.pdf',
                },
            ],
            total: 1,
        });
        mockPrivateFileUrlResolver.resolveByKey.mockResolvedValue(PRIVATE_FILE_UNAVAILABLE);

        const result = await controller.listMedia(PROGRAM_ID, platformAdminUser);

        const file = (result.files as Array<Record<string, unknown>>)[0];
        expect(file.url).toBeNull();
        expect(file.download_url).toBeNull();
    });
});

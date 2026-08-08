import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { FilesController } from './files.controller';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';
import { StorageService } from '../application/storage.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
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

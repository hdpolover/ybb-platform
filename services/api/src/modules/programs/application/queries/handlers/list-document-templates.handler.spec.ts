import { DocumentTemplate } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { ListDocumentTemplatesHandler } from './list-program-content.handlers';
import { ListDocumentTemplatesQuery } from '../list-program-content.queries';
import { IProgramContentRepository } from '../../../../../core/interfaces/repositories/program-content.repository.interface';
import { IProgramRepository } from '../../../../../core/interfaces/repositories/program.repository.interface';
import { PrivateFileUrlResolver, PRIVATE_FILE_UNAVAILABLE } from '@modules/files/application/private-file-url-resolver.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

const platformAdmin = {
    accessLevel: 5,
    canManageAdmins: true,
    canAssignRoles: true,
    customPermissions: [],
    role: { name: 'super_admin', permissions: ['platform_access'] },
    adminBrands: [],
    adminPrograms: [],
};
const assignedAdminFor = (programIds: string[]) => ({
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'reviewer', permissions: [] },
    adminBrands: [],
    adminPrograms: programIds.map((programId) => ({ programId, permissions: [] })),
});
const actor = { userId: 'admin-1', email: 'a@b.c', brandId: 'brand-x', adminId: 'adm-1' } as any;

// SHOULD-FIX coverage flagged by review: ListDocumentTemplatesHandler now presigns
// private-category (documents/signed-copies) templateUrl values instead of returning
// the raw permanent CDN url, since the masked public download endpoint denies them.
describe('ListDocumentTemplatesHandler — private file presigning', () => {
    let handler: ListDocumentTemplatesHandler;
    let mockRepository: jest.Mocked<Pick<IProgramContentRepository, 'findDocumentTemplatesByProgramId'>>;
    let mockProgramRepository: jest.Mocked<Pick<IProgramRepository, 'findBySlug'>>;
    let mockPrivateFileUrlResolver: { resolve: jest.Mock };
    let mockPrismaRead: any;

    // UUID form so resolveProgramId() short-circuits and never needs findBySlug.
    const PROGRAM_ID = '123e4567-e89b-12d3-a456-426614174000';
    const PRIVATE_TEMPLATE_URL = 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/documents/agreement.pdf';
    const PUBLIC_URL = 'https://example.com/marketing.pdf';
    const PRESIGNED_URL = 'https://storage.example.com/signed?X-Amz-Signature=abc';

    const makeTemplate = (templateUrl: string | null): DocumentTemplate =>
        ({
            id: 'tmpl-1',
            programId: PROGRAM_ID,
            name: 'Agreement',
            type: 'agreement_letter',
            templateUrl,
        }) as unknown as DocumentTemplate;

    beforeEach(() => {
        mockRepository = { findDocumentTemplatesByProgramId: jest.fn() };
        mockProgramRepository = { findBySlug: jest.fn() };
        mockPrivateFileUrlResolver = { resolve: jest.fn() };
        // Platform-scope admin passes every programme, keeping these tests
        // about presigning rather than the (separately tested) scope check.
        mockPrismaRead = {
            admin: { findUnique: jest.fn().mockResolvedValue(platformAdmin) },
            program: {
                findUnique: jest.fn().mockResolvedValue({ id: PROGRAM_ID, brandId: 'brand-x', name: 'P', deletedAt: null }),
            },
        };

        handler = new ListDocumentTemplatesHandler(
            mockRepository as unknown as IProgramContentRepository,
            mockProgramRepository as unknown as IProgramRepository,
            mockPrivateFileUrlResolver as unknown as PrivateFileUrlResolver,
            mockPrismaRead as unknown as PrismaReadService,
        );
    });

    it('replaces a private-category templateUrl with a fresh presigned url', async () => {
        mockRepository.findDocumentTemplatesByProgramId.mockResolvedValue([makeTemplate(PRIVATE_TEMPLATE_URL)]);
        mockPrivateFileUrlResolver.resolve.mockResolvedValue(PRESIGNED_URL);

        const result = await handler.execute(new ListDocumentTemplatesQuery(PROGRAM_ID, actor));

        expect(mockPrivateFileUrlResolver.resolve).toHaveBeenCalledWith(PRIVATE_TEMPLATE_URL);
        expect(result[0].templateUrl).toBe(PRESIGNED_URL);
    });

    it('leaves a non-private templateUrl unchanged', async () => {
        mockRepository.findDocumentTemplatesByProgramId.mockResolvedValue([makeTemplate(PUBLIC_URL)]);
        mockPrivateFileUrlResolver.resolve.mockResolvedValue(null);

        const result = await handler.execute(new ListDocumentTemplatesQuery(PROGRAM_ID, actor));

        expect(result[0].templateUrl).toBe(PUBLIC_URL);
    });

    it('nulls out the templateUrl (fails closed) when presigning fails', async () => {
        mockRepository.findDocumentTemplatesByProgramId.mockResolvedValue([makeTemplate(PRIVATE_TEMPLATE_URL)]);
        mockPrivateFileUrlResolver.resolve.mockResolvedValue(PRIVATE_FILE_UNAVAILABLE);

        const result = await handler.execute(new ListDocumentTemplatesQuery(PROGRAM_ID, actor));

        expect(result[0].templateUrl).toBeNull();
    });

    it('returns null templateUrl unchanged (no resolver call) when there is no url', async () => {
        mockRepository.findDocumentTemplatesByProgramId.mockResolvedValue([makeTemplate(null)]);

        const result = await handler.execute(new ListDocumentTemplatesQuery(PROGRAM_ID, actor));

        expect(result[0].templateUrl).toBeNull();
        expect(mockPrivateFileUrlResolver.resolve).not.toHaveBeenCalled();
    });

    // Admin-only route (@Roles), previously unscoped: any admin could list any
    // programme's document templates by id.
    it('refuses a programme-scoped admin listing templates outside their assigned programmes', async () => {
        mockPrismaRead.admin.findUnique.mockResolvedValue(assignedAdminFor(['someone-elses-program']));

        await expect(
            handler.execute(new ListDocumentTemplatesQuery(PROGRAM_ID, actor)),
        ).rejects.toThrow(ForbiddenException);

        expect(mockRepository.findDocumentTemplatesByProgramId).not.toHaveBeenCalled();
    });

    it('lets a programme-assigned admin list templates for their own programme', async () => {
        mockPrismaRead.admin.findUnique.mockResolvedValue(assignedAdminFor([PROGRAM_ID]));
        mockRepository.findDocumentTemplatesByProgramId.mockResolvedValue([makeTemplate(null)]);

        await expect(
            handler.execute(new ListDocumentTemplatesQuery(PROGRAM_ID, actor)),
        ).resolves.toHaveLength(1);
    });
});

import { DocumentTemplate } from '@prisma/client';
import { ListDocumentTemplatesHandler } from './list-program-content.handlers';
import { ListDocumentTemplatesQuery } from '../list-program-content.queries';
import { IProgramContentRepository } from '../../../../../core/interfaces/repositories/program-content.repository.interface';
import { IProgramRepository } from '../../../../../core/interfaces/repositories/program.repository.interface';
import { PrivateFileUrlResolver, PRIVATE_FILE_UNAVAILABLE } from '@modules/files/application/private-file-url-resolver.service';

// SHOULD-FIX coverage flagged by review: ListDocumentTemplatesHandler now presigns
// private-category (documents/signed-copies) templateUrl values instead of returning
// the raw permanent CDN url, since the masked public download endpoint denies them.
describe('ListDocumentTemplatesHandler — private file presigning', () => {
    let handler: ListDocumentTemplatesHandler;
    let mockRepository: jest.Mocked<Pick<IProgramContentRepository, 'findDocumentTemplatesByProgramId'>>;
    let mockProgramRepository: jest.Mocked<Pick<IProgramRepository, 'findBySlug'>>;
    let mockPrivateFileUrlResolver: { resolve: jest.Mock };

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

        handler = new ListDocumentTemplatesHandler(
            mockRepository as unknown as IProgramContentRepository,
            mockProgramRepository as unknown as IProgramRepository,
            mockPrivateFileUrlResolver as unknown as PrivateFileUrlResolver,
        );
    });

    it('replaces a private-category templateUrl with a fresh presigned url', async () => {
        mockRepository.findDocumentTemplatesByProgramId.mockResolvedValue([makeTemplate(PRIVATE_TEMPLATE_URL)]);
        mockPrivateFileUrlResolver.resolve.mockResolvedValue(PRESIGNED_URL);

        const result = await handler.execute(new ListDocumentTemplatesQuery(PROGRAM_ID));

        expect(mockPrivateFileUrlResolver.resolve).toHaveBeenCalledWith(PRIVATE_TEMPLATE_URL);
        expect(result[0].templateUrl).toBe(PRESIGNED_URL);
    });

    it('leaves a non-private templateUrl unchanged', async () => {
        mockRepository.findDocumentTemplatesByProgramId.mockResolvedValue([makeTemplate(PUBLIC_URL)]);
        mockPrivateFileUrlResolver.resolve.mockResolvedValue(null);

        const result = await handler.execute(new ListDocumentTemplatesQuery(PROGRAM_ID));

        expect(result[0].templateUrl).toBe(PUBLIC_URL);
    });

    it('nulls out the templateUrl (fails closed) when presigning fails', async () => {
        mockRepository.findDocumentTemplatesByProgramId.mockResolvedValue([makeTemplate(PRIVATE_TEMPLATE_URL)]);
        mockPrivateFileUrlResolver.resolve.mockResolvedValue(PRIVATE_FILE_UNAVAILABLE);

        const result = await handler.execute(new ListDocumentTemplatesQuery(PROGRAM_ID));

        expect(result[0].templateUrl).toBeNull();
    });

    it('returns null templateUrl unchanged (no resolver call) when there is no url', async () => {
        mockRepository.findDocumentTemplatesByProgramId.mockResolvedValue([makeTemplate(null)]);

        const result = await handler.execute(new ListDocumentTemplatesQuery(PROGRAM_ID));

        expect(result[0].templateUrl).toBeNull();
        expect(mockPrivateFileUrlResolver.resolve).not.toHaveBeenCalled();
    });
});

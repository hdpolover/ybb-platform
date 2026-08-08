import { AdminMediaController } from './admin-media.controller';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { StorageService } from '../application/storage.service';
import { PrivateFileUrlResolver, PRIVATE_FILE_UNAVAILABLE } from '../application/private-file-url-resolver.service';

describe('AdminMediaController — listMedia (private-file presigning)', () => {
    let controller: AdminMediaController;
    let mockFileServiceClient: { listProgramMedia: jest.Mock };
    let mockPrivateFileUrlResolver: { resolveByKey: jest.Mock };

    const PROGRAM_ID = 'prog-1';
    const BRAND_ID = 'brand-1';
    const PRESIGNED_URL = 'https://storage.example.com/signed?X-Amz-Signature=abc';

    beforeEach(() => {
        mockFileServiceClient = { listProgramMedia: jest.fn() };
        mockPrivateFileUrlResolver = { resolveByKey: jest.fn() };

        controller = new AdminMediaController(
            mockFileServiceClient as unknown as FileServiceClient,
            {} as StorageService,
            mockPrivateFileUrlResolver as unknown as PrivateFileUrlResolver,
        );
    });

    it('replaces url/download_url with a fresh presigned url for a private-category file', async () => {
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

        const result = await controller.listMedia(PROGRAM_ID, BRAND_ID);

        expect(mockPrivateFileUrlResolver.resolveByKey).toHaveBeenCalledWith(
            'prod/brandx/programs/prog1/documents/agreement.pdf',
        );
        expect((result.files as Array<Record<string, unknown>>)[0].url).toBe(PRESIGNED_URL);
        expect((result.files as Array<Record<string, unknown>>)[0].download_url).toBe(PRESIGNED_URL);
    });

    it('leaves a public-category file (gallery) untouched', async () => {
        const publicFile = {
            id: 'file-2',
            storage_path: 'prod/brandx/programs/prog1/gallery/photo.jpg',
            url: 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/gallery/photo.jpg',
            download_url: 'https://cdn.ybbhub.com/prod/brandx/programs/prog1/gallery/photo.jpg',
        };
        mockFileServiceClient.listProgramMedia.mockResolvedValue({ files: [publicFile], total: 1 });

        const result = await controller.listMedia(PROGRAM_ID, BRAND_ID);

        expect(mockPrivateFileUrlResolver.resolveByKey).not.toHaveBeenCalled();
        expect(result.files).toEqual([publicFile]);
    });

    it('clears url/download_url (fails closed) when a private file cannot be presigned', async () => {
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

        const result = await controller.listMedia(PROGRAM_ID, BRAND_ID);

        const file = (result.files as Array<Record<string, unknown>>)[0];
        expect(file.url).toBeNull();
        expect(file.download_url).toBeNull();
    });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PortalCertificatesController } from './portal-certificates.controller';
import { GetPortalCertificatesHandler } from '../application/queries/handlers/get-portal-certificates.handler';
import { DownloadCertificateHandler } from '../application/commands/handlers/download-certificate.handler';
import { UnauthorizedException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';

describe('PortalCertificatesController', () => {
    let controller: PortalCertificatesController;
    let getCertsHandler: jest.Mocked<GetPortalCertificatesHandler>;
    let downloadHandler: jest.Mocked<DownloadCertificateHandler>;

    const mockUser = { userId: 'user-123' };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PortalCertificatesController],
            providers: [
                {
                    provide: GetPortalCertificatesHandler,
                    useValue: { execute: jest.fn() },
                },
                {
                    provide: DownloadCertificateHandler,
                    useValue: { execute: jest.fn() },
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<PortalCertificatesController>(PortalCertificatesController);
        getCertsHandler = module.get(GetPortalCertificatesHandler);
        downloadHandler = module.get(DownloadCertificateHandler);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('listCertificates', () => {
        it('should call handler with userId from JWT', async () => {
            const mockResult = {
                certificates: [
                    {
                        id: 'cert-1',
                        name: 'Certificate of Participation',
                        type: 'certificate',
                        fileUrl: 'https://example.com/cert.pdf',
                        fileType: 'pdf',
                        programName: 'YBB 2026',
                        generatedAt: new Date(),
                        downloadCount: 0,
                    },
                ],
                total: 1,
            };
            getCertsHandler.execute.mockResolvedValue(mockResult);

            const result = await controller.listCertificates(mockUser);

            expect(getCertsHandler.execute).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'user-123' }),
            );
            expect(result.total).toBe(1);
            expect(result.certificates[0].name).toBe('Certificate of Participation');
        });

        it('should throw UnauthorizedException if no user', async () => {
            await expect(controller.listCertificates({})).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });

    describe('downloadCertificate', () => {
        it('should call handler with userId and certificateId', async () => {
            downloadHandler.execute.mockResolvedValue({
                fileUrl: 'https://example.com/cert.pdf',
                fileName: 'Certificate.pdf',
            });

            const result = await controller.downloadCertificate(mockUser, 'cert-1');

            expect(downloadHandler.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-123',
                    certificateId: 'cert-1',
                }),
            );
            expect(result.fileUrl).toBe('https://example.com/cert.pdf');
        });

        it('should throw UnauthorizedException if no user', async () => {
            await expect(controller.downloadCertificate({}, 'cert-1')).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });
});

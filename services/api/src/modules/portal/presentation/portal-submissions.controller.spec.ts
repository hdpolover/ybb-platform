import { Test, TestingModule } from '@nestjs/testing';
import { PortalSubmissionsController } from './portal-submissions.controller';
import { GetPortalSubmissionDetailHandler } from '../application/queries/handlers/get-portal-submission-detail.handler';
import { SaveSubmissionSectionHandler } from '../application/commands/handlers/save-submission-section.handler';
import { PortalSubmitApplicationHandler } from '../application/commands/handlers/portal-submit-application.handler';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';

describe('PortalSubmissionsController', () => {
    let controller: PortalSubmissionsController;
    let getDetailHandler: jest.Mocked<GetPortalSubmissionDetailHandler>;
    let saveSectionHandler: jest.Mocked<SaveSubmissionSectionHandler>;
    let submitHandler: jest.Mocked<PortalSubmitApplicationHandler>;

    const mockUser = { userId: 'user-123', email: 'test@test.com', brandId: 'brand-id' } as import('@shared/decorators/current-user.decorator').CurrentUserData;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PortalSubmissionsController],
            providers: [
                {
                    provide: GetPortalSubmissionDetailHandler,
                    useValue: { execute: jest.fn() },
                },
                {
                    provide: SaveSubmissionSectionHandler,
                    useValue: { execute: jest.fn() },
                },
                {
                    provide: PortalSubmitApplicationHandler,
                    useValue: { execute: jest.fn() },
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<PortalSubmissionsController>(PortalSubmissionsController);
        getDetailHandler = module.get(GetPortalSubmissionDetailHandler);
        saveSectionHandler = module.get(SaveSubmissionSectionHandler);
        submitHandler = module.get(PortalSubmitApplicationHandler);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getSubmissionDetail', () => {
        it('should call handler with userId from JWT', async () => {
            const mockResult: import('./dto/portal-submission-detail.dto').PortalSubmissionDetailResponseDto = {
                applicationId: 'app-1',
                programId: 'prog-1',
                programName: 'Test Program',
                status: 'draft',
                overallProgress: 33,
                sections: [],
                essays: [],
                requirements: [],
                preview: {
                    title: 'Preview & Confirmation',
                    description: 'Review your submission details before finalizing your application.',
                    checklists: [],
                    primaryAction: {
                        type: 'submit_application',
                        label: 'Submit Application',
                        enabled: true,
                    },
                    payment: {
                        required: false,
                        paid: true,
                        status: 'paid',
                    },
                    canSubmit: true,
                    pendingItems: [],
                },
            };
            getDetailHandler.execute.mockResolvedValue(mockResult);

            const result = await controller.getSubmissionDetail(mockUser);

            expect(getDetailHandler.execute).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'user-123' }),
            );
            expect(result.applicationId).toBe('app-1');
        });

        it('should throw UnauthorizedException if no user', async () => {
            await expect(controller.getSubmissionDetail({} as unknown as import('@shared/decorators/current-user.decorator').CurrentUserData)).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });

    describe('saveSection', () => {
        it('should call handler with section and data', async () => {
            saveSectionHandler.execute.mockResolvedValue({
                success: true,
                section: 'personal_info',
            });

            const result = await controller.saveSection(
                mockUser,
                'personal_info',
                { data: { full_name: 'John Doe' } },
            );

            expect(saveSectionHandler.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-123',
                    section: 'personal_info',
                    data: { full_name: 'John Doe' },
                }),
            );
            expect(result.success).toBe(true);
        });

        it('should throw UnauthorizedException if no user', async () => {
            await expect(
                controller.saveSection({} as unknown as import('@shared/decorators/current-user.decorator').CurrentUserData, 'personal_info', { data: {} }),
            ).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('submitApplication', () => {
        it('should call handler with userId', async () => {
            submitHandler.execute.mockResolvedValue({
                success: true,
                applicationId: 'app-1',
                status: 'submitted',
            });

            const result = await controller.submitApplication(mockUser);

            expect(submitHandler.execute).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'user-123' }),
            );
            expect(result.status).toBe('submitted');
        });

        it('should throw UnauthorizedException if no user', async () => {
            await expect(controller.submitApplication({} as unknown as import('@shared/decorators/current-user.decorator').CurrentUserData)).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });
});

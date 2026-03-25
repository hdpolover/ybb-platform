import { Test, TestingModule } from '@nestjs/testing';
import { PortalController } from './portal.controller';
import { QueryBus } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { 
  GetPortalDashboardQuery, 
  GetPortalSubmissionsQuery, 
  GetPortalPaymentsQuery, 
  GetPortalDocumentsQuery 
} from '../application/queries/portal-queries';

describe('PortalController', () => {
  let controller: PortalController;
  let queryBus: QueryBus;

  const mockUser = { userId: 'user-123', email: 'test@test.com', brandId: 'brand-id' } as import('@shared/decorators/current-user.decorator').CurrentUserData;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortalController],
      providers: [
        {
          provide: QueryBus,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<PortalController>(PortalController);
    queryBus = module.get<QueryBus>(QueryBus);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should execute GetPortalDashboardQuery', async () => {
      await controller.getDashboard(mockUser);
      expect(queryBus.execute).toHaveBeenCalledWith(new GetPortalDashboardQuery(mockUser.userId));
    });

    it('should throw UnauthorizedException if no user', async () => {
      await expect(controller.getDashboard({} as unknown as import('@shared/decorators/current-user.decorator').CurrentUserData)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getSubmissions', () => {
    it('should execute GetPortalSubmissionsQuery', async () => {
      await controller.getSubmissions(mockUser);
      expect(queryBus.execute).toHaveBeenCalledWith(new GetPortalSubmissionsQuery(mockUser.userId));
    });
  });

  describe('getPayments', () => {
    it('should execute GetPortalPaymentsQuery', async () => {
      await controller.getPayments(mockUser);
      expect(queryBus.execute).toHaveBeenCalledWith(new GetPortalPaymentsQuery(mockUser.userId));
    });
  });

  describe('getDocuments', () => {
    it('should execute GetPortalDocumentsQuery', async () => {
      await controller.getDocuments(mockUser);
      expect(queryBus.execute).toHaveBeenCalledWith(new GetPortalDocumentsQuery(mockUser.userId));
    });
  });
});

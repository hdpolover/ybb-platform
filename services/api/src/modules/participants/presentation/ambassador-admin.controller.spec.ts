
import { Test, TestingModule } from '@nestjs/testing';
import { AmbassadorAdminController } from './ambassador-admin.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { GetAmbassadorsListQuery, UpdateAmbassadorStatusCommand } from '../application/commands/ambassador-admin.commands';

describe('AmbassadorAdminController', () => {
  let controller: AmbassadorAdminController;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  const mockCommandBus = { execute: jest.fn() };
  const mockQueryBus = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AmbassadorAdminController],
      providers: [
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<AmbassadorAdminController>(AmbassadorAdminController);
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should execute GetAmbassadorsListQuery', async () => {
      await controller.findAll('prog-1', 'search-term', 2);
      expect(mockQueryBus.execute).toHaveBeenCalledWith(expect.any(GetAmbassadorsListQuery));
      const query = mockQueryBus.execute.mock.calls[0][0];
      expect(query.programId).toBe('prog-1');
      expect(query.search).toBe('search-term');
      expect(query.page).toBe(2);
    });
  });

  describe('activate', () => {
      it('should execute UpdateAmbassadorStatusCommand with isActive=true', async () => {
          await controller.activate('amb-1');
          expect(mockCommandBus.execute).toHaveBeenCalledWith(expect.any(UpdateAmbassadorStatusCommand));
          const cmd = mockCommandBus.execute.mock.calls[0][0];
          expect(cmd.ambassadorId).toBe('amb-1');
          expect(cmd.isActive).toBe(true);
      });
  });

  describe('deactivate', () => {
    it('should execute UpdateAmbassadorStatusCommand with isActive=false', async () => {
        await controller.deactivate('amb-1');
        expect(mockCommandBus.execute).toHaveBeenCalledWith(expect.any(UpdateAmbassadorStatusCommand));
        const cmd = mockCommandBus.execute.mock.calls[0][0];
        expect(cmd.ambassadorId).toBe('amb-1');
        expect(cmd.isActive).toBe(false);
    });
});
});

// services/api/src/modules/programs/presentation/content-templates.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ContentTemplatesController } from './content-templates.controller';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import { GetContentTemplatesQuery, GetContentTemplateByIdQuery } from '../application/queries/get-content-templates.query';
import { CreateContentTemplateCommand, UpdateContentTemplateCommand, DeleteContentTemplateCommand } from '../application/commands/content-template.commands';

describe('ContentTemplatesController', () => {
  let controller: ContentTemplatesController;
  const mockQueryExecute = jest.fn();
  const mockCommandExecute = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentTemplatesController],
      providers: [
        { provide: QueryBus, useValue: { execute: mockQueryExecute } },
        { provide: CommandBus, useValue: { execute: mockCommandExecute } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ContentTemplatesController>(ContentTemplatesController);
    jest.clearAllMocks();
  });

  it('list() dispatches GetContentTemplatesQuery with the entityType query param', async () => {
    mockQueryExecute.mockResolvedValue([]);
    await controller.list('faqs');
    expect(mockQueryExecute).toHaveBeenCalledWith(new GetContentTemplatesQuery('faqs'));
  });

  it('list() passes undefined when entityType is omitted', async () => {
    mockQueryExecute.mockResolvedValue([]);
    await controller.list(undefined);
    expect(mockQueryExecute).toHaveBeenCalledWith(new GetContentTemplatesQuery(undefined));
  });

  it('detail() dispatches GetContentTemplateByIdQuery', async () => {
    mockQueryExecute.mockResolvedValue({ id: 't1' });
    await controller.detail('t1');
    expect(mockQueryExecute).toHaveBeenCalledWith(new GetContentTemplateByIdQuery('t1'));
  });

  it('create() dispatches CreateContentTemplateCommand with the dto', async () => {
    const dto = { entityType: 'faqs', programId: 'src', name: 'x' };
    mockCommandExecute.mockResolvedValue({ id: 'new-id' });
    await controller.create(dto as never);
    expect(mockCommandExecute).toHaveBeenCalledWith(new CreateContentTemplateCommand(dto as never));
  });

  it('update() dispatches UpdateContentTemplateCommand with id and dto', async () => {
    const dto = { name: 'renamed' };
    mockCommandExecute.mockResolvedValue({ id: 't1' });
    await controller.update('t1', dto as never);
    expect(mockCommandExecute).toHaveBeenCalledWith(new UpdateContentTemplateCommand('t1', dto as never));
  });

  it('remove() dispatches DeleteContentTemplateCommand with id', async () => {
    mockCommandExecute.mockResolvedValue({ id: 't1' });
    await controller.remove('t1');
    expect(mockCommandExecute).toHaveBeenCalledWith(new DeleteContentTemplateCommand('t1'));
  });
});

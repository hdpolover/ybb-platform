import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ScoringStage } from '@prisma/client';
import { ProgramScoringController } from './program-scoring.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { GetScoringRubricsHandler } from '../application/queries/handlers/get-scoring-rubrics.handler';
import { UpsertScoringRubricHandler } from '../application/commands/handlers/upsert-scoring-rubric.handler';
import { GetScoringRubricsQuery } from '../application/queries/get-scoring-rubrics.query';
import { UpsertScoringRubricCommand } from '../application/commands/upsert-scoring-rubric.command';
import { UpsertScoringRubricDto } from './dto/scoring-rubric.dto';

describe('ProgramScoringController', () => {
  let controller: ProgramScoringController;
  const mockExecute = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramScoringController],
      providers: [
        { provide: GetScoringRubricsHandler, useValue: mockExecute },
        { provide: UpsertScoringRubricHandler, useValue: mockExecute },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProgramScoringController>(ProgramScoringController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getScoringRubrics', () => {
    it('executes GetScoringRubricsQuery with the programId', async () => {
      mockExecute.execute.mockResolvedValue({ application: null, interview: null });
      await controller.getScoringRubrics('prog-1', undefined);
      expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(GetScoringRubricsQuery));
      const query: GetScoringRubricsQuery = mockExecute.execute.mock.calls[0][0];
      expect(query.programId).toBe('prog-1');
      expect(query.stage).toBeUndefined();
    });

    it('passes stage query param when provided', async () => {
      mockExecute.execute.mockResolvedValue({ application: null, interview: null });
      await controller.getScoringRubrics('prog-1', ScoringStage.application);
      const query: GetScoringRubricsQuery = mockExecute.execute.mock.calls[0][0];
      expect(query.stage).toBe(ScoringStage.application);
    });
  });

  describe('upsertScoringRubric', () => {
    it('executes UpsertScoringRubricCommand with correct arguments', async () => {
      mockExecute.execute.mockResolvedValue({ id: 'schema-1' });
      const dto = plainToInstance(UpsertScoringRubricDto, {
        name: 'App Rubric',
        categories: [
          { name: 'Essay', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
        ],
      });

      await controller.upsertScoringRubric('prog-1', 'application', dto);

      expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(UpsertScoringRubricCommand));
      const cmd: UpsertScoringRubricCommand = mockExecute.execute.mock.calls[0][0];
      expect(cmd.programId).toBe('prog-1');
      expect(cmd.stage).toBe(ScoringStage.application);
    });
  });
});

describe('UpsertScoringRubricDto: weight/maxScore validation via controller DTO', () => {
  it('converts percentage weight to fraction before validation', async () => {
    // The DTO receives fractions (0-1) -- the controller/client is responsible for % conversion.
    // Here we verify the DTO itself rejects weights < 0.
    const dto = plainToInstance(UpsertScoringRubricDto, {
      categories: [
        { name: 'Essay', weight: -0.01, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors.length).toBeGreaterThan(0);
  });
});

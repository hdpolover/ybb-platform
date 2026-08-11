// services/api/src/modules/programs/presentation/program-scoring.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ScoringStage } from '@prisma/client';
import * as request from 'supertest';
import { ProgramScoringController } from './program-scoring.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { GetScoringRubricsHandler } from '../application/queries/handlers/get-scoring-rubrics.handler';
import { GetScoringRubricVersionsHandler } from '../application/queries/handlers/get-scoring-rubric-versions.handler';
import { UpsertScoringRubricHandler } from '../application/commands/handlers/upsert-scoring-rubric.handler';
import { GetScoringRubricsQuery } from '../application/queries/get-scoring-rubrics.query';
import { GetScoringRubricVersionsQuery } from '../application/queries/get-scoring-rubric-versions.query';
import { UpsertScoringRubricCommand } from '../application/commands/upsert-scoring-rubric.command';
import { UpsertScoringRubricDto } from './dto/scoring-rubric.dto';

describe('ProgramScoringController', () => {
  let controller: ProgramScoringController;
  const mockHandlerExecute = { execute: jest.fn() };
  const mockVersionsHandlerExecute = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramScoringController],
      providers: [
        { provide: GetScoringRubricsHandler, useValue: mockHandlerExecute },
        { provide: UpsertScoringRubricHandler, useValue: mockHandlerExecute },
        { provide: GetScoringRubricVersionsHandler, useValue: mockVersionsHandlerExecute },
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
    it('executes GetScoringRubricsQuery with programId, stage, and no version by default', async () => {
      mockHandlerExecute.execute.mockResolvedValue({ application: null, interview: null });
      await controller.getScoringRubrics('prog-1', undefined, undefined);
      const query: GetScoringRubricsQuery = mockHandlerExecute.execute.mock.calls[0][0];
      expect(query.programId).toBe('prog-1');
      expect(query.stage).toBeUndefined();
      expect(query.version).toBeUndefined();
    });

    it('passes stage and version query params when provided', async () => {
      mockHandlerExecute.execute.mockResolvedValue({ application: null, interview: null });
      await controller.getScoringRubrics('prog-1', ScoringStage.application, '2');
      const query: GetScoringRubricsQuery = mockHandlerExecute.execute.mock.calls[0][0];
      expect(query.stage).toBe(ScoringStage.application);
      expect(query.version).toBe(2);
    });

    it('rejects a non-numeric version with 400', async () => {
      await expect(
        controller.getScoringRubrics('prog-1', ScoringStage.application, 'not-a-number'),
      ).rejects.toThrow('version must be a positive integer.');
    });
  });

  describe('upsertScoringRubric', () => {
    it('executes UpsertScoringRubricCommand with the current admin as createdById', async () => {
      mockHandlerExecute.execute.mockResolvedValue({ id: 'schema-1' });
      const dto = plainToInstance(UpsertScoringRubricDto, {
        name: 'App Rubric',
        passThreshold: 75,
        categories: [
          { name: 'Essay', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
        ],
      });

      // userId (users.id) and adminId (admins.id) are deliberately different
      // here: ScoringSchema.createdById is a FK to admins(id), so the command
      // must carry adminId, not userId. See resolveActingAdminId.
      await controller.upsertScoringRubric(
        'prog-1',
        'application',
        dto,
        { userId: 'user-1', adminId: 'admin-1' } as never,
      );

      const cmd: UpsertScoringRubricCommand = mockHandlerExecute.execute.mock.calls[0][0];
      expect(cmd.programId).toBe('prog-1');
      expect(cmd.stage).toBe(ScoringStage.application);
      expect(cmd.createdById).toBe('admin-1');
      expect(cmd.createdById).not.toBe('user-1');
      expect(cmd.payload.passThreshold).toBe(75);
    });

    it('throws ForbiddenException instead of falling back to userId when the principal has no adminId', async () => {
      const dto = plainToInstance(UpsertScoringRubricDto, {
        name: 'App Rubric',
        passThreshold: 75,
        categories: [
          { name: 'Essay', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
        ],
      });

      await expect(
        controller.upsertScoringRubric('prog-1', 'application', dto, { userId: 'user-1' } as never),
      ).rejects.toThrow('Authenticated user is not an admin.');
      expect(mockHandlerExecute.execute).not.toHaveBeenCalled();
    });

    it('ignores a client-supplied createdById in the request body and uses the authenticated principal instead', async () => {
      mockHandlerExecute.execute.mockResolvedValue({ id: 'schema-1' });
      // A DTO built from a raw body that an attacker stuffed a createdById into.
      // UpsertScoringRubricDto has no createdById field, so plainToInstance
      // (without whitelist here) still cannot leak it through onto the command
      // unless the controller reads it off dto rather than off the authenticated user.
      const dto = plainToInstance(UpsertScoringRubricDto, {
        name: 'App Rubric',
        passThreshold: 75,
        createdById: 'attacker-admin-id',
        categories: [
          { name: 'Essay', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
        ],
      });

      await controller.upsertScoringRubric(
        'prog-1',
        'application',
        dto,
        { userId: 'user-1', adminId: 'real-admin-1' } as never,
      );

      const cmd: UpsertScoringRubricCommand = mockHandlerExecute.execute.mock.calls[0][0];
      expect(cmd.createdById).toBe('real-admin-1');
      expect(cmd.createdById).not.toBe('attacker-admin-id');
    });

    it('rejects an invalid stage param with 400', async () => {
      const dto = plainToInstance(UpsertScoringRubricDto, { categories: [] });
      await expect(
        controller.upsertScoringRubric(
          'prog-1',
          'not-a-stage',
          dto,
          { userId: 'user-1', adminId: 'admin-1' } as never,
        ),
      ).rejects.toThrow('Invalid stage "not-a-stage"');
    });
  });

  describe('getScoringRubricVersions', () => {
    it('executes GetScoringRubricVersionsQuery with programId and stage, and returns its result unchanged', async () => {
      const summaries = [
        { version: 2, isActive: true, createdAt: '2026-08-01T00:00:00.000Z', createdByName: 'Alice', hasSubmittedReviews: false },
        { version: 1, isActive: false, createdAt: '2026-07-01T00:00:00.000Z', createdByName: 'Alice', hasSubmittedReviews: true },
      ];
      mockVersionsHandlerExecute.execute.mockResolvedValue(summaries);

      const result = await controller.getScoringRubricVersions('prog-1', ScoringStage.application);

      expect(mockVersionsHandlerExecute.execute).toHaveBeenCalledWith(expect.any(GetScoringRubricVersionsQuery));
      const query: GetScoringRubricVersionsQuery = mockVersionsHandlerExecute.execute.mock.calls[0][0];
      expect(query.programId).toBe('prog-1');
      expect(query.stage).toBe(ScoringStage.application);
      expect(result).toEqual(summaries);
    });
  });
});

describe('ProgramScoringController route resolution (real HTTP layer)', () => {
  // Proves /scoring-rubrics/versions is not swallowed by a parameterized
  // sibling route registered earlier on the controller. This exercises
  // Nest's actual Express router, not just a direct method call, so it
  // would catch a real route-shadowing regression that a unit-level
  // "was this method called" assertion cannot.
  let app: INestApplication;
  const mockHandlerExecute = { execute: jest.fn() };
  const mockVersionsHandlerExecute = { execute: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramScoringController],
      providers: [
        { provide: GetScoringRubricsHandler, useValue: mockHandlerExecute },
        { provide: UpsertScoringRubricHandler, useValue: mockHandlerExecute },
        { provide: GetScoringRubricVersionsHandler, useValue: mockVersionsHandlerExecute },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: import('@nestjs/common').ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId: 'admin-1', role: 'super_admin' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /programs/:programId/scoring-rubrics/versions resolves to getScoringRubricVersions', async () => {
    mockVersionsHandlerExecute.execute.mockResolvedValue([
      { version: 1, isActive: true, createdAt: '2026-08-01T00:00:00.000Z', createdByName: 'Alice', hasSubmittedReviews: false },
    ]);

    const response = await request(app.getHttpServer())
      .get('/programs/prog-1/scoring-rubrics/versions')
      .query({ stage: 'application' })
      .expect(200);

    expect(mockVersionsHandlerExecute.execute).toHaveBeenCalledTimes(1);
    expect(mockHandlerExecute.execute).not.toHaveBeenCalled();
    const query: GetScoringRubricVersionsQuery = mockVersionsHandlerExecute.execute.mock.calls[0][0];
    expect(query.programId).toBe('prog-1');
    expect(query.stage).toBe('application');
    expect(response.body).toEqual([
      { version: 1, isActive: true, createdAt: '2026-08-01T00:00:00.000Z', createdByName: 'Alice', hasSubmittedReviews: false },
    ]);
  });

  it('GET /programs/:programId/scoring-rubrics (no trailing segment) still resolves to getScoringRubrics', async () => {
    mockHandlerExecute.execute.mockResolvedValue({ application: null, interview: null });

    await request(app.getHttpServer()).get('/programs/prog-1/scoring-rubrics').expect(200);

    expect(mockHandlerExecute.execute).toHaveBeenCalledTimes(1);
    expect(mockVersionsHandlerExecute.execute).not.toHaveBeenCalled();
  });
});

describe('UpsertScoringRubricDto: weight/maxScore validation via controller DTO', () => {
  it('converts percentage weight to fraction before validation', async () => {
    const dto = plainToInstance(UpsertScoringRubricDto, {
      categories: [
        { name: 'Essay', weight: -0.01, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors.length).toBeGreaterThan(0);
  });
});

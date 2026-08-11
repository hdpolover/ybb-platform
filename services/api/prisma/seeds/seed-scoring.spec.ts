// services/api/prisma/seeds/seed-scoring.spec.ts
// Unit tests for the idempotent application-stage rubric backfill. Mocks
// the prisma singleton from ./utils rather than hitting a real database,
// matching this suite's plain-jest style (no @nestjs/testing).
import { validateWeightSums, type WeightedCategory } from '../../src/modules/scoring/domain/scoring-calculation';

const findManyProgram = jest.fn();
const findFirstScoringSchema = jest.fn();
const createScoringSchema = jest.fn();
const aggregateScoringSchema = jest.fn();
const logMock = jest.fn();

jest.mock('./utils', () => ({
  prisma: {
    program: { findMany: (...args: unknown[]) => findManyProgram(...args) },
    scoringSchema: {
      findFirst: (...args: unknown[]) => findFirstScoringSchema(...args),
      create: (...args: unknown[]) => createScoringSchema(...args),
      aggregate: (...args: unknown[]) => aggregateScoringSchema(...args),
    },
  },
  log: (...args: unknown[]) => logMock(...args),
}));

import { seedScoring } from './seed-scoring';

const PROGRAM_A = { id: 'program-a', name: 'Program A' };
const PROGRAM_B = { id: 'program-b', name: 'Program B' };

describe('seedScoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aggregateScoringSchema.mockResolvedValue({ _max: { version: null } });
  });

  it('creates a version 1 application rubric for a program with no active rubric', async () => {
    findManyProgram.mockResolvedValue([PROGRAM_A]);
    findFirstScoringSchema.mockResolvedValue(null);
    createScoringSchema.mockResolvedValue({ id: 'schema-1' });

    await seedScoring();

    expect(createScoringSchema).toHaveBeenCalledTimes(1);
    const createArgs = createScoringSchema.mock.calls[0][0];
    expect(createArgs.data.programId).toBe(PROGRAM_A.id);
    expect(createArgs.data.stage).toBe('application');
    expect(createArgs.data.version).toBe(1);
    expect(createArgs.data.isActive).toBe(true);
    expect(createArgs.data.passThreshold).toBe(75);

    const categories = createArgs.data.categories.create;
    expect(categories).toEqual([
      {
        name: 'Achievement and Experience',
        weight: 0.4,
        order: 1,
        criteria: {
          create: [
            { name: 'Project Experiences', weight: 0.3, maxScore: 100, order: 1 },
            { name: 'Achievement', weight: 0.4, maxScore: 100, order: 2 },
            { name: 'Leadership', weight: 0.3, maxScore: 100, order: 3 },
          ],
        },
      },
      {
        name: 'Essay Assessment',
        weight: 0.6,
        order: 2,
        criteria: {
          create: [
            { name: 'Topic Relevance to SDGs Themes', weight: 0.3, maxScore: 100, order: 1 },
            { name: 'Argumentation, Innovation, and Creativity', weight: 0.5, maxScore: 100, order: 2 },
            { name: 'Validity of Sources and References', weight: 0.1, maxScore: 100, order: 3 },
            { name: 'Writing Format', weight: 0.1, maxScore: 100, order: 4 },
          ],
        },
      },
    ]);
  });

  it('skips a program that already has an active application rubric and creates nothing for it', async () => {
    findManyProgram.mockResolvedValue([PROGRAM_A]);
    findFirstScoringSchema.mockResolvedValue({ id: 'existing-schema' });

    await seedScoring();

    expect(createScoringSchema).not.toHaveBeenCalled();
  });

  it('is idempotent: a second run against state where the rubric now exists makes zero additional creates', async () => {
    findManyProgram.mockResolvedValue([PROGRAM_A, PROGRAM_B]);

    // First run: neither program has a rubric yet.
    findFirstScoringSchema.mockResolvedValue(null);
    createScoringSchema.mockResolvedValue({ id: 'schema-1' });
    await seedScoring();
    expect(createScoringSchema).toHaveBeenCalledTimes(2);

    // Second run: both programs now report an active rubric.
    jest.clearAllMocks();
    aggregateScoringSchema.mockResolvedValue({ _max: { version: null } });
    findManyProgram.mockResolvedValue([PROGRAM_A, PROGRAM_B]);
    findFirstScoringSchema.mockResolvedValue({ id: 'existing-schema' });

    await seedScoring();

    expect(createScoringSchema).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledWith(expect.stringContaining('0 created, 2 skipped'));
  });

  it('never creates an interview-stage rubric', async () => {
    findManyProgram.mockResolvedValue([PROGRAM_A]);
    findFirstScoringSchema.mockResolvedValue(null);
    createScoringSchema.mockResolvedValue({ id: 'schema-1' });

    await seedScoring();

    const interviewCreates = createScoringSchema.mock.calls.filter(
      (call) => call[0].data.stage === 'interview',
    );
    expect(interviewCreates).toHaveLength(0);
    expect(findFirstScoringSchema).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ stage: 'interview' }) }),
    );
  });

  it('checks the active-rubric lookup against isActive and non-deleted rows, per program and stage', async () => {
    findManyProgram.mockResolvedValue([PROGRAM_A]);
    findFirstScoringSchema.mockResolvedValue(null);
    createScoringSchema.mockResolvedValue({ id: 'schema-1' });

    await seedScoring();

    expect(findFirstScoringSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programId: PROGRAM_A.id,
          stage: 'application',
          isActive: true,
          deletedAt: null,
        }),
      }),
    );
  });

  it('derives the next version from MAX(version) across all rows, including soft-deleted, instead of hardcoding 1', async () => {
    findManyProgram.mockResolvedValue([PROGRAM_A]);
    findFirstScoringSchema.mockResolvedValue(null);
    // A soft-deleted version 1 already reserved this (programId, stage) pair.
    aggregateScoringSchema.mockResolvedValue({ _max: { version: 1 } });
    createScoringSchema.mockResolvedValue({ id: 'schema-2' });

    await seedScoring();

    expect(createScoringSchema).toHaveBeenCalledTimes(1);
    expect(createScoringSchema.mock.calls[0][0].data.version).toBe(2);
  });

  it('seeded category and criterion weights pass validateWeightSums from the frozen scoring-calculation module', () => {
    const categories: WeightedCategory[] = [
      {
        categoryId: 'Achievement and Experience',
        categoryWeight: 0.4,
        criteria: [
          { criterionId: 'Project Experiences', criterionWeight: 0.3, maxScore: 100 },
          { criterionId: 'Achievement', criterionWeight: 0.4, maxScore: 100 },
          { criterionId: 'Leadership', criterionWeight: 0.3, maxScore: 100 },
        ],
      },
      {
        categoryId: 'Essay Assessment',
        categoryWeight: 0.6,
        criteria: [
          { criterionId: 'Topic Relevance to SDGs Themes', criterionWeight: 0.3, maxScore: 100 },
          {
            criterionId: 'Argumentation, Innovation, and Creativity',
            criterionWeight: 0.5,
            maxScore: 100,
          },
          { criterionId: 'Validity of Sources and References', criterionWeight: 0.1, maxScore: 100 },
          { criterionId: 'Writing Format', criterionWeight: 0.1, maxScore: 100 },
        ],
      },
    ];

    expect(validateWeightSums(categories)).toEqual([]);
  });
});

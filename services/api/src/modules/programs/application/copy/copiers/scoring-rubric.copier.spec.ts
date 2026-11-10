// services/api/src/modules/programs/application/copy/copiers/scoring-rubric.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { ScoringRubricCopier } from './scoring-rubric.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { createPrismaTxMock } from '../../../../../../test/utils/prisma-tx-mock';

async function captureError(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected promise to reject');
}

const D = (n: number) => new Prisma.Decimal(n);

type SchemaRow = ReturnType<typeof schema>;

// One category (weight 1) with two criteria (0.6 / 0.4): valid weights by default.
function schema(over: { id: string; programId: string; stage: ScoringStage; version?: number; name?: string; threshold?: number; criterionName?: string }) {
  return {
    id: over.id,
    programId: over.programId,
    stage: over.stage,
    name: over.name ?? `${over.stage} rubric`,
    description: null as string | null,
    isActive: true,
    version: over.version ?? 1,
    createdById: null as string | null,
    passThreshold: D(over.threshold ?? 75),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null as Date | null,
    legacyId: null,
    categories: [
      {
        id: `${over.id}-cat`,
        schemaId: over.id,
        name: 'Essay',
        description: null as string | null,
        weight: D(1),
        order: 0,
        legacyId: null,
        criteria: [
          { id: `${over.id}-c1`, categoryId: `${over.id}-cat`, name: over.criterionName ?? 'Clarity', description: null as string | null, weight: D(0.6), maxScore: D(100), order: 0, legacyId: null },
          { id: `${over.id}-c2`, categoryId: `${over.id}-cat`, name: 'Impact', description: null as string | null, weight: D(0.4), maxScore: D(100), order: 1, legacyId: null },
        ],
      },
    ],
  };
}

// Disjoint prisma/tx pair (see prisma-tx-mock.ts): prisma serves reads outside a
// transaction (countFor/preview/exportTemplate); tx is what copy()/applyTemplate()
// read and write through, including the real mintRubricVersionInTx.
function mkPrisma(opts: { source?: SchemaRow[]; target?: SchemaRow[]; maxVersion?: number } = {}) {
  const rowsFor = (programId: string) => (programId === 'src' ? opts.source : opts.target) ?? [];
  const buildModels = () => ({
    scoringSchema: {
      findMany: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve([{ ...schema({ id: where.id, programId: 'tgt', stage: 'application' }), categories: [] }]);
        return Promise.resolve(rowsFor(where.programId).filter((r) => r.isActive && r.deletedAt === null));
      }),
      findFirst: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(rowsFor(where.programId).find((r) => r.stage === where.stage && r.isActive && r.deletedAt === null) ?? null),
      ),
      count: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(rowsFor(where.programId).length)),
      aggregate: jest.fn().mockResolvedValue({ _max: { version: opts.maxVersion ?? null } }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: `new-${data.stage}`, ...data })),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    scoringCategory: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: `cat-${data.name}`, ...data })),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    scoringCriterion: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  });
  const { prisma, tx } = createPrismaTxMock(buildModels);
  return { prisma: prisma as unknown as PrismaService, tx: tx as unknown as PrismaService, rawPrisma: prisma as any, rawTx: tx as any };
}

function expectNothingDeleted(tx: any) {
  for (const model of ['scoringSchema', 'scoringCategory', 'scoringCriterion']) {
    expect(tx[model].delete).not.toHaveBeenCalled();
    expect(tx[model].deleteMany).not.toHaveBeenCalled();
    expect(tx[model].updateMany).not.toHaveBeenCalled();
  }
}

const SRC_APP = () => schema({ id: 's-app', programId: 'src', stage: 'application' });
const SRC_INT = () => schema({ id: 's-int', programId: 'src', stage: 'interview', threshold: 80 });

describe('ScoringRubricCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new ScoringRubricCopier(mkPrisma().prisma);
    expect(copier.key).toBe('scoring-rubric');
    expect(copier.label).toBe('Scoring Rubric');
    expect(copier.supportsAppend).toBe(true);
  });

  it('countFor counts active, non-deleted rubrics', async () => {
    const { prisma, rawPrisma } = mkPrisma({ source: [SRC_APP(), SRC_INT()] });
    const copier = new ScoringRubricCopier(prisma);
    expect(await copier.countFor('src')).toBe(2);
    expect(rawPrisma.scoringSchema.count).toHaveBeenCalledWith({ where: { programId: 'src', isActive: true, deletedAt: null } });
  });

  it('preview() labels by stage and summarises categories, criteria and threshold', async () => {
    const { prisma } = mkPrisma({ source: [SRC_APP(), SRC_INT()] });
    const items = await new ScoringRubricCopier(prisma).preview('src');
    expect(items).toEqual([
      { id: 's-app', label: 'Application rubric', meta: '1 categories, 2 criteria, pass 75' },
      { id: 's-int', label: 'Interview rubric', meta: '1 categories, 2 criteria, pass 80' },
    ]);
  });

  describe('copy', () => {
    it('mints a version-1 rubric on the TRANSACTION client when the target has none', async () => {
      const { prisma, tx, rawPrisma, rawTx } = mkPrisma({ source: [SRC_APP()], target: [] });
      const result = await new ScoringRubricCopier(prisma).copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
      expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
      const data = rawTx.scoringSchema.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ programId: 'tgt', stage: 'application', version: 1, isActive: true, createdById: null, name: 'application rubric' });
      expect(Number(data.passThreshold)).toBe(75);
      expect(rawTx.scoringCategory.create).toHaveBeenCalledTimes(1);
      expect(rawTx.scoringCriterion.create).toHaveBeenCalledTimes(2);
      expect(rawPrisma.$transaction).not.toHaveBeenCalled();
      expect(rawPrisma.scoringSchema.create).not.toHaveBeenCalled();
    });

    it('append leaves an existing target rubric alone and counts it skipped', async () => {
      const { prisma, tx, rawTx } = mkPrisma({
        source: [SRC_APP(), SRC_INT()],
        target: [schema({ id: 't-app', programId: 'tgt', stage: 'application', criterionName: 'Different' })],
      });
      const result = await new ScoringRubricCopier(prisma).copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
      expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
      expect(rawTx.scoringSchema.create).toHaveBeenCalledTimes(1);
      expect(rawTx.scoringSchema.create.mock.calls[0][0].data.stage).toBe('interview');
      expect(rawTx.scoringSchema.update).not.toHaveBeenCalled();
    });

    it('replace mints a NEW version, deactivates the old one, and never deletes anything', async () => {
      const { prisma, tx, rawTx } = mkPrisma({
        source: [SRC_APP()],
        target: [schema({ id: 't-app', programId: 'tgt', stage: 'application', version: 2, criterionName: 'Different' })],
        maxVersion: 3,
      });
      const result = await new ScoringRubricCopier(prisma).copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
      expect(result).toEqual({ created: 0, skipped: 0, replaced: 1 });
      expect(rawTx.scoringSchema.update).toHaveBeenCalledWith({ where: { id: 't-app' }, data: { isActive: false } });
      expect(rawTx.scoringSchema.create.mock.calls[0][0].data.version).toBe(4);
      expect(rawTx.scoringSchema.update.mock.invocationCallOrder[0]).toBeLessThan(rawTx.scoringSchema.create.mock.invocationCallOrder[0]);
      expectNothingDeleted(rawTx);
    });

    it('replace with a semantically identical target mints nothing and counts skipped, not replaced', async () => {
      const { prisma, tx, rawTx } = mkPrisma({
        source: [SRC_APP()],
        target: [schema({ id: 't-app', programId: 'tgt', stage: 'application' })],
      });
      const result = await new ScoringRubricCopier(prisma).copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
      expect(result).toEqual({ created: 0, skipped: 1, replaced: 0 });
      expect(rawTx.scoringSchema.create).not.toHaveBeenCalled();
      expect(rawTx.scoringSchema.update).not.toHaveBeenCalled();
    });

    it('honours itemIds (schema ids)', async () => {
      const { prisma, tx, rawTx } = mkPrisma({ source: [SRC_APP(), SRC_INT()], target: [] });
      const result = await new ScoringRubricCopier(prisma).copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: ['s-int'], mode: 'append' });
      expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
      expect(rawTx.scoringSchema.create.mock.calls[0][0].data.stage).toBe('interview');
    });

    it('is a no-op when the source has no active rubric', async () => {
      const { prisma, tx } = mkPrisma({ source: [], target: [] });
      const result = await new ScoringRubricCopier(prisma).copy(tx, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
      expect(result).toEqual({ created: 0, skipped: 0, replaced: 0 });
    });
  });

  describe('exportTemplate', () => {
    it('exports plain numbers (no Decimal) in the template item shape', async () => {
      const { prisma } = mkPrisma({ source: [SRC_APP()] });
      const payload = await new ScoringRubricCopier(prisma).exportTemplate('src');
      expect(payload).toEqual({
        entityType: 'scoring-rubric',
        payloadVersion: 1,
        items: [
          {
            stage: 'application',
            name: 'application rubric',
            description: null,
            passThreshold: 75,
            categories: [
              {
                name: 'Essay',
                description: null,
                weight: 1,
                order: 0,
                criteria: [
                  { name: 'Clarity', description: null, weight: 0.6, maxScore: 100, order: 0 },
                  { name: 'Impact', description: null, weight: 0.4, maxScore: 100, order: 1 },
                ],
              },
            ],
          },
        ],
      });
    });

    it('honours itemIds', async () => {
      const { prisma } = mkPrisma({ source: [SRC_APP(), SRC_INT()] });
      const payload = await new ScoringRubricCopier(prisma).exportTemplate('src', ['s-int']);
      expect(payload.items.map((i) => i.stage)).toEqual(['interview']);
    });
  });

  describe('applyTemplate', () => {
    async function exported(source: SchemaRow[]) {
      const { prisma } = mkPrisma({ source });
      return new ScoringRubricCopier(prisma).exportTemplate('src');
    }

    it('applies a stored payload onto an empty target', async () => {
      const payload = await exported([SRC_APP(), SRC_INT()]);
      const { prisma, tx, rawTx } = mkPrisma({ target: [] });
      const result = await new ScoringRubricCopier(prisma).applyTemplate(tx, payload, 'tgt', 'append');
      expect(result).toEqual({ created: 2, skipped: 0, replaced: 0 });
      expect(rawTx.scoringSchema.create).toHaveBeenCalledTimes(2);
    });

    it('append skips a stage the target already has; replace mints a new version for it', async () => {
      const payload = await exported([SRC_APP()]);
      const target = [schema({ id: 't-app', programId: 'tgt', stage: 'application', version: 1, criterionName: 'Different' })];

      const a = mkPrisma({ target });
      expect(await new ScoringRubricCopier(a.prisma).applyTemplate(a.tx, payload, 'tgt', 'append')).toEqual({ created: 0, skipped: 1, replaced: 0 });
      expect(a.rawTx.scoringSchema.create).not.toHaveBeenCalled();

      const r = mkPrisma({ target, maxVersion: 1 });
      expect(await new ScoringRubricCopier(r.prisma).applyTemplate(r.tx, payload, 'tgt', 'replace')).toEqual({ created: 0, skipped: 0, replaced: 1 });
      expect(r.rawTx.scoringSchema.create.mock.calls[0][0].data.version).toBe(2);
      expectNothingDeleted(r.rawTx);
    });

    it('rejects a payload whose weights do not sum to 1, before any write', async () => {
      const payload = await exported([SRC_APP()]);
      (payload.items[0] as any).categories[0].criteria[0].weight = 0.9;
      const { prisma, tx, rawTx } = mkPrisma({ target: [] });
      const err = await captureError(new ScoringRubricCopier(prisma).applyTemplate(tx, payload, 'tgt', 'append'));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(rawTx.scoringSchema.create).not.toHaveBeenCalled();
    });

    it('rejects two items for the same stage', async () => {
      const payload = await exported([SRC_APP()]);
      const dup = { ...payload, items: [payload.items[0], payload.items[0]] };
      const { prisma, tx } = mkPrisma({ target: [] });
      await expect(new ScoringRubricCopier(prisma).applyTemplate(tx, dup, 'tgt', 'append')).rejects.toThrow(BadRequestException);
    });

    it('rejects a malformed item via the template schema', async () => {
      const { prisma, tx } = mkPrisma({ target: [] });
      const bad = { entityType: 'scoring-rubric', payloadVersion: 1, items: [{ stage: 'nope' }] };
      await expect(new ScoringRubricCopier(prisma).applyTemplate(tx, bad, 'tgt', 'append')).rejects.toThrow(BadRequestException);
    });
  });
});

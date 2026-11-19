// services/api/src/modules/programs/presentation/program-awards.controller.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ADMIN_SCOPE_KEY, AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../../brands/application/services/landing-cache-invalidation.service';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import * as contentHandlers from '../application/commands/handlers/manage-program-content.handlers';
import { ProgramAwardsController } from './program-awards.controller';
import { CreateProgramAwardDto, UpdateProgramAwardDto } from './dto/program-award.dto';
import {
  CreateProgramAwardHandler,
  DeleteProgramAwardHandler,
  ListProgramAwardsHandler,
  UpdateProgramAwardHandler,
} from '../application/commands/handlers/program-award.handlers';

jest.mock('../application/commands/handlers/manage-program-content.handlers', () => ({
  ...jest.requireActual('../application/commands/handlers/manage-program-content.handlers'),
  invalidateLandingCacheByProgramId: jest.fn().mockResolvedValue(undefined),
}));

const PROGRAM = '11111111-1111-4111-8111-111111111111';
const OTHER_PROGRAM = '22222222-2222-4222-8222-222222222222';

type Row = { id: string; programId: string; name: string; order: number; createdAt: Date; deletedAt: Date | null };

// Minimal in-memory programAward table honouring the where-shapes the handlers use.
function fakePrisma(rows: Row[]) {
  const matches = (row: Row, where: Partial<Row>) =>
    Object.entries(where).every(([key, value]) => row[key as keyof Row] === value);
  let seq = 0;
  return {
    rows,
    program: { findUnique: jest.fn(({ where }) => Promise.resolve(where.id === PROGRAM || where.id === OTHER_PROGRAM ? { id: where.id } : null)) },
    programAward: {
      findMany: jest.fn(({ where }) => Promise.resolve(rows.filter((r) => matches(r, where)).sort((a, b) => a.order - b.order))),
      findFirst: jest.fn(({ where }) => Promise.resolve(rows.find((r) => matches(r, where)) ?? null)),
      create: jest.fn(({ data }) => {
        const row = { id: `new-${++seq}`, order: 0, createdAt: new Date(), deletedAt: null, ...data };
        rows.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn(({ where, data }) => {
        const index = rows.findIndex((r) => r.id === where.id);
        rows[index] = { ...rows[index], ...data };
        return Promise.resolve(rows[index]);
      }),
    },
  };
}

describe('ProgramAwardsController', () => {
  let controller: ProgramAwardsController;
  let prisma: ReturnType<typeof fakePrisma>;
  const invalidate = contentHandlers.invalidateLandingCacheByProgramId as jest.Mock;

  beforeEach(async () => {
    prisma = fakePrisma([
      { id: 'a1', programId: PROGRAM, name: 'Best Delegate', order: 1, createdAt: new Date(), deletedAt: null },
      { id: 'b1', programId: OTHER_PROGRAM, name: 'Other Program Award', order: 1, createdAt: new Date(), deletedAt: null },
    ]);
    const module = await Test.createTestingModule({
      controllers: [ProgramAwardsController],
      providers: [
        ListProgramAwardsHandler,
        CreateProgramAwardHandler,
        UpdateProgramAwardHandler,
        DeleteProgramAwardHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: LandingCacheInvalidationService, useValue: { invalidate: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .overrideGuard(AdminScopeGuard).useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ProgramAwardsController);
    invalidate.mockClear();
  });

  it('applies AdminScopeGuard scoped to the programId route param on every route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ProgramAwardsController)).toEqual([JwtAuthGuard, RolesGuard, AdminScopeGuard]);
    expect(Reflect.getMetadata(ADMIN_SCOPE_KEY, ProgramAwardsController)).toEqual({ target: 'program', paramName: 'programId' });
  });

  it('lists only this program\'s non-deleted awards, ordered', async () => {
    const result = await controller.list(PROGRAM);
    expect(result.map((a) => a.id)).toEqual(['a1']);
    expect(prisma.programAward.findMany).toHaveBeenCalledWith({
      where: { programId: PROGRAM, deletedAt: null },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('creates an award on the route program and invalidates the landing', async () => {
    const created = await controller.create(PROGRAM, { name: 'Best Speaker', order: 2 } as CreateProgramAwardDto);
    expect(created).toMatchObject({ name: 'Best Speaker', programId: PROGRAM, order: 2 });
    expect(invalidate).toHaveBeenCalledWith(PROGRAM, prisma, expect.anything());
  });

  it('404s creating on a program that does not exist', async () => {
    await expect(controller.create('33333333-3333-4333-8333-333333333333', { name: 'X' } as CreateProgramAwardDto))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.programAward.create).not.toHaveBeenCalled();
  });

  it('updates an award of this program', async () => {
    const updated = await controller.update(PROGRAM, 'a1', { name: 'Best Delegate 2026', isActive: false } as UpdateProgramAwardDto);
    expect(updated).toMatchObject({ id: 'a1', name: 'Best Delegate 2026', isActive: false });
    expect(invalidate).toHaveBeenCalledWith(PROGRAM, prisma, expect.anything());
  });

  it('404s when the award belongs to another program, without writing', async () => {
    await expect(controller.update(PROGRAM, 'b1', { name: 'hijack' } as UpdateProgramAwardDto)).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.remove(PROGRAM, 'b1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.programAward.update).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('soft-deletes: row keeps existing with deletedAt, disappears from GET, and cannot be edited again', async () => {
    await controller.remove(PROGRAM, 'a1');
    expect(prisma.rows.find((r) => r.id === 'a1')?.deletedAt).toBeInstanceOf(Date);
    expect(await controller.list(PROGRAM)).toEqual([]);
    await expect(controller.update(PROGRAM, 'a1', { name: 'zombie' } as UpdateProgramAwardDto)).rejects.toBeInstanceOf(NotFoundException);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});

describe('ProgramAward DTO validation (global ValidationPipe settings)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const validateCreate = (body: object) => pipe.transform(body, { type: 'body', metatype: CreateProgramAwardDto });
  const validateUpdate = (body: object) => pipe.transform(body, { type: 'body', metatype: UpdateProgramAwardDto });

  it('accepts a full valid payload and nulls on nullable fields', async () => {
    await expect(validateCreate({
      name: 'Best Delegate', category: 'Delegate', tier: 'gold', description: 'd', tags: ['Leadership'],
      winnerCount: 3, color: '#1D4ED8', iconUrl: 'https://cdn.example.com/i.png', badgeUrl: 'http://x.io/b.png',
      isActive: true, order: 1,
    })).resolves.toBeInstanceOf(CreateProgramAwardDto);
    await expect(validateUpdate({ color: null, iconUrl: null, category: null })).resolves.toBeDefined();
  });

  it.each([
    ['bad color', { name: 'A', color: 'blue' }],
    ['short hex color', { name: 'A', color: '#fff' }],
    ['non-http url', { name: 'A', iconUrl: 'javascript:alert(1)' }],
    ['url without protocol', { name: 'A', badgeUrl: 'cdn.example.com/b.png' }],
    ['negative winners', { name: 'A', winnerCount: -1 }],
    ['missing name', { category: 'x' }],
    ['unknown field', { name: 'A', programId: 'x' }],
    ['overlong name', { name: 'x'.repeat(256) }],
  ])('rejects %s on create', async (_label, body) => {
    await expect(validateCreate(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['null name', { name: null }],
    ['null tags', { tags: null }],
    ['null order', { order: null }],
    ['empty name', { name: '' }],
  ])('rejects %s on update (NOT NULL columns)', async (_label, body) => {
    await expect(validateUpdate(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});

// src/modules/programs/application/handlers/loa-send-search.handler.spec.ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SearchLoaSendsHandler } from './loa-batch.handlers';
import { SearchLoaSendsQuery } from '../queries/loa-batch.queries';
import { SearchLoaSendsQueryDto } from '../dto/loa-batch.dto';
import { LoaBatchRecipientSendRepository } from '../../infrastructure/persistence/loa-batch-recipient-send.repository';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

const platformAdmin = {
  accessLevel: 5,
  canManageAdmins: true,
  canAssignRoles: true,
  customPermissions: [],
  role: { name: 'super_admin', permissions: ['platform_access'] },
  adminBrands: [],
  adminPrograms: [],
};
const assignedAdminFor = (programIds: string[]) => ({
  accessLevel: 1,
  canManageAdmins: false,
  canAssignRoles: false,
  customPermissions: [],
  role: { name: 'reviewer', permissions: [] },
  adminBrands: [],
  adminPrograms: programIds.map((programId) => ({ programId, permissions: [] })),
});
const actor = { userId: 'admin-1', email: 'a@b.c', brandId: 'brand-x', adminId: 'adm-1' } as any;

const row = {
  id: 'send-1',
  batchId: 'batch-1',
  batch: { id: 'batch-1', name: 'Wave 1' },
  participantId: 'p-1',
  email: 'Ada@Example.com',
  status: 'sent',
  providerMessageId: 'resend-1',
  errorMessage: null,
  attemptCount: 1,
  sentAt: new Date('2026-02-01'),
  deliveryStatus: 'complained',
  deliveredAt: new Date('2026-02-01'),
  bouncedAt: null,
  bounceType: null,
  complainedAt: new Date('2026-02-02'),
  deliveryUpdatedAt: new Date('2026-02-02'),
};

describe('SearchLoaSendsHandler', () => {
  let handler: SearchLoaSendsHandler;
  let sendRepo: { searchByEmail: jest.Mock };
  let prisma: { participant: { findMany: jest.Mock }; participantDocument: { findMany: jest.Mock } };
  let programRepo: { findBySlug: jest.Mock };
  let readPrisma: any;

  beforeEach(async () => {
    sendRepo = { searchByEmail: jest.fn().mockResolvedValue([row]) };
    prisma = {
      participant: { findMany: jest.fn().mockResolvedValue([{ id: 'p-1', fullName: 'Ada L' }]) },
      participantDocument: {
        findMany: jest.fn().mockResolvedValue([
          { downloadCount: 3, firstDownloadedAt: new Date('2026-02-04'), application: { participantId: 'p-1' } },
        ]),
      },
    };
    programRepo = { findBySlug: jest.fn().mockResolvedValue({ id: 'prog-1' }) };
    readPrisma = {
      admin: { findUnique: jest.fn().mockResolvedValue(platformAdmin) },
      program: {
        findUnique: jest.fn().mockResolvedValue({ id: 'prog-1', brandId: 'brand-x', name: 'P', deletedAt: null }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        SearchLoaSendsHandler,
        { provide: LoaBatchRecipientSendRepository, useValue: sendRepo },
        { provide: PrismaService, useValue: prisma },
        { provide: 'IProgramRepository', useValue: programRepo },
        { provide: PrismaReadService, useValue: readPrisma },
      ],
    }).compile();

    handler = module.get(SearchLoaSendsHandler);
  });

  const run = (programId = 'prog-1', email = 'ada') =>
    handler.execute(new SearchLoaSendsQuery(programId, email, actor));

  it('searches only the resolved program, capped at 50', async () => {
    await run();
    expect(sendRepo.searchByEmail).toHaveBeenCalledWith('prog-1', 'ada', 50);
  });

  it('returns proof fields plus batch name and participant name', async () => {
    const [result] = await run();
    expect(result).toEqual({
      id: 'send-1',
      batchId: 'batch-1',
      batchName: 'Wave 1',
      participantId: 'p-1',
      participantName: 'Ada L',
      email: 'Ada@Example.com',
      status: 'sent',
      providerMessageId: 'resend-1',
      errorMessage: null,
      attemptCount: 1,
      sentAt: row.sentAt,
      deliveryStatus: 'complained',
      deliveredAt: row.deliveredAt,
      bouncedAt: null,
      bounceType: null,
      complainedAt: row.complainedAt,
      deliveryUpdatedAt: row.deliveryUpdatedAt,
      downloadCount: 3,
      firstDownloadedAt: new Date('2026-02-04'),
    });
  });

  it('falls back to the mailed address when the participant has no name yet', async () => {
    prisma.participant.findMany.mockResolvedValue([{ id: 'p-1', fullName: '' }]);
    const [result] = await run();
    expect(result.participantName).toBe('Ada@Example.com');
  });

  it('returns [] without a participant lookup when nothing matches', async () => {
    sendRepo.searchByEmail.mockResolvedValue([]);
    await expect(run()).resolves.toEqual([]);
    expect(prisma.participant.findMany).not.toHaveBeenCalled();
  });

  it('refuses a programme-scoped admin outside their assigned programmes, before querying', async () => {
    readPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['someone-elses-program']));
    await expect(run()).rejects.toThrow(NotFoundException);
    expect(sendRepo.searchByEmail).not.toHaveBeenCalled();
  });

  it('404s on an unknown program slug', async () => {
    programRepo.findBySlug.mockResolvedValue(null);
    await expect(run('no-such-slug')).rejects.toThrow(NotFoundException);
    expect(sendRepo.searchByEmail).not.toHaveBeenCalled();
  });
});

describe('SearchLoaSendsQueryDto', () => {
  const check = (email: unknown) => validate(plainToInstance(SearchLoaSendsQueryDto, { email }));

  it('rejects fewer than 3 characters', async () => {
    expect(await check('ab')).not.toHaveLength(0);
  });

  it('rejects whitespace padding that trims below 3 characters', async () => {
    expect(await check('  ab  ')).not.toHaveLength(0);
  });

  it('rejects a missing email', async () => {
    expect(await check(undefined)).not.toHaveLength(0);
  });

  it('accepts 3+ characters and trims them', async () => {
    const dto = plainToInstance(SearchLoaSendsQueryDto, { email: '  ada  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('ada');
  });
});

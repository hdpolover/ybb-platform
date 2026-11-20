// src/modules/stats/revenue/revenue.controller.spec.ts
//
// Per-program revenue and the transaction list/export show gross/fee/net, so
// being assigned to a program is not enough: a non-platform admin also needs a
// payments permission on it. Platform admins are unaffected. A list with no
// programId is narrowed to the programs where the admin holds that permission.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RevenueController } from './revenue.controller';
import { resolveRevenueAccessScope, assertProgramAccess } from './utils/revenue-access.util';
import { assertProgramPermission, programIdsWithPermission } from '@shared/guards/admin-permission.guard';

jest.mock('./utils/revenue-access.util', () => ({
  resolveRevenueAccessScope: jest.fn(),
  assertProgramAccess: jest.fn(),
}));
jest.mock('@shared/guards/admin-permission.guard', () => ({
  assertProgramPermission: jest.fn(),
  programIdsWithPermission: jest.fn(),
}));

const PROGRAM_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const PAYMENTS = ['payments:read', 'payments:write'];
const user = { userId: 'u1', adminId: 'a1', role: 'admin' } as never;
const platform = { kind: 'platform', allowedProgramIds: null };
const assigned = { kind: 'assigned', allowedProgramIds: [PROGRAM_ID, OTHER_ID] };

describe('RevenueController payments permission', () => {
  const service = {
    getProgramRevenueSummary: jest.fn(),
    getRevenueTransactions: jest.fn(),
    exportRevenueTransactions: jest.fn(),
    getPlatformRevenueRollup: jest.fn(),
  };
  const readPrisma = {};
  const controller = new RevenueController(service as never, readPrisma as never);
  const res = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
    (assertProgramAccess as jest.Mock).mockResolvedValue({ id: PROGRAM_ID });
    (assertProgramPermission as jest.Mock).mockResolvedValue(undefined);
    (programIdsWithPermission as jest.Mock).mockResolvedValue([PROGRAM_ID]);
  });

  describe('GET revenue (rollup)', () => {
    it('leaves a platform admin unscoped', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(platform);
      await controller.getPlatformRevenue({} as never, user);
      expect(service.getPlatformRevenueRollup).toHaveBeenCalledWith({}, platform);
      expect(programIdsWithPermission).not.toHaveBeenCalled();
    });

    it('narrows the rollup to programs where the admin holds a payments permission', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(assigned);
      await controller.getPlatformRevenue({} as never, user);
      expect(programIdsWithPermission).toHaveBeenCalledWith(readPrisma, user, [PROGRAM_ID, OTHER_ID], PAYMENTS);
      expect(service.getPlatformRevenueRollup).toHaveBeenCalledWith({}, { kind: 'assigned', allowedProgramIds: [PROGRAM_ID] });
    });
  });

  describe('GET programs/:programId/revenue', () => {
    it('lets a platform admin through without any permission lookup', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(platform);

      await controller.getProgramRevenue(PROGRAM_ID, user);

      expect(assertProgramPermission).not.toHaveBeenCalled();
      expect(service.getProgramRevenueSummary).toHaveBeenCalledWith(PROGRAM_ID, platform);
    });

    it('lets an assigned admin holding a payments permission read it', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(assigned);

      await controller.getProgramRevenue(PROGRAM_ID, user);

      expect(assertProgramPermission).toHaveBeenCalledWith(readPrisma, user, PROGRAM_ID, PAYMENTS);
      expect(service.getProgramRevenueSummary).toHaveBeenCalled();
    });

    it('refuses (404) a program outside the admin assignment, before any permission answer', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(assigned);
      (assertProgramAccess as jest.Mock).mockRejectedValue(new NotFoundException());

      await expect(controller.getProgramRevenue(OTHER_ID, user)).rejects.toBeInstanceOf(NotFoundException);
      expect(assertProgramPermission).not.toHaveBeenCalled();
      expect(service.getProgramRevenueSummary).not.toHaveBeenCalled();
    });

    it('refuses (403) an assigned admin without a payments permission', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(assigned);
      (assertProgramPermission as jest.Mock).mockRejectedValue(new ForbiddenException());

      await expect(controller.getProgramRevenue(PROGRAM_ID, user)).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.getProgramRevenueSummary).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ['GET revenue/transactions', 'getRevenueTransactions', 'getRevenueTransactions'],
    ['GET revenue/transactions/export', 'exportRevenueTransactions', 'exportRevenueTransactions'],
  ] as const)('%s', (_name, method, serviceMethod) => {
    const call = (query: object) =>
      method === 'exportRevenueTransactions'
        ? controller.exportRevenueTransactions(query as never, user, res)
        : controller.getRevenueTransactions(query as never, user);
    const lastScope = () => {
      const args = service[serviceMethod].mock.calls[0];
      return args[args.length - 1];
    };

    it('leaves a platform admin unscoped, with or without a programId', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(platform);

      await call({});
      await call({ programId: OTHER_ID });

      expect(assertProgramPermission).not.toHaveBeenCalled();
      expect(programIdsWithPermission).not.toHaveBeenCalled();
      expect(lastScope()).toEqual(platform);
    });

    it('narrows an all-programs request to the programs where the admin holds a payments permission', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(assigned);

      await call({});

      expect(programIdsWithPermission).toHaveBeenCalledWith(readPrisma, user, [PROGRAM_ID, OTHER_ID], PAYMENTS);
      expect(lastScope()).toEqual({ kind: 'assigned', allowedProgramIds: [PROGRAM_ID] });
    });

    it('yields an empty scope (not everything) when no assigned program grants a payments permission', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(assigned);
      (programIdsWithPermission as jest.Mock).mockResolvedValue([]);

      await call({});

      expect(lastScope()).toEqual({ kind: 'assigned', allowedProgramIds: [] });
    });

    it('allows a programId the admin is assigned to with a payments permission', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(assigned);

      await call({ programId: PROGRAM_ID });

      expect(assertProgramPermission).toHaveBeenCalledWith(readPrisma, user, PROGRAM_ID, PAYMENTS);
      expect(service[serviceMethod]).toHaveBeenCalled();
    });

    it('refuses (404) a programId outside the assignment', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(assigned);
      (assertProgramAccess as jest.Mock).mockRejectedValue(new NotFoundException());

      await expect(call({ programId: OTHER_ID })).rejects.toBeInstanceOf(NotFoundException);
      expect(service[serviceMethod]).not.toHaveBeenCalled();
    });

    it('refuses (403) an assigned programId without a payments permission', async () => {
      (resolveRevenueAccessScope as jest.Mock).mockResolvedValue(assigned);
      (assertProgramPermission as jest.Mock).mockRejectedValue(new ForbiddenException());

      await expect(call({ programId: PROGRAM_ID })).rejects.toBeInstanceOf(ForbiddenException);
      expect(service[serviceMethod]).not.toHaveBeenCalled();
    });
  });
});

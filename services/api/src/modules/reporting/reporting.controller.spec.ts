// services/api/src/modules/reporting/reporting.controller.spec.ts
//
// GET /reporting/payments/export: platform admins get any filter set; a
// program-scoped admin (e.g. the Finance role) may export only a program they
// are assigned to, and only with a payments permission on it.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import {
  resolveRevenueAccessScope,
  assertProgramAccess,
} from '@modules/stats/revenue/utils/revenue-access.util';
import { assertProgramPermission } from '@shared/guards/admin-permission.guard';

jest.mock('@modules/stats/revenue/utils/revenue-access.util', () => ({
  resolveRevenueAccessScope: jest.fn(),
  assertProgramAccess: jest.fn(),
}));
jest.mock('@shared/guards/admin-permission.guard', () => ({
  assertProgramPermission: jest.fn(),
}));

const PROGRAM_ID = '11111111-1111-4111-8111-111111111111';
const user = { userId: 'u1', adminId: 'a1', role: 'admin' } as never;
const res = {} as never;

describe('ReportingController.exportPayments scope', () => {
  const reportingService = { exportPayments: jest.fn() };
  const readPrisma = {};
  const controller = new ReportingController(reportingService as never, readPrisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    (assertProgramAccess as jest.Mock).mockResolvedValue({ id: PROGRAM_ID });
    (assertProgramPermission as jest.Mock).mockResolvedValue(undefined);
  });

  it('lets a platform admin export without a programId', async () => {
    (resolveRevenueAccessScope as jest.Mock).mockResolvedValue({ kind: 'platform' });

    await controller.exportPayments(res, {}, user);

    expect(assertProgramAccess).not.toHaveBeenCalled();
    expect(reportingService.exportPayments).toHaveBeenCalledWith(res, expect.objectContaining({ programId: undefined }));
  });

  it('refuses a program-scoped admin who sends no programId', async () => {
    (resolveRevenueAccessScope as jest.Mock).mockResolvedValue({ kind: 'assigned', programIds: [PROGRAM_ID] });

    await expect(controller.exportPayments(res, {}, user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(reportingService.exportPayments).not.toHaveBeenCalled();
  });

  it('refuses a program-scoped admin on a program outside their assignment', async () => {
    (resolveRevenueAccessScope as jest.Mock).mockResolvedValue({ kind: 'assigned', programIds: [] });
    (assertProgramAccess as jest.Mock).mockRejectedValue(new NotFoundException());

    await expect(controller.exportPayments(res, { programId: PROGRAM_ID }, user)).rejects.toBeInstanceOf(NotFoundException);
    expect(reportingService.exportPayments).not.toHaveBeenCalled();
  });

  it('refuses a program-scoped admin without a payments permission on the program', async () => {
    (resolveRevenueAccessScope as jest.Mock).mockResolvedValue({ kind: 'assigned', programIds: [PROGRAM_ID] });
    (assertProgramPermission as jest.Mock).mockRejectedValue(new ForbiddenException());

    await expect(controller.exportPayments(res, { programId: PROGRAM_ID }, user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(assertProgramPermission).toHaveBeenCalledWith(readPrisma, user, PROGRAM_ID, ['payments:read', 'payments:write']);
    expect(reportingService.exportPayments).not.toHaveBeenCalled();
  });

  it('exports an assigned program for an admin holding payments:read', async () => {
    (resolveRevenueAccessScope as jest.Mock).mockResolvedValue({ kind: 'assigned', programIds: [PROGRAM_ID] });

    await controller.exportPayments(res, { programId: PROGRAM_ID, status: 'paid' }, user);

    expect(assertProgramAccess).toHaveBeenCalledWith(readPrisma, expect.anything(), PROGRAM_ID);
    expect(reportingService.exportPayments).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ programId: PROGRAM_ID, status: 'paid' }),
    );
  });
});

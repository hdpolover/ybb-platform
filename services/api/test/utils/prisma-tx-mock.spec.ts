// services/api/test/utils/prisma-tx-mock.spec.ts
import { makePrismaTxMock, expectNoOuterWrites } from './prisma-tx-mock';

describe('makePrismaTxMock', () => {
  it('builds disjoint prisma/tx mocks with $transaction pre-wired to the tx client', async () => {
    const { prisma, tx } = makePrismaTxMock(
      { participantApplication: { findUnique: jest.fn() } },
      { participantApplication: { update: jest.fn() } },
    );

    expect(prisma.participantApplication.findUnique).not.toBe(tx.participantApplication.update);

    await prisma.$transaction(async (client: typeof tx) => {
      await client.participantApplication.update({ where: { id: '1' }, data: {} });
    });

    expect(tx.participantApplication.update).toHaveBeenCalledTimes(1);
  });

  it('throws when prisma and tx share a jest.fn() by reference (the exact `makePrismaTxMock(models, models)` mistake)', () => {
    const models = { participantApplication: { update: jest.fn() } };

    expect(() => makePrismaTxMock(models, models)).toThrow(
      /participantApplication\.update.*SAME jest\.fn\(\)/s,
    );
  });

  it('throws when the shared jest.fn() is nested inside otherwise-separate shape objects', () => {
    const sharedUpdate = jest.fn();

    expect(() =>
      makePrismaTxMock(
        { ambassador: { update: sharedUpdate } },
        { ambassador: { update: sharedUpdate } },
      ),
    ).toThrow(/ambassador\.update/);
  });

  it('does not throw when prisma and tx declare the same model.op name with distinct jest.fn() instances', () => {
    expect(() =>
      makePrismaTxMock(
        { participantApplication: { update: jest.fn() } },
        { participantApplication: { update: jest.fn() } },
      ),
    ).not.toThrow();
  });
});

describe('expectNoOuterWrites', () => {
  it('passes when no write-shaped operation was called', () => {
    const { prisma } = makePrismaTxMock(
      { participantApplication: { findUnique: jest.fn(), update: jest.fn() } },
      { participantApplication: { update: jest.fn() } },
    );

    expect(() => expectNoOuterWrites(prisma)).not.toThrow();
  });

  it('ignores read operations even when they were called', () => {
    const { prisma } = makePrismaTxMock(
      { participantApplication: { findUnique: jest.fn(), findMany: jest.fn() } },
      {},
    );
    prisma.participantApplication.findUnique({ where: { id: '1' } });
    prisma.participantApplication.findMany({});

    expect(() => expectNoOuterWrites(prisma)).not.toThrow();
  });

  it('fails, naming the model and operation, when a write escaped onto the outer client', () => {
    const { prisma } = makePrismaTxMock(
      { participantApplication: { update: jest.fn() } },
      { participantApplication: { update: jest.fn() } },
    );
    prisma.participantApplication.update({ where: { id: '1' }, data: { status: 'submitted' } });

    expect(() => expectNoOuterWrites(prisma)).toThrow(/participantApplication\.update/);
  });

  it('checks every write op across every model, not just the first one found', () => {
    const { prisma } = makePrismaTxMock(
      {
        participantApplication: { update: jest.fn() },
        applicationInvoice: { updateMany: jest.fn() },
      },
      { participantApplication: { update: jest.fn() }, applicationInvoice: { updateMany: jest.fn() } },
    );
    prisma.applicationInvoice.updateMany({ where: {}, data: {} });

    expect(() => expectNoOuterWrites(prisma)).toThrow(/applicationInvoice\.updateMany/);
  });

  it('accepts a narrowed subset of the prisma mock, ignoring models outside it', () => {
    const { prisma } = makePrismaTxMock(
      {
        participantApplication: { update: jest.fn() }, // legitimately written outside the tx
        ambassador: { update: jest.fn() }, // must never be written outside the tx
      },
      { ambassador: { update: jest.fn() } },
    );
    // Legitimate outer write -- must not affect a narrowed check.
    prisma.participantApplication.update({ where: { id: '1' }, data: {} });

    expect(() => expectNoOuterWrites({ ambassador: prisma.ambassador })).not.toThrow();
  });
});

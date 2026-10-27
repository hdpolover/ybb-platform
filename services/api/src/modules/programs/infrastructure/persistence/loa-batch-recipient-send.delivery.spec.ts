// src/modules/programs/infrastructure/persistence/loa-batch-recipient-send.delivery.spec.ts
import { LoaBatchRecipientSendRepository, resolveDeliveryUpdate } from './loa-batch-recipient-send.repository';

const T1 = new Date('2026-10-27T10:00:00Z');
const T2 = new Date('2026-10-27T11:00:00Z');
const fresh = { deliveryStatus: null, deliveryUpdatedAt: null };

describe('resolveDeliveryUpdate', () => {
  it('sets delivered and its timestamp on a fresh row', () => {
    expect(resolveDeliveryUpdate(fresh, { status: 'delivered', occurredAt: T1, bounceType: null })).toEqual({
      deliveryStatus: 'delivered',
      deliveredAt: T1,
      deliveryUpdatedAt: T1,
    });
  });

  it('bounced beats delivered and keeps the bounce type', () => {
    const current = { deliveryStatus: 'delivered', deliveryUpdatedAt: T1 };
    expect(resolveDeliveryUpdate(current, { status: 'bounced', occurredAt: T2, bounceType: 'Permanent/General' })).toEqual({
      deliveryStatus: 'bounced',
      bouncedAt: T2,
      bounceType: 'Permanent/General',
      deliveryUpdatedAt: T2,
    });
  });

  it('complained beats delivered', () => {
    const current = { deliveryStatus: 'delivered', deliveryUpdatedAt: T1 };
    expect(resolveDeliveryUpdate(current, { status: 'complained', occurredAt: T2, bounceType: null })?.deliveryStatus).toBe(
      'complained',
    );
  });

  it.each(['delivered', 'delayed'] as const)('never downgrades bounced to %s', (status) => {
    const current = { deliveryStatus: 'bounced', deliveryUpdatedAt: T1 };
    expect(resolveDeliveryUpdate(current, { status, occurredAt: T2, bounceType: null })).toBeNull();
  });

  it.each(['delivered', 'bounced', 'delayed'] as const)('never downgrades complained to %s', (status) => {
    const current = { deliveryStatus: 'complained', deliveryUpdatedAt: T1 };
    expect(resolveDeliveryUpdate(current, { status, occurredAt: T2, bounceType: null })).toBeNull();
  });

  it('a late delayed event does not overwrite delivered', () => {
    const current = { deliveryStatus: 'delivered', deliveryUpdatedAt: T1 };
    expect(resolveDeliveryUpdate(current, { status: 'delayed', occurredAt: T2, bounceType: null })).toBeNull();
  });

  it('delayed upgrades to delivered', () => {
    const current = { deliveryStatus: 'delayed', deliveryUpdatedAt: T1 };
    expect(resolveDeliveryUpdate(current, { status: 'delivered', occurredAt: T2, bounceType: null })?.deliveryStatus).toBe(
      'delivered',
    );
  });

  it('ignores an older event of the same rank (redelivery / reordering)', () => {
    const current = { deliveryStatus: 'delivered', deliveryUpdatedAt: T2 };
    expect(resolveDeliveryUpdate(current, { status: 'delivered', occurredAt: T1, bounceType: null })).toBeNull();
  });
});

describe('LoaBatchRecipientSendRepository.applyDeliveryEvent', () => {
  const build = (rows: Array<{ id: string; deliveryStatus: string | null; deliveryUpdatedAt: Date | null }>) => {
    const prisma = {
      loaBatchRecipientSend: {
        findMany: jest.fn().mockResolvedValue(rows),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return { prisma, repo: new LoaBatchRecipientSendRepository(prisma as never) };
  };

  it('returns 0 and writes nothing for an unknown message id', async () => {
    const { prisma, repo } = build([]);
    await expect(repo.applyDeliveryEvent({ emailId: 'nope', status: 'delivered', occurredAt: T1, bounceType: null })).resolves.toBe(0);
    expect(prisma.loaBatchRecipientSend.updateMany).not.toHaveBeenCalled();
  });

  it('updates the matched row guarded on its previously read state', async () => {
    const { prisma, repo } = build([{ id: 'r1', deliveryStatus: null, deliveryUpdatedAt: null }]);
    await repo.applyDeliveryEvent({ emailId: 'em_1', status: 'delivered', occurredAt: T1, bounceType: null });
    expect(prisma.loaBatchRecipientSend.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerMessageId: 'em_1' } }),
    );
    expect(prisma.loaBatchRecipientSend.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', deliveryStatus: null, deliveryUpdatedAt: null },
      data: { deliveryStatus: 'delivered', deliveredAt: T1, deliveryUpdatedAt: T1 },
    });
  });

  it('does not write when the event would downgrade the row', async () => {
    const { prisma, repo } = build([{ id: 'r1', deliveryStatus: 'bounced', deliveryUpdatedAt: T1 }]);
    await repo.applyDeliveryEvent({ emailId: 'em_1', status: 'delivered', occurredAt: T2, bounceType: null });
    expect(prisma.loaBatchRecipientSend.updateMany).not.toHaveBeenCalled();
  });
});

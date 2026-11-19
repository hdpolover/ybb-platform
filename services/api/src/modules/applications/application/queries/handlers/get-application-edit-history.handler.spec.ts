// services/api/src/modules/applications/application/queries/handlers/get-application-edit-history.handler.spec.ts
import { GetApplicationEditHistoryHandler } from './get-application-edit-history.handler';
import { GetApplicationEditHistoryQuery } from '../get-application-edit-history.query';

function build(rows: unknown[], users: unknown[] = []) {
  const prisma = {
    applicationEditHistory: { findMany: jest.fn().mockResolvedValue(rows) },
    user: { findMany: jest.fn().mockResolvedValue(users) },
  };
  return { prisma, handler: new GetApplicationEditHistoryHandler(prisma as never) };
}

const q = new GetApplicationEditHistoryQuery('app-1');

describe('GetApplicationEditHistoryHandler', () => {
  it('returns [] without hitting the user table when there is no history', async () => {
    const { prisma, handler } = build([]);
    await expect(handler.execute(q)).resolves.toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('queries newest first, capped at 100, scoped to the application', async () => {
    const { prisma, handler } = build([]);
    await handler.execute(q);
    expect(prisma.applicationEditHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicationId: 'app-1' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  });

  it('flattens the changes map and preserves row order', async () => {
    const t2 = new Date('2026-11-02');
    const t1 = new Date('2026-11-01');
    const { handler } = build(
      [
        { id: 'h2', editedBy: 'u1', reason: 'typo', createdAt: t2, changes: { 'personalData.phone': { old: '+62 1', new: '+62811' }, 'participant.fullName': { old: 'A', new: 'B' } } },
        { id: 'h1', editedBy: 'u1', reason: null, createdAt: t1, changes: { 'essayAnswers.q1': { old: undefined, new: 'x' } } },
      ],
      [{ id: 'u1', email: 'a@x.io', admin: { fullName: 'Admin One' } }],
    );

    const out = await handler.execute(q);

    expect(out.map((e) => e.id)).toEqual(['h2', 'h1']);
    expect(out[0]).toMatchObject({ editedAt: t2, reason: 'typo' });
    expect(out[0].changes).toEqual([
      { key: 'personalData.phone', old: '+62 1', new: '+62811' },
      { key: 'participant.fullName', old: 'A', new: 'B' },
    ]);
    expect(out[1].changes).toEqual([{ key: 'essayAnswers.q1', old: null, new: 'x' }]);
  });

  it('resolves editors with a single batched lookup and handles missing/non-admin users', async () => {
    const mk = (id: string, editedBy: string) => ({ id, editedBy, reason: null, createdAt: new Date(), changes: {} });
    const { prisma, handler } = build(
      [mk('h1', 'u1'), mk('h2', 'u2'), mk('h3', 'u1'), mk('h4', 'gone')],
      [
        { id: 'u1', email: 'a@x.io', admin: { fullName: 'Admin One' } },
        { id: 'u2', email: 'b@x.io', admin: null },
      ],
    );

    const out = await handler.execute(q);

    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['u1', 'u2', 'gone'] } });
    expect(out[0].editor).toEqual({ id: 'u1', name: 'Admin One', email: 'a@x.io' });
    expect(out[1].editor).toEqual({ id: 'u2', name: 'b@x.io', email: 'b@x.io' });
    expect(out[3].editor).toBeNull();
  });

  it('returns empty changes for malformed JSON instead of throwing', async () => {
    const { handler } = build(
      [{ id: 'h1', editedBy: 'u1', reason: null, createdAt: new Date(), changes: 'garbage' }],
      [{ id: 'u1', email: 'a@x.io', admin: null }],
    );
    const out = await handler.execute(q);
    expect(out[0].changes).toEqual([]);
  });
});

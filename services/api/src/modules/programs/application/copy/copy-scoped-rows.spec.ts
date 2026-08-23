// services/api/src/modules/programs/application/copy/copy-scoped-rows.spec.ts
import { copyScopedRows } from './copy-scoped-rows';

type Row = { id: string; name: string; order: number; programId: string };

// A minimal fake delegate — copyScopedRows only needs findMany/updateMany/create,
// so the fake mirrors those three Prisma-model-delegate methods without pulling
// in a real Prisma model. Rows live in a plain array; findMany filters by the
// where clause's `programId` (the only field these tests vary).
function fakeDelegate(initialRows: Row[]) {
  let rows = [...initialRows];
  let nextId = rows.length + 1;
  return {
    findMany: jest.fn(async ({ where }: { where: { programId: string } }) =>
      rows.filter((r) => r.programId === where.programId),
    ),
    updateMany: jest.fn(async ({ where, data }: { where: { programId: string }; data: Partial<Row> & { deletedAt?: Date; isActive?: boolean } }) => {
      const matched = rows.filter((r) => r.programId === where.programId);
      rows = rows.map((r) => (r.programId === where.programId ? { ...r, ...data } : r));
      return { count: matched.length };
    }),
    create: jest.fn(async ({ data }: { data: Omit<Row, 'id'> }) => {
      const row = { ...data, id: `new-${nextId++}` } as Row;
      rows.push(row);
      return row;
    }),
    _rows: () => rows,
  };
}

describe('copyScopedRows', () => {
  it('append copies new rows and skips exact dedupe-key collisions (case-sensitive)', async () => {
    const delegate = fakeDelegate([
      { id: 's1', name: 'Email', order: 0, programId: 'src' },
      { id: 's2', name: 'email', order: 1, programId: 'src' },
      { id: 't1', name: 'email', order: 0, programId: 'tgt' },
    ]);
    const result = await copyScopedRows({
      delegate,
      scopeField: 'programId',
      sourceProgramId: 'src',
      targetProgramId: 'tgt',
      mode: 'append',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData: { deletedAt: new Date() },
    });
    // 'Email' (capital E) does not collide with the existing lowercase
    // 'email' row — dedupe is exact Set.has(), matching the DB-enforced
    // partial unique index on ApplicationFormField.
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
    expect(delegate.create).toHaveBeenCalledTimes(1);
    expect(delegate.create.mock.calls[0][0].data.name).toBe('Email');
  });

  it('append renumbers new rows after the target\'s current max order', async () => {
    const delegate = fakeDelegate([
      { id: 's1', name: 'a', order: 0, programId: 'src' },
      { id: 's2', name: 'b', order: 1, programId: 'src' },
      { id: 't1', name: 'x', order: 5, programId: 'tgt' },
    ]);
    await copyScopedRows({
      delegate,
      scopeField: 'programId',
      sourceProgramId: 'src',
      targetProgramId: 'tgt',
      mode: 'append',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData: { deletedAt: new Date() },
    });
    expect(delegate.create.mock.calls[0][0].data.order).toBe(6);
    expect(delegate.create.mock.calls[1][0].data.order).toBe(7);
  });

  it('replace soft-deletes existing target rows via replaceData, then inserts from order 0', async () => {
    const delegate = fakeDelegate([
      { id: 's1', name: 'a', order: 3, programId: 'src' },
      { id: 't1', name: 'old', order: 0, programId: 'tgt' },
    ]);
    const replaceData = { deletedAt: new Date('2026-08-23'), isActive: false };
    const result = await copyScopedRows({
      delegate,
      scopeField: 'programId',
      sourceProgramId: 'src',
      targetProgramId: 'tgt',
      mode: 'replace',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData,
    });
    expect(delegate.updateMany).toHaveBeenCalledWith({
      where: { programId: 'tgt' },
      data: replaceData,
    });
    expect(delegate.create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('empty source is a no-op: no create/updateMany calls beyond the initial lookups', async () => {
    const delegate = fakeDelegate([{ id: 't1', name: 'x', order: 0, programId: 'tgt' }]);
    const result = await copyScopedRows({
      delegate,
      scopeField: 'programId',
      sourceProgramId: 'src',
      targetProgramId: 'tgt',
      mode: 'append',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData: { deletedAt: new Date() },
    });
    expect(result).toEqual({ created: 0, skipped: 0, replaced: 0 });
    expect(delegate.create).not.toHaveBeenCalled();
  });

  it('itemIds filters the source rows before copying', async () => {
    const delegate = fakeDelegate([
      { id: 's1', name: 'a', order: 0, programId: 'src' },
      { id: 's2', name: 'b', order: 1, programId: 'src' },
      { id: 's3', name: 'c', order: 2, programId: 'src' },
    ]);
    await copyScopedRows({
      delegate,
      scopeField: 'programId',
      sourceProgramId: 'src',
      targetProgramId: 'tgt',
      itemIds: ['s1', 's3'],
      mode: 'append',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData: { deletedAt: new Date() },
    });
    expect(delegate.create).toHaveBeenCalledTimes(2);
    expect(delegate.create.mock.calls.map((c: any) => c[0].data.name)).toEqual(['a', 'c']);
  });

  it('replace calls beforeReplace with the existing target row ids before deleting, and aborts if it throws', async () => {
    const delegate = fakeDelegate([
      { id: 's1', name: 'a', order: 0, programId: 'src' },
      { id: 't1', name: 'old', order: 0, programId: 'tgt' },
    ]);
    const beforeReplace = jest.fn(async () => {
      throw new Error('blocked');
    });
    await expect(
      copyScopedRows({
        delegate,
        scopeField: 'programId',
        sourceProgramId: 'src',
        targetProgramId: 'tgt',
        mode: 'replace',
        activeFilter: {},
        idOf: (r: Row) => r.id,
        dedupeKey: (r: Row) => r.name,
        fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
        replaceData: { deletedAt: new Date() },
        beforeReplace,
      }),
    ).rejects.toThrow('blocked');
    expect(beforeReplace).toHaveBeenCalledWith(['t1']);
    expect(delegate.updateMany).not.toHaveBeenCalled();
    expect(delegate.create).not.toHaveBeenCalled();
  });
});

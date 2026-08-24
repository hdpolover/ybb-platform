// services/api/test/utils/prisma-tx-mock.ts

/**
 * Builds a disjoint `{ prisma, tx }` mock pair for specs that exercise code
 * shaped like `prisma.$transaction((tx) => tx.model.create(...))`.
 *
 * The trap this exists to close: `base.$transaction = jest.fn((cb) =>
 * cb(base))` hands the transaction callback the SAME object the code under
 * test also holds as `this.prisma`. With one shared mock, an assertion like
 * `expect(prisma.model.create).toHaveBeenCalled()` passes identically
 * whether the code wrote through the transactional `tx` client (correct) or
 * reached around it to the ambient, non-transactional `this.prisma`
 * (a bug — one that, for a replace-mode write, soft-deletes the target rows
 * and then fails to insert the replacements if anything downstream in the
 * transaction rolls back, leaving that target's rows silently empty). Two
 * separate jest.fn() sets make that class of bug fail loudly: writes
 * asserted against `tx` won't have fired if the code actually wrote to
 * `prisma`, and a companion `expect(prisma.model.create).not.toHaveBeenCalled()`
 * catches it from the other side. `buildModels` is invoked twice — once for
 * `tx`, once for `prisma` — so both mocks share the same call-through
 * behavior (e.g. reading from the same closed-over fixture data) while
 * remaining independently-tracked jest.fn() instances. `prisma.$transaction`
 * is pre-wired to invoke its callback with `tx`, matching
 * `PrismaService.$transaction`'s real signature.
 */
export function createPrismaTxMock<TModels extends Record<string, unknown>>(
  buildModels: () => TModels,
): { prisma: TModels & { $transaction: jest.Mock }; tx: TModels } {
  const tx = buildModels();
  const prisma = buildModels() as TModels & { $transaction: jest.Mock };
  prisma.$transaction = jest.fn((cb: (tx: TModels) => unknown) => cb(tx));
  return { prisma, tx };
}

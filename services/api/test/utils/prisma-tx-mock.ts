// services/api/test/utils/prisma-tx-mock.ts
//
// Shared helper for mocking `PrismaService.$transaction` in handler/repository specs.
//
// WHY `tx` MUST BE A DISJOINT OBJECT FROM `prisma` (never `cb(mockPrisma)`):
//
// The common shortcut is
//   mockPrisma.$transaction.mockImplementation((cb) => cb(mockPrisma))
// i.e. wiring the transaction client to literally BE the outer prisma mock. That
// collapses the two identities a test needs to tell apart: a write sent to
// `this.prisma.model.op(...)` (outside any transaction — commits immediately and
// independently of everything else) versus a write sent to `tx.model.op(...)`
// (inside the transaction — rolled back atomically with every other write in the
// same callback). If `tx === prisma`, `expect(mockPrisma.model.op).toHaveBeenCalled()`
// is true in BOTH worlds, so a refactor that silently moves a write outside the
// transaction — the single most common way atomicity regresses during a refactor —
// is invisible to the test. Keeping `tx` a separate object with its own `jest.fn()`s
// means "was this call routed through the transaction" and "did the outer client see
// this call" become independently observable, which is the entire point of testing
// `$transaction` at all.
//
// This shape is not invented here — it's promoted from two specs that already do it
// correctly:
//   - src/modules/programs/application/commands/handlers/application-form-field.handler.spec.ts
//   - src/modules/applications/application/commands/handlers/upsert-application-review.handler.spec.ts
//
// Usage:
//   const { prisma, tx } = makePrismaTxMock(
//     { participantApplication: { findUnique: jest.fn() } },      // outer client (reads, plus any writes deliberately outside the tx)
//     { applicationInvoice: { updateMany: jest.fn() }, participantApplication: { update: jest.fn() } }, // tx client (writes that must be atomic)
//   );
//   // ...
//   expect(tx.participantApplication.update).toHaveBeenCalledWith(...);
//   expectNoOuterWrites(prisma); // proves no write escaped the transaction onto the outer client

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PrismaTxMock<TPrisma extends object, TTx extends object> {
  /** The outer `PrismaService` mock. Has `$transaction` pre-wired to invoke its callback with `tx`. */
  prisma: TPrisma & { $transaction: jest.Mock };
  /** The disjoint transaction-client mock. Never the same object as `prisma`. */
  tx: TTx;
}

/**
 * Builds a disjoint `{ prisma, tx }` pair with `prisma.$transaction` pre-wired.
 *
 * Supports both the callback form (`$transaction(async (tx) => ...)`, invokes the
 * callback with `tx`) and the array form (`$transaction([a(), b()])`, resolves via
 * `Promise.all`). Note that the array form is evaluated *eagerly by the caller*
 * before `$transaction` is ever invoked (see Idiom 2 in
 * `.notes/vacuous-test-audit.md`), so a mock cannot make delegate-level assertions
 * transaction-aware for that form — specs using array-form `$transaction` must
 * additionally assert `prisma.$transaction` was called with an array of the
 * expected length.
 */
export function makePrismaTxMock<TPrisma extends object, TTx extends object>(
  prismaShape: TPrisma,
  txShape: TTx,
): PrismaTxMock<TPrisma, TTx> {
  const tx = txShape;
  const prisma: any = {
    ...prismaShape,
    $transaction: jest.fn((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: TTx) => unknown)(tx);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return Promise.resolve(arg);
    }),
  };
  return { prisma, tx };
}

/** Prisma delegate methods that mutate data. Read methods (find-family, count,
 * aggregate, groupBy) are deliberately excluded — reads on the outer,
 * non-transactional `prisma` client are normal and expected; only writes must
 * never land there. */
const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

/**
 * Asserts that no write-shaped Prisma operation was called on the given mock.
 * Intended for the outer, non-transactional `prisma` mock returned by
 * `makePrismaTxMock` (or any subset of it shaped the same way,
 * `{ modelName: { opName: jest.fn(), ... }, ... }`) — pass a subset when some
 * model on the outer client legitimately writes outside the transaction and
 * only other models must be write-free.
 *
 * This is the assertion every `$transaction`-mocking spec needs and, without
 * this helper, has to hand-write once per model per operation:
 *   expect(prisma.someModel.update).not.toHaveBeenCalled();
 * That negative IS the fix for a mocked transaction: asserting the `tx` mock
 * was called proves nothing on its own, because a write that escaped the
 * transaction still calls *something* — this is the only assertion that
 * catches it landing in the wrong place.
 *
 * Failures name the exact `model.operation` that was called outside the
 * transaction, so a failure is diagnosable without a debugger.
 */
export function expectNoOuterWrites(prisma: Record<string, unknown>): void {
  for (const [model, ops] of Object.entries(prisma)) {
    if (model === '$transaction' || ops === null || typeof ops !== 'object') continue;

    for (const [op, fn] of Object.entries(ops as Record<string, unknown>)) {
      if (!WRITE_OPERATIONS.has(op)) continue;
      if (typeof fn !== 'function' || !('mock' in fn)) continue;

      const mockFn = fn as jest.Mock;
      if (mockFn.mock.calls.length > 0) {
        try {
          expect(mockFn).not.toHaveBeenCalled();
        } catch (err) {
          throw new Error(
            `expectNoOuterWrites: prisma.${model}.${op} was called outside the transaction ` +
              `— a write that must be atomic escaped $transaction (route it through the tx ` +
              `client instead).\n\n${(err as Error).message}`,
          );
        }
      }
    }
  }
}

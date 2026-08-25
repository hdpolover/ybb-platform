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
//
// `makePrismaTxMock` throws at construction time if `prisma` and `tx` end up sharing
// any `jest.fn()` by reference (e.g. passing the same shape object/literal to both
// parameters) — see `assertDisjointMocks` below. That mistake type-checks, compiles,
// and passes today; it silently reintroduces the exact bug this helper exists to catch.


export interface PrismaTxMock<TPrisma extends object, TTx extends object> {
  /** The outer `PrismaService` mock. Has `$transaction` pre-wired to invoke its callback with `tx`. */
  prisma: TPrisma & { $transaction: jest.Mock };
  /** The disjoint transaction-client mock. Never the same object as `prisma`. */
  tx: TTx;
}

/**
 * Walks a (nested, model -> operation -> fn) shape and returns a map of every
 * function reference found to the dotted path it was found at. Used to detect
 * whether `prismaShape` and `txShape` share any `jest.fn()` by reference.
 */
function collectFnPaths(shape: object, prefix = '', seen = new Set<object>()): Map<unknown, string> {
  const found = new Map<unknown, string>();
  if (seen.has(shape)) return found;
  seen.add(shape);

  for (const [key, value] of Object.entries(shape)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'function') {
      found.set(value, path);
    } else if (value && typeof value === 'object') {
      for (const [fn, p] of collectFnPaths(value, path, seen)) {
        found.set(fn, p);
      }
    }
  }
  return found;
}

/**
 * Throws if `prismaShape` and `txShape` share any `jest.fn()` by reference —
 * e.g. `makePrismaTxMock(models, models)`, or two shapes built from the same
 * object literal. That mistake compiles and type-checks: `prisma.X.update` and
 * `tx.X.update` become literally the same mock function, so
 * `expect(prisma.X.update).not.toHaveBeenCalled()` and
 * `expect(tx.X.update).toHaveBeenCalled()` can never disagree, and the spec is
 * structurally incapable of detecting a write that escaped the transaction.
 * A loud failure here beats a silently vacuous spec.
 */
function assertDisjointMocks(prismaShape: object, txShape: object): void {
  const prismaFns = collectFnPaths(prismaShape);
  const txFns = collectFnPaths(txShape);

  for (const [fn, txPath] of txFns) {
    if (prismaFns.has(fn)) {
      const prismaPath = prismaFns.get(fn);
      throw new Error(
        `makePrismaTxMock: prisma.${prismaPath} and tx.${txPath} are the SAME jest.fn() ` +
          `(shared by reference). This collapses "was this write routed through the ` +
          `transaction" and "did the outer client see this write" into one observable, ` +
          `which defeats the entire purpose of this helper. Pass separate shape objects ` +
          `for the outer prisma mock and the tx mock — never the same object/literal for both.`,
      );
    }
  }
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
 *
 * @throws if `prismaShape` and `txShape` share any `jest.fn()` by reference — see
 * `assertDisjointMocks`.
 */
export function makePrismaTxMock<TPrisma extends object, TTx extends object>(
  prismaShape: TPrisma,
  txShape: TTx,
): PrismaTxMock<TPrisma, TTx> {
  assertDisjointMocks(prismaShape, txShape);

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

/**
 * Convenience wrapper for the common case where both sides of the pair are
 * built from the same factory: calls `buildModels` TWICE so `prisma` and `tx`
 * are independently-tracked jest.fn() sets that still share call-through
 * behavior (e.g. reading the same closed-over fixture data).
 *
 * Delegates to `makePrismaTxMock`, so it inherits the disjointness assertion:
 * a `buildModels` that returns a memoized/shared object rather than a fresh
 * one throws instead of silently producing a vacuous spec.
 */
export function createPrismaTxMock<TModels extends Record<string, unknown>>(
  buildModels: () => TModels,
): { prisma: TModels & { $transaction: jest.Mock }; tx: TModels } {
  const { prisma, tx } = makePrismaTxMock(buildModels(), buildModels());
  return {
    prisma: prisma as TModels & { $transaction: jest.Mock },
    tx: tx as TModels,
  };
}

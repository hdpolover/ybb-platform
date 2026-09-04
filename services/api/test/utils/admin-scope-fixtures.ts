// test/utils/admin-scope-fixtures.ts
import {
  AdminAccessLike,
  AdminProgramAccessScope,
  getAdminProgramAccessScope,
} from '../../src/shared/admin-access-response';

/**
 * One admin fixture per kind `getAdminProgramAccessScope` can return.
 *
 * WHY THIS EXISTS, AND WHY IT IS A RECORD.
 *
 * A missing test FIXTURE does not fail — it simply never asks the question.
 * `user-access.util.spec.ts` carried fixtures for the platform and brand
 * personas and none for the program-scoped `'assigned'` one, so the suite was
 * green while an entire class of admin was locked out of the dashboard. Two
 * independent reviews missed it, one of them explicitly briefed to look for
 * lockouts, because neither questioned the fixture SET. That shipped as PR
 * #149 and had to be undone by #152.
 *
 * Typing this as `Record<AdminProgramAccessScope, ...>` is what stops it
 * happening again: add a fourth kind to the classifier and this object fails
 * to compile until a fixture for it exists. The omission becomes a build
 * error instead of a silent gap in coverage.
 *
 * `admin-scope-fixtures.spec.ts` then asserts each fixture really does classify
 * as the key it is filed under, so the fixtures cannot drift away from the
 * classifier they are supposed to represent.
 */
export const ADMIN_SCOPE_FIXTURES: Record<AdminProgramAccessScope, AdminAccessLike> = {
  // Super admin by access level. Sees every brand and every programme.
  platform: {
    accessLevel: 5,
    adminBrands: [],
    adminPrograms: [],
  },

  // Holds at least one brand grant, so its scope is those brands.
  brand_scope: {
    accessLevel: 2,
    adminBrands: [{ brandId: 'brand-1' } as never],
    adminPrograms: [],
  },

  // THE PERSONA THAT HAD NO FIXTURE. No brand grant at all — its reach is
  // derived from the programmes it is individually assigned to. Anything that
  // asks "which brands may this admin touch?" by reading adminBrands gets an
  // empty list for this admin and, if it then treats empty as "none", locks
  // them out of their own programmes.
  assigned: {
    accessLevel: 1,
    adminBrands: [],
    adminPrograms: [{ programId: 'program-1' } as never],
  },
};

/** Every kind, for `it.each` over the full set rather than a chosen subset. */
export const ADMIN_SCOPE_KINDS = Object.keys(
  ADMIN_SCOPE_FIXTURES,
) as AdminProgramAccessScope[];

/** Re-exported so a spec can assert a fixture against the real classifier. */
export { getAdminProgramAccessScope };

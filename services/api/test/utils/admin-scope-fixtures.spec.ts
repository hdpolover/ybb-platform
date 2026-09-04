// test/utils/admin-scope-fixtures.spec.ts
import {
  ADMIN_SCOPE_FIXTURES,
  ADMIN_SCOPE_KINDS,
  getAdminProgramAccessScope,
} from './admin-scope-fixtures';

describe('admin scope fixtures', () => {
  it('covers every kind the classifier can return', () => {
    // If the classifier gains a fourth kind, the Record type stops
    // ADMIN_SCOPE_FIXTURES compiling long before this runs — this assertion is
    // the runtime half, catching a kind removed or renamed rather than added.
    expect(ADMIN_SCOPE_KINDS.sort()).toEqual(['assigned', 'brand_scope', 'platform']);
  });

  it.each(ADMIN_SCOPE_KINDS)('the %s fixture really classifies as that kind', kind => {
    // Without this, a fixture could sit under the wrong key and a spec
    // iterating the set would believe it had tested a persona it never built.
    expect(getAdminProgramAccessScope(ADMIN_SCOPE_FIXTURES[kind])).toBe(kind);
  });

  it('gives the assigned persona no brand grant, which is the whole trap', () => {
    // The #149 lockout came from code reading adminBrands to decide reach and
    // treating an empty list as "no access". A fixture that quietly carried a
    // brand would test nothing.
    expect(ADMIN_SCOPE_FIXTURES.assigned.adminBrands).toHaveLength(0);
    expect(ADMIN_SCOPE_FIXTURES.assigned.adminPrograms.length).toBeGreaterThan(0);
  });
});

// services/api/src/modules/admin-access-requests/admin-divisions.spec.ts
import { ADMIN_DIVISIONS, isPlatformTierRole } from './admin-divisions';

describe('admin divisions', () => {
  it('maps the agreed keys to default role names', () => {
    expect(ADMIN_DIVISIONS.map((d) => [d.key, d.defaultRoleName])).toEqual([
      ['digital_marketing', 'Digital Marketing'],
      ['reviewer', 'Reviewer'],
      ['news_writer', 'News Writer'],
      ['admin', 'Program Admin'],
      ['project_management', 'Program Admin'],
      ['other', null],
    ]);
  });

  it('never defaults to a platform-tier role name', () => {
    const defaults = ADMIN_DIVISIONS.map((d) => d.defaultRoleName);
    expect(defaults).not.toContain('Admin');
    expect(defaults).not.toContain('Project Manager');
    expect(defaults).not.toContain('Super Admin');
  });

  it.each([
    [{ name: 'Admin', permissions: ['platform_access', 'admin.manage'] }, true],
    [{ name: 'Project Manager', permissions: ['platform_access'] }, true],
    [{ name: 'Super Admin', permissions: ['*'] }, true],
    [{ name: 'Program Admin', permissions: ['program:read', 'participants:read'] }, false],
    [{ name: 'Reviewer', permissions: ['reviews:write'] }, false],
  ])('classifies %j as platform=%s', (role, expected) => {
    expect(isPlatformTierRole(role)).toBe(expected);
  });
});

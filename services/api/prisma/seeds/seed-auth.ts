import { prisma, log } from './utils';

export async function seedAuth() {
  log('🌱 Seeding Auth...');

  // 1. Auth Providers
  // We prioritize 'local' to ensure it's established as the default foundation
  const providers = [
    { name: 'local', displayName: 'Email & Password', icon: 'email', buttonColor: '#4A5568', order: 1, isOAuth: false },
    { name: 'google', displayName: 'Google', icon: 'google', buttonColor: '#4285F4', order: 2, isOAuth: true },
  ];

  for (const p of providers) {
    await prisma.authProvider.upsert({
      where: { name: p.name },
      update: {
        order: p.order,
        isActive: true,
      },
      create: {
        name: p.name,
        displayName: p.displayName,
        description: `Sign in with ${p.displayName}`,
        isActive: true,
        isOAuth: p.isOAuth,
        icon: p.icon,
        buttonColor: p.buttonColor,
        order: p.order,
      },
    });

    if (p.name === 'local') {
      log('✅ Default Auth Provider (local) established');
    }
  }
  log('✅ All Auth Providers synced');

  // 2. Roles
  const roles = [
    {
      name: 'Super Admin',
      description: 'Full platform access across brands, programs, and administrator management.',
      permissions: ['*', 'admin.*', 'platform.*', 'platform.manage', 'platform_access', 'admin.manage'],
    },
    {
      name: 'Platform Admin',
      description: 'Platform-wide operational access across brands and programs without super-admin elevation.',
      permissions: [
        'platform.manage',
        'platform_access',
        'brand.manage',
        'program:read',
        'program:write',
        'content:read',
        'content:write',
        'documents:read',
        'documents:write',
        'media:read',
        'media:write',
        'announcements:read',
        'announcements:write',
        'participants:read',
        'participants:write',
        'applications:read',
        'applications:write',
        'payments:read',
        'payments:write',
        'roles.manage',
      ],
    },
    {
      name: 'Admin',
      description: 'Brand or platform administrator with operational program access.',
      permissions: [
        'platform_access',
        'brand.manage',
        'program:read',
        'program:write',
        'content:read',
        'content:write',
        'documents:read',
        'documents:write',
        'media:read',
        'media:write',
        'announcements:read',
        'announcements:write',
        'participants:read',
        'participants:write',
        'applications:read',
        'applications:write',
        'payments:read',
        'payments:write',
      ],
    },
    {
      name: 'Program Admin',
      description: 'Program-scoped administrator for applications, participants, and program operations.',
      permissions: [
        'program:read',
        'program:write',
        'applications:read',
        'applications:write',
        'participants:read',
        'participants:write',
        'payments:read',
        'documents:read',
        'announcements:read',
        'media:read',
      ],
    },
    {
      name: 'Editor',
      description: 'Content editor for program materials and CMS-managed content.',
      permissions: [
        'program:read',
        'content:read',
        'content:write',
        'documents:read',
        'documents:write',
        'media:read',
        'media:write',
        'announcements:read',
        'announcements:write',
      ],
    },
    {
      name: 'Reviewer',
      description: 'Review applications, essays, and scoring data without broader admin access.',
      permissions: ['program:read', 'applications:read', 'applications:write', 'review:read', 'review:write', 'documents:read'],
    },
    {
      name: 'News Writer',
      description: 'Manage announcements and supporting content assets for a specific program.',
      permissions: [
        'program:read',
        'content:read',
        'content:write',
        'announcements:read',
        'announcements:write',
        'media:read',
        'media:write',
        'documents:read',
      ],
    },
    {
      name: 'Participant',
      description: 'Participant access to their own application workflow.',
      permissions: ['application:read', 'application:write'],
    },
  ];

  for (const r of roles) {
    await prisma.adminRole.upsert({
      where: { name: r.name },
      update: {
        description: r.description,
        permissions: r.permissions,
        isActive: true,
      },
      create: {
        name: r.name,
        description: r.description,
        isActive: true,
        permissions: r.permissions
      }
    });
  }
  log('✅ Roles created');
}

import { prisma, log, error } from './utils';
import { BRANDS } from './seed-brands';
import * as bcrypt from 'bcrypt';

export async function seedAdmins() {
  log('🌱 Seeding Admins...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  const cysBrand = await prisma.brand.findUnique({ where: { slug: BRANDS.CYS } });
  if (!cysBrand) {
    return error(`${BRANDS.CYS} Brand not found. Cannot seed admins.`);
  }

  const brandBySlug = new Map([[BRANDS.CYS, cysBrand]]);

  const activeCysProgram = await prisma.program.findFirst({
    where: { brandId: cysBrand.id, isActive: true },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
  });

  const programByBrandSlug = new Map(
    activeCysProgram ? [[BRANDS.CYS, activeCysProgram]] : [],
  );

  type BrandAssignmentSeed = {
    brandSlug: string;
    roleInBrand: string;
    permissions: string[];
  };

  type ProgramAssignmentSeed = {
    brandSlug: string;
    roleInProgram: string;
    permissions: string[];
  };

  type AdminSeed = {
    email: string;
    name: string;
    role: string;
    primaryBrandSlug: string;
    level: number;
    canManageAdmins: boolean;
    canAssignRoles: boolean;
    customPermissions?: string[];
    brandAssignments?: BrandAssignmentSeed[];
    programAssignments?: ProgramAssignmentSeed[];
  };

  const admins: AdminSeed[] = [
    // Platform-level super admin — full access across all brands and platform config
    {
      email: 'super@ybbhub.com',
      name: 'YBB Super Admin',
      role: 'Super Admin',
      primaryBrandSlug: BRANDS.CYS,
      level: 999,
      canManageAdmins: true,
      canAssignRoles: true,
      customPermissions: ['*'],
      brandAssignments: [
        {
          brandSlug: BRANDS.CYS,
          roleInBrand: 'owner',
          permissions: ['*', 'platform.manage', 'admin.manage'],
        },
      ],
      programAssignments: [
        {
          brandSlug: BRANDS.CYS,
          roleInProgram: 'owner',
          permissions: ['*'],
        },
      ],
    },
    // CYS brand super admin — full CYS management, no platform-level access
    {
      email: 'super@chinayouthsummit.com',
      name: 'CYS Super Admin',
      role: 'Admin',
      primaryBrandSlug: BRANDS.CYS,
      level: 800,
      canManageAdmins: true,
      canAssignRoles: true,
      customPermissions: [
        'brand.manage', 'admin.manage',
        'program:read', 'program:write',
        'applications:read', 'applications:write',
        'participants:read', 'participants:write',
        'payments:read', 'payments:write',
        'content:write',
      ],
      brandAssignments: [
        {
          brandSlug: BRANDS.CYS,
          roleInBrand: 'owner',
          permissions: ['brand.manage', 'admin.manage', 'program:read', 'program:write', 'content:write'],
        },
      ],
      programAssignments: [
        {
          brandSlug: BRANDS.CYS,
          roleInProgram: 'owner',
          permissions: [
            'program:read', 'program:write',
            'applications:read', 'applications:write',
            'participants:read', 'participants:write',
            'payments:read', 'payments:write',
            'content:write',
          ],
        },
      ],
    },
    // CYS program admin — scoped to program operations, limited dashboard access
    {
      email: 'admin@chinayouthsummit.com',
      name: 'CYS Program Admin',
      role: 'Program Admin',
      primaryBrandSlug: BRANDS.CYS,
      level: 3,
      canManageAdmins: false,
      canAssignRoles: false,
      programAssignments: [
        {
          brandSlug: BRANDS.CYS,
          roleInProgram: 'program_admin',
          permissions: [
            'program:read',
            'applications:read', 'applications:write',
            'participants:read',
            'payments:read',
          ],
        },
      ],
    },
  ];

  for (const adminData of admins) {
    const role = await prisma.adminRole.findUnique({ where: { name: adminData.role } });
    if (!role) {
      log(`⚠️ Role ${adminData.role} not found, skipping ${adminData.email}`);
      continue;
    }

    const primaryBrand = brandBySlug.get(adminData.primaryBrandSlug);
    if (!primaryBrand) {
      log(`⚠️ Primary brand ${adminData.primaryBrandSlug} not found, skipping ${adminData.email}`);
      continue;
    }

    const user = await prisma.user.upsert({
      where: {
        email_brandId: { email: adminData.email, brandId: primaryBrand.id },
      },
      update: {
        passwordHash,
        isActive: true,
        emailVerified: true,
      },
      create: {
        email: adminData.email,
        brandId: primaryBrand.id,
        passwordHash,
        emailVerified: true,
        isActive: true,
      },
    });

    const admin = await prisma.admin.upsert({
      where: { userId: user.id },
      update: {
        fullName: adminData.name,
        roleId: role.id,
        accessLevel: adminData.level,
        canManageAdmins: adminData.canManageAdmins,
        canAssignRoles: adminData.canAssignRoles,
        customPermissions: adminData.customPermissions || [],
        activatedAt: new Date(),
        deactivatedAt: null,
        deletedAt: null,
      },
      create: {
        userId: user.id,
        fullName: adminData.name,
        roleId: role.id,
        accessLevel: adminData.level,
        canManageAdmins: adminData.canManageAdmins,
        canAssignRoles: adminData.canAssignRoles,
        customPermissions: adminData.customPermissions || [],
        activatedAt: new Date(),
      },
    });

    const brandAssignments = (adminData.brandAssignments || [])
      .map((assignment) => {
        const brand = brandBySlug.get(assignment.brandSlug);
        if (!brand) {
          log(`⚠️ Brand assignment ${assignment.brandSlug} not found for ${adminData.email}`);
          return null;
        }

        return {
          adminId: admin.id,
          brandId: brand.id,
          roleInBrand: assignment.roleInBrand,
          permissions: assignment.permissions,
        };
      })
      .filter((assignment): assignment is NonNullable<typeof assignment> => Boolean(assignment));

    for (const assignment of brandAssignments) {
      await prisma.adminBrand.upsert({
        where: { adminId_brandId: { adminId: assignment.adminId, brandId: assignment.brandId } },
        update: { roleInBrand: assignment.roleInBrand, permissions: assignment.permissions },
        create: assignment,
      });
    }

    const programAssignments = (adminData.programAssignments || [])
      .map((assignment) => {
        const program = programByBrandSlug.get(assignment.brandSlug);
        if (!program) {
          log(`⚠️ Active program for ${assignment.brandSlug} not found for ${adminData.email}`);
          return null;
        }

        return {
          adminId: admin.id,
          programId: program.id,
          roleInProgram: assignment.roleInProgram,
          permissions: assignment.permissions,
        };
      })
      .filter((assignment): assignment is NonNullable<typeof assignment> => Boolean(assignment));

    for (const assignment of programAssignments) {
      await prisma.adminProgram.upsert({
        where: { adminId_programId: { adminId: assignment.adminId, programId: assignment.programId } },
        update: { roleInProgram: assignment.roleInProgram, permissions: assignment.permissions },
        create: assignment,
      });
    }
  }

  log('✅ Admins seeded (Password: admin123)');
}

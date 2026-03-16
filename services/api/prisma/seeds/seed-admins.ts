import { prisma, log, error } from './utils';
import { BRANDS } from './seed-brands';
import * as bcrypt from 'bcrypt';

export async function seedAdmins() {
  log('🌱 Seeding Admins...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  const brandSlugs = [BRANDS.IYS, BRANDS.JYS, BRANDS.CYS] as const;
  const brands = await prisma.brand.findMany({
    where: { slug: { in: [...brandSlugs] } },
  });

  const brandBySlug = new Map(brands.map((brand) => [brand.slug, brand]));

  for (const slug of brandSlugs) {
    if (!brandBySlug.has(slug)) {
      return error(`${slug} Brand not found. Cannot seed admins.`);
    }
  }

  const activePrograms = await prisma.program.findMany({
    where: {
      brandId: { in: brands.map((brand) => brand.id) },
      isActive: true,
    },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
  });

  const programByBrandSlug = new Map<string, (typeof activePrograms)[number]>();
  for (const program of activePrograms) {
    const brand = brands.find((entry) => entry.id === program.brandId);
    if (brand && !programByBrandSlug.has(brand.slug)) {
      programByBrandSlug.set(brand.slug, program);
    }
  }

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
    {
      email: 'admin@ybbhub.com',
      name: 'YBB Platform Super Admin',
      role: 'Super Admin',
      primaryBrandSlug: BRANDS.IYS,
      level: 999,
      canManageAdmins: true,
      canAssignRoles: true,
      customPermissions: ['*'],
      brandAssignments: brandSlugs.map((brandSlug) => ({
        brandSlug,
        roleInBrand: 'owner',
        permissions: ['*', 'platform.manage', 'admin.manage'],
      })),
      programAssignments: brandSlugs.map((brandSlug) => ({
        brandSlug,
        roleInProgram: 'owner',
        permissions: ['*'],
      })),
    },
    {
      email: 'platform@ybbhub.com',
      name: 'YBB Platform Admin',
      role: 'Platform Admin',
      primaryBrandSlug: BRANDS.IYS,
      level: 7,
      canManageAdmins: false,
      canAssignRoles: false,
      customPermissions: ['platform.manage', 'platform_access'],
      brandAssignments: brandSlugs.map((brandSlug) => ({
        brandSlug,
        roleInBrand: 'platform_admin',
        permissions: ['platform.manage', 'platform_access', 'brand.manage', 'program:read', 'program:write'],
      })),
    },
    {
      email: 'manager@ybbhub.com',
      name: 'IYS Program Manager',
      role: 'Program Admin',
      primaryBrandSlug: BRANDS.IYS,
      level: 3,
      canManageAdmins: false,
      canAssignRoles: false,
      programAssignments: [
        {
          brandSlug: BRANDS.IYS,
          roleInProgram: 'program_admin',
          permissions: ['program:read', 'program:write', 'applications:read', 'applications:write', 'participants:read', 'payments:read'],
        },
      ],
    },
    {
      email: 'jys.manager@ybbhub.com',
      name: 'JYS Program Manager',
      role: 'Program Admin',
      primaryBrandSlug: BRANDS.JYS,
      level: 3,
      canManageAdmins: false,
      canAssignRoles: false,
      programAssignments: [
        {
          brandSlug: BRANDS.JYS,
          roleInProgram: 'program_admin',
          permissions: ['program:read', 'program:write', 'applications:read', 'applications:write', 'participants:read', 'payments:read'],
        },
      ],
    },
    {
      email: 'editor@ybbhub.com',
      name: 'CYS Content Editor',
      role: 'Editor',
      primaryBrandSlug: BRANDS.CYS,
      level: 2,
      canManageAdmins: false,
      canAssignRoles: false,
      programAssignments: [
        {
          brandSlug: BRANDS.CYS,
          roleInProgram: 'content_editor',
          permissions: ['program:read', 'content:write'],
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

    await prisma.adminBrand.deleteMany({ where: { adminId: admin.id } });
    if (brandAssignments.length > 0) {
      await prisma.adminBrand.createMany({ data: brandAssignments });
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

    await prisma.adminProgram.deleteMany({ where: { adminId: admin.id } });
    if (programAssignments.length > 0) {
      await prisma.adminProgram.createMany({ data: programAssignments });
    }
  }

  log('✅ Admins seeded (Password: admin123)');
}

import { prisma, log, error } from './utils';
import { BRANDS } from './seed-brands';
import * as bcrypt from 'bcrypt';

export async function seedAdmins() {
  log('🌱 Seeding Admins...');

  // We attach admins to IYS brand for now as the default context
  const brand = await prisma.brand.findUnique({ where: { slug: BRANDS.IYS } });
  if (!brand) return error('IYS Brand not found. Cannot seed admins.');

  const passwordHash = await bcrypt.hash('admin123', 10);

  const admins = [
    {
      email: 'admin@ybbhub.com',
      name: 'Super Admin',
      role: 'Super Admin',
      level: 999,
      canManageAdmins: true
    },
    {
      email: 'manager@ybbhub.com',
      name: 'Program Manager',
      role: 'Admin',
      level: 500,
      canManageAdmins: false
    },
    {
      email: 'editor@ybbhub.com',
      name: 'Content Editor',
      role: 'Editor',
      level: 100,
      canManageAdmins: false
    }
  ];

  for (const adminData of admins) {
    const role = await prisma.adminRole.findUnique({ where: { name: adminData.role } });
    if (!role) {
      log(`⚠️ Role ${adminData.role} not found, skipping ${adminData.email}`);
      continue;
    }

    // 1. Create/Update User
    const user = await prisma.user.upsert({
      where: { 
        email_brandId: { email: adminData.email, brandId: brand.id } 
      },
      update: {
        passwordHash, // Reset password
        isActive: true,
        emailVerified: true
      },
      create: {
        email: adminData.email,
        brandId: brand.id,
        passwordHash,
        emailVerified: true,
        isActive: true,
      },
    });

    // 2. Create/Update Admin Profile
    await prisma.admin.upsert({
      where: { userId: user.id },
      update: {
        fullName: adminData.name,
        roleId: role.id,
        accessLevel: adminData.level,
        canManageAdmins: adminData.canManageAdmins,
        canAssignRoles: adminData.canManageAdmins
      },
      create: {
        userId: user.id,
        fullName: adminData.name,
        roleId: role.id,
        accessLevel: adminData.level,
        canManageAdmins: adminData.canManageAdmins,
        canAssignRoles: adminData.canManageAdmins
      }
    });
  }

  log('✅ Admins seeded (Password: admin123)');
}

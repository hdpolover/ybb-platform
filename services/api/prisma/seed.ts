import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Default Brand (ProgramCategory)
  const defaultBrand = await prisma.programCategory.upsert({
    where: { slug: 'ybb' },
    update: {},
    create: {
      name: 'Youth Break the Boundaries',
      slug: 'ybb',
      description: 'Youth Break the Boundaries Foundation',
      websiteUrl: 'https://youthbreaktheboundaries.com',
      contactEmail: 'admin@youthbreaktheboundaries.com',
      primaryColor: '#000000',
      isActive: true,
    },
  });
  console.log(`✅ Brand created: ${defaultBrand.name}`);

  // 2. Create Super Admin Role
  const superAdminRole = await prisma.adminRole.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      name: 'Super Admin',
      description: 'Full access to all system features',
      permissions: ['*'], // Wildcard permission
      isActive: true,
    },
  });
  console.log(`✅ Role created: ${superAdminRole.name}`);

  // 3. Create Admin User
  const adminEmail = 'admin@ybbhub.com';
  const adminPassword = 'admin123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  const adminUser = await prisma.user.upsert({
    where: {
      email_programCategoryId: {
        email: adminEmail,
        programCategoryId: defaultBrand.id,
      },
    },
    update: {},
    create: {
      email: adminEmail,
      programCategoryId: defaultBrand.id,
      passwordHash: passwordHash,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ User created: ${adminUser.email}`);

  // 4. Create Admin Profile
  const adminProfile = await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      fullName: 'Super Admin',
      roleId: superAdminRole.id,
      accessLevel: 999,
      canManageAdmins: true,
      canAssignRoles: true,
    },
  });
  console.log(`✅ Admin Profile created: ${adminProfile.fullName}`);

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

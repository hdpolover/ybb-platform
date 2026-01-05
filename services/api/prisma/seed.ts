import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // ==========================================
  // 1. Create Brands (Program Categories)
  // ==========================================

  // 1.1 YBB (Youth Break the Boundaries)
  const ybbBrand = await prisma.programCategory.upsert({
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
  console.log(`✅ Brand created/updated: ${ybbBrand.name}`);

  // 1.2 IYS (Istanbul Youth Summit)
  const iysBrand = await prisma.programCategory.upsert({
    where: { slug: 'iys' },
    update: {},
    create: {
      name: 'Istanbul Youth Summit',
      slug: 'iys',
      description: 'Istanbul Youth Summit is an international summit for youth leaders.',
      websiteUrl: 'https://istanyouthsummit.com',
      contactEmail: 'admin@istanyouthsummit.com',
      primaryColor: '#E31E24', // Example red
      isActive: true,
    },
  });
  console.log(`✅ Brand created/updated: ${iysBrand.name}`);

  // 1.3 AYIMUN (Asia Youth International Model United Nations)
  const ayimunBrand = await prisma.programCategory.upsert({
    where: { slug: 'ayimun' },
    update: {},
    create: {
      name: 'Asia Youth International Model United Nations',
      slug: 'ayimun',
      description: 'Asia Youth International Model United Nations is a platform for youth to learn about diplomacy.',
      websiteUrl: 'https://modelunitednations.org',
      contactEmail: 'admin@modelunitednations.org',
      primaryColor: '#0056B3', // Example blue
      isActive: true,
    },
  });
  console.log(`✅ Brand created/updated: ${ayimunBrand.name}`);


  // ==========================================
  // 2. Create Programs
  // ==========================================

  // 2.1 YBB Programs
  const ybbAmbassador2025 = await prisma.program.upsert({
    where: {
      programCategoryId_slug: {
        programCategoryId: ybbBrand.id,
        slug: 'ybb-ambassador-2025',
      },
    },
    update: {},
    create: {
      programCategoryId: ybbBrand.id,
      name: 'YBB Ambassador Program 2025',
      slug: 'ybb-ambassador-2025',
      description: 'Join the global movement of youth leaders.',
      shortDescription: 'Become a YBB Ambassador and lead change in your community.',
      year: 2025,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      applicationDeadline: new Date('2024-12-31'),
      location: 'Global (Online)',
      capacity: 1000,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: true,
      status: 'published',
      requireEmailVerification: true,
      allowRegistration: true,
      registrationOpenDate: new Date('2024-10-01'),
      registrationCloseDate: new Date('2024-12-31'),
    },
  });
  console.log(`✅ Program created/updated: ${ybbAmbassador2025.name}`);

  // 2.2 IYS Programs
  const iys2025 = await prisma.program.upsert({
    where: {
      programCategoryId_slug: {
        programCategoryId: iysBrand.id,
        slug: 'istanbul-youth-summit-2025',
      },
    },
    update: {},
    create: {
      programCategoryId: iysBrand.id,
      name: 'Istanbul Youth Summit 2025',
      slug: 'istanbul-youth-summit-2025',
      description: 'The 8th Istanbul Youth Summit in Turkey.',
      shortDescription: 'Gathering youth leaders in Istanbul.',
      year: 2025,
      startDate: new Date('2025-02-10'),
      endDate: new Date('2025-02-13'),
      applicationDeadline: new Date('2024-11-30'),
      location: 'Istanbul, Turkey',
      capacity: 500,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: true,
      status: 'published',
      requireEmailVerification: true,
      allowRegistration: true,
      registrationOpenDate: new Date('2024-08-01'),
      registrationCloseDate: new Date('2024-11-30'),
      requirePayment: true,
      registrationFee: 150.00,
      currency: 'USD',
    },
  });
  console.log(`✅ Program created/updated: ${iys2025.name}`);

  const iys2024 = await prisma.program.upsert({
    where: {
      programCategoryId_slug: {
        programCategoryId: iysBrand.id,
        slug: 'istanbul-youth-summit-2024',
      },
    },
    update: {},
    create: {
      programCategoryId: iysBrand.id,
      name: 'Istanbul Youth Summit 2024',
      slug: 'istanbul-youth-summit-2024',
      description: 'The 7th Istanbul Youth Summit in Turkey.',
      shortDescription: 'Past event.',
      year: 2024,
      startDate: new Date('2024-03-04'),
      endDate: new Date('2024-03-07'),
      applicationDeadline: new Date('2023-12-31'),
      location: 'Istanbul, Turkey',
      capacity: 400,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: false,
      status: 'completed',
      requireEmailVerification: true,
      allowRegistration: false,
    },
  });
  console.log(`✅ Program created/updated: ${iys2024.name}`);

  // 2.3 AYIMUN Programs
  const ayimun2025 = await prisma.program.upsert({
    where: {
      programCategoryId_slug: {
        programCategoryId: ayimunBrand.id,
        slug: 'ayimun-2025',
      },
    },
    update: {},
    create: {
      programCategoryId: ayimunBrand.id,
      name: 'Asia Youth International MUN 2025',
      slug: 'ayimun-2025',
      description: 'Model United Nations conference in Malaysia.',
      shortDescription: 'Experience diplomacy in action.',
      year: 2025,
      startDate: new Date('2025-05-15'),
      endDate: new Date('2025-05-18'),
      applicationDeadline: new Date('2025-03-31'),
      location: 'Kuala Lumpur, Malaysia',
      capacity: 600,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: true,
      status: 'published',
      requireEmailVerification: true,
      allowRegistration: true,
      registrationOpenDate: new Date('2024-12-01'),
      registrationCloseDate: new Date('2025-03-31'),
      requirePayment: true,
      registrationFee: 200.00,
      currency: 'USD',
    },
  });
  console.log(`✅ Program created/updated: ${ayimun2025.name}`);


  // ==========================================
  // 3. Create Super Admin Role
  // ==========================================
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

  // ==========================================
  // 4. Create Admin User (Linked to YBB Brand)
  // ==========================================
  const adminEmail = 'admin@ybbhub.com';
  const adminPassword = 'admin123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  const adminUser = await prisma.user.upsert({
    where: {
      email_programCategoryId: {
        email: adminEmail,
        programCategoryId: ybbBrand.id,
      },
    },
    update: {},
    create: {
      email: adminEmail,
      programCategoryId: ybbBrand.id,
      passwordHash: passwordHash,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ User created: ${adminUser.email}`);

  // ==========================================
  // 5. Create Admin Profile
  // ==========================================
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

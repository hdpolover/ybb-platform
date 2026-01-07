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
  // 1b. Create Brand Settings
  // ==========================================
  
  // YBB Settings
  await prisma.programCategorySetting.upsert({
    where: { programCategoryId: ybbBrand.id },
    update: {},
    create: {
      programCategoryId: ybbBrand.id,
      isMaintenanceMode: false,
      usdInIdr: 16000,
      footerNavigation: [
        {
          title: "Programs",
          items: [
            { label: "YBB Ambassador 2025", url: "/programs/ybb-ambassador-2025" },
            { label: "Istanbul Youth Summit", url: "https://istanyouthsummit.com" }
          ]
        },
        {
          title: "About",
          items: [
            { label: "About Us", url: "/about" },
            { label: "Contact", url: "/contact" }
          ]
        },
        {
            title: "Legal",
            items: [
                { label: "Privacy Policy", url: "/privacy" },
                { label: "Terms of Service", url: "/terms" }
            ]
        }
      ]
    }
  });
  console.log(`✅ Settings created for: ${ybbBrand.name}`);

  // IYS Settings
  await prisma.programCategorySetting.upsert({
    where: { programCategoryId: iysBrand.id },
    update: {},
    create: {
      programCategoryId: iysBrand.id,
      isMaintenanceMode: false,
      usdInIdr: 16100,
      footerNavigation: [
        {
          title: "Quick Links",
          items: [
            { label: "Home", url: "/" },
            { label: "Programs", url: "/programs" }
          ]
        },
        {
            title: "Support",
            items: [
                { label: "FAQ", url: "/faq" },
                { label: "Contact Support", url: "/support" }
            ]
        }
      ]
    }
  });
  console.log(`✅ Settings created for: ${iysBrand.name}`);

  // AYIMUN Settings
  await prisma.programCategorySetting.upsert({
    where: { programCategoryId: ayimunBrand.id },
    update: {},
    create: {
      programCategoryId: ayimunBrand.id,
      isMaintenanceMode: false,
      usdInIdr: 16050,
      footerNavigation: [
        {
            title: "Navigation",
            items: [
                { label: "Home", url: "/" },
                { label: "Register", url: "/register" }
            ]
        }
      ]
    }
  });
  console.log(`✅ Settings created for: ${ayimunBrand.name}`);


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

  // ==========================================
  // 6. Create Social Feeds (Instagram Sync)
  // ==========================================

  // 6.1 YBB Social Feed
  const ybbSocialFeeds = [
    {
      postId: 'C1a2b3c4d5',
      imageUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800',
      permalink: 'https://instagram.com/p/C1a2b3c4d5',
      caption: 'Join us for the next global leader summit! #YBB #YouthLeadership',
      postedAt: new Date('2025-01-05T10:00:00Z'),
    },
    {
      postId: 'E6f7g8h9i0',
      imageUrl: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800',
      permalink: 'https://instagram.com/p/E6f7g8h9i0',
      caption: 'Throwback to our amazing workshop in Bali. 🌴 #YBB #Education',
      postedAt: new Date('2025-01-03T15:30:00Z'),
    },
    {
      postId: 'J1k2l3m4n5',
      imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800',
      permalink: 'https://instagram.com/p/J1k2l3m4n5',
      caption: 'Meet our inspiring alumni from 2024. ✨ #YBBAlumni',
      postedAt: new Date('2024-12-28T09:15:00Z'),
    },
  ];

  for (const feed of ybbSocialFeeds) {
    await prisma.programSocialFeed.create({
      data: {
        programCategoryId: ybbBrand.id,
        platform: 'instagram',
        postId: feed.postId,
        imageUrl: feed.imageUrl,
        permalink: feed.permalink,
        caption: feed.caption,
        postedAt: feed.postedAt,
        isActive: true,
      },
    });
  }
  console.log(`✅ Social Feeds created for: ${ybbBrand.name}`);

  // 6.2 IYS Social Feed
  const iysSocialFeeds = [
    {
      postId: 'IYS_P1',
      imageUrl: 'https://images.unsplash.com/photo-1544531586-fde5298cdd40?w=800',
      permalink: 'https://instagram.com/p/IYS_P1',
      caption: 'Registration for IYS 2025 is now OPEN! 🇹🇷 #IYS2025 #Istanbul',
      postedAt: new Date('2025-01-01T08:00:00Z'),
    },
    {
      postId: 'IYS_P2',
      imageUrl: 'https://images.unsplash.com/photo-1527296556488-8255074ec644?w=800',
      permalink: 'https://instagram.com/p/IYS_P2',
      caption: 'Discover the beauty of Turkey while learning leadership. 🕌',
      postedAt: new Date('2024-12-25T12:00:00Z'),
    }
  ];

  for (const feed of iysSocialFeeds) {
    await prisma.programSocialFeed.create({
      data: {
        programCategoryId: iysBrand.id,
        platform: 'instagram',
        postId: feed.postId,
        imageUrl: feed.imageUrl,
        permalink: feed.permalink,
        caption: feed.caption,
        postedAt: feed.postedAt,
        isActive: true,
      },
    });
  }
  console.log(`✅ Social Feeds created for: ${iysBrand.name}`);

  // ==========================================
  // 7. Create Program Resources (Guidelines)
  // ==========================================

  // 7.1 YBB Ambassador 2025 Guidelines
  const ybbGuide = await prisma.programResource.create({
    data: {
      programId: ybbAmbassador2025.id,
      title: 'YBB Ambassador 2025 Guidelines',
      description: 'Complete guide for the ambassador program including roles, responsibilities, and benefits.',
      fileUrl: 'https://cdn.youthbreaktheboundaries.com/guidelines/ybb-ambassador-2025-guide.pdf',
      fileType: 'pdf',
      type: 'guide',
      isPublic: true,
      isActive: true,
      order: 1
    }
  });
  console.log(`✅ Guidelines created for: ${ybbAmbassador2025.name}`);

  // 7.2 IYS 2025 Guidelines
  const iysGuide = await prisma.programResource.create({
    data: {
      programId: iys2025.id,
      title: 'Istanbul Youth Summit 2025 Guidelines',
      description: 'Everything you need to know about IYS 2025.',
      fileUrl: 'https://cdn.youthbreaktheboundaries.com/guidelines/iys-2025-guide.pdf',
      fileType: 'pdf',
      type: 'guide',
      isPublic: true,
      isActive: true,
      order: 1
    }
  });
  console.log(`✅ Guidelines created for: ${iys2025.name}`);

  // ==========================================
  // 8. Create Video Gallery (Highlights)
  // ==========================================

  // 8.1 IYS 2025 Videos (Using placeholders since it's future/current)
  // Assuming these are promo videos or similar
  await prisma.programGallery.create({
    data: {
      programId: iys2025.id,
      type: 'video',
      imageUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'OFFICIAL AFTER MOVIE OF ISTANBUL YOUTH SUMMIT 2025',
      description: 'IYS 2025 • Highlight video',
      order: 1,
      isActive: true
    }
  });
  await prisma.programGallery.create({
    data: {
      programId: iys2025.id,
      type: 'video',
      imageUrl: 'https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
      videoUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      title: 'OFFICIAL WELCOMING VIDEO OF ISTANBUL YOUTH SUMMIT 2025',
      description: 'IYS 2025 • Cultural experience',
      order: 2,
      isActive: true
    }
  });
  console.log(`✅ Videos created for: ${iys2025.name}`);

  // 8.2 IYS 2024 Videos (Past event)
  await prisma.programGallery.create({
    data: {
      programId: iys2024.id,
      type: 'video',
      imageUrl: 'https://img.youtube.com/vi/3jumL123/maxresdefault.jpg',
      videoUrl: 'https://www.youtube.com/watch?v=3jumL123',
      title: 'OFFICIAL AFTER MOVIE OF ISTANBUL YOUTH SUMMIT 2024',
      description: 'IYS 2024 • Highlight video',
      order: 1,
      isActive: true
    }
  });
   await prisma.programGallery.create({
    data: {
      programId: iys2024.id,
      type: 'video',
      imageUrl: 'https://img.youtube.com/vi/4xyz5678/maxresdefault.jpg',
      videoUrl: 'https://www.youtube.com/watch?v=4xyz5678',
      title: 'Closing Ceremony Highlights 2024',
      description: 'IYS 2024 • Ceremony',
      order: 2,
      isActive: true
    }
  });
  console.log(`✅ Videos created for: ${iys2024.name}`);

  // ==========================================
  // 9. Create Alumni Stories (Testimonials)
  // ==========================================
  
  // 9.1 IYS Alumni Video (Featured)
  await prisma.programTestimonial.create({
    data: {
      programCategoryId: iysBrand.id,
      programId: iys2025.id, // Associated with specific program year
      name: 'Te Aroha',
      role: 'Participant from New Zealand',
      company: 'Japan Youth Summit Alumni',
      testimonial: 'Testimonials from Te Aroha - New Zealand for Japan Youth Summit 2025 in Osaka',
      category: 'alumni',
      type: 'video',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Dummy
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      isFeatured: true,
      isActive: true,
      order: 1
    }
  });

  // 9.2 IYS Alumni Video (Regular)
  await prisma.programTestimonial.create({
    data: {
      programCategoryId: iysBrand.id,
      programId: iys2024.id,
      name: 'Sarah Johnson',
      role: 'Delegate from UK',
      company: 'Future Leader',
      testimonial: 'An unforgettable experience!',
      category: 'alumni',
      type: 'video',
      videoUrl: 'https://www.youtube.com/watch?v=3jumL123',
      thumbnailUrl: 'https://img.youtube.com/vi/3jumL123/maxresdefault.jpg',
      isFeatured: false,
      isActive: true,
      order: 2
    }
  });

  console.log(`✅ Testimonials created for: ${iysBrand.name}`);

  // ==========================================
  // 10. Create Program Awards (For JYS/IYS)
  // ==========================================
  
  // Best Innovation Award
  await prisma.programAward.create({
    data: {
      programId: iys2025.id,
      name: 'Best Innovation Award',
      description: 'Honoring breakthrough ideas with real-world impact',
      winnerCount: 3,
      tags: ['IYS', 'INDIVIDUAL', 'STAGE'],
      color: '#E91E63', // Pink
      order: 1,
      isActive: true
    }
  });

  // Best Presenter
  await prisma.programAward.create({
    data: {
      programId: iys2025.id,
      name: 'Best Presenter',
      description: 'Outstanding delivery, clarity, and audience engagement',
      winnerCount: 2,
      tags: ['IYS', 'INDIVIDUAL', 'STAGE'],
      color: '#FFC107', // Amber/Yellow
      order: 2,
      isActive: true
    }
  });

  // Best Participant
  await prisma.programAward.create({
    data: {
      programId: iys2025.id,
      name: 'Best Participant',
      description: 'Active contributors with exemplary attitude and consistency',
      winnerCount: 2,
      tags: ['IYS', 'INDIVIDUAL'],
      color: '#2196F3', // Blue
      order: 3,
      isActive: true
    }
  });

  // Best Group
  await prisma.programAward.create({
    data: {
      programId: iys2025.id,
      name: 'Best Group',
      description: 'Teamwork, synergy, and collaborative problem-solving',
      winnerCount: 2,
      tags: ['IYS', 'TEAM', 'COLLABORATION'],
      color: '#4CAF50', // Green
      order: 4,
      isActive: true
    }
  });

  // Best Leader
  await prisma.programAward.create({
    data: {
      programId: iys2025.id,
      name: 'Best Leader',
      description: 'Inspiring leadership and decision-making under pressure',
      winnerCount: 1,
      tags: ['IYS', 'INDIVIDUAL', 'LEADERSHIP'],
      color: '#673AB7', // Purple
      order: 5,
      isActive: true
    }
  });

  // Best Content Creator
  await prisma.programAward.create({
    data: {
      programId: iys2025.id,
      name: 'Best Content Creator',
      description: 'Creative storytelling through engaging digital content',
      winnerCount: 1,
      tags: ['IYS', 'INDIVIDUAL', 'DIGITAL'],
      color: '#E91E63', // Red/Pink
      order: 6,
      isActive: true
    }
  });

  console.log(`✅ Awards created for: ${iys2025.name}`);

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

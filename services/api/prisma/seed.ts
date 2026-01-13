import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // ==========================================
  // 0. Create Auth Providers
  // ==========================================
  const localProvider = await prisma.authProvider.upsert({
    where: { name: 'local' },
    update: {},
    create: {
      name: 'local',
      displayName: 'Email & Password',
      description: 'Traditional email and password authentication',
      isActive: true,
      isOAuth: false,
      icon: 'email',
      buttonColor: '#4A5568',
      order: 1,
    },
  });
  console.log(`✅ Auth Provider created: ${localProvider.displayName}`);

  const googleProvider = await prisma.authProvider.upsert({
    where: { name: 'google' },
    update: {},
    create: {
      name: 'google',
      displayName: 'Google',
      description: 'Sign in with Google account',
      isActive: true,
      isOAuth: true,
      icon: 'google',
      buttonColor: '#4285F4',
      order: 2,
      scopes: ['email', 'profile'],
      // Note: clientId and clientSecret should be set via environment variables
    },
  });
  console.log(`✅ Auth Provider created: ${googleProvider.displayName}`);

  const facebookProvider = await prisma.authProvider.upsert({
    where: { name: 'facebook' },
    update: {},
    create: {
      name: 'facebook',
      displayName: 'Facebook',
      description: 'Sign in with Facebook account',
      isActive: true,
      isOAuth: true,
      icon: 'facebook',
      buttonColor: '#1877F2',
      order: 3,
      scopes: ['email', 'public_profile'],
    },
  });
  console.log(`✅ Auth Provider created: ${facebookProvider.displayName}`);

  const appleProvider = await prisma.authProvider.upsert({
    where: { name: 'apple' },
    update: {},
    create: {
      name: 'apple',
      displayName: 'Apple',
      description: 'Sign in with Apple account',
      isActive: true,
      isOAuth: true,
      icon: 'apple',
      buttonColor: '#000000',
      order: 4,
      scopes: ['email', 'name'],
    },
  });
  console.log(`✅ Auth Provider created: ${appleProvider.displayName}`);

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

  // 1.3 Youth Academic Forum
  const yafBrand = await prisma.programCategory.upsert({
    where: { slug: 'youth-academic-forum' },
    update: {},
    create: {
      name: 'Youth Academic Forum',
      slug: 'youth-academic-forum',
      description: 'Youth Academic Forum is a platform for youth to share their academic work.',
      websiteUrl: 'https://youthacademicforum.com',
      contactEmail: 'admin@youthacademicforum.com',
      primaryColor: '#0056B3', // Example blue
      isActive: true,
    },
  });
  console.log(`✅ Brand created/updated: ${yafBrand.name}`);

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

  // YAF Settings
  await prisma.programCategorySetting.upsert({
    where: { programCategoryId: yafBrand.id },
    update: {},
    create: {
      programCategoryId: yafBrand.id,
      isMaintenanceMode: false,
      usdInIdr: 16050,
      footerNavigation: [
        {
            title: "Navigation",
            items: [
                { label: "Home", url: "/" },
                { label: "Programs", url: "/programs" }
            ]
        }
      ]
    }
  });
  console.log(`✅ Settings created for: ${yafBrand.name}`);


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

  // 2.3 YAF Programs
  const yaf2025 = await prisma.program.upsert({
    where: {
      programCategoryId_slug: {
        programCategoryId: yafBrand.id,
        slug: 'youth-academic-forum-2025',
      },
    },
    update: {},
    create: {
      programCategoryId: yafBrand.id,
      name: 'Youth Academic Forum 2025',
      slug: 'youth-academic-forum-2025',
      description: 'International academic forum for youth.',
      shortDescription: 'Share your research and ideas.',
      year: 2025,
      startDate: new Date('2025-05-15'),
      endDate: new Date('2025-05-18'),
      applicationDeadline: new Date('2025-03-31'),
      location: 'Global (Online)',
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
      registrationFee: 50.00,
      currency: 'USD',
    },
  });
  console.log(`✅ Program created/updated: ${yaf2025.name}`);


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

  // ==========================================
  // 11. Create Program Pricing Tiers
  // ==========================================
  
  // IYS 2025 Pricing
  await prisma.programPricingTier.create({
    data: {
      programId: iys2025.id,
      name: 'Early Bird - International',
      description: 'Special price for early registrants from outside Turkey',
      price: 450.00,
      currency: 'USD',
      capacity: 100,
      feeType: 'full_fee',
      target: 'self_funded',
      benefits: ['Access to all sessions', 'Accommodation (3 nights)', 'Meals', 'Certificate', 'Airport Transfer'],
      isActive: true,
      order: 1
    }
  });

  await prisma.programPricingTier.create({
    data: {
      programId: iys2025.id,
      name: 'Regular - International',
      description: 'Regular price for international participants',
      price: 550.00,
      currency: 'USD',
      capacity: 200,
      feeType: 'full_fee',
      target: 'self_funded',
      benefits: ['Access to all sessions', 'Accommodation (3 nights)', 'Meals', 'Certificate', 'Airport Transfer'],
      isActive: true,
      order: 2
    }
  });

  console.log(`✅ Pricing Tiers created for: ${iys2025.name}`);

  // ==========================================
  // 12. Create Sponsors & Partners
  // ==========================================

  // IYS Sponsors
  await prisma.sponsor.create({
    data: {
      programCategoryId: iysBrand.id,
      name: 'Turkish Airlines',
      type: 'corporate',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Turkish_Airlines_logo_2010.svg/2560px-Turkish_Airlines_logo_2010.svg.png',
      websiteUrl: 'https://www.turkishairlines.com',
      tier: 'platinum',
      isActive: true,
      order: 1
    }
  });

  await prisma.sponsor.create({
    data: {
      programCategoryId: iysBrand.id,
      name: 'Ministry of Youth and Sports',
      type: 'government', 
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Ministry_of_Youth_and_Sports_%28Turkey%29.svg',
      websiteUrl: 'https://gsb.gov.tr',
      tier: 'gold',
      isActive: true,
      order: 2
    }
  });
  console.log(`✅ Sponsors created for: ${iysBrand.name}`);

  // ==========================================
  // 13. Create Program Speakers
  // ==========================================

  await prisma.programSpeaker.create({
    data: {
      programId: iys2025.id,
      name: 'John Doe',
      title: 'CEO',
      organization: 'Tech Innovations Inc.',
      bio: 'Visionary leader with 20 years of experience in technology.',
      photoUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
      isActive: true,
      order: 1
    }
  });

   await prisma.programSpeaker.create({
    data: {
      programId: iys2025.id,
      name: 'Jane Smith',
      title: 'Founder',
      organization: 'Green Earth NGO',
      bio: 'Environmental activist and social entrepreneur.',
      photoUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
      isActive: true,
      order: 2
    }
  });
  console.log(`✅ Speakers created for: ${iys2025.name}`);

  // ==========================================
  // 14. Create Program Timeline
  // ==========================================

  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Registration Opens',
      date: new Date('2024-08-01'),
      description: 'Start submitting your applications.',
      order: 1,
      isActive: true
    }
  });

  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Registration Closes',
      date: new Date('2024-11-30'), 
      description: 'Last day to submit applications.',
      order: 2,
      isActive: true
    }
  });

  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Announcement of Delegates',
      date: new Date('2024-12-15'),
      description: 'Selected participants will be notified via email.',
      order: 3,
      isActive: true
    }
  });

   await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Summit Day',
      date: new Date('2025-02-10'),
      description: 'Welcome to Istanbul!',
      order: 4,
      isActive: true
    }
  });
  console.log(`✅ Timeline created for: ${iys2025.name}`);

  // ==========================================
  // 15. Create Program FAQs
  // ==========================================

  const faqs = [
    {
        question: "Is this program fully funded?",
        answer: "There are fully funded, partial funded, and self-funded categories available.",
        category: "general" as const
    },
    {
        question: "Do I need a visa to enter Turkey?",
        answer: "It depends on your nationality. Please check with the Turkish embassy in your country or the e-visa website.",
        category: "visa" as const
    },
    {
        question: "Is there an age limit?",
        answer: "Yes, the program is open for youth aged 17-35 years old.",
        category: "registration" as const
    }
  ];

  for (const f of faqs) {
    await prisma.programFaq.create({
        data: {
            programId: iys2025.id,
            question: f.question,
            answer: f.answer,
            category: f.category,
            isActive: true
        }
    });
  }
  console.log(`✅ FAQs created for: ${iys2025.name}`);

  // ==========================================
  // 16. Create Program Schedule
  // ==========================================
  
  await prisma.programSchedule.create({
    data: {
        programId: iys2025.id,
        day: 'Day 1',
        startTime: '09:00',
        endTime: '12:00',
        activity: 'Opening Ceremony',
        description: 'Keynote speeches and cultural performances.',
        location: 'Main Hall',
        order: 1,
        isActive: true
    }
  });

  await prisma.programSchedule.create({
    data: {
        programId: iys2025.id,
        day: 'Day 1',
        startTime: '13:00',
        endTime: '15:00',
        activity: 'Panel Discussion: Future Leaders',
        description: 'Discussion with industry experts.',
        location: 'Main Hall',
        order: 2,
        isActive: true
    }
  });
  
  await prisma.programSchedule.create({
    data: {
        programId: iys2025.id,
        day: 'Day 2',
        startTime: '09:00',
        endTime: '17:00',
        activity: 'Project Presentations',
        description: 'Delegates present their social projects.',
        location: 'Meeting Rooms',
        order: 3,
        isActive: true
    }
  });
  console.log(`✅ Schedule created for: ${iys2025.name}`);

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

import { PrismaClient, ApplicationCategory } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

// -------------------------------------------------------------
// Fix for Prisma 7 + Postgres Adapter in Seed Script
// -------------------------------------------------------------
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
// -------------------------------------------------------------

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
    update: {
      about: "Youth Break the Boundaries Foundation (YBB) is a non-profit organization that focuses on youth development and empowerment. We believe that young people are the key to a better future, and we are dedicated to providing them with the tools, resources, and opportunities they need to succeed.",
      vision: "To create a generation of young leaders who are capable of making a positive impact on the world.",
      mission: "To empower youth through education, leadership development, and community engagement programs.",
      logoUrl: "https://placehold.co/400x100/EEE/31343C?text=YBB+Logo",
      bannerUrl: "https://placehold.co/1200x400/000/FFF?text=YBB+Banner",
      contactPhone: '+6285173386622',
      contactWhatsapp: '+6285173386622',
      contactAddress: 'Ngaglik, Sleman, Yogyakarta, Indonesia',
      socialMediaLinks: {
        instagram: 'https://instagram.com/youthbreaktheboundaries',
        tiktok: 'https://tiktok.com/@youthbreaktheboundaries',
        youtube: 'https://youtube.com/youthbreaktheboundaries',
        telegram: 'https://t.me/youthbreaktheboundaries',
        email: 'mailto:admin@youthbreaktheboundaries.com'
      },
    },
    create: {
      name: 'Youth Break the Boundaries',
      slug: 'ybb',
      description: 'Youth Break the Boundaries Foundation',
      websiteUrl: 'https://youthbreaktheboundaries.com',
      contactEmail: 'admin@youthbreaktheboundaries.com',
      primaryColor: '#000000',
      isActive: true,
      about: "Youth Break the Boundaries Foundation (YBB) is a non-profit organization that focuses on youth development and empowerment. We believe that young people are the key to a better future, and we are dedicated to providing them with the tools, resources, and opportunities they need to succeed.",
      vision: "To create a generation of young leaders who are capable of making a positive impact on the world.",
      mission: "To empower youth through education, leadership development, and community engagement programs.",
      logoUrl: "https://placehold.co/400x100/EEE/31343C?text=YBB+Logo",
      bannerUrl: "https://placehold.co/1200x400/000/FFF?text=YBB+Banner",
      contactPhone: '+6285173386622',
      contactWhatsapp: '+6285173386622',
      contactAddress: 'Ngaglik, Sleman, Yogyakarta, Indonesia',
      socialMediaLinks: {
        instagram: 'https://instagram.com/youthbreaktheboundaries',
        tiktok: 'https://tiktok.com/@youthbreaktheboundaries',
        youtube: 'https://youtube.com/youthbreaktheboundaries',
        telegram: 'https://t.me/youthbreaktheboundaries',
        email: 'mailto:admin@youthbreaktheboundaries.com'
      },
    },
  });
  console.log(`✅ Brand created/updated: ${ybbBrand.name}`);

  // 1.2 IYS (Istanbul Youth Summit)
  const iysBrand = await prisma.programCategory.upsert({
    where: { slug: 'iys' },
    update: {
      about: "Istanbul Youth Summit (IYS) is an international summit that brings together young leaders from around the world to discuss and find solutions to global challenges. Since its inception, IYS has been a platform for youth to share ideas, collaborate on projects, and build a network of change-makers.",
      vision: "To be the premier global platform for youth dialogue and action on sustainable development goals.",
      mission: "To foster cross-cultural understanding and empower youth to take leadership roles in their communities.",
      logoUrl: "https://placehold.co/400x100/E31E24/FFF?text=IYS+Logo",
      bannerUrl: "https://placehold.co/1200x400/E31E24/FFF?text=IYS+Banner",
      websiteUrl: 'https://istanbulyouthsummit.com',
      contactEmail: 'admin@istanbulyouthsummit.com',
      contactPhone: '+6285173386622',
      contactWhatsapp: '+6285173386622',
      contactAddress: 'Ngaglik, Sleman, Yogyakarta, Indonesia',
      socialMediaLinks: {
        instagram: 'https://instagram.com/istanbulyouthsummit',
        tiktok: 'https://tiktok.com/@istanbulyouthsummit',
        youtube: 'https://youtube.com/istanbulyouthsummit',
        telegram: 'https://t.me/istanbulyouthsummit',
        email: 'mailto:admin@istanbulyouthsummit.com'
      },
    },
    create: {
      name: 'Istanbul Youth Summit',
      slug: 'iys',
      description: 'Istanbul Youth Summit is an international summit for youth leaders.',
      websiteUrl: 'https://istanbulyouthsummit.com',
      contactEmail: 'admin@istanbulyouthsummit.com',
      primaryColor: '#E31E24', // Example red
      isActive: true,
      about: "Istanbul Youth Summit (IYS) is an international summit that brings together young leaders from around the world to discuss and find solutions to global challenges. Since its inception, IYS has been a platform for youth to share ideas, collaborate on projects, and build a network of change-makers.",
      vision: "To be the premier global platform for youth dialogue and action on sustainable development goals.",
      mission: "To foster cross-cultural understanding and empower youth to take leadership roles in their communities.",
      logoUrl: "https://placehold.co/400x100/E31E24/FFF?text=IYS+Logo",
      bannerUrl: "https://placehold.co/1200x400/E31E24/FFF?text=IYS+Banner",
      contactPhone: '+6285173386622',
      contactWhatsapp: '+6285173386622',
      contactAddress: 'Ngaglik, Sleman, Yogyakarta, Indonesia',
      socialMediaLinks: {
        instagram: 'https://instagram.com/istanbulyouthsummit',
        tiktok: 'https://tiktok.com/@istanbulyouthsummit',
        youtube: 'https://youtube.com/istanbulyouthsummit',
        telegram: 'https://t.me/istanbulyouthsummit',
        email: 'mailto:admin@istanbulyouthsummit.com'
      },
    },
  });
  console.log(`✅ Brand created/updated: ${iysBrand.name}`);

  // 1.3 Youth Academic Forum
  const yafBrand = await prisma.programCategory.upsert({
    where: { slug: 'youth-academic-forum' },
    update: {
       about: "Youth Academic Forum (YAF) is a dedicated platform for young scholars, researchers, and students to present their academic work and engage in intellectual discourse. YAF aims to bridge the gap between academic research and practical application.",
       vision: "To cultivate a culture of academic excellence and critical thinking among youth.",
       mission: "To provide a supportive environment for young academics to share their research, receive feedback, and collaborate.",
       logoUrl: "https://placehold.co/400x100/0056B3/FFF?text=YAF+Logo",
       bannerUrl: "https://placehold.co/1200x400/0056B3/FFF?text=YAF+Banner",
    },
    create: {
      name: 'Youth Academic Forum',
      slug: 'youth-academic-forum',
      description: 'Youth Academic Forum is a platform for youth to share their academic work.',
      websiteUrl: 'https://youthacademicforum.com',
      contactEmail: 'admin@youthacademicforum.com',
      primaryColor: '#0056B3', // Example blue
      isActive: true,
      about: "Youth Academic Forum (YAF) is a dedicated platform for young scholars, researchers, and students to present their academic work and engage in intellectual discourse. YAF aims to bridge the gap between academic research and practical application.",
      vision: "To cultivate a culture of academic excellence and critical thinking among youth.",
      mission: "To provide a supportive environment for young academics to share their research, receive feedback, and collaborate.",
      logoUrl: "https://placehold.co/400x100/0056B3/FFF?text=YAF+Logo",
      bannerUrl: "https://placehold.co/1200x400/0056B3/FFF?text=YAF+Banner",
    },
  });
  console.log(`✅ Brand created/updated: ${yafBrand.name}`);

  // ==========================================
  // 1b. Create Brand Settings
  // ==========================================
  
  // YBB Settings
  await prisma.programCategorySetting.upsert({
    where: { programCategoryId: ybbBrand.id },
    update: {
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
        },
        {
            title: "Connect",
            items: [
                { label: "Instagram", url: "https://instagram.com/youthbreaktheboundaries" },
                { label: "TikTok", url: "https://tiktok.com/@youthbreaktheboundaries" },
                { label: "YouTube", url: "https://youtube.com/youthbreaktheboundaries" },
                { label: "Telegram", url: "https://t.me/youthbreaktheboundaries" }
            ]
        }
      ]
    },
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
        },
        {
            title: "Connect",
            items: [
                { label: "Instagram", url: "https://instagram.com/youthbreaktheboundaries" },
                { label: "TikTok", url: "https://tiktok.com/@youthbreaktheboundaries" },
                { label: "YouTube", url: "https://youtube.com/youthbreaktheboundaries" },
                { label: "Telegram", url: "https://t.me/youthbreaktheboundaries" }
            ]
        }
      ]
    }
  });
  console.log(`✅ Settings created for: ${ybbBrand.name}`);

  // IYS Settings
  await prisma.programCategorySetting.upsert({
    where: { programCategoryId: iysBrand.id },
    update: {
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
        },
        {
            title: "Connect",
            items: [
                { label: "Instagram", url: "https://instagram.com/istanbulyouthsummit" },
                { label: "TikTok", url: "https://tiktok.com/@istanbulyouthsummit" },
                { label: "YouTube", url: "https://youtube.com/istanbulyouthsummit" },
                { label: "Telegram", url: "https://t.me/istanbulyouthsummit" }
            ]
        }
      ]
    },
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
        },
        {
            title: "Connect",
            items: [
                { label: "Instagram", url: "https://instagram.com/istanbulyouthsummit" },
                { label: "TikTok", url: "https://tiktok.com/@istanbulyouthsummit" },
                { label: "YouTube", url: "https://youtube.com/istanbulyouthsummit" },
                { label: "Telegram", url: "https://t.me/istanbulyouthsummit" }
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
    update: {
      description: 'The YBB Ambassador Program 2025 is a prestigious opportunity for youth leaders worldwide to represent their countries and communities. As an ambassador, you will gain exclusive access to leadership training, networking opportunities, and the chance to drive impactful projects. This program is designed to cultivate the next generation of global changemakers who are passionate about education, social entrepreneurship, and sustainable development.',
      shortDescription: 'Become a YBB Ambassador and lead change in your community. Join a global network of young leaders committed to making a difference.',
      benefitsDescription: "- Networking with global leaders\n- Leadership training and workshops\n- Certificate of Ambassadorship\n- Exclusive access to YBB events\n- Opportunity to represent your country",
      requirementsDescription: "- Aged 17-35 years old\n- Passionate about social change\n- Good communication skills\n- Committed to the program duration",
    },
    create: {
      programCategoryId: ybbBrand.id,
      name: 'YBB Ambassador Program 2025',
      slug: 'ybb-ambassador-2025',
      description: 'The YBB Ambassador Program 2025 is a prestigious opportunity for youth leaders worldwide to represent their countries and communities. As an ambassador, you will gain exclusive access to leadership training, networking opportunities, and the chance to drive impactful projects. This program is designed to cultivate the next generation of global changemakers who are passionate about education, social entrepreneurship, and sustainable development.',
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
      benefitsDescription: "- Networking with global leaders\n- Leadership training and workshops\n- Certificate of Ambassadorship\n- Exclusive access to YBB events\n- Opportunity to represent your country",
      requirementsDescription: "- Aged 17-35 years old\n- Passionate about social change\n- Good communication skills\n- Committed to the program duration",
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
    update: {
      description: 'The 8th Istanbul Youth Summit (IYS 2025) is set to be the largest gathering of youth leaders in Turkey. Under the theme "Sustainable Leadership for a Better Future", delegates will engage in rigorous debates, workshops, and project presentations. This summit aims to equip young leaders with the skills and knowledge needed to tackle global challenges such as climate change, education inequality, and economic instability. Join us in the historic city of Istanbul for an unforgettable experience.',
      shortDescription: 'Gathering youth leaders in Istanbul for a transformative summit experience focusing on sustainable leadership.',
      benefitsDescription: "1. International Certificate\n2. Networking with 500+ leaders\n3. Cultural Exchange\n4. Mentorship from Experts\n5. Opportunity to win funding for projects",
      requirementsDescription: "1. Youth aged 17-35\n2. Open to all nationalities\n3. No criminal record\n4. Able to communicate in English",
    },
    create: {
      programCategoryId: iysBrand.id,
      name: 'Istanbul Youth Summit 2025',
      slug: 'istanbul-youth-summit-2025',
      description: 'The 8th Istanbul Youth Summit (IYS 2025) is set to be the largest gathering of youth leaders in Turkey. Under the theme "Sustainable Leadership for a Better Future", delegates will engage in rigorous debates, workshops, and project presentations. This summit aims to equip young leaders with the skills and knowledge needed to tackle global challenges such as climate change, education inequality, and economic instability. Join us in the historic city of Istanbul for an unforgettable experience.',
      shortDescription: 'Gathering youth leaders in Istanbul.',
      theme: 'Sustainable Leadership for a Better Future',
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
      benefitsDescription: "1. International Certificate\n2. Networking with 500+ leaders\n3. Cultural Exchange\n4. Mentorship from Experts\n5. Opportunity to win funding for projects",
      requirementsDescription: "1. Youth aged 17-35\n2. Open to all nationalities\n3. No criminal record\n4. Able to communicate in English",
    },
  });
  console.log(`✅ Program created/updated: ${iys2025.name}`);

  // 2.2a IYS Objectives
  const iysObjectives = [
    "Empowering youth to lead in sustainability and cultural innovation.",
    "Strengthening leadership skills and character development.",
    "Providing a platform for youth voices on global issues.",
    "Equipping participants to contribute to national and global progress.",
    "Building a global network of young leaders for ongoing collaboration, particularly among Youth Break the Boundaries alumni."
  ];

  // Clear existing objectives to avoid duplicates on re-seed (optional but good practice)
  try {
      // Logic to delete existing might count on relation cascade or just ignore for seed upsert if we used upsert
      // Simple create for now as we don't have unique constraint on description+programId
      // Ideally we should deleteMany first
      await prisma.programObjective.deleteMany({
          where: { programId: iys2025.id }
      });
      
      for (let i = 0; i < iysObjectives.length; i++) {
        await prisma.programObjective.create({
          data: {
            programId: iys2025.id,
            description: iysObjectives[i],
            order: i + 1,
            isActive: true
          }
        });
      }
      console.log(`✅ Objectives created for: ${iys2025.name}`);
  } catch (error) {
      console.log('⚠️ Could not seed objectives (Model might not exist yet if schema not pushed):', error.message);
  }

  // 2.2c IYS Subthemes
  const iysSubthemes = [
    { name: "Education", description: "Improving quality of education for future generations." },
    { name: "Health", description: "Ensuring healthy lives and well-being for all." },
    { name: "Economy", description: "Promoting inclusive and sustainable economic growth." },
    { name: "Environment", description: "Taking urgent action to combat climate change." },
    { name: "Social Policy", description: "Reducing inequality within and among countries." }
  ];

  try {
      await prisma.programSubtheme.deleteMany({
          where: { programId: iys2025.id }
      });
      
      for (const sub of iysSubthemes) {
        await prisma.programSubtheme.create({
          data: {
            programId: iys2025.id,
            name: sub.name,
            description: sub.description,
            isActive: true
          }
        });
      }
      console.log(`✅ Subthemes created for: ${iys2025.name}`);
  } catch (error) {
      console.log('⚠️ Could not seed subthemes (Model might not exist yet):', error.message);
  }

  // 2.2b YBB Ambassador Objectives
  const ybbObjectives = [
    "Represent Youth Break the Boundaries in your local community.",
    "Organize and lead social impact projects.",
    "Promote SDG awareness and implementation.",
    "Build strategic partnerships with local organizations.",
    "Facilitate knowledge sharing among youth."
  ];

  try {
      await prisma.programObjective.deleteMany({
          where: { programId: ybbAmbassador2025.id }
      });
      
      for (let i = 0; i < ybbObjectives.length; i++) {
        await prisma.programObjective.create({
          data: {
            programId: ybbAmbassador2025.id,
            description: ybbObjectives[i],
            order: i + 1,
            isActive: true
          }
        });
      }
      console.log(`✅ Objectives created for: ${ybbAmbassador2025.name}`);
  } catch (error) {
     console.log('⚠️ Could not seed YBB objectives:', error.message);
  }

  const iys2024 = await prisma.program.upsert({
    where: {
      programCategoryId_slug: {
        programCategoryId: iysBrand.id,
        slug: 'istanbul-youth-summit-2024',
      },
    },
    update: {
      description: 'The 7th Istanbul Youth Summit brought together over 400 delegates from 30+ countries. It was a resounding success, featuring keynote speeches from prominent figures and innovative project presentations. Although this event has concluded, you can still view the highlights and outcomes.',
    },
    create: {
      programCategoryId: iysBrand.id,
      name: 'Istanbul Youth Summit 2024',
      slug: 'istanbul-youth-summit-2024',
      description: 'The 7th Istanbul Youth Summit brought together over 400 delegates from 30+ countries. It was a resounding success, featuring keynote speeches from prominent figures and innovative project presentations. Although this event has concluded, you can still view the highlights and outcomes.',
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
    update: {
        description: 'Youth Academic Forum 2025 is the premier platform for young researchers. We invite abstracts and papers from all disciplines. Selected papers will be published in our partner journals, and authors will have the chance to present their work to a panel of distinguished academics.',
        shortDescription: 'Share your research and ideas with a global academic community.',
        benefitsDescription: "- Publication opportunity\n- Peer review feedback\n- Academic networking\n- Presentation skills development",
    },
    create: {
      programCategoryId: yafBrand.id,
      name: 'Youth Academic Forum 2025',
      slug: 'youth-academic-forum-2025',
      description: 'Youth Academic Forum 2025 is the premier platform for young researchers. We invite abstracts and papers from all disciplines. Selected papers will be published in our partner journals, and authors will have the chance to present their work to a panel of distinguished academics.',
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
      benefitsDescription: "- Publication opportunity\n- Peer review feedback\n- Academic networking\n- Presentation skills development",
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
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
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
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileType: 'pdf',
      type: 'guide',
      isPublic: true,
      isActive: true,
      order: 1
    }
  });
  console.log(`✅ Guidelines created for: ${iys2025.name}`);

  // ==========================================
  // 8. Create Video & Image Gallery (Highlights)
  // ==========================================

  // Clear existing gallery items to avoid duplicates
  const programsToClean = [iys2025.id, iys2024.id, ybbAmbassador2025.id];
  await prisma.programGallery.deleteMany({
      where: { programId: { in: programsToClean } }
  });
  console.log('🧹 Cleared existing gallery items for seeded programs.');

  // 8.1 IYS 2025 Videos
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

  // 8.2 IYS 2024 Videos
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

  // 8.3 Create Image Gallery
  const galleryImages = [
    { title: 'Opening Ceremony', text: 'Opening+Ceremony' },
    { title: 'Group Photo', text: 'Group+Photo' },
    { title: 'Networking Session', text: 'Networking' },
    { title: 'Cultural Night', text: 'Cultural+Night' },
    { title: 'Workshops', text: 'Workshops' },
    { title: 'Awarding Night', text: 'Awarding' },
  ];

  // Seed images for IYS 2025
  for (let i = 0; i < galleryImages.length; i++) {
    await prisma.programGallery.create({
      data: {
        programId: iys2025.id,
        type: 'image',
        imageUrl: `https://placehold.co/800x600/E31E24/FFF?text=${galleryImages[i].text}`,
        title: `${galleryImages[i].title} - IYS 2025`,
        description: `Photo from ${galleryImages[i].title}`,
        order: i + 3, // Start after videos (1, 2)
        isActive: true
      }
    });
  }
  console.log(`✅ Gallery Images created for: ${iys2025.name}`);

  // Seed images for IYS 2024
  for (let i = 0; i < galleryImages.length; i++) {
    await prisma.programGallery.create({
      data: {
        programId: iys2024.id,
        type: 'image',
        imageUrl: `https://placehold.co/800x600/E31E24/FFF?text=${galleryImages[i].text}+2024`,
        title: `${galleryImages[i].title} - IYS 2024`,
        description: `Throwback to ${galleryImages[i].title}`,
        order: i + 3,
        isActive: true
      }
    });
  }
  console.log(`✅ Gallery Images created for: ${iys2024.name}`);

  // Seed images for YBB Ambassador 2025
  for (let i = 0; i < galleryImages.length; i++) {
    await prisma.programGallery.create({
      data: {
        programId: ybbAmbassador2025.id,
        type: 'image',
        imageUrl: `https://placehold.co/800x600/000000/FFF?text=${galleryImages[i].text}+Ambassador`,
        title: `${galleryImages[i].title} - YBB Ambassador`,
        description: `Ambassador Program ${galleryImages[i].title}`,
        order: i + 1,
        isActive: true
      }
    });
  }
  console.log(`✅ Gallery Images created for: ${ybbAmbassador2025.name}`);

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
      name: 'Fully Funded',
      description: 'Competitive selection for full scholarship.',
      price: 15.00, // Application fee often applies even for fully funded selection
      currency: 'USD',
      capacity: 50,
      feeType: 'registration_fee',
      allowedCategories: [ApplicationCategory.fully_funded],
      benefits: [
        'Full flight coverage', 
        'Accommodation at 5-star hotel', 
        'Meals and transport included', 
        'VIP Access to all sessions', 
        'Exclusive mentorship'
      ],
      isActive: true,
      order: 1
    }
  });

  await prisma.programPricingTier.create({
    data: {
      programId: iys2025.id,
      name: 'Partial / Self Funded',
      description: 'Guaranteed spot for self-supporting delegates.',
      price: 450.00,
      currency: 'USD',
      capacity: 100,
      feeType: 'full_fee',
      allowedCategories: [ApplicationCategory.self_funded],
      benefits: [
        'Accommodation at 4-star hotel', 
        'Meals and transport included', 
        'Access to all sessions', 
        'International Certificate', 
        'Gala Dinner Entrance'
      ],
      isActive: true,
      order: 2
    }
  });

  // YBB Ambassador 2025 Pricing
  await prisma.programPricingTier.create({
      data: {
        programId: ybbAmbassador2025.id,
        name: 'Ambassador Registration',
        description: 'Administrative commitment fee',
        price: 10.00,
        currency: 'USD',
        capacity: 1000,
        feeType: 'registration_fee',
        allowedCategories: [ApplicationCategory.self_funded],
        benefits: ['Official Ambassador ID', 'Digital Toolkit', 'Global Network Access'],
        isActive: true,
        order: 1
      }
  });

  console.log(`✅ Pricing Tiers created for: ${iys2025.name} and ${ybbAmbassador2025.name}`);

  // ==========================================
  // 12. Create Sponsors & Partners
  // ==========================================

  // IYS Sponsors
  await prisma.sponsor.create({
    data: {
      programCategoryId: iysBrand.id,
      name: 'Turkish Airlines',
      type: 'corporate',
      logoUrl: 'https://placehold.co/200x100/EEE/31343C?text=Turkish+Airlines',
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
      logoUrl: 'https://placehold.co/200x100/EEE/31343C?text=Ministry+of+Youth',
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
  // 14. Create Program Timeline (Journey & Important Dates)
  // ==========================================

  // Cleanup IYS 2025 timeline
  await prisma.programTimeline.deleteMany({ where: { programId: iys2025.id } });

  // 1. Participant Registration
  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Participant Registration',
      date: new Date('2025-08-01'),
      endDate: new Date('2025-09-30'), 
      description: 'Register an Account and Complete the Registration Form including payment.\nRegistration Fee: Initial Stage: 10 USD / Rp167,500\nProgram Fee: Start from 330 USD',
      order: 1,
      isActive: true
    }
  });

  // 2. LoA Announcement
  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'LoA Announcement',
      date: new Date('2025-10-01'),
      endDate: new Date('2025-10-05'),
      description: 'Check your email and IG for more information.',
      order: 2,
      isActive: true
    }
  });

  // 3. On Boarding Session
  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'On Boarding Session',
      date: new Date('2025-10-10'), // Placeholder date
      description: 'Date will be confirmed via email.',
      order: 3,
      isActive: true
    }
  });

  // 4. First Payment
  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'First Payment',
      date: new Date('2025-11-20'),
      description: 'Program fees are available when the payment period begins. First Installment: 330 USD / Rp5.000.000',
      order: 4,
      isActive: true
    }
  });

  // 5. Mentoring
  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Mentoring',
      date: new Date('2025-11-25'),
      description: 'Participants will receive mentoring after the first stage of payment.',
      order: 5,
      isActive: true
    }
  });

  // 6. Second Payment
  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Second Payment',
      date: new Date('2025-12-20'),
      description: 'Participants must complete the second installment. Second Installment: 400 USD / Rp6.500.000',
      order: 6,
      isActive: true
    }
  });

  // 7. Fully Funded Interview Announcement
  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Fully Funded Candidate Interview Announcement',
      date: new Date('2025-11-25'),
      endDate: new Date('2025-11-30'),
      description: 'Selected fully funded candidates are invited to attend the interview stage.',
      order: 7,
      isActive: true
    }
  });

  // 8. Interview Fully Funded Candidates
  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Interview Fully Funded Candidates',
      date: new Date('2025-12-01'),
      endDate: new Date('2025-12-10'),
      description: 'Interview session for shortlisted fully funded candidates.',
      order: 8,
      isActive: true
    }
  });

  // 9. Final Announcement
  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Final Announcement of Fully Funded Candidates',
      date: new Date('2025-12-20'),
      endDate: new Date('2025-12-25'),
      description: 'Final results for fully funded candidates who have been selected.',
      order: 9,
      isActive: true
    }
  });

  // 10. Summit Program
  await prisma.programTimeline.create({
    data: {
      programId: iys2025.id,
      title: 'Istanbul Youth Summit Program',
      date: new Date('2026-02-02'),
      endDate: new Date('2026-02-05'),
      description: 'The Istanbul Youth Summit program will take place on February 2-5, 2026, in Istanbul, Turkey.',
      order: 10,
      isActive: true
    }
  });

  console.log(`✅ Timeline created for: ${iys2025.name}`);

  // YBB Ambassador Timeline
  await prisma.programTimeline.create({
    data: {
      programId: ybbAmbassador2025.id,
      title: 'Application Period',
      date: new Date('2024-10-01'),
      description: 'Open call for ambassadors.',
      order: 1,
      isActive: true
    }
  });

  await prisma.programTimeline.create({
      data: {
        programId: ybbAmbassador2025.id,
        title: 'Interview Stage',
        date: new Date('2025-01-15'),
        description: 'Selected candidates interview.',
        order: 2,
        isActive: true
      }
  });

  await prisma.programTimeline.create({
      data: {
        programId: ybbAmbassador2025.id,
        title: 'Onboarding',
        date: new Date('2025-02-01'),
        description: 'Welcome new ambassadors.',
        order: 3,
        isActive: true
      }
  });

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

  // YBB Ambassador FAQs
  const ybbFaqs = [
      {
          question: "What does an Ambassador do?",
          answer: "Ambassadors represent YBB in their region, organizing events and spreading awareness about our programs.",
          category: "general"
      },
      {
          question: "Is this a paid position?",
          answer: "This is a voluntary role, but top performers receive rewards and exclusive opportunities.",
          category: "general"
      },
      {
          question: "How long is the term?",
          answer: "The ambassadorship lasts for one year.",
          category: "general"
      }
  ];

  for (const f of ybbFaqs) {
      await prisma.programFaq.create({
          data: {
              programId: ybbAmbassador2025.id,
              question: f.question,
              answer: f.answer,
              category: f.category as any, // Cast if necessary depending on strict typing in seed
              isActive: true
          }
      });
  }

  // ==========================================
  // 16. Create Program Schedule
  // ==========================================
  
  // Cleanup old schedule entries for IYS 2025
  await prisma.programSchedule.deleteMany({
      where: { programId: iys2025.id }
  });

  // Day 1
  await prisma.programSchedule.create({
    data: {
        programId: iys2025.id,
        day: 'Day 1',
        startTime: '12:11',
        endTime: '13:12', // For duration calc in strategy
        activity: 'First Day: Arrival of the Delegates',
        description: 'Airport Assistance will be provided exclusively at Istanbul Airport, with an estimated schedule pickup session at approximately 12:00 PM local time.[CHECKLIST]Airport assistance,Opening Ceremony,Registration (Hotel Check In),Gala Dinner',
        location: 'Istanbul Airport / Hotel',
        order: 1,
        isActive: true
    }
  });

  // Day 2
  await prisma.programSchedule.create({
    data: {
        programId: iys2025.id,
        day: 'Day 2',
        startTime: '11:15',
        endTime: '17:20', 
        activity: 'Day 2: City Tour and University Visit',
        description: 'A meaningful opportunity to experience Turkish culture and daily life through a city tour and university visit, gaining both cultural insights and academic perspectives.[CHECKLIST]International Symposium with Global Experts',
        location: 'Istanbul City Center',
        order: 2,
        isActive: true
    }
  });
  
  // Day 3
  await prisma.programSchedule.create({
    data: {
        programId: iys2025.id,
        day: 'Day 3',
        startTime: '11:19',
        endTime: '17:22',
        activity: 'Day 3: Project Presentations, Awards, and Cultural Night',
        description: 'Each delegate will be assigned to a distribution group based on the SDGs they have selected. The groups consisting 7-12 members).[CHECKLIST]Project Group Presentations,Closing Ceremony,Awarding Night and Cultural Night',
        location: 'Conference Hall',
        order: 3,
        isActive: true
    }
  });

  // Day 4
  await prisma.programSchedule.create({
    data: {
         programId: iys2025.id,
         day: 'Day 4',
         startTime: '11:23',
         endTime: '13:24',
         activity: 'Day 4: Closing Chapter as Delegates Return to Their Countries',
         description: 'The Airport Assistance service for departure at Istanbul Airport will be available at 12:00 PM local time.[CHECKLIST]Certificate claims,Airport Assistance,Hotel Check out',
         location: 'Hotel Lobby',
         order: 4,
         isActive: true
    }
  });

  console.log(`✅ Detailed Schedule created for: ${iys2025.name}`);

  // ==========================================
  // 16b. Create Program Participation Info (Landing Page Details)
  // ==========================================

  // Fully Funded Info
  await prisma.programParticipationInfo.upsert({
    where: {
      programId_category: {
        programId: iys2025.id,
        category: ApplicationCategory.fully_funded,
      },
    },
    update: {},
    create: {
      programId: iys2025.id,
      category: ApplicationCategory.fully_funded,
      heroTitle: 'Fully Funded Program',
      heroDescription: 'The scholarship covers the program fee, such as program fees, accommodation, meals and provides a sponsorship for flight tickets up to 500 USD. Please note that visa fees and other personal expenses are not covered.',
      benefits: [
        {
          title: "Full Reimbursement",
          description: "Full reimbursement of all payment."
        },
        {
          title: "Recognition",
          description: "Enhanced program recognition"
        },
        {
          title: "Exclusive Activities",
          description: "Access to exclusive fully funded activities."
        },
        {
          title: "Mentorship",
          description: "Additional mentorship opportunities"
        }
      ],
      requirements: [
        {
          title: "Registration",
          items: ["Complete registration form and documentation"]
        },
        {
          title: "Essay",
          items: ["Submit detailed essays and applications"]
        },
        {
          title: "Interview",
          items: ["Participate in interviews and evaluations"]
        },
        {
          title: "Payment",
          items: ["Pay fees according to scheduled payment batches initially"]
        },
        {
          title: "Criteria",
          items: ["Meet selection criteria and deadlines"]
        }
      ],
      sections: [
        {
          type: "timeline",
          title: "Selection Process",
          items: [
             { label: "Registration", date: "Aug - Sept 2025" },
             { label: "Interview", date: "Dec 2025" },
             { label: "Announcement", date: "Jan 2026" }
          ]
        }
      ],
      isActive: true,
    }
  });

  // Self Funded Info
  await prisma.programParticipationInfo.upsert({
    where: {
      programId_category: {
        programId: iys2025.id,
        category: ApplicationCategory.self_funded,
      },
    },
    update: {},
    create: {
      programId: iys2025.id,
      category: ApplicationCategory.self_funded,
      heroTitle: 'Self Funded Program',
      heroDescription: 'For participants who want to guarantee their spot and enjoy independent travel arrangements while getting full access to the summit.',
      benefits: [
        {
           title: "Guaranteed Spot",
           description: "Direct entry without competitive interview selection (subject to basic screening)."
        },
        {
           title: "Flexibility",
           description: "Choose your own flight and extended stay options."
        }
      ],
      requirements: [
        {
           title: "Registration",
           items: ["Complete registration form"]
        },
        {
           title: "Payment",
           items: ["Pay registration fee and program fee full payment"]
        }
      ],
      isActive: true
    }
  });

  console.log(`✅ Participation Info created for: ${iys2025.name}`);

  // ==========================================
  // 17. Create Legal Documents
  // ==========================================
  
  const legalDocs = [
    {
      title: 'Terms of Service',
      slug: 'terms-of-service',
      content: '<h1>Terms of Service</h1><p>Welcome to our platform. By using our services, you agree to these terms. These terms govern your use of our website and participation in our programs.</p><h3>1. Acceptance</h3><p>By accessing our services, you agree to be bound by these Terms.</p><h3>2. Eligibility</h3><p>You must be at least 17 years old to participate in our programs.</p>',
      isRequired: true
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy-policy',
      content: '<h1>Privacy Policy</h1><p>We value your privacy. This policy explains how we collect and use your data.</p><h3>1. Data Collection</h3><p>We collect personal information such as name, email, and nationality when you register.</p><h3>2. Usage</h3><p>We use this data to process your application and communicate with you.</p>',
      isRequired: true
    },
    {
        title: 'Cookie Policy',
        slug: 'cookie-policy',
        content: '<h1>Cookie Policy</h1><p>We use cookies to improve your experience on our website. This includes necessary cookies for site functionality and analytics cookies to understand user behavior.</p>',
        isRequired: false
    },
    {
        title: 'Participant Agreement',
        slug: 'participant-agreement',
        content: '<h1>Participant Agreement</h1><p>By participating in our programs, you agree to conduct yourself with integrity and respect towards other participants and staff.</p><h3>Code of Conduct</h3><p> harassment, discrimination, or disruptive behavior will not be tolerated and may result in immediate disqualification.</p>',
        isRequired: true
    }
  ];

  // Seed for YBB
  for (const doc of legalDocs) {
    await prisma.legalDocument.upsert({
      where: {
        programCategoryId_slug_version: {
            programCategoryId: ybbBrand.id,
            slug: doc.slug,
            version: '1.0'
        }
      },
      update: {},
      create: {
        programCategoryId: ybbBrand.id,
        title: doc.title,
        slug: doc.slug,
        content: doc.content.replace('our platform', 'Youth Break the Boundaries'),
        version: '1.0',
        isRequired: doc.isRequired,
        isActive: true
      }
    });
  }
  console.log(`✅ Legal Documents created for: ${ybbBrand.name}`);

  // Seed for IYS
  for (const doc of legalDocs) {
    await prisma.legalDocument.upsert({
      where: {
        programCategoryId_slug_version: {
            programCategoryId: iysBrand.id,
            slug: doc.slug,
            version: '1.0'
        }
      },
      update: {},
      create: {
        programCategoryId: iysBrand.id,
        title: doc.title,
        slug: doc.slug,
        content: doc.content.replace('our platform', 'Istanbul Youth Summit'),
        version: '1.0',
        isRequired: doc.isRequired,
        isActive: true
      }
    });
  }
  console.log(`✅ Legal Documents created for: ${iysBrand.name}`);

  // ==========================================
  // 18. Create Program Announcements (News)
  // ==========================================
  
  await prisma.programAnnouncement.deleteMany({
      where: { programId: iys2025.id }
  });

  const newsItems = [
    {
      title: "Registration Extended to September 30th",
      content: "Due to high demand, we are extending the registration deadline for Istanbul Youth Summit 2025. Don't miss this opportunity to join 500+ global leaders.",
      category: "News",
      imageUrl: "https://placehold.co/600x400/E31E24/FFF?text=Deadline+Extended",
      publishDate: new Date('2025-09-15T09:00:00Z')
    },
    {
      title: "Keynote Speaker Announcement: Dr. Sarah Johnson",
      content: "We are thrilled to announce our first keynote speaker, Dr. Sarah Johnson from the UN Environmental Programme. She will be sharing insights on sustainable leadership.",
      category: "News",
      imageUrl: "https://placehold.co/600x400/E31E24/FFF?text=Speaker+Reveal",
      publishDate: new Date('2025-10-01T10:00:00Z')
    },
    {
      title: "Scholarship Results Announced",
      content: "The list of fully funded scholarship recipients for IYS 2025 has been published. Check your email and the dashboard for results.",
      category: "Award",
      imageUrl: "https://placehold.co/600x400/E31E24/FFF?text=Scholarship+Results",
      publishDate: new Date('2026-01-10T09:00:00Z')
    },
    {
       title: "Official Venue Partner: Istanbul Convention Center",
       content: "We are proud to partner with the ICC for our 2025 summit. Experience world-class facilities in the heart of Istanbul.",
       category: "News",
       imageUrl: "https://placehold.co/600x400/E31E24/FFF?text=Venue+Partner",
       publishDate: new Date('2025-11-20T14:00:00Z')
    }
  ];

  for (const item of newsItems) {
    await prisma.programAnnouncement.create({
      data: {
        programId: iys2025.id,
        title: item.title,
        content: item.content,
        category: item.category, // Now valid thanks to migration
        imageUrl: item.imageUrl,
        targetAudience: 'all',
        publishDate: item.publishDate,
        isActive: true
      }
    });
  }
  console.log(`✅ Announcements created for: ${iys2025.name}`);

  // ==========================================
  // 19. Create Award Winners (Participants)
  // ==========================================

  // 19.1 Create Dummy Participants if needed
  // We'll create 3 winners.
  const winnersData = [
    { name: "Ali Hassan", country: "Turkey", institution: "Istanbul University", gender: "male" },
    { name: "Maria Garcia", country: "Spain", institution: "University of Barcelona", gender: "female" },
    { name: "Chen Wei", country: "China", institution: "Tsinghua University", gender: "male" }
  ];

  // We need the 'participant' role
  const participantRole = await prisma.adminRole.upsert({ // Using adminRole just for placeholder ref if needed, but Participants link to User
      where: { name: 'Participant' },
      update: {},
      create: { name: 'Participant', isActive: true }
  });

  // Get Best Presenter Award
  const bestPresenter = await prisma.programAward.findFirst({
      where: { programId: iys2025.id, name: 'Best Presenter' }
  });

  if (bestPresenter) {
      for (const [index, w] of winnersData.entries()) {
          const email = `winner${index + 1}@example.com`;
          
          // 1. Create User
          const user = await prisma.user.upsert({
              where: { email_programCategoryId: { email, programCategoryId: iysBrand.id } },
              update: {},
              create: {
                  email,
                  programCategoryId: iysBrand.id,
                  passwordHash: 'dummy',
                  emailVerified: true,
                  isActive: true
              }
          });

          // 2. Create Participant Profile
          const participant = await prisma.participant.upsert({
              where: { userId: user.id },
              update: {},
              create: {
                  userId: user.id,
                  fullName: w.name,
                  nationality: w.country,
                  institution: w.institution,
                  profilePictureUrl: `https://randomuser.me/api/portraits/${w.gender === 'male' ? 'men' : 'women'}/${index + 50}.jpg`,
                  phoneNumber: '+1234567890',
                  gender: w.gender === 'male' ? 'male' : 'female',
              }
          });

          // 3. Create Application
          const application = await prisma.participantApplication.upsert({
              where: {
                  participantId_programId: {
                      participantId: participant.id,
                      programId: iys2025.id
                  }
              },
              update: {},
              create: {
                  participantId: participant.id,
                  programId: iys2025.id,
                  status: 'accepted',
                  paymentStatus: 'paid',
                  ticketStatus: 'fully_funded'
              }
          });

          // 4. Assign Award
          // Check if already awarded
          const existingAward = await prisma.participantAward.findFirst({
              where: { applicationId: application.id, programAwardId: bestPresenter.id }
          });

          if (!existingAward) {
              await prisma.participantAward.create({
                  data: {
                      applicationId: application.id,
                      programAwardId: bestPresenter.id,
                      awardedAt: new Date(),
                      notes: "For exceptional presentation on sustainable energy."
                  }
              });
          }
      }
      console.log(`✅ Award Winners assigned for: ${bestPresenter.name}`);
  }

  // ==========================================
  // 20. Create Partnership Opportunities
  // ==========================================

  // Ambassador Program Opportunity
  await prisma.partnershipOpportunity.create({
    data: {
      programCategoryId: iysBrand.id,
      title: "Ambassador Program",
      subtitle: "Join our global network of youth leaders",
      description: "Represent the Istanbul Youth Summit in your country. As an ambassador, you will gain exclusive access to leadership training, networking opportunities, and the chance to drive impactful projects.",
      type: "ambassador",
      features: [
        "Exclusive Leadership Training",
        "Global Networking",
        "Certificate of Ambassadorship",
        "Priority Access to Summit"
      ],
      ctaLabel: "Apply Now",
      isActive: true,
      order: 1
    }
  });

  // Affiliate Program Opportunity
  await prisma.partnershipOpportunity.create({
    data: {
      programCategoryId: iysBrand.id,
      title: "Affiliate Program",
      subtitle: "Partner with us for mutual growth",
      description: "Collaborate with IYS to promote youth empowerment. Ideal for organizations, student bodies, and media partners looking to expand their reach.",
      type: "affiliate",
      features: [
        "Brand Exposure",
        "Joint Events",
        "Revenue Sharing (Optional)",
        "Marketing Resources"
      ],
      ctaLabel: "Join as Partner",
      isActive: true,
      order: 2
    }
  });

  console.log(`✅ Partnership Opportunities created for: ${iysBrand.name}`);

  // ==========================================
  // 21. Create Sponsorship Tiers
  // ==========================================

  // Platinum Tier
  await prisma.sponsorshipTier.create({
    data: {
      programCategoryId: iysBrand.id,
      name: "Platinum Sponsor",
      priceDescription: "$5,000+",
      description: "Maximum visibility and strategic partnership.",
      features: [
        "Logo on Main Stage Backdrop",
        "Keynote Speaking Slot",
        "VIP Access for 5 Representatives",
        "Dedicated Booth Space",
        "Social Media Feature (3 Posts)"
      ],
      isActive: true,
      order: 1
    }
  });

  // Gold Tier
  await prisma.sponsorshipTier.create({
    data: {
      programCategoryId: iysBrand.id,
      name: "Gold Sponsor",
      priceDescription: "$3,000 - $4,999",
      description: "Significant brand exposure and engagement.",
      features: [
        "Logo on Event Banner",
        "Workshop Hosting Opportunity",
        "VIP Access for 3 Representatives",
        "Shared Booth Space",
        "Social Media Feature (1 Post)"
      ],
      isActive: true,
      order: 2
    }
  });

  // Silver Tier
  await prisma.sponsorshipTier.create({
    data: {
      programCategoryId: iysBrand.id,
      name: "Silver Sponsor",
      priceDescription: "$1,000 - $2,999",
      description: "Essential branding and networking.",
      features: [
        "Logo on Website",
        "Mention in Opening Ceremony",
        "VIP Access for 1 Representative",
        "Logo in Program Booklet"
      ],
      isActive: true,
      order: 3
    }
  });

  console.log(`✅ Sponsorship Tiers created for: ${iysBrand.name}`);


  // ==========================================
  // 22. Seed Payment Configuration (NEW) 
  // ==========================================

  /*
  // REMOVED IN V2 - MOVED TO PAYMENT SERVICE
  // 1. Payment Gateway for YBB (Sandbox Keys)
  await prisma.paymentGatewayConfig.create({
    data: {
      programCategoryId: ybbBrand.id,
      provider: 'midtrans',
      mode: 'sandbox',
      serverKey: 'SB-Mid-server-YOUR_KEY_HERE',
      clientKey: 'SB-Mid-client-YOUR_KEY_HERE',
      isActive: true
    }
  });
  console.log(`✅ Payment Gateway Config created for: ${ybbBrand.name}`);

  // 2. Seed Payment Methods
  // 2.1 Manual BCA
  const methodBca = await prisma.paymentMethod.upsert({
    where: { code: 'manual_bca' },
    update: {},
    create: {
      code: 'manual_bca',
      name: 'Bank Transfer BCA',
      type: 'MANUAL',
      logoUrl: 'https://placehold.co/100x50/0056B3/FFF?text=BCA',
      description: 'Transfer to BCA Account',
      isEnabled: true,
    }
  });

  await prisma.manualPaymentDetail.create({
    data: {
      paymentMethodId: methodBca.id,
      providerName: 'BCA',
      accountNumber: '1234567890',
      accountHolder: 'YBB Foundation',
      instructionText: 'Please transfer exact amount including unique code.'
    }
  });

  // 2.2 Manual PayPal
  const methodPaypal = await prisma.paymentMethod.upsert({
    where: { code: 'manual_paypal' },
    update: {},
    create: {
      code: 'manual_paypal',
      name: 'PayPal',
      type: 'MANUAL',
      logoUrl: 'https://placehold.co/100x50/003087/FFF?text=PayPal',
      description: 'Send to our PayPal email',
      isEnabled: true,
    }
  });

  await prisma.manualPaymentDetail.create({
    data: {
      paymentMethodId: methodPaypal.id,
      providerName: 'PayPal',
      accountNumber: 'finance@ybbhub.com',
      accountHolder: 'YBB Finance',
      instructionText: 'Use "Friends and Family" to avoid fees.'
    }
  });

  // 2.3 Midtrans Credit Card
  await prisma.paymentMethod.upsert({
    where: { code: 'midtrans_credit_card' },
    update: {},
    create: {
      code: 'midtrans_credit_card',
      name: 'Credit Card',
      type: 'AUTOMATIC',
      provider: 'midtrans',
      logoUrl: 'https://placehold.co/100x50/000/FFF?text=VISA',
      description: 'Visa / Mastercard / JCB',
      isEnabled: true,
    }
  });

  // 2.4 Midtrans GoPay
  await prisma.paymentMethod.upsert({
    where: { code: 'midtrans_gopay' },
    update: {},
    create: {
      code: 'midtrans_gopay',
      name: 'GoPay',
      type: 'AUTOMATIC',
      provider: 'midtrans',
      logoUrl: 'https://placehold.co/100x50/00AA13/FFF?text=GoPay',
      description: 'Scan QR with GoJek',
      isEnabled: true,
    }
  });

  console.log('✅ Payment Methods & Config seeded.');
  */

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

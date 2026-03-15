import { prisma, log } from './utils';
import * as bcrypt from 'bcrypt';

export const BRANDS = {
  IYS: 'istanbul-youth-summit',
  YAF: 'youth-academic-forum',
  WYF: 'world-youth-fest',
  JYS: 'japan-youth-summit',
  MEYS: 'middle-east-youth-summit',
  KYS: 'korea-youth-summit',
  VYS: 'vietnam-youth-summit',
  CYS: 'china-youth-summit',
};

export async function seedBrands() {
  log('🌱 Seeding Brands...');

  // 1. IYS (Primary Brand for this seed)
  const iys = await prisma.brand.upsert({
    where: { slug: BRANDS.IYS },
    update: {},
    create: {
      name: 'Istanbul Youth Summit',
      slug: BRANDS.IYS,
      description: 'Istanbul Youth Summit connects future leaders.',
      websiteUrl: 'https://istanbulyouthsummit.com',
      contactEmail: 'admin@istanbulyouthsummit.com',
      primaryColor: '#023e8a',
      isActive: true,
      logoUrl: "https://placehold.co/400x100/023e8a/FFF?text=IYS+Logo",
      bannerUrl: "https://placehold.co/1200x400/023e8a/FFF?text=IYS+Banner",
    },
  });

  // 2. YAF
  const yaf = await prisma.brand.upsert({
    where: { slug: BRANDS.YAF },
    update: {},
    create: {
      name: 'Youth Academic Forum',
      slug: BRANDS.YAF,
      description: 'Platform for young scholars.',
      websiteUrl: 'https://youthacademicforum.com',
      contactEmail: 'admin@youthacademicforum.com',
      primaryColor: '#0056B3',
      isActive: true,
      logoUrl: "https://placehold.co/400x100/0056B3/FFF?text=YAF+Logo",
      bannerUrl: "https://placehold.co/1200x400/0056B3/FFF?text=YAF+Banner",
    },
  });

  // 3. WYF
  await prisma.brand.upsert({
    where: { slug: BRANDS.WYF },
    update: {},
    create: {
      name: 'World Youth Fest',
      slug: BRANDS.WYF,
      description: 'Global platform for youth.',
      websiteUrl: 'https://worldyouthfest.com',
      contactEmail: 'admin@worldyouthfest.com',
      primaryColor: '#F59E0B',
      isActive: true,
      logoUrl: 'https://placehold.co/400x100/F59E0B/FFF?text=WYF+Logo',
    },
  });

  // 4. JYS
  await prisma.brand.upsert({
    where: { slug: BRANDS.JYS },
    update: {},
    create: {
      name: 'Japan Youth Summit',
      slug: BRANDS.JYS,
      description: 'Connecting future leaders in Osaka.',
      websiteUrl: 'https://japanyouthsummit.com',
      contactEmail: 'admin@japanyouthsummit.com',
      primaryColor: '#EF4444',
      isActive: true,
      logoUrl: 'https://placehold.co/400x100/EF4444/FFF?text=JYS+Logo',
    },
  });

  // Removed YBB and AYIMUN

  // 8. CYS
  await prisma.brand.upsert({
    where: { slug: BRANDS.CYS },
    update: {
      contactPhone: '+8615000000000',
      contactWhatsapp: '+8615000000000',
      contactAddress: 'Beijing, China',
      contactEmail: 'info@chinayouthsummit.com',
      primaryColor: '#E62C4F',
      logoUrl: 'https://placehold.co/400x100/E62C4F/FFF?text=CYS+Logo',
      logoWhiteUrl: 'https://placehold.co/400x100/FFF/E62C4F?text=CYS+Logo',
      logoColorUrl: 'https://placehold.co/400x100/E62C4F/FFF?text=CYS+Logo',
      logoIconUrl: 'https://placehold.co/100x100/E62C4F/FFF?text=CYS',
      bannerUrl: 'https://placehold.co/1200x400/E62C4F/FFF?text=China+Youth+Summit',
      socialMediaLinks: {
        instagram: 'https://instagram.com/chinayouthsummit',
        tiktok: 'https://www.tiktok.com/@chinayouthsummit',
        youtube: 'https://www.youtube.com/@chinayouthsummit',
        telegram: 'https://t.me/chinayouthsummit',
      },
    },
    create: {
      id: 'c1a2e3f4-0000-4000-8000-111122223333',
      name: 'China Youth Summit',
      slug: BRANDS.CYS,
      description: 'Connecting young leaders across China and Asia.',
      about: 'China Youth Summit (CYS) is a premier youth leadership program dedicated to empowering young people across China and Asia.',
      websiteUrl: 'chinayouthsummit.com',
      contactEmail: 'info@chinayouthsummit.com',
      contactPhone: '+8615000000000',
      contactWhatsapp: '+8615000000000',
      contactAddress: 'Beijing, China',
      primaryColor: '#E62C4F',
      defaultCurrency: 'CNY',
      isActive: true,
      logoUrl: 'https://placehold.co/400x100/E62C4F/FFF?text=CYS+Logo',
      logoWhiteUrl: 'https://placehold.co/400x100/FFF/E62C4F?text=CYS+Logo',
      logoColorUrl: 'https://placehold.co/400x100/E62C4F/FFF?text=CYS+Logo',
      logoIconUrl: 'https://placehold.co/100x100/E62C4F/FFF?text=CYS',
      bannerUrl: 'https://placehold.co/1200x400/E62C4F/FFF?text=China+Youth+Summit',
      socialMediaLinks: {
        instagram: 'https://instagram.com/chinayouthsummit',
        tiktok: 'https://www.tiktok.com/@chinayouthsummit',
        youtube: 'https://www.youtube.com/@chinayouthsummit',
        telegram: 'https://t.me/chinayouthsummit',
      },
    },
  });

  log('✅ Brands created');
}


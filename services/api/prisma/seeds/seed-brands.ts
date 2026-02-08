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
      primaryColor: '#E31E24',
      isActive: true,
      logoUrl: "https://placehold.co/400x100/E31E24/FFF?text=IYS+Logo",
      bannerUrl: "https://placehold.co/1200x400/E31E24/FFF?text=IYS+Banner",
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

  log('✅ Brands created');
}


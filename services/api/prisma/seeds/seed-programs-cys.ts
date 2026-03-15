import { prisma, log, error } from './utils';
import { BRANDS } from './seed-brands';

export async function seedCYSPrograms() {
  log('🌱 Seeding CYS Programs...');

  const brand = await prisma.brand.findUnique({ where: { slug: BRANDS.CYS } });
  if (!brand) return error('CYS Brand not found');

  // ==========================================
  // CYS 2026 (Active/Upcoming)
  // ==========================================
  await prisma.program.upsert({
    where: {
      brandId_slug: { brandId: brand.id, slug: 'china-youth-summit-2026' },
    },
    update: {
      isActive: true,
      isPublished: true,
      status: 'published',
      allowRegistration: true,
      logoUrl: 'https://placehold.co/400x100/E62C4F/FFF?text=CYS+2026',
      logoWhiteUrl: 'https://placehold.co/400x100/FFF/E62C4F?text=CYS+2026',
      bannerUrl: 'https://placehold.co/1200x600/E62C4F/FFF?text=CYS+2026+Banner',
      thumbnailUrl: 'https://placehold.co/600x400/E62C4F/FFF?text=CYS+2026',
    },
    create: {
      id: 'c1a2e3f4-0001-4000-8000-111122223334',
      brandId: brand.id,
      name: 'China Youth Summit 2026',
      slug: 'china-youth-summit-2026',
      description:
        'The inaugural China Youth Summit (CYS 2026) brings together young leaders from across China and Asia. Theme: "Bridging Cultures, Building Futures".',
      shortDescription: 'Join the premier youth leadership summit in Beijing, July 2026.',
      year: 2026,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-14'),
      applicationDeadline: new Date('2026-05-31'),
      location: 'Beijing, China',
      capacity: 400,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: true,
      status: 'published',
      allowRegistration: true,
      requirePayment: true,
      benefitsDescription:
        '1. Leadership Training\n2. Cross-cultural Exchange\n3. International Networking\n4. Certificate of Participation',
      logoUrl: 'https://placehold.co/400x100/E62C4F/FFF?text=CYS+2026',
      logoWhiteUrl: 'https://placehold.co/400x100/FFF/E62C4F?text=CYS+2026',
      bannerUrl: 'https://placehold.co/1200x600/E62C4F/FFF?text=CYS+2026+Banner',
      thumbnailUrl: 'https://placehold.co/600x400/E62C4F/FFF?text=CYS+2026',
    },
  });

  log('✅ CYS Programs seeded');
}

import { prisma, log, error } from './utils';
import { BRANDS } from './seed-brands';

export async function seedBrandContent() {
  log('🌱 Seeding Brand Content (Settings, Socials, Sponsors)...');

  // We are focusing on IYS for now as the main brand
  const iys = await prisma.brand.findUnique({ where: { slug: BRANDS.IYS } });
  if (!iys) return error('IYS Brand not found');

  // 1. Category Settings
  await prisma.brandSetting.upsert({
    where: { brandId: iys.id },
    update: {},
    create: {
      brandId: iys.id,
      isMaintenanceMode: false,
      usdInIdr: 16000,
      supportEmail: 'admin@istanbulyouthsummit.com',
      footerNavigation: [
        {
          title: "Programs",
          links: [
            { label: "Istanbul Youth Summit 2026", url: "/programs/istanbul-youth-summit-2026" },
            { label: "Past Events", url: "/programs/past" }
          ]
        },
        {
          title: "Legal",
          links: [
            { label: "Privacy Policy", url: "/legal/privacy" },
            { label: "Terms of Service", url: "/legal/terms" }
          ]
        }
      ]
    }
  });

  // 2. Social Feeds (Instagram Placeholders)
  await prisma.brandSocialFeed.deleteMany({ where: { brandId: iys.id } });
  await prisma.brandSocialFeed.createMany({
    data: [
      {
        brandId: iys.id,
        platform: 'instagram',
        postId: 'ig_001',
        imageUrl: 'https://placehold.co/400x400?text=IG+Post+1',
        permalink: 'https://instagram.com/p/123',
        caption: 'Registration is now OPEN! #IYS2026',
        postedAt: new Date(),
        isActive: true
      },
      {
        brandId: iys.id,
        platform: 'instagram',
        postId: 'ig_002',
        imageUrl: 'https://placehold.co/400x400?text=IG+Post+2',
        permalink: 'https://instagram.com/p/456',
        caption: 'Highlights from last year. #IYS2025',
        postedAt: new Date(Date.now() - 86400000), // Yesterday
        isActive: true
      }
    ]
  });

  // 3. Sponsorship Tiers (Brand Level)
  await prisma.sponsorshipTier.deleteMany({ where: { brandId: iys.id } });
  await prisma.sponsorshipTier.createMany({
    data: [
      {
        brandId: iys.id,
        name: 'Platinum Sponsor',
        priceDescription: '$10,000+',
        description: 'Maximum visibility and keynote speech opportunity.',
        features: ['Logo on main banner', 'Keynote speech', 'Booth at venue', 'Social media shoutout'],
        order: 1,
        isActive: true
      },
      {
        brandId: iys.id,
        name: 'Gold Sponsor',
        priceDescription: '$5,000+',
        description: 'High visibility and booth.',
        features: ['Logo on website', 'Booth at venue', 'Social media shoutout'],
        order: 2,
        isActive: true
      }
    ]
  });

  // 4. Sponsors (Global/Brand Level)
  await prisma.sponsor.deleteMany({ where: { brandId: iys.id } });
  await prisma.sponsor.createMany({
    data: [
      {
        brandId: iys.id,
        name: 'Tech Corp Global',
        type: 'corporate',
        tier: 'platinum',
        logoUrl: 'https://placehold.co/200x100?text=Tech+Corp',
        websiteUrl: 'https://techcorp.example.com',
        description: 'Leading innovation worldwide.',
        order: 1,
        isActive: true
      },
      {
        brandId: iys.id,
        name: 'Education First',
        type: 'ngo',
        tier: 'gold',
        logoUrl: 'https://placehold.co/200x100?text=Education+First',
        websiteUrl: 'https://edu-first.example.org',
        description: 'Promoting global literacy.',
        order: 2,
        isActive: true
      },
      {
        brandId: iys.id,
        name: 'Local Media Group',
        type: 'media_partner',
        tier: 'partner',
        logoUrl: 'https://placehold.co/200x100?text=Media+Group',
        websiteUrl: 'https://media.example.com',
        order: 3,
        isActive: true
      }
    ]
  });

  // 5. Partnership Opportunities
  await prisma.partnershipOpportunity.deleteMany({ where: { brandId: iys.id } });
  await prisma.partnershipOpportunity.createMany({
    data: [
      {
        brandId: iys.id,
        type: 'ambassador',
        title: 'Campus Ambassador',
        description: 'Represent IYS in your university.',
        features: ['Certificate', 'Discount on registration', 'Networking'],
        ctaLabel: 'Apply Now',
        order: 1,
        isActive: true
      },
      {
        brandId: iys.id,
        type: 'media_partner',
        title: 'Media Partner',
        description: 'Cover our event and get exclusive access.',
        features: ['Press Pass', 'Interview opportunities', 'Logo placement'],
        ctaLabel: 'Contact Us',
        order: 2,
        isActive: true
      }
    ]
  });

  // 5. Program Team (Brand Executives)
  await prisma.programTeam.deleteMany({ where: { brandId: iys.id } });
  await prisma.programTeam.createMany({
    data: [
      {
        brandId: iys.id,
        name: 'John Doe',
        role: 'Founder & CEO',
        bio: 'Visionary leader with 10+ years in youth empowerment.',
        photoUrl: 'https://placehold.co/400x400?text=CEO',
        order: 1,
        isActive: true
      },
      {
        brandId: iys.id,
        name: 'Jane Smith',
        role: 'Director of Partnerships',
        bio: 'Connecting global organizations for impact.',
        photoUrl: 'https://placehold.co/400x400?text=Director',
        order: 2,
        isActive: true
      }
    ]
  });

  // 6. Brand Testimonials (General Alumni)
  await prisma.programTestimonial.deleteMany({ where: { brandId: iys.id } });
  await prisma.programTestimonial.createMany({
    data: [
      {
        brandId: iys.id,
        name: 'Alice Johnson',
        role: 'Alumni 2020',
        testimonial: 'YBB changed my life and career trajectory.',
        category: 'alumni',
        isFeatured: true,
        avatarUrl: 'https://placehold.co/100x100?text=Alice',
        order: 1,
        isActive: true
      }
    ]
  });

  // 7. Legal Documents
  await prisma.legalDocument.deleteMany({ where: { brandId: iys.id } });
  await prisma.legalDocument.createMany({
    data: [
      {
        brandId: iys.id,
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        version: '1.0',
        content: `
          <h1>Privacy Policy</h1>
          <p>Effective Date: January 1, 2026</p>
          <p>We value your privacy. This document explains how we collect, use, and share your personal information...</p>
          <h2>1. Information We Collect</h2>
          <p>We collect information you provide directly to us when you create an account, register for an event...</p>
          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to provide, maintain, and improve our services...</p>
        `,
        description: 'Our policy regarding user data collection and usage.',
        isRequired: true,
        isActive: true
      },
      {
        brandId: iys.id,
        title: 'Terms of Service',
        slug: 'terms-of-service',
        version: '1.0',
        content: `
          <h1>Terms of Service</h1>
          <p>Welcome to Istanbul Youth Summit.</p>
          <p>By accessing or using our services, you agree to be bound by these Terms...</p>
          <h2>1. Eligibility</h2>
          <p>You must be at least 18 years old to use our services...</p>
          <h2>2. Code of Conduct</h2>
          <p>Participants are expected to behave professionally...</p>
        `,
        description: 'Rules and regulations for using our platform and attending events.',
        isRequired: true,
        isActive: true
      },
      {
        brandId: iys.id,
        title: 'Refund Policy',
        slug: 'refund-policy',
        version: '1.0',
        content: `
          <h1>Refund Policy</h1>
          <p>All registration fees are non-refundable unless the event is cancelled...</p>
        `,
        description: 'Conditions under which refunds are granted.',
        isRequired: false,
        isActive: true
      }
    ]
  });

  log('✅ Brand Content (Settings, Socials, Sponsors, Team, Testimonials, Legal) seeded for IYS');

  // ==========================================
  // CYS Brand Content
  // ==========================================
  const cys = await prisma.brand.findUnique({ where: { slug: BRANDS.CYS } });
  if (!cys) {
    error('CYS Brand not found — skipping CYS brand content');
    return;
  }

  // CYS Settings
  await prisma.brandSetting.upsert({
    where: { brandId: cys.id },
    update: {},
    create: {
      brandId: cys.id,
      isMaintenanceMode: false,
      usdInIdr: 16000,
      supportEmail: 'info@chinayouthsummit.com',
      footerNavigation: [
        {
          title: 'Programs',
          links: [
            { label: 'China Youth Summit 2026', url: '/programs/china-youth-summit-2026' },
            { label: 'Past Events', url: '/programs/past' },
          ],
        },
        {
          title: 'Legal',
          links: [
            { label: 'Privacy Policy', url: '/legal/privacy' },
            { label: 'Terms of Service', url: '/legal/terms' },
          ],
        },
      ],
    },
  });

  // CYS Social Feeds
  await prisma.brandSocialFeed.deleteMany({ where: { brandId: cys.id } });
  await prisma.brandSocialFeed.createMany({
    data: [
      { brandId: cys.id, platform: 'instagram', postId: 'cys_ig_001', imageUrl: 'https://placehold.co/400x400/E62C4F/FFF?text=CYS+Registration+Open', permalink: 'https://instagram.com/p/cys001', caption: 'Registration is NOW OPEN for CYS 2026! 🚀 #CYS2026 #ChinaYouthSummit', postedAt: new Date(), isActive: true },
      { brandId: cys.id, platform: 'instagram', postId: 'cys_ig_002', imageUrl: 'https://placehold.co/400x400/C0392B/FFF?text=CYS+2025+Highlights', permalink: 'https://instagram.com/p/cys002', caption: 'Throwback to CYS 2025 in Beijing! What an incredible journey. #CYS2025', postedAt: new Date(Date.now() - 86400000), isActive: true },
      { brandId: cys.id, platform: 'instagram', postId: 'cys_ig_003', imageUrl: 'https://placehold.co/400x400/922B21/FFF?text=Speaker+Announcement', permalink: 'https://instagram.com/p/cys003', caption: 'Excited to announce our keynote speakers for CYS 2026!', postedAt: new Date(Date.now() - 172800000), isActive: true },
    ],
  });

  // CYS Sponsors
  await prisma.sponsor.deleteMany({ where: { brandId: cys.id } });
  await prisma.sponsor.createMany({
    data: [
      { brandId: cys.id, name: 'Asia Innovation Fund', type: 'corporate', tier: 'platinum', logoUrl: 'https://placehold.co/200x100/E62C4F/FFF?text=Asia+Innovation', websiteUrl: 'https://asiainnovation.example.com', description: 'Driving innovation across Asia.', order: 1, isActive: true },
      { brandId: cys.id, name: 'Global Education Alliance', type: 'ngo', tier: 'gold', logoUrl: 'https://placehold.co/200x100/C0392B/FFF?text=GEA', websiteUrl: 'https://gea.example.org', description: 'Advancing education worldwide.', order: 2, isActive: true },
      { brandId: cys.id, name: 'Youth Media Network', type: 'media_partner', tier: 'partner', logoUrl: 'https://placehold.co/200x100/922B21/FFF?text=YMN', websiteUrl: 'https://ymn.example.com', description: 'Youth-focused media coverage.', order: 3, isActive: true },
      { brandId: cys.id, name: 'TechBridge Asia', type: 'corporate', tier: 'gold', logoUrl: 'https://placehold.co/200x100/E62C4F/FFF?text=TechBridge', websiteUrl: 'https://techbridge.example.com', description: 'Connecting tech talent across borders.', order: 4, isActive: true },
    ],
  });

  log('✅ Brand Content seeded for CYS');
}

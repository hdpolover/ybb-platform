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
  const cysMetadata = {
    impact_stats: {
      total_participants: '8,500+',
      total_countries: '62',
      total_alumni: '7,200+',
      editions_held: '5',
    },
    features: [
      { id: 'f1', icon: 'globe', title: 'International Exposure', description: 'Connect with young leaders from 60+ countries and broaden your global perspective through cross-cultural dialogue and collaboration.' },
      { id: 'f2', icon: 'award', title: 'Recognized Certification', description: 'Receive internationally acknowledged certificates and awards endorsed by partner universities and government bodies.' },
      { id: 'f3', icon: 'users', title: 'Expert Mentorship', description: 'Learn from world-class speakers, academics, and industry professionals who guide your leadership journey.' },
      { id: 'f4', icon: 'lightbulb', title: 'Innovation Projects', description: 'Develop and pitch real-world innovation projects on sustainability, technology, and social impact with your team.' },
      { id: 'f5', icon: 'heart', title: 'Cultural Immersion', description: 'Explore local heritage and culture through curated excursions and cultural exchange events throughout the program.' },
      { id: 'f6', icon: 'star', title: 'Lifelong Alumni Network', description: 'Join a global alumni community of 7,000+ changemakers continuing to collaborate long after the program ends.' },
    ],
    benefits: {
      eyebrow: 'Program Benefits',
      title: 'Built for Students, University Students & Professionals',
      groups: [
        {
          id: 'high_school',
          title: 'Benefits for High School Students',
          imageUrl: 'https://placehold.co/640x360/E62C4F/FFF?text=CYS+High+School',
          items: [
            'Aligned with international baccalaureate (IB) curriculum',
            'Supports Cambridge and national curriculum requirements',
            'Curated leadership certification recognized by universities',
            'Boosts university applications with international experience',
          ],
        },
        {
          id: 'university',
          title: 'Benefits for University Students',
          imageUrl: 'https://placehold.co/640x360/C0392B/FFF?text=CYS+University',
          items: [
            'Internship and research collaboration opportunities',
            'Network with professors and global academics',
            'Case competitions and innovation challenges',
            'Career acceleration through mentorship and industry exposure',
          ],
        },
        {
          id: 'professional',
          title: 'Benefits for Young Professionals',
          imageUrl: 'https://placehold.co/640x360/922B21/FFF?text=CYS+Professional',
          items: [
            'Cross-sector leadership development workshops',
            'Business networking across 60+ countries',
            'Featured in media coverage and alumni spotlights',
            'Partnership and collaboration opportunities post-program',
          ],
        },
      ],
    },
    recognition: {
      title: 'Recognition & Credibility',
      subtitle: 'Proof that our program and organization are legitimate and credible.',
      proofs: [
        { iconKey: 'ministry', title: 'Recognized by Ministry', subtitle: 'Endorsed by relevant government bodies in participating countries', bullets: ['Compliance-ready', 'Official acknowledgements'] },
        { iconKey: 'university', title: 'Supported by Universities', subtitle: 'Backed by reputable higher education institutions', bullets: ['Academic support', 'Guest lecturers from partner universities'] },
        { iconKey: 'official_partners', title: 'Official Partners', subtitle: 'Formal collaborations with trusted international organizations', bullets: ['MoU/LoI signed', 'Program co-creation'] },
        { iconKey: 'legal_recognition', title: 'Legal Recognition', subtitle: 'Meets formal compliance and regulatory standards', bullets: ['Policies & SOP in place', 'Auditable process'] },
        { iconKey: 'registered_entity', title: 'Registered Organization', subtitle: 'Legally registered foundation with valid documentation', bullets: ['Foundation registered', 'Valid legal documents'] },
        { iconKey: 'ip_protection', title: 'IP & Legal Protection', subtitle: 'Brand trademark registered with intellectual property authorities' },
        { iconKey: 'media_coverage', title: 'Media Coverage', subtitle: 'Featured by national and international media outlets', bullets: ['Online features', 'Press releases'] },
        { iconKey: 'award_winning', title: 'Award-Winning Program', subtitle: 'Recipients of international youth program recognitions', bullets: ['International awards', 'Jury-selected'] },
        { iconKey: 'global_alumni', title: 'Global Alumni Network', subtitle: 'Active community of graduates collaborating across 60+ countries', bullets: ['Ongoing initiatives', 'Cross-border alumni projects'] },
      ],
      trademark: {
        href: '#',
        brand: 'CHINA YOUTH SUMMIT',
        regNo: 'IDM001273000',
        status: '(TM) Registered',
        classText: '41 — Education, seminars, conferences, youth cultural events, and leadership programs.',
        owner: 'YBB Foundation (ID)',
        logoUrl: 'https://placehold.co/80x80/E62C4F/FFF?text=CYS',
      },
    },
    moments_shorts: {
      eyebrow: 'Short Highlights',
      title: 'Discover Our Moments in 60 Seconds',
      description: 'Watch bite-sized highlights from China Youth Summit\'s workshops, cultural sessions, and everyday moments.',
    },
    payment_info: {
      eyebrow: 'Payment & Selection',
      title: 'Important information before you apply',
      introText: 'Understand how the payment schedule and fully funded selection work so you can choose the best registration type for you.',
      items: [
        { id: 'payment-schedule', icon: 'payment_schedule', title: 'Payment Schedule', body: 'All participants pay program fees in scheduled batches, not as a single upfront payment.' },
        { id: 'selection-quota', icon: 'selection_quota', title: 'Selection Quota', body: 'Fully funded slots are limited and competitive based on qualifications and available funding.' },
        { id: 'fully-funded-process', icon: 'fully_funded_process', title: 'Fully Funded Process', body: 'If selected for fully funded, you complete the program at no personal cost — fees are covered by our sponsors.' },
        { id: 'self-funded-guarantee', icon: 'self_funded_guarantee', title: 'Refund Policy', body: 'Self-funded participants who are declined receive a full refund in line with our refund policy.' },
      ],
      note: 'All payments are processed securely. For queries, contact our support team.',
    },
    participant_demographics: {
      eyebrow: 'Participant Geography',
      title: 'Participant Distribution by Country',
      country_levels: {
        'China': 'high', 'Indonesia': 'high', 'Japan': 'high', 'Pakistan': 'high',
        'India': 'medium', 'Malaysia': 'medium', 'South Korea': 'medium', 'Turkey': 'medium',
        'United States of America': 'low', 'Brazil': 'low', 'Germany': 'low', 'Australia': 'low',
        'Nigeria': 'low', 'France': 'low', 'Canada': 'low',
      },
      country_participants: {
        'China': 520, 'Indonesia': 380, 'Japan': 290, 'Pakistan': 210,
        'India': 160, 'Malaysia': 140, 'South Korea': 130, 'Turkey': 110,
        'United States of America': 95, 'Brazil': 70, 'Germany': 65, 'Australia': 55,
        'Nigeria': 50, 'France': 45, 'Canada': 40,
      },
      legend: { high: 'High participation', medium: 'Medium participation', low: 'Low participation', none: 'No participants' },
    },
    promo_cta: {
      eyebrow: 'Ready to Lead?',
      title: 'Ready to Lead? Join China Youth Summit 2026!',
      subtitle: 'Be part of a transformative experience connecting young leaders from 60+ countries. Apply now and shape the future.',
      primary_cta_label: 'Apply Now',
      primary_cta_href: '/apply',
      video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      video_title: 'CYS 2026 Registration Guideline',
      video_description: 'Watch this short walkthrough to understand the registration flow, required documents, and key deadlines.',
    },
  };

  await prisma.brand.upsert({
    where: { slug: BRANDS.CYS },
    update: {
      about: 'China Youth Summit (CYS) is a premier international youth leadership program bridging young people across China, Asia, and the world. Through summit sessions, innovation challenges, and cultural exchanges, CYS empowers the next generation to lead with purpose.',
      vision: 'To be the leading platform that connects and empowers the brightest young minds across Asia and the world.',
      mission: 'To cultivate globally-minded, culturally aware, and purpose-driven leaders through impactful youth summit experiences.',
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
      metadata: cysMetadata,
    },
    create: {
      id: 'c1a2e3f4-0000-4000-8000-111122223333',
      name: 'China Youth Summit',
      slug: BRANDS.CYS,
      description: 'Connecting young leaders across China and Asia.',
      about: 'China Youth Summit (CYS) is a premier international youth leadership program bridging young people across China, Asia, and the world. Through summit sessions, innovation challenges, and cultural exchanges, CYS empowers the next generation to lead with purpose.',
      vision: 'To be the leading platform that connects and empowers the brightest young minds across Asia and the world.',
      mission: 'To cultivate globally-minded, culturally aware, and purpose-driven leaders through impactful youth summit experiences.',
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
      metadata: cysMetadata,
    },
  });

  log('✅ Brands created');
}


import { prisma, log, error } from './utils';
import { BRANDS } from './seed-brands';
import { JYS_2026_DATA } from './data/jys-2026-data';
import { buildLegacySubmissionFormFields } from './data/shared-submission-form-fields';
import { 
  PricingFeeType, 
  FaqCategory, 
  ApplicationCategory, 
  AssessmentType 
} from '@prisma/client';

export async function seedJYSPrograms() {
  log('🌱 Seeding Exhaustive JYS Programs...');

  const brand = await prisma.brand.findUnique({ where: { slug: BRANDS.JYS } });
  if (!brand) return error('JYS Brand not found');

  const { 
    program: programData, 
    participationCategories,
    subthemes, 
    objectives,
    timeline,
    schedule,
    pricingTiers, 
    requirements,
    essays,
    faqs,
    awards,
    team,
    resources,
    announcements,
    participationInfo
  } = JYS_2026_DATA;

  // ==========================================
  // JYS 2026 Main Program
  // ==========================================
  const programFields = {
    name: programData.name,
    slug: programData.slug,
    theme: programData.theme,
    description: programData.description,
    shortDescription: programData.shortDescription,
    year: programData.year,
    location: programData.location,
    startDate: new Date(programData.startDate),
    endDate: new Date(programData.endDate),
    applicationDeadline: new Date(programData.applicationDeadline),
    thumbnailUrl: programData.logoUrl, // Using logo as thumbnail
    bannerUrl: programData.bannerUrl,
    logoUrl: programData.logoUrl,
    benefitsDescription: programData.benefitsDescription,
    requirementsDescription: programData.requirementsDescription,
    termsAndConditions: programData.termsAndConditions,
  };

  const jys2026 = await prisma.program.upsert({
    where: {
      brandId_slug: { brandId: brand.id, slug: programData.slug },
    },
    update: {
      isActive: true,
      isPublished: true,
      status: 'published',
      allowRegistration: true,
      isVisibleToUsers: true,
      ...programFields,
    },
    create: {
      brandId: brand.id,
      ...programFields,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: true,
      status: 'published',
      allowRegistration: true,
      requirePayment: true,
    },
  });

  const jysContentSeeded =
    (await prisma.programEssay.count({ where: { programId: jys2026.id } })) > 0 ||
    (await prisma.applicationFormField.count({ where: { programId: jys2026.id } })) > 0;
  if (jysContentSeeded) {
    log('  → JYS 2026 content already seeded, skipping');
    log('✅ Exhaustive JYS Programs seeded');
    return;
  }

  // ==========================================
  // Objectives
  // ==========================================
  await prisma.programObjective.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programObjective.createMany({
    data: objectives.map(o => ({ programId: jys2026.id, ...o })),
  });

  // ==========================================
  // Participation Categories
  // ==========================================
  await prisma.programParticipationCategory.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programParticipationCategory.createMany({
    data: participationCategories.map(c => ({ programId: jys2026.id, ...c })),
  });

  // ==========================================
  // Subthemes
  // ==========================================
  await prisma.programSubtheme.deleteMany({ where: { programId: jys2026.id } });
  for (const s of subthemes) {
    await prisma.programSubtheme.create({
      data: { programId: jys2026.id, ...s, isActive: true },
    });
  }

  // ==========================================
  // Timeline
  // ==========================================
  await prisma.programTimeline.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programTimeline.createMany({
    data: timeline.map(t => ({
      programId: jys2026.id,
      title: t.title,
      description: t.description,
      date: new Date(t.date),
      endDate: t.endDate ? new Date(t.endDate) : null,
      order: t.order,
      isActive: true,
    })),
  });

  // ==========================================
  // Schedule
  // ==========================================
  await prisma.programSchedule.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programSchedule.createMany({
    data: schedule.map(s => ({
      programId: jys2026.id,
      ...s
    })),
  });

  // ==========================================
  // Pricing Tiers
  // ==========================================
  await prisma.programPricingTier.deleteMany({ where: { programId: jys2026.id } });
  for (const tier of pricingTiers) {
    await prisma.programPricingTier.create({
      data: {
        programId: jys2026.id,
        name: tier.name,
        description: tier.description,
        price: tier.price,
        currency: tier.currency,
        feeType: tier.feeType as PricingFeeType,
        allowedCategories: tier.allowedCategories as ApplicationCategory[],
        benefits: tier.benefits,
        isActive: true,
      },
    });
  }

  // ==========================================
  // Requirements
  // ==========================================
  await prisma.programRequirement.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programRequirement.createMany({
    data: requirements.map(r => ({
      programId: jys2026.id,
      ...r,
      isActive: true,
    })),
  });

  // ==========================================
  // Application Form Fields
  // ==========================================
  await prisma.applicationFormField.deleteMany({ where: { programId: jys2026.id } });
  await prisma.applicationFormField.createMany({
    data: buildLegacySubmissionFormFields().map(f => ({
      programId: jys2026.id,
      ...f,
      isActive: true,
    })),
  });

  // ==========================================
  // Essays
  // ==========================================
  await prisma.programEssay.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programEssay.createMany({
    data: essays.map(e => ({
      programId: jys2026.id,
      ...e,
      isActive: true,
    })),
  });

  // ==========================================
  // FAQs
  // ==========================================
  await prisma.programFaq.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programFaq.createMany({
    data: faqs.map((faq, i) => ({
      programId: jys2026.id,
      question: faq.question,
      answer: faq.answer,
      category: FaqCategory.general,
      order: i + 1,
      isActive: true,
    })),
  });

  // ==========================================
  // Awards
  // ==========================================
  await prisma.programAward.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programAward.createMany({
    data: awards.map(a => ({
      programId: jys2026.id,
      ...a,
    })),
  });

  // ==========================================
  // Team
  // ==========================================
  await prisma.programTeam.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programTeam.createMany({
    data: team.map(t => ({
      programId: jys2026.id,
      ...t,
      isActive: true,
    })),
  });

  // ==========================================
  // Resources
  // ==========================================
  await prisma.programResource.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programResource.createMany({
    data: resources.map(r => ({
      programId: jys2026.id,
      ...r,
    })),
  });

  // ==========================================
  // Announcements
  // ==========================================
  await prisma.programAnnouncement.deleteMany({ where: { programId: jys2026.id } });
  await prisma.programAnnouncement.createMany({
    data: announcements.map(a => ({
      programId: jys2026.id,
      ...a,
    })),
  });

  // ==========================================
  // Participation Info
  // ==========================================
  await prisma.programParticipationInfo.deleteMany({ where: { programId: jys2026.id } });
  for (const info of participationInfo) {
    await prisma.programParticipationInfo.create({
      data: {
        programId: jys2026.id,
        category: info.category as ApplicationCategory,
        benefits: info.benefits,
        requirements: info.requirements,
      },
    });
  }

  log('✅ Exhaustive JYS Programs seeded');
}

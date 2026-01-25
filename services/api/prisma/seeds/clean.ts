import { prisma, log } from './utils';

export async function cleanDatabase() {
  log('🧹 Cleaning database...');

  // 1. Child tables of Program
  await prisma.participantApplication.deleteMany({});
  await prisma.programPricingTier.deleteMany({});
  await prisma.programEssay.deleteMany({});
  await prisma.programSubtheme.deleteMany({});
  await prisma.programSpeaker.deleteMany({});
  await prisma.programGallery.deleteMany({});
  await prisma.programSchedule.deleteMany({});
  await prisma.programFaq.deleteMany({});
  // Add other program related tables if necessary
  
  // 2. Program
  await prisma.program.deleteMany({});

  // 3. Admin & User (Linked to Brands)
  await prisma.admin.deleteMany({});
  await prisma.user.deleteMany({});

  // 4. Brands (ProgramCategory)
  await prisma.programCategory.deleteMany({});
  
  log('✨ Database cleaned');
}

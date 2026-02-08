import { prisma, log } from './utils';

export async function cleanDatabase() {
  log('🧹 Cleaning database using TRUNCATE CASCADE (Super Fast)...');

  // These are the main tables that will cascade to everything else
  const tables = [
    'application_assessments',
    'application_invoices',
    'participant_awards',
    'participant_documents',
    'participant_applications',
    'program_pricing_tiers',
    'program_essays',
    'program_subthemes',
    'program_speakers',
    'program_gallery',
    'program_schedules',
    'program_faqs',
    'programs',
    'admins',
    'user_identities',
    'users',
    'brands',
    'auth_providers'
  ];

  try {
    const query = `TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
    await prisma.$executeRawUnsafe(query);
    log('✨ Database cleaned successfully');
  } catch (e) {
    log('⚠️ TRUNCATE failed. Falling back to deleteMany (slower)...');

    // Fallback if TRUNCATE fails for some reason
    const modelNames = [
      'applicationAssessment',
      'applicationInvoice',
      'participantAward',
      'participantDocument',
      'participantApplication',
      'programPricingTier',
      'programEssay',
      'programSubtheme',
      'programSpeaker',
      'programGallery',
      'programSchedule',
      'programFaq',
      'program',
      'admin',
      'userIdentity',
      'user',
      'brand'
    ];

    for (const model of modelNames) {
      try {
        // @ts-ignore
        await prisma[model].deleteMany({});
      } catch (err) {
        // Skip if table doesn't exist or other minor error
      }
    }
  }
}

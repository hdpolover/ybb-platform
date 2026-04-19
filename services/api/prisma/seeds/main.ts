import { prisma, log, error } from './utils';
import { cleanDatabase } from './clean';
import { seedAuth } from './seed-auth';
import { seedBrands } from './seed-brands';
// import { seedFromCSV } from './seed-csv';
// import { seedExtendedCSV } from './seed-csv-extended';
import { seedDummyContent } from './seed-dummy-content';
import { seedBrandContent } from './seed-brand-content';
import { seedAdmins } from './seed-admins';
import { seedIYSPrograms } from './seed-programs-iys';
import { seedJYSPrograms } from './seed-programs-jys';
import { seedCYSPrograms } from './seed-programs-cys';
import { seedParticipants } from './seed-participants';
import { seedScoring } from './seed-scoring';
import { seedSystemFormFields } from './seed-system-form-fields';
import { seedFormTemplates } from './seed-form-templates';

async function main() {
  log('🚀 Starting Full Database Seed...');
  try {
    // cleanDatabase() is intentionally NOT called here — it would wipe all user data.
    // Run `ts-node prisma/seeds/clean.ts` explicitly if you need a fresh start.
    if (process.env.FORCE_CLEAN === 'true') {
      log('⚠️  FORCE_CLEAN=true detected. Wiping database...');
      await cleanDatabase();
    }

    await seedAuth();

    // Remote Migration for Brands & Programs
    log('🌏 Running Remote Data Migration (Brands & Programs)...');
    try {
      const { migrateBrands } = require('./internal/migrate-brands');
      const { migratePrograms } = require('./internal/migrate-programs');
      const { migrateMetadata } = require('./internal/migrate-metadata');

      await migrateBrands();
      await migratePrograms();
      await migrateMetadata();
      log('✅ Remote Migration Completed');
    } catch (err) {
      error('Remote Migration failed, falling back to manual seeds');
      console.error(err);
      await seedBrands();
      await seedIYSPrograms();
      await seedJYSPrograms();
      await seedCYSPrograms();
    }

    await seedBrands(); // Ensure all brands (including new ones like CYS) are seeded
    await seedBrandContent();

    // Seed Dummy/Standard Content
    await seedDummyContent();
    // await seedIYSPrograms(); // Replaced by migratePrograms
    await seedJYSPrograms();
    await seedCYSPrograms();
    await seedAdmins();

    // Seed System Form Field catalog (for the form field picker)
    await seedSystemFormFields();
    await seedFormTemplates();

    // Seed Participants & Apps
    await seedParticipants();

    // Seed Scoring
    await seedScoring();

    // await seedYAFPrograms(); // Removed
    // await seedYAFPrograms(); // Removed
    // await seedOtherPrograms(); // Removed

    log('🎉 All seeds completed successfully!');
  } catch (e) {
    error('Seeding Failed');
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

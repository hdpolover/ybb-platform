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
import { seedParticipants } from './seed-participants';
import { seedScoring } from './seed-scoring';

async function main() {
  log('🚀 Starting Full Database Seed...');
  try {
    // Only clean database in development or if env variable FORCE_CLEAN is set
    // In staging/production, we generally want to UPSERT data, not wipe it.
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
        log('ℹ️ Environment is ' + process.env.NODE_ENV + '. Skipping cleanDatabase() to preserve data.');
    } else {
        await cleanDatabase();
    }
    
    await seedAuth();
    await seedBrands();
    await seedBrandContent();
    await seedAdmins();
    
    // Seed Programs
    // await seedYBBPrograms(); // Removed
    // await seedFromCSV();
    // await seedExtendedCSV();
    await seedDummyContent();
    await seedIYSPrograms();
    
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

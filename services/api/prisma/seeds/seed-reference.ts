import { prisma, log, error } from './utils';
import { seedAuth } from './seed-auth';
import { seedSystemFormFields } from './seed-system-form-fields';

async function main() {
  log('🌱 Seeding reference/catalog data...');
  try {
    await seedAuth();
    await seedSystemFormFields();
    log('✅ Reference data ready.');
  } catch (e) {
    error('Reference seed failed');
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

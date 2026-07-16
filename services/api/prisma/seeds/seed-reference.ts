import { prisma, log, error } from './utils';
import { seedAuth } from './seed-auth';
import { seedSystemFormFields } from './seed-system-form-fields';
import { seedFormTemplates } from './seed-form-templates';

async function main() {
  log('🌱 Seeding reference/catalog data...');
  try {
    await seedAuth();
    await seedSystemFormFields();
    await seedFormTemplates();
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

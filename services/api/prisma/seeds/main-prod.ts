import { prisma, log, error } from './utils';
import { seedAuth } from './seed-auth';
import { seedBrands } from './seed-brands';
import { seedAdmins } from './seed-admins';

/**
 * Production-only seed.
 * Runs only the essential reference data and super admin account.
 * Does NOT seed dummy content, programs, participants, or scoring.
 *
 * Execution order matters:
 *  1. seedAuth  — auth providers (upsert-safe)
 *  2. seedBrands — brand reference data required by seedAdmins
 *  3. seedAdmins — super admin + platform admin accounts
 */
async function main() {
  log('🚀 Starting Production Seed (minimal)...');
  try {
    await seedAuth();
    await seedBrands();
    await seedAdmins();
    log('🎉 Production seed completed successfully!');
  } catch (e) {
    error('Production seed failed');
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

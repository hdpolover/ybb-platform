import { prisma, log, error } from './utils';
import { seedAuth } from './seed-auth';
import { seedSystemFormFields } from './seed-system-form-fields';

/**
 * Postgres advisory lock key for the reference seed.
 *
 * Arbitrary but must stay stable — it only has to be distinct from any other
 * advisory lock this system takes. Prisma's own migration lock uses a different
 * key, so these do not collide.
 */
const REFERENCE_SEED_LOCK_KEY = 4820_2601;

async function main() {
  log('🌱 Seeding reference/catalog data...');
  try {
    // Serialise across replicas. Every seed step here is an upsert, which is
    // idempotent on its own but NOT safe to run concurrently: two replicas
    // upserting the same row can deadlock or race the unique constraint.
    // `prisma migrate deploy` already takes its own advisory lock, so
    // migrations were safe; this closes the same gap for the seed.
    //
    // A session-level lock, so it is released automatically if the process dies
    // mid-seed rather than wedging every future boot. pg_advisory_lock blocks
    // until it is granted, which is what we want — the second replica should
    // wait a moment and then find nothing to do, not skip the seed entirely.
    await prisma.$executeRaw`SELECT pg_advisory_lock(${REFERENCE_SEED_LOCK_KEY}::bigint)`;
    try {
      await seedAuth();
      await seedSystemFormFields();
    } finally {
      await prisma.$executeRaw`SELECT pg_advisory_unlock(${REFERENCE_SEED_LOCK_KEY}::bigint)`;
    }
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

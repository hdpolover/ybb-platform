import { migrateBrands } from './migrate-brands';
import { migratePrograms } from './migrate-programs';
import { disconnectPrisma } from './prisma-config';

async function main() {
    console.log('🚀 Starting Remote Data Migration...');
    const start = Date.now();

    try {
        // Step 1: Brands
        await migrateBrands();

        // Step 2: Programs
        await migratePrograms();

        // Step 3: Users (Coming soon)
        // await migrateUsers();

        const duration = ((Date.now() - start) / 1000).toFixed(2);
        console.log(`\n✅ Remote Migration Successful! Total duration: ${duration}s`);
    } catch (error) {
        console.error('\n❌ Critical Migration Failure:');
        console.error(error);
        process.exit(1);
    } finally {
        await disconnectPrisma();
    }
}

main().catch(console.error);

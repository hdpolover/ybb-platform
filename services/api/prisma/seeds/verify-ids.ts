import { prisma, disconnectPrisma } from './internal/prisma-config';

async function run() {
    console.log('--- BRANDS ---');
    const brands = await prisma.brand.findMany({
        select: { id: true, name: true, legacyId: true }
    });
    console.log(JSON.stringify(brands, null, 2));

    console.log('\n--- PROGRAMS ---');
    const progs = await prisma.program.findMany({
        select: { id: true, name: true, brandId: true }
    });
    console.log(JSON.stringify(progs, null, 2));

    await disconnectPrisma();
}

run();

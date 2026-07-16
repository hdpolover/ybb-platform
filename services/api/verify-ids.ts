import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    console.log('--- BRANDS ---');
    const brands = await prisma.brand.findMany({
        select: { id: true, name: true, legacyId: true }
    });
    console.log(brands);

    console.log('\n--- PROGRAMS ---');
    const progs = await prisma.program.findMany({
        select: { id: true, name: true, brandId: true }
    });
    console.log(progs);

    await prisma.$disconnect();
}

run();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const brandId = 'ca586883-4181-44a1-b949-39dc4a69ade8';
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    console.log('Brand:', brand?.name);

    const progs = await prisma.program.findMany({
        where: { brandId }
    });

    console.log('--- Programs for Brand ---');
    for (const p of progs) {
        console.log(`- ${p.name} (id: ${p.id})`);
        console.log(`  Published: ${p.isPublished}`);
        console.log(`  Active: ${p.isActive}`);
        console.log(`  Visible to Users: ${p.isVisibleToUsers}`);
        console.log(`  Status: ${p.status}`);
    }

    await prisma.$disconnect();
}

run();

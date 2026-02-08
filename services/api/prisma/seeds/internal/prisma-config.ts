import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

let connectionString = process.env.DATABASE_URL || 'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';

// Improved Docker detection
const isDocker = process.env.IS_DOCKER === 'true' ||
    require('fs').existsSync('/.dockerenv') ||
    (process.env.HOSTNAME && process.env.HOSTNAME.includes('ybb-api'));

if (connectionString.includes('postgres-api')) {
    if (!isDocker) {
        console.log('ℹ️ Host machine detected, swapping postgres-api with localhost:5438');
        connectionString = connectionString.replace('postgres-api:5432', 'localhost:5438');
    } else {
        console.log('🐳 Docker container detected, keeping postgres-api:5432');
    }
}

export const pool = new Pool({ connectionString });
export const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

export const log = (msg: string) => console.log(`[SEED] ${msg}`);
export const error = (msg: string) => console.error(`[SEED ERROR] ${msg}`);

export async function disconnectPrisma() {
    await prisma.$disconnect();
    await pool.end();
}

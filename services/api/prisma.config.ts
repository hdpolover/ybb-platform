import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

console.log('PRISMA CONFIG: Resolving configuration...');
const dbUrl = process.env.DATABASE_URL || env('DATABASE_URL');
console.log('PRISMA CONFIG: DATABASE_URL is ' + (dbUrl ? 'set' : 'EMPTY'));
console.log('PRISMA CONFIG: DATABASE_URL host -> ' + (dbUrl ? dbUrl.split('@')[1] : 'N/A'));

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts'
  },
  datasource: {
    url: dbUrl,
  },
});

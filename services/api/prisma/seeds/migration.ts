import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load env vars from project root (assuming running from services/api)
dotenv.config({ path: '../../.env' });
// Or try explicit if above fails, but standard is process.env.DATABASE_URL
if (!process.env.DATABASE_URL) {
    // try local .env
    dotenv.config();
}
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Loaded' : 'Missing');

const connectionString = process.env.DATABASE_URL?.replace('postgres-api:5432', 'localhost:5438');
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Absolute path to migration data based on project structure
const MIGRATION_DATA_PATH = path.resolve(__dirname, '../../../../migration_data');

async function readCsv<T>(fileName: string): Promise<T[]> {
    const filePath = path.join(MIGRATION_DATA_PATH, fileName);
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${fileName}. Skipping.`);
        return [];
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    // CSVs have no headers, so we used 'columns: false' and get arrays of strings
    return parse(fileContent, {
        columns: false,
        skip_empty_lines: true,
        relax_column_count: true,
        delimiter: '\t',
        relax_quotes: true,
    }) as unknown as T[];
}

// --- Interfaces based on MySQL DESCRIBE & CSV inspection ---

// users.csv: id, name, email, ???, password_hash, ...
type UserRow = [string, string, string, string, string, string, string, string, string, string, string, string];

// programs.csv: id, brand_id(maybe?), name, slug, description, ..., year, ...
type ProgramRow = string[];

// participants.csv: id, user_id, program_id, ..., full_name, email, phone, ...
type ParticipantRow = string[];

// payments.csv
type PaymentRow = string[];

// program_categories.csv
type CategoryRow = string[];

// program_schedules.csv
type ScheduleRow = string[];


// Helper to parse dates safely
function parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr === 'NULL' || dateStr.trim() === '') return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

async function main() {
    console.log('Starting migration...');

    // 0. Ensure Brand Exists
    console.log('Ensuring default Brand...');
    const brand = await prisma.brand.upsert({
        where: { slug: 'ybb-foundation' },
        update: {},
        create: {
            name: 'YBB Foundation',
            slug: 'ybb-foundation',
            description: 'Youth Break the Boundaries Foundation',
        },
    });
    console.log(`Brand ID: ${brand.id}`);

    // 1. Users
    console.log('Migrating Users...');
    const users = await readCsv<UserRow>('users.csv');
    for (const row of users) {
        try {
            const legacyId = parseInt(row[0]);
            const fullName = row[1];
            const email = row[2];
            // row[4] seems to be password hash based on typical pos
            const passwordHash = row[4] && row[4].length > 10 ? row[4] : null;

            if (!email || !email.includes('@')) continue;

            await prisma.user.upsert({
                where: { email_brandId: { email, brandId: brand.id } },
                update: {
                    legacyId,
                    passwordHash, // Update password if changed
                },
                create: {
                    email,
                    brandId: brand.id,
                    legacyId,
                    passwordHash,
                    isActive: true,
                    emailVerified: true, // Assuming old users are verified
                    // Handle full name? User model doesn't have fullName, it's in Participant/Admin. 
                    // We'll create a Participant profile for everyone as a fallback, 
                    // or just rely on the participants table to populate the profile.
                },
            });
        } catch (e) {
            console.error(`Error migrating user ${row[0]}:`, e);
        }
    }

    // 2. Programs
    console.log('Migrating Programs...');
    const programs = await readCsv<ProgramRow>('programs.csv');
    const programMap = new Map<number, string>(); // legacyId -> uuid

    for (const row of programs) {
        try {
            const legacyId = parseInt(row[0]);
            const name = row[2]; // Based on inspection, col 2 is name
            // const slug = row[3] || name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
            const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + legacyId; // Ensure unique

            const year = new Date().getFullYear(); // Default validation

            const created = await prisma.program.upsert({
                where: { legacyId },
                update: { name },
                create: {
                    brandId: brand.id,
                    name,
                    slug,
                    year,
                    legacyId,
                    startDate: parseDate(row[4]) || new Date(),
                    endDate: parseDate(row[5]) || new Date(),
                    applicationDeadline: parseDate(row[4]) || new Date(), // fallback to start date
                },
            });
            programMap.set(legacyId, created.id);
        } catch (e) {
            console.error(`Error migrating program ${row[0]}:`, e);
        }
    }

    // 3. Program Categories
    console.log('Migrating Program Categories...');
    const categories = await readCsv<CategoryRow>('program_categories.csv');
    for (const row of categories) {
        try {
            // row: id, program_id, name, description, ...
            const legacyProgramId = parseInt(row[1]);
            const programId = programMap.get(legacyProgramId);
            const name = row[2];

            if (programId && name) {
                await prisma.programParticipationCategory.create({
                    data: {
                        programId,
                        name,
                        description: row[3],
                    },
                });
            }
        } catch (e) {
            console.error(`Error migrating category ${row[0]}:`, e);
        }
    }

    // 4. Participants & Applications
    console.log('Migrating Participants & Applications...');
    const participants = await readCsv<ParticipantRow>('participants.csv');

    for (const row of participants) {
        try {
            // Based on `DESCRIBE participants`:
            // id, user_id, program_id, payment_status(maybe?), ... 
            // but wait, `participants.csv` has many columns. 
            // Let's assume based on `head`:
            // Col 0: id? No, looks like 1, 2, 3...
            // Col 1: user_id (legacy)
            // Col 2: program_id (legacy)
            // Col 4: full_name (e.g. "suhendra")
            // Col 6: birthdate? "2011-06-14"
            // Col 7: gender "male"
            // Col 9: phone "+62813..."

            const legacyId = parseInt(row[0]);
            const legacyUserId = parseInt(row[1]);
            const legacyProgramId = parseInt(row[2]);

            // Find user by legacy ID
            const user = await prisma.user.findUnique({ where: { legacyId: legacyUserId } });
            const programId = programMap.get(legacyProgramId);

            if (user && programId) {
                // 4a. Create/Update Participant Profile
                const participant = await prisma.participant.upsert({
                    where: { userId: user.id },
                    update: {
                        fullName: row[4],
                        phoneNumber: row[9],
                        birthdate: parseDate(row[6]),
                        legacyId: legacyId, // Track legacy participant ID
                    },
                    create: {
                        userId: user.id,
                        fullName: row[4] || 'Unknown',
                        phoneNumber: row[9],
                        birthdate: parseDate(row[6]),
                        legacyId: legacyId,
                    }
                });

                // 4b. Create Application
                await prisma.participantApplication.upsert({
                    where: { participantId_programId: { participantId: participant.id, programId } },
                    update: {},
                    create: {
                        participantId: participant.id,
                        programId: programId,
                        status: 'submitted', // Default
                    }
                });
            }

        } catch (e) {
            console.error(`Error migrating participant ${row[0]}:`, e);
        }
    }

    // 5. Payments -> ApplicationInvoice
    console.log('Migrating Payments...');
    const payments = await readCsv<PaymentRow>('payments.csv');
    for (const row of payments) {
        try {
            // payments.csv: id, user_id, program_id, amount, status(0/1), proof_url, ...
            // We need to map this to the ApplicationInvoice, linked to the Application

            const legacyUserId = parseInt(row[1]);
            const legacyProgramId = parseInt(row[2]);
            const amount = parseFloat(row[3]);
            const statusRaw = row[5]; // 1 = paid?
            const proofUrl = row[4];

            const user = await prisma.user.findUnique({ where: { legacyId: legacyUserId } });
            const programId = programMap.get(legacyProgramId);

            if (user && programId) {
                // Find the application
                // We need the participant ID first
                const participant = await prisma.participant.findUnique({ where: { userId: user.id } });
                if (participant) {
                    const application = await prisma.participantApplication.findUnique({
                        where: { participantId_programId: { participantId: participant.id, programId } }
                    });

                    if (application) {
                        // Find or create a pricing tier for this amount
                        let pricingTier = await prisma.programPricingTier.findFirst({
                            where: { programId, price: amount }
                        });

                        if (!pricingTier) {
                            // Create a legacy tier for this amount
                            pricingTier = await prisma.programPricingTier.create({
                                data: {
                                    programId,
                                    name: `Legacy Payment Tier (${amount})`,
                                    price: amount,
                                    description: 'Auto-generated during migration',
                                }
                            });
                        }

                        await prisma.applicationInvoice.create({
                            data: {
                                applicationId: application.id,
                                pricingTierId: pricingTier.id,
                                amount: amount || 0,
                                currency: 'IDR',
                                status: statusRaw === '1' ? 'paid' : 'unpaid',
                                paymentMethod: 'manual_transfer',
                                externalTransactionId: proofUrl ? proofUrl.substring(0, 100) : null,
                            }
                        });

                        // Update application status
                        if (statusRaw === '1') {
                            await prisma.participantApplication.update({
                                where: { id: application.id },
                                data: { registrationPaymentStatus: 'paid' }
                            });
                        }
                    }
                }
            }

        } catch (e) {
            console.error(`Error migrating payment ${row[0]}:`, e);
        }
    }

    // 6. Program Schedules
    console.log('Migrating Schedules...');
    const schedules = await readCsv<ScheduleRow>('program_schedules.csv');
    for (const row of schedules) {
        try {
            // id, program_id, name, desc, start, end
            const legacyProgramId = parseInt(row[1]);
            const programId = programMap.get(legacyProgramId);

            if (programId) {
                const startDate = parseDate(row[4]);
                const endDate = parseDate(row[5]);

                if (startDate) { // Only create if start date is valid
                    await prisma.programSchedule.create({
                        data: {
                            programId,
                            activity: row[2], // name -> activity
                            description: row[3],
                            day: startDate.toISOString().split('T')[0], // YYYY-MM-DD
                            startTime: startDate.toTimeString().substring(0, 5), // HH:MM
                            endTime: endDate ? endDate.toTimeString().substring(0, 5) : null, // HH:MM
                        }
                    });
                }
            }
        } catch (e) {
            console.error(`Error migrating schedule ${row[0]}:`, e);
        }
    }

    console.log('Migration complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

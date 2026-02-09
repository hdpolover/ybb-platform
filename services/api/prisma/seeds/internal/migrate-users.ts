import { createMysqlConnection } from './mysql-config';
import { prisma, log, error } from '../utils';

export async function migrateUsers() {
    log('🚀 Migrating Users, Participants, and Applications...');
    const conn = await createMysqlConnection();

    try {
        // 1. Pre-fetch Programs to map Legacy Program ID -> { id, brandId }
        const programs = await prisma.program.findMany({
            select: { id: true, brandId: true, legacyId: true }
        });
        const programMap = new Map();
        programs.forEach(p => {
            if (p.legacyId) programMap.set(p.legacyId, p);
        });

        // 2. Pre-fetch Program Essays to map Legacy Essay ID -> { id, question }
        // We use the new UUID we generated in migrate-program-content.ts
        // Legacy ID X -> UUID '20000000-0000-0000-0000-00000000000X'
        const generateEssayId = (legacyId: number) => {
            return `20000000-0000-0000-0000-${legacyId.toString().padStart(12, '0')}`;
        };

        // 3. Process Participants in Batches - Incremental using Cursor
        // Get the last migrated legacy participant ID from ParticipantApplication table
        const lastMigratedId = await getLastMigratedParticipantId();
        log(`🔄 Incremental Migration: Resuming from Legacy Participant ID: ${lastMigratedId}`);

        const BATCH_SIZE = 500;
        let hasMore = true;
        let currentCursor = lastMigratedId;

        while (hasMore) {
            log(`Processing batch starting after ID ${currentCursor}...`);

            // Cursor-based pagination is faster and safer for incremental
            const query = `SELECT * FROM participants WHERE is_deleted = 0 AND id > ${currentCursor} ORDER BY id ASC LIMIT ${BATCH_SIZE}`;

            const [participants]: any = await conn.execute(query);

            if (participants.length === 0) {
                hasMore = false;
                break;
            }

            // Fetch related users for this batch (optimization)
            const userIds = participants.map((p: any) => p.user_id).filter((id: any) => id);
            if (userIds.length === 0) {
                // If no users in this batch, update cursor and continue to next batch
                currentCursor = participants[participants.length - 1].id;
                continue;
            }

            const [users]: any = await conn.execute(
                `SELECT * FROM users WHERE id IN (${userIds.join(',')})`
            );
            const userMap = new Map();
            users.forEach((u: any) => userMap.set(u.id, u));

            // Fetch related essays for this batch
            const participantIds = participants.map((p: any) => p.id);
            const [allEssays]: any = await conn.execute(
                `SELECT * FROM participant_essays WHERE participant_id IN (${participantIds.join(',')}) AND is_deleted = 0`
            );
            // Group essays by participant_id
            const essayMap = new Map();
            allEssays.forEach((e: any) => {
                if (!essayMap.has(e.participant_id)) essayMap.set(e.participant_id, []);
                essayMap.get(e.participant_id).push(e);
            });

            // Group participants by (email + brandId) to deduplicate User upserts
            const userUpsertMap = new Map<string, { legacyUser: any, programData: any, participants: any[] }>();

            for (const p of participants) {
                const programData = programMap.get(p.program_id);
                if (!programData) continue;
                const legacyUser = userMap.get(p.user_id);
                if (!legacyUser) continue;

                const key = `${legacyUser.email.toLowerCase()}|${programData.brandId}`;
                if (!userUpsertMap.has(key)) {
                    userUpsertMap.set(key, { legacyUser, programData, participants: [] });
                }
                userUpsertMap.get(key)?.participants.push(p);
            };

            // Process Users First (Parallel)
            // We map the keys to an array of promises
            const processedUsers = new Map<string, any>(); // key -> created userId

            await Promise.all(Array.from(userUpsertMap.entries()).map(async ([key, data]) => {
                const { legacyUser, programData } = data;
                const userEmail = legacyUser.email.toLowerCase();

                let requestUser;
                try {
                    requestUser = await prisma.user.upsert({
                        where: { email_brandId: { email: userEmail, brandId: programData.brandId } },
                        update: {}, // No update needed if exists
                        create: {
                            email: userEmail,
                            brandId: programData.brandId,
                            passwordHash: legacyUser.password,
                            isActive: legacyUser.is_active === 1,
                            emailVerified: legacyUser.is_email_verified === 1,
                            legacyId: legacyUser.id,
                            createdAt: legacyUser.created_at || new Date(),
                            identities: {
                                create: {
                                    providerId: (await getLocalProviderId()),
                                    providerUserId: null,
                                    providerEmail: userEmail,
                                    isPrimary: true
                                }
                            }
                        }
                    });
                } catch (e: any) {
                    // If legacyId unique constraint failed, retry without legacyId
                    if (e.code === 'P2002' && e.meta?.target?.includes('legacy_id')) {
                        requestUser = await prisma.user.upsert({
                            where: { email_brandId: { email: userEmail, brandId: programData.brandId } },
                            update: {},
                            create: {
                                email: userEmail,
                                brandId: programData.brandId,
                                passwordHash: legacyUser.password,
                                isActive: legacyUser.is_active === 1,
                                emailVerified: legacyUser.is_email_verified === 1,
                                // No legacyId
                                createdAt: legacyUser.created_at || new Date(),
                                identities: {
                                    create: {
                                        providerId: (await getLocalProviderId()),
                                        providerUserId: null,
                                        providerEmail: userEmail,
                                        isPrimary: true
                                    }
                                }
                            }
                        });
                    } else {
                        console.error(`Error Upserting User ${userEmail}:`, e);
                        return; // Skip this user and their participants
                    }
                }
                processedUsers.set(key, requestUser);
            }));

            // Now Process Participants (Parallel)
            await Promise.all(Array.from(userUpsertMap.entries()).map(async ([key, data]) => {
                const requestUser = processedUsers.get(key);
                if (!requestUser) return; // User creation failed

                const { programData, participants: userParticipants, legacyUser } = data;

                // Process all participants for this user
                for (const p of userParticipants) {

                    // ... (rest of logic)
                    try {
                        // B. Upsert Participant Profile
                        // We need to ensure only ONE profile per user.
                        // Upsert using userId (if unique index exists?).
                        // Participant has `userId` unique?
                        // Let's check schema: `model Participant { ... userId String @unique ... }`
                        // Yes! So we can use upsert on userId.

                        const profile = await prisma.participant.upsert({
                            where: { userId: requestUser.id },
                            update: {}, // Keep existing profile
                            create: {
                                userId: requestUser.id,
                                fullName: p.full_name || legacyUser.name,
                                phoneNumber: p.phone_number,
                                nationality: p.nationality,
                                currentCity: p.city,
                                currentAddress: p.address,
                                gender: mapGender(p.gender),
                                tshirtSize: p.tshirt_size,
                                emergencyContactName: p.emergency_account,
                                emergencyContactPhone: (p.emergency_phone_flag || '') + (p.emergency_account || ''),
                                instagramUsername: p.instagram_account,
                                resumeUrl: p.resume_url,
                                knowledgeSource: p.knowledge_source,
                                referralCode: p.referral_code,
                                occupation: p.institution ? 'Student/Professional' : undefined,
                                institution: p.institution,
                                createdAt: p.created_at || new Date(),
                                // No legacyId
                            }
                        });

                        // C. Upsert Participant Application
                        const essays = essayMap.get(p.id) || [];
                        const essayAnswers: any = {};
                        essays.forEach((e: any) => {
                            const key = generateEssayId(e.program_essay_id);
                            essayAnswers[key] = e.answer;
                        });

                        const appId = `00000000-0000-0000-0000-${p.id.toString().padStart(12, '0')}`;
                        const status = mapStatus(p.payment_status, p.is_submited);
                        const paymentStatus = mapPaymentStatus(p.payment_status);

                        await prisma.participantApplication.upsert({
                            where: { id: appId },
                            update: {
                                status: status,
                                registrationPaymentStatus: paymentStatus,
                                programPaymentStatus: 'unpaid',
                                essayAnswers,
                                submittedAt: p.is_submited ? (p.updated_at || new Date()) : null,
                                personalData: {},
                            },
                            create: {
                                id: appId,
                                programId: programData.id,
                                participantId: profile.id,
                                status: status,
                                registrationPaymentStatus: paymentStatus,
                                programPaymentStatus: 'unpaid',
                                essayAnswers,
                                submittedAt: p.is_submited ? (p.updated_at || new Date()) : null,
                                personalData: {},
                                createdAt: p.created_at || new Date(),
                            }
                        });
                    } catch (err) {
                        // console.error(`Error processing participant ${p.id}:`, err);
                    }
                }

            })); // End Promise.all

            // Update cursor to the last processed ID
            if (participants.length > 0) {
                currentCursor = participants[participants.length - 1].id;
            }
        }

        log('✅ User and Participant migration finished.');

    } catch (e) {
        error('User migration failed');
        console.error(e);
    } finally {
        await conn.end();
    }
}

// Helpers
async function getLastMigratedParticipantId(): Promise<number> {
    // We generated ParticipantApplication ID as `00000000-0000-0000-0000-XXXXXXXXXXXX` (12 digits legacy ID)
    // We can find the max ID by querying DB.
    // Since lexicographical sort of UUIDs works for this format (zeros + digits), we can just take MAX(id).

    // However, we must filter only those matching our prefix to avoid mixing with other UUIDs?
    // Our prefix is `00000000-0000-0000-0000-`

    const PREFIX = '00000000-0000-0000-0000-';

    // Prisma queryRaw to retrieve the max ID starting with prefix
    const [result]: any = await prisma.$queryRaw`
        SELECT id FROM participant_applications 
        WHERE id::text LIKE '00000000-0000-0000-0000-%'
        ORDER BY id DESC 
        LIMIT 1
    `;

    if (result && result.id) {
        // Extract the legacy ID part
        const lastPart = result.id.replace(PREFIX, '');
        return parseInt(lastPart, 10);
    }

    return 0; // Default start from beginning
}

let _localProviderId: string | null = null;
async function getLocalProviderId() {
    if (_localProviderId) return _localProviderId;
    const provider = await prisma.authProvider.findUnique({ where: { name: 'local' } });
    if (provider) {
        _localProviderId = provider.id;
        return provider.id;
    }
    // Create if missing
    const newProvider = await prisma.authProvider.create({
        data: { name: 'local', displayName: 'Email & Password' }
    });
    _localProviderId = newProvider.id;
    return newProvider.id;
}

function mapGender(g: string) {
    if (!g) return null;
    const lower = g.toLowerCase();
    if (lower.includes('female') || lower === 'f') return 'female';
    if (lower.includes('male') || lower === 'm') return 'male';
    return 'other';
}

function mapStatus(paymentStatus: string, isSubmitted: number): any {
    // If submitted -> submitted
    // If not submitted -> draft
    if (isSubmitted === 1) return 'submitted';
    return 'draft';
}

function mapPaymentStatus(status: string): any {
    if (!status) return 'unpaid';
    const s = status.toLowerCase();
    if (s === 'paid' || s === 'settlement' || s === 'success') return 'paid';
    if (s === 'pending') return 'processing';
    if (s === 'failure' || s === 'deny' || s === 'expire') return 'failed';
    return 'unpaid';
}


if (require.main === module) {
    migrateUsers().catch(console.error);
}

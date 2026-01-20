#!/usr/bin/env node

/**
 * Import CSV data into PostgreSQL
 * 
 * Reads CSV files exported from MySQL and imports into PostgreSQL with:
 * - UUID generation for all records
 * - ID mapping stored in migration_tracking table
 * - Foreign key relationship handling
 * 
 * Usage:
 *   node scripts/import-from-csv.js [--table=tablename]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

// =============================================================================
// CONFIGURATION
// =============================================================================

const EXPORT_DIR = './migration_data';
const BATCH_SIZE = 1000;
const SPECIFIC_TABLE = process.argv.find(arg => arg.startsWith('--table='))?.split('=')[1];

// PostgreSQL connection configs
const pgApiConfig = {
    connectionString: process.env.DATABASE_URL || 'postgresql://ybb_user:ybb_password@localhost:5432/ybb_db',
};

const pgPaymentConfig = {
    connectionString: process.env.PAYMENT_DATABASE_URL || 'postgresql://ybb_user:ybb_password@localhost:5432/ybb_payments_db',
};

// ID mapping storage
const idMappings = new Map();

// Statistics
const stats = {
    tables: {},
    errors: [],
    startTime: null,
    endTime: null,
};

// =============================================================================
// UTILITIES
// =============================================================================

function log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = {
        'info': '📝',
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'start': '🚀',
        'end': '🎉',
    }[type] || '📝';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

function getUUID(tableName, mysqlId) {
    if (!mysqlId) return null;
    const key = `${tableName}:${mysqlId}`;
    if (!idMappings.has(key)) {
        idMappings.set(key, uuidv4());
    }
    return idMappings.get(key);
}

function toTimestamp(value) {
    if (!value || value === 'NULL' || value === '\\N') return null;
    try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
        return null;
    }
}

function toBool(value) {
    if (value === null || value === undefined || value === 'NULL' || value === '\\N') return false;
    return value === '1' || value === 1 || value === true || value === 'true';
}

function unescapeMySQLValue(value) {
    if (value === 'NULL' || value === '\\N') return null;
    if (value === '' || value === undefined) return value;

    // Unescape common MySQL escape sequences
    return value
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
}

/**
 * Parse TSV line (MySQL --batch output uses tabs)
 */
function parseTsvLine(line) {
    return line.split('\t').map(unescapeMySQLValue);
}

/**
 * Read CSV/TSV file line by line (memory efficient for large files)
 */
async function* readLines(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        if (line.trim()) {
            yield line;
        }
    }
}

/**
 * Batch processor for large datasets
 */
async function processBatches(filePath, processFn, batchSize = BATCH_SIZE) {
    const batch = [];
    let lineNum = 0;
    let processedCount = 0;

    for await (const line of readLines(filePath)) {
        lineNum++;
        batch.push({ line, lineNum });

        if (batch.length >= batchSize) {
            await processFn(batch);
            processedCount += batch.length;
            log(`  Processed ${processedCount} records...`);
            batch.length = 0;
        }
    }

    // Process remaining
    if (batch.length > 0) {
        await processFn(batch);
        processedCount += batch.length;
    }

    return processedCount;
}

// =============================================================================
// IMPORT FUNCTIONS
// =============================================================================

async function importProgramCategories(pgClient) {
    const filePath = path.join(EXPORT_DIR, 'program_categories.csv');
    if (!fs.existsSync(filePath)) {
        log('program_categories.csv not found, skipping', 'warning');
        return;
    }

    log('Importing program_categories...');
    let count = 0;

    for await (const line of readLines(filePath)) {
        const cols = parseTsvLine(line);
        // id, name, description, is_active, web_url, about, logo_url, main_banner_url, email, contact, telegram, location, created_at, updated_at
        const mysqlId = cols[0];
        const id = getUUID('program_categories', mysqlId);

        try {
            await pgClient.query(`
                INSERT INTO program_categories (
                    id, name, slug, description, is_active,
                    website_url, about, logo_url, banner_url,
                    contact_email, contact_phone, contact_whatsapp, contact_address,
                    default_timezone, require_email_verification, default_currency,
                    created_at, updated_at, legacy_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                ON CONFLICT (legacy_id) DO NOTHING
            `, [
                id,
                cols[1] || 'Unknown', // name
                (cols[1] || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'cat-' + mysqlId, // generated slug
                cols[2], // description
                toBool(cols[3]), // is_active
                cols[4], // website_url
                cols[5], // about
                cols[6], // logo_url
                cols[7], // banner_url
                cols[8], // contact_email
                cols[9], // contact_phone
                cols[10], // contact_whatsapp (telegram)
                cols[11], // contact_address (location)
                'Asia/Jakarta',
                true,
                'IDR',
                toTimestamp(cols[12]), // created_at
                toTimestamp(cols[13]), // updated_at
                parseInt(mysqlId)
            ]);
            count++;
        } catch (err) {
            stats.errors.push({ table: 'program_categories', error: `ID ${mysqlId}: ${err.message}` });
        }
    }

    stats.tables.program_categories = count;
    log(`Imported ${count} program_categories`, 'success');
}

async function importPrograms(pgClient) {
    const filePath = path.join(EXPORT_DIR, 'programs.csv');
    if (!fs.existsSync(filePath)) {
        log('programs.csv not found, skipping', 'warning');
        return;
    }

    log('Importing programs...');
    let count = 0;

    for await (const line of readLines(filePath)) {
        const cols = parseTsvLine(line);
        // id, program_category_id, name, description, start_date, end_date, banner_url, created_at, updated_at
        const mysqlId = cols[0];
        const id = getUUID('programs', mysqlId);
        const categoryId = getUUID('program_categories', cols[1]);

        try {
            await pgClient.query(`
                INSERT INTO programs (
                    id, program_category_id, name, slug, description,
                    year, start_date, end_date, application_deadline, location, capacity,
                    is_published, is_visible_to_users, is_active, status,
                    banner_url,
                    require_email_verification, currency,
                    allow_registration, require_payment, registration_fee,
                    created_at, updated_at, legacy_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
                ON CONFLICT (legacy_id) DO NOTHING
            `, [
                id,
                categoryId,
                cols[2] || 'Untitled Program', // name
                (cols[2] || 'program').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'prog-' + mysqlId, // generated slug
                cols[3], // description
                new Date(toTimestamp(cols[4]) || Date.now()).getFullYear(), // year
                toTimestamp(cols[4]) || new Date().toISOString(), // start_date
                toTimestamp(cols[5]) || new Date().toISOString(), // end_date
                toTimestamp(cols[5]), // application_deadline (same as end_date)
                'TBD', // location (missing in MySQL)
                100, // capacity
                true, // is_published
                true, // is_visible_to_users
                true, // is_active
                'published', // status
                cols[6], // banner_url
                true, // require_email_verification
                'IDR', // currency
                true, // allow_registration
                true, // require_payment
                0, // registration_fee
                toTimestamp(cols[7]),
                toTimestamp(cols[8]),
                parseInt(mysqlId)
            ]);
            count++;
        } catch (err) {
            stats.errors.push({ table: 'programs', error: `ID ${mysqlId}: ${err.message}` });
        }
    }

    stats.tables.programs = count;
    log(`Imported ${count} programs`, 'success');
}

async function importUsers(pgClient) {
    const filePath = path.join(EXPORT_DIR, 'users.csv');
    if (!fs.existsSync(filePath)) {
        log('users.csv not found, skipping', 'warning');
        return;
    }

    // Get valid categories to enforce FK integrity
    const categoriesRes = await pgClient.query('SELECT id FROM program_categories');
    const validCategoryIds = new Set(categoriesRes.rows.map(r => r.id));
    const fallbackCategoryId = categoriesRes.rows[0]?.id;

    if (!fallbackCategoryId) {
        log('No program categories found! Cannot import users safely.', 'error');
        return;
    }

    log(`Importing users (using fallback category ${fallbackCategoryId} for invalid FKs)...`);

    const processBatch = async (batch) => {
        for (const { line, lineNum } of batch) {
            const cols = parseTsvLine(line);
            // Columns: id, full_name, email, password, is_verified, program_category_id, is_active, created_at, updated_at
            const mysqlId = cols[0];
            const id = getUUID('users', mysqlId);
            let categoryId = getUUID('program_categories', cols[5] || '1');

            if (!validCategoryIds.has(categoryId)) {
                categoryId = fallbackCategoryId;
            }

            try {
                await pgClient.query(`
                    INSERT INTO users (
                        id, email, program_category_id, password_hash, 
                        email_verified, is_active,
                        created_at, updated_at, legacy_id, legacy_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (legacy_id) DO NOTHING
                `, [
                    id,
                    cols[2], // email
                    categoryId,
                    cols[3] || '', // password
                    toBool(cols[4]), // is_verified
                    toBool(cols[6]), // is_active
                    toTimestamp(cols[7]) || new Date().toISOString(),
                    toTimestamp(cols[8]) || new Date().toISOString(),
                    parseInt(mysqlId),
                    'user'
                ]);
            } catch (err) {
                if (!err.message.includes('duplicate')) {
                    stats.errors.push({ table: 'users', error: `Line ${lineNum}: ${err.message}` });
                }
            }
        }
    };

    const count = await processBatches(filePath, processBatch);
    stats.tables.users = count;
    log(`Imported ${count} users`, 'success');
}

async function importParticipants(pgClient) {
    const filePath = path.join(EXPORT_DIR, 'participants.csv');
    if (!fs.existsSync(filePath)) {
        log('participants.csv not found, skipping', 'warning');
        return;
    }

    log('Importing participants...');

    const processBatch = async (batch) => {
        for (const { line, lineNum } of batch) {
            const cols = parseTsvLine(line);
            // Columns: id, user_id, program_id, account_id, full_name, nickname, birthdate, gender, 
            //          country_code, phone_number, nationality, nationality_code, 
            //          origin_address, current_address,
            //          education_level, institution, major, occupation,
            //          instagram_account, organizations,
            //          tshirt_size, disease_history,
            //          emergency_account, contact_relation, emergency_country_code,
            //          picture_url, resume_url,
            //          knowledge_source, ref_code_ambassador, category,
            //          experiences, achievements, twibbon_link, requirement_link,
            //          score_total, score_status,
            //          created_at, updated_at

            const mysqlId = cols[0];
            if (!mysqlId || mysqlId === 'id') continue; // Skip header or empty

            const participantId = getUUID('participants', mysqlId);
            const userId = getUUID('users', cols[1]);

            try {
                await pgClient.query(`
                    INSERT INTO participants (
                        id, user_id, full_name, nick_name, birthdate, gender,
                        phone_country_code, phone_number,
                        nationality, nationality_code, origin_address, current_address,
                        education_level, institution, major, occupation,
                        instagram_username, organizations,
                        tshirt_size, medical_conditions,
                        emergency_contact_name, emergency_contact_relation,
                        profile_picture_url, resume_url,
                        knowledge_source, referral_code,
                        created_at, updated_at, legacy_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
                    ON CONFLICT (legacy_id) DO NOTHING
                `, [
                    participantId,
                    userId,
                    cols[4] || 'Unknown', // full_name
                    cols[5], // nickname
                    toTimestamp(cols[6]), // birthdate
                    cols[7]?.toLowerCase() || null, // gender
                    cols[8], // country_code
                    cols[9], // phone_number
                    cols[10], // nationality
                    cols[11], // nationality_code
                    cols[12], // origin_address
                    cols[13], // current_address
                    cols[14], // education_level
                    cols[15], // institution
                    cols[16], // major
                    cols[17], // occupation
                    cols[18], // instagram_account
                    cols[19], // organizations
                    cols[20], // tshirt_size
                    cols[21], // disease_history -> medical_conditions
                    cols[22], // emergency_account -> emergency_contact_name
                    cols[23], // contact_relation
                    cols[25], // picture_url
                    cols[26], // resume_url
                    cols[27], // knowledge_source
                    cols[28], // ref_code_ambassador -> referral_code
                    toTimestamp(cols[36]) || new Date().toISOString(),
                    toTimestamp(cols[37]) || new Date().toISOString(),
                    parseInt(mysqlId)
                ]);
            } catch (err) {
                if (!err.message.includes('duplicate') && !err.message.includes('violates foreign key')) {
                    stats.errors.push({ table: 'participants', error: `Line ${lineNum}: ${err.message}` });
                }
            }
        }
    };

    const count = await processBatches(filePath, processBatch);
    stats.tables.participants = count;
    log(`Imported ${count} participant records`, 'success');
}

async function importParticipantApplications(pgClient) {
    const filePath = path.join(EXPORT_DIR, 'participants.csv');
    const statusFilePath = path.join(EXPORT_DIR, 'participant_statuses.csv');

    if (!fs.existsSync(filePath)) {
        log('participants.csv not found, skipping applications', 'warning');
        return;
    }

    log('Importing participant_applications...');

    // First, load statuses into memory
    const statusMap = new Map();
    if (fs.existsSync(statusFilePath)) {
        for await (const line of readLines(statusFilePath)) {
            const cols = parseTsvLine(line);
            // id, participant_id, general_status, form_status, document_status, payment_status
            statusMap.set(cols[1], {
                general: cols[2],
                form: cols[3],
                document: cols[4],
                payment: cols[5]
            });
        }
        log(`  Loaded ${statusMap.size} participant statuses`);
    }

    const statusTextMap = {
        '0': 'draft',
        '1': 'submitted',
        '2': 'under_review',
        '3': 'accepted',
        '4': 'rejected',
    };

    const processBatch = async (batch) => {
        for (const { line, lineNum } of batch) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            if (!mysqlId || mysqlId === 'id') continue;

            const applicationId = getUUID('applications', mysqlId);
            const participantId = getUUID('participants', mysqlId);
            const programId = getUUID('programs', cols[2]);

            const status = statusMap.get(mysqlId);
            const appStatus = statusTextMap[status?.general] || statusTextMap[status?.form] || 'draft';
            const paymentStatus = status?.payment === '1' ? 'completed' : 'pending';

            try {
                await pgClient.query(`
                    INSERT INTO participant_applications (
                        id, participant_id, program_id,
                        application_category, experiences, achievements,
                        twibbon_link,
                        status, payment_status,
                        created_at, updated_at, legacy_participant_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (legacy_participant_id) DO UPDATE SET updated_at = EXCLUDED.updated_at
                    WHERE participant_applications.legacy_participant_id IS NOT NULL
                `, [
                    applicationId,
                    participantId,
                    programId,
                    cols[29], // category (fully_funded/self_funded)
                    cols[30], // experiences
                    cols[31], // achievements
                    cols[32], // twibbon_link
                    appStatus,
                    paymentStatus,
                    toTimestamp(cols[36]),
                    toTimestamp(cols[37]),
                    parseInt(mysqlId)
                ]);
            } catch (err) {
                if (!err.message.includes('duplicate') && !err.message.includes('violates foreign key')) {
                    stats.errors.push({ table: 'applications', error: `Line ${lineNum}: ${err.message}` });
                }
            }
        }
    };

    const count = await processBatches(filePath, processBatch);
    stats.tables.applications = count;
    log(`Imported ${count} applications`, 'success');
}

async function importAdmins(pgClient) {
    const filePath = path.join(EXPORT_DIR, 'admins.csv');
    if (!fs.existsSync(filePath)) {
        log('admins.csv not found, skipping', 'warning');
        return;
    }

    // Load existing users
    log('Loading existing user emails for linking admins...');
    const userRes = await pgClient.query('SELECT id, email FROM users WHERE email IS NOT NULL');
    const userEmailMap = new Map();
    for (const r of userRes.rows) {
        userEmailMap.set(r.email.toLowerCase(), r.id);
    }

    // Get Valid Category
    const categoriesRes = await pgClient.query('SELECT id FROM program_categories');
    const fallbackCategoryId = categoriesRes.rows[0]?.id;
    if (!fallbackCategoryId) {
        log('No Program Categories found. Skipping Admins import as category is required.', 'error');
        return;
    }

    log('Importing admins...');
    let count = 0;

    for await (const line of readLines(filePath)) {
        const cols = parseTsvLine(line);
        const mysqlId = cols[0];
        // Cols: 0:id, 1:full_name, 2:email, 3:phone
        const fullName = cols[1];
        let email = cols[2];
        const phone = cols[3];

        const adminId = getUUID('admins', mysqlId);

        let userId;
        let userExists = false;

        // Try to link by email
        if (email && userEmailMap.has(email.toLowerCase())) {
            userId = userEmailMap.get(email.toLowerCase());
            userExists = true;
        } else {
            // Create specific user for admin (using 'admin_' prefix to avoid collision)
            userId = getUUID('users', 'admin_' + mysqlId);
        }

        if (!email) {
            email = `missing_admin_${mysqlId}@ybb.dev`;
        }

        try {
            // Ensure user exists
            await pgClient.query(`
                INSERT INTO users (
                    id, email, program_category_id, password_hash, 
                    email_verified, is_active,
                    created_at, updated_at, legacy_id, legacy_type
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO NOTHING
            `, [
                userId,
                email,
                fallbackCategoryId, // Use VALID category ID from DB
                '',
                true,
                true,
                new Date().toISOString(),
                new Date().toISOString(),
                userExists ? null : null,
                'admin'
            ]);

            // Create admin record
            await pgClient.query(`
                INSERT INTO admins (
                    id, user_id, full_name, phone_number,
                    access_level, can_manage_admins, can_assign_roles,
                    timezone, locale,
                    created_at, updated_at, legacy_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (legacy_id) DO NOTHING
            `, [
                adminId,
                userId,
                fullName || 'Admin', // name
                phone, // phone_number
                1,
                true,
                true,
                'Asia/Jakarta',
                'en',
                new Date().toISOString(),
                new Date().toISOString(),
                parseInt(mysqlId)
            ]);
            count++;
        } catch (err) {
            stats.errors.push({ table: 'admins', error: `ID ${mysqlId}: ${err.message}` });
        }
    }

    stats.tables.admins = count;
    log(`Imported ${count} admins`, 'success');
}

async function importAmbassadorsV2(pgClient) {
    const filePath = path.join(EXPORT_DIR, 'ambassadors.csv');
    if (!fs.existsSync(filePath)) {
        log('ambassadors.csv not found, skipping', 'warning');
        return;
    }

    // Load existing users
    log('Loading existing user emails for linking ambassadors...');
    const userRes = await pgClient.query('SELECT id, email FROM users WHERE email IS NOT NULL');
    const userEmailMap = new Map();
    for (const r of userRes.rows) {
        userEmailMap.set(r.email.toLowerCase(), r.id);
    }

    // Get Valid IDs
    const programsRes = await pgClient.query('SELECT id FROM programs');
    const validProgramIds = new Set(programsRes.rows.map(r => r.id));
    const categoriesRes = await pgClient.query('SELECT id FROM program_categories');
    const validCategoryIds = new Set(categoriesRes.rows.map(r => r.id));
    const fallbackCategoryId = categoriesRes.rows[0]?.id;

    if (!fallbackCategoryId) {
        log('No programs/categories found! Skipping ambassadors.', 'error');
        return;
    }

    log('Importing ambassadors...');
    let count = 0;

    for await (const line of readLines(filePath)) {
        const cols = parseTsvLine(line);
        const mysqlId = cols[0]; // ID

        // Smart Scan for Email to handle shifted columns
        let email = cols.find(c => c && c.includes && c.includes('@'));
        let userId;
        let userExists = false;

        // Try to link by Email
        if (email && userEmailMap.has(email.toLowerCase())) {
            userId = userEmailMap.get(email.toLowerCase());
            userExists = true;
        } else {
            // Fallback: Use user_id column if it looks like an int
            const potentialUserId = cols[1];
            if (potentialUserId && /^\d+$/.test(potentialUserId)) {
                // Try generating ID from UserID
                userId = getUUID('users', potentialUserId);
            } else {
                // Fallback to Ambassador ID
                userId = getUUID('users', 'ambassador_' + mysqlId);
            }
        }

        const ambassadorId = getUUID('ambassadors', mysqlId);

        let programId = getUUID('programs', cols[2]); // Default assumption
        // If program invalid, fallback
        if (!validProgramIds.has(programId)) {
            programId = programsRes.rows[0].id;
        }

        if (!email) {
            email = `missing_ambassador_${mysqlId}@ybb.dev`;
        }

        try {
            // Create user for ambassador if not exists
            // Ensure user exists (idempotent)
            try {
                const categoryId = fallbackCategoryId; // Assuming fallbackCategoryId is the correct one to use here
                const legacyIdLink = null; // Assuming legacyIdLink is null for new ambassador users

                await pgClient.query(`
                    INSERT INTO users (
                        id, email, program_category_id, password_hash, 
                        email_verified, is_active,
                        created_at, updated_at, legacy_id, legacy_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    userId,
                    email,
                    categoryId,
                    '', // password
                    true,
                    true, // is_active
                    toTimestamp(cols[cols.length - 2]) || new Date().toISOString(),
                    toTimestamp(cols[cols.length - 1]) || new Date().toISOString(),
                    legacyIdLink,
                    'ambassador_user'
                ]);
                // Update map to prevent future conflicts in this run
                userEmailMap.set(email.toLowerCase(), userId);
            } catch (userErr) {
                // If unique constraint violation (email), link to existing user if possible
                if (userErr.code === '23505' && userErr.constraint === 'users_email_program_category_id_key') {
                    // Log warning but proceed to link ambassador to the existing user?
                    // We need the ID of the conflicting user.
                    // But we don't have it easily.
                    // If we updated map correctly, this shouldn't happen often.
                    console.log(`Warning: Duplicate email ${email} for Ambassador ${mysqlId}. Linking to existing user.`);
                    // If map has it, use it.
                    if (userEmailMap.has(email.toLowerCase())) {
                        userId = userEmailMap.get(email.toLowerCase());
                    }
                } else {
                    throw userErr;
                }
            }

            // Create ambassador record
            await pgClient.query(`
                INSERT INTO ambassadors (
                    id, user_id, program_id,
                    full_name, institution,
                    referral_code,
                    created_at, updated_at, legacy_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (legacy_id) DO NOTHING
            `, [
                ambassadorId,
                userId,
                programId,
                cols[3] || 'Ambassador', // full_name
                cols[5], // institution
                // cols[6], // major (REMOVED)
                // cols[7], // instagram_account (REMOVED)
                cols[8] || `REF-${mysqlId}`, // referral_code (ensure unique)
                toTimestamp(cols[cols.length - 2]) || new Date().toISOString(),
                toTimestamp(cols[cols.length - 1]) || new Date().toISOString(),
                parseInt(mysqlId)
            ]);
            count++;
        } catch (err) {
            console.error(`ERROR Ambassador ${mysqlId}:`, err.message);
            stats.errors.push({ table: 'ambassadors', error: `ID ${mysqlId}: ${err.message}` });
        }
    }

    stats.tables.ambassadors = count;
    log(`Imported ${count} ambassadors`, 'success');
}

async function importPayments(pgPaymentClient) {
    const filePath = path.join(EXPORT_DIR, 'payments.csv');
    if (!fs.existsSync(filePath)) {
        log('payments.csv not found, skipping', 'warning');
        return;
    }

    log('Importing payments to Payment Service DB...');

    const processBatch = async (batch) => {
        for (const { line, lineNum } of batch) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            const paymentId = getUUID('payments', mysqlId);

            try {
                await pgPaymentClient.query(`
                    INSERT INTO payments (
                        id, application_id, user_id,
                        amount, currency, status, payment_type,
                        description,
                        created_at, updated_at, paid_at,
                        legacy_id, legacy_participant_id, legacy_program_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (legacy_id) DO NOTHING
                `, [
                    paymentId,
                    String(cols[1]), // participant_id as application_id
                    String(cols[1]), // participant_id as user_id
                    parseFloat(cols[3]) || 0, // amount
                    cols[4] || 'IDR', // currency
                    cols[5] === '1' ? 'success' : 'pending', // status
                    cols[6] || 'automatic', // payment_type
                    cols[7], // description
                    toTimestamp(cols[cols.length - 2]),
                    toTimestamp(cols[cols.length - 1]),
                    cols[5] === '1' ? toTimestamp(cols[cols.length - 1]) : null, // paid_at
                    parseInt(mysqlId),
                    parseInt(cols[1]), // participant_id
                    parseInt(cols[2])  // program_id
                ]);
            } catch (err) {
                if (!err.message.includes('duplicate')) {
                    stats.errors.push({ table: 'payments', error: `Line ${lineNum}: ${err.message}` });
                }
            }
        }
    };

    const count = await processBatches(filePath, processBatch);
    stats.tables.payments = count;
    log(`Imported ${count} payments`, 'success');
}

async function importGatewayTransactions(pgPaymentClient) {
    // Ensure gateway configs exist
    let midtransConfigId = (await pgPaymentClient.query(
        `SELECT id FROM gateway_configs WHERE gateway_name = 'midtrans' LIMIT 1`
    )).rows[0]?.id;

    if (!midtransConfigId) {
        log('Creating default midtrans gateway config...');
        const res = await pgPaymentClient.query(`
            INSERT INTO gateway_configs (
                id, gateway_name, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id
        `, [getUUID('gateway_configs', 'midtrans'), 'midtrans', true]);
        midtransConfigId = res.rows[0].id;
    }

    let xenditConfigId = (await pgPaymentClient.query(
        `SELECT id FROM gateway_configs WHERE gateway_name = 'xendit' LIMIT 1`
    )).rows[0]?.id;

    if (!xenditConfigId) {
        log('Creating default xendit gateway config...');
        const res = await pgPaymentClient.query(`
            INSERT INTO gateway_configs (
                id, gateway_name, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id
        `, [getUUID('gateway_configs', 'xendit'), 'xendit', true]);
        xenditConfigId = res.rows[0].id;
    }

    // Import Midtrans transactions
    const midtransPath = path.join(EXPORT_DIR, 'midtrans_payment.csv');
    if (fs.existsSync(midtransPath)) {
        log('Importing midtrans transactions...');
        let count = 0;

        for await (const line of readLines(midtransPath)) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            const txId = getUUID('midtrans_payment', mysqlId);
            const paymentId = getUUID('payments', cols[2]); // payment_id column

            try {
                await pgPaymentClient.query(`
                    INSERT INTO gateway_transactions (
                        id, payment_id, gateway_config_id, gateway_name,
                        gateway_transaction_id, gateway_order_id,
                        amount, currency, status, status_code,
                        payment_type, bank, va_number,
                        pdf_url, redirect_url,
                        customer_email, description,
                        transaction_time, expired_at,
                        created_at, updated_at,
                        legacy_id, legacy_table
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
                    ON CONFLICT (legacy_table, legacy_id) WHERE legacy_id IS NOT NULL DO NOTHING
                `, [
                    txId,
                    paymentId,
                    midtransConfigId,
                    'midtrans',
                    cols[13], // transaction_id
                    cols[12], // order_id
                    parseFloat(cols[7]) || 0, // gross_amount
                    cols[6] || 'IDR', // currency
                    cols[10], // transaction_status
                    cols[9], // status_code
                    cols[8], // payment_type
                    cols[14], // bank
                    cols[15], // va_number
                    cols[16], // pdf_url
                    cols[17], // finish_redirect_url
                    cols[5], // email
                    cols[4], // description
                    toTimestamp(cols[11]), // transaction_time
                    toTimestamp(cols[18]), // expired_at
                    toTimestamp(cols[19]), // created_at
                    toTimestamp(cols[20]), // updated_at
                    parseInt(mysqlId),
                    'midtrans_payment'
                ]);
                count++;
            } catch (err) {
                stats.errors.push({ table: 'midtrans', error: `ID ${mysqlId}: ${err.message}` });
            }
        }
        stats.tables.midtrans = count;
        log(`Imported ${count} midtrans transactions`, 'success');
    }

    // Import Xendit transactions
    const xenditPath = path.join(EXPORT_DIR, 'xendit_payment.csv');
    if (fs.existsSync(xenditPath)) {
        log('Importing xendit transactions...');
        let count = 0;

        for await (const line of readLines(xenditPath)) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            const txId = getUUID('xendit_payment', mysqlId);
            const paymentId = getUUID('payments', cols[2]); // payment_id column

            try {
                await pgPaymentClient.query(`
                    INSERT INTO gateway_transactions (
                        id, payment_id, gateway_config_id, gateway_name,
                        gateway_transaction_id, gateway_order_id, gateway_user_id,
                        amount, currency, status,
                        payment_method,
                        redirect_url,
                        customer_email, merchant_name, description,
                        expired_at,
                        created_at, updated_at,
                        legacy_id, legacy_table
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                    ON CONFLICT (legacy_table, legacy_id) WHERE legacy_id IS NOT NULL DO NOTHING
                `, [
                    txId,
                    paymentId,
                    xenditConfigId,
                    'xendit',
                    cols[9], // id_xendit
                    cols[7], // external_id
                    cols[10], // user_id_xendit
                    parseFloat(cols[5]) || 0, // amount
                    cols[8] || 'IDR', // currency
                    cols[12], // status
                    cols[15], // payment_method
                    cols[11], // url_xendit
                    cols[6], // email
                    cols[13], // merchant_name
                    cols[4], // description
                    toTimestamp(cols[14]), // expired_at
                    toTimestamp(cols[16]), // created_at
                    toTimestamp(cols[17]), // updated_at
                    parseInt(mysqlId),
                    'xendit_payment'
                ]);
                count++;
            } catch (err) {
                stats.errors.push({ table: 'xendit', error: `ID ${mysqlId}: ${err.message}` });
            }
        }
        stats.tables.xendit = count;
        log(`Imported ${count} xendit transactions`, 'success');
    }
}

async function importProgramContent(pgClient) {
    // 1. FAQs
    const faqsPath = path.join(EXPORT_DIR, 'program_faqs.csv');
    if (fs.existsSync(faqsPath)) {
        log('Importing program FAQs...');
        let count = 0;
        for await (const line of readLines(faqsPath)) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            const programId = getUUID('programs', cols[1]);
            const faqId = getUUID('program_faqs', mysqlId);

            if (!programId) {
                // stats.errors.push({ table: 'program_faqs', error: `Parent Program not found for FAQ ID ${mysqlId}` });
                continue;
            }

            try {
                await pgClient.query(`
                    INSERT INTO program_faqs (
                        id, program_id, question, answer, "order",
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    faqId,
                    programId,
                    cols[2], // question
                    cols[3], // answer
                    0, // order
                    toTimestamp(cols[4]) || new Date().toISOString(), // created_at (fallback)
                    toTimestamp(cols[5]) || new Date().toISOString()  // updated_at (fallback)
                ]);
                count++;
            } catch (err) {
                stats.errors.push({ table: 'program_faqs', error: `ID ${mysqlId}: ${err.message}` });
            }
        }
        stats.tables.program_faqs = count;
        log(`Imported ${count} FAQs`, 'success');
    }

    // 2. Schedules
    const schedulesPath = path.join(EXPORT_DIR, 'program_schedules.csv');
    if (fs.existsSync(schedulesPath)) {
        log('Importing program schedules...');
        let count = 0;
        for await (const line of readLines(schedulesPath)) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            const programId = getUUID('programs', cols[1]);
            const scheduleId = getUUID('program_schedules', mysqlId);

            if (!programId) continue;

            try {
                await pgClient.query(`
                    INSERT INTO program_schedules (
                        id, program_id, activity, description,
                        day, start_time, end_time, location, "order",
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    scheduleId,
                    programId,
                    cols[2], // activity (mapped from name)
                    cols[3], // description
                    toTimestamp(cols[4]) ? new Date(cols[4]).toISOString().split('T')[0] : 'TBD', // day (date portion)
                    toTimestamp(cols[4]) ? new Date(cols[4]).toISOString().split('T')[1].substring(0, 5) : null, // start_time (HH:mm)
                    toTimestamp(cols[5]) ? new Date(cols[5]).toISOString().split('T')[1].substring(0, 5) : null, // end_time (HH:mm)
                    null, // location
                    parseInt(cols[6]) || 0, // order
                    toTimestamp(cols[8]) || new Date().toISOString(),
                    toTimestamp(cols[9]) || new Date().toISOString()
                ]);
                count++;
            } catch (err) {
                stats.errors.push({ table: 'program_schedules', error: `ID ${mysqlId}: ${err.message}` });
            }
        }
        stats.tables.program_schedules = count;
        log(`Imported ${count} schedules`, 'success');
    }

    // 3. Announcements
    const announcementsPath = path.join(EXPORT_DIR, 'program_announcements.csv');
    if (fs.existsSync(announcementsPath)) {
        log('Importing program announcements...');
        let count = 0;
        for await (const line of readLines(announcementsPath)) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            const programId = getUUID('programs', cols[1]);
            const announcementId = getUUID('program_announcements', mysqlId);

            if (count < 5) console.log(`DEBUG Announcement ${mysqlId}: ProgramID in CSV=${cols[1]}, MappedUUID=${programId}`);

            if (!programId) {
                if (count < 5) console.log(`DEBUG Skipping Announcement ${mysqlId}: No program ID mapping found.`);
                continue;
            }

            try {
                await pgClient.query(`
                    INSERT INTO program_announcements (
                        id, program_id, title, content, image_url,
                        is_active, publish_date,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    announcementId,
                    programId,
                    cols[2], // title
                    cols[3], // content
                    cols[5], // imageUrl
                    toBool(cols[4]), // is_published (is_active)
                    toTimestamp(cols[6]), // created_at as published_at fallback
                    toTimestamp(cols[6]), // created_at
                    toTimestamp(cols[7]) // updated_at
                ]);
                count++;
            } catch (err) {
                console.error(`ERROR Announcement ${mysqlId}: ${err.message}`);
                stats.errors.push({ table: 'program_announcements', error: `ID ${mysqlId}: ${err.message}` });
            }
        }
        stats.tables.program_announcements = count;
        log(`Imported ${count} announcements`, 'success');
    }

    // 4. Speakers (ProgramSpeaker)
    const speakersPath = path.join(EXPORT_DIR, 'program_speakers.csv');
    if (fs.existsSync(speakersPath)) {
        log('Importing program speakers...');
        let count = 0;
        for await (const line of readLines(speakersPath)) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            const programId = getUUID('programs', cols[1]);
            const speakerId = getUUID('program_speakers', mysqlId);
            if (!programId) continue;

            try {
                await pgClient.query(`
                    INSERT INTO program_speakers (
                        id, program_id, name, title,
                        bio, photo_url, "order",
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    speakerId,
                    programId,
                    cols[2], // name
                    cols[3], // title (company/role)
                    cols[4], // bio
                    cols[5], // photo_url
                    parseInt(cols[6]) || 0, // order
                    toTimestamp(cols[7]) || new Date().toISOString(),
                    toTimestamp(cols[8]) || new Date().toISOString()
                ]);
                count++;
            } catch (err) {
                stats.errors.push({ table: 'program_speakers', error: `ID ${mysqlId}: ${err.message}` });
            }
        }
        stats.tables.program_speakers = count;
        log(`Imported ${count} speakers`, 'success');
    }

    // 5. Sponsors (Sponsor)
    const sponsorsPath = path.join(EXPORT_DIR, 'program_sponsors.csv');
    if (fs.existsSync(sponsorsPath)) {
        log('Importing sponsors...');
        let count = 0;
        for await (const line of readLines(sponsorsPath)) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            const programId = getUUID('programs', cols[1]);
            const sponsorId = getUUID('sponsors', mysqlId);
            if (!programId) continue;

            try {
                await pgClient.query(`
                    INSERT INTO sponsors (
                        id, program_id, name, website_url,
                        logo_url, "order",
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    sponsorId,
                    programId,
                    cols[2], // name
                    cols[3], // website
                    cols[4], // logo
                    parseInt(cols[5]) || 0, // order
                    toTimestamp(cols[6]) || new Date().toISOString(),
                    toTimestamp(cols[7]) || new Date().toISOString()
                ]);
                count++;
            } catch (err) {
                stats.errors.push({ table: 'sponsors', error: `ID ${mysqlId}: ${err.message}` });
            }
        }
        stats.tables.sponsors = count;
        log(`Imported ${count} sponsors`, 'success');
    }

    // 6. Testimonials (ProgramTestimonial)
    const testimonialsPath = path.join(EXPORT_DIR, 'program_testimonies.csv');
    if (fs.existsSync(testimonialsPath)) {
        log('Importing testimonials...');
        let count = 0;
        for await (const line of readLines(testimonialsPath)) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            const categoryId = getUUID('program_categories', cols[1]); // Use program_categories mapping
            const testimonialId = getUUID('program_testimonials', mysqlId);

            if (!categoryId) {
                console.log(`DEBUG Testimonial ${mysqlId}: No category ID mapping found for ${cols[1]}`);
                continue;
            }

            try {
                await pgClient.query(`
                    INSERT INTO program_testimonials (
                        id, program_category_id, name, testimonial,
                        role, company, avatar_url,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    testimonialId,
                    categoryId,
                    cols[2], // name
                    cols[3], // testimonial (already escaped)
                    cols[4], // role
                    cols[5], // company
                    cols[6], // avatar_url
                    toTimestamp(cols[7]) || new Date().toISOString(),
                    toTimestamp(cols[8]) || new Date().toISOString()
                ]);
                count++;
            } catch (err) {
                stats.errors.push({ table: 'program_testimonials', error: `ID ${mysqlId}: ${err.message}` });
            }
        }
        stats.tables.program_testimonials = count;
        log(`Imported ${count} testimonials`, 'success');
    }

    // 7. Photos/Gallery (ProgramGallery - Fixed name)
    const photosPath = path.join(EXPORT_DIR, 'program_photos.csv');
    if (fs.existsSync(photosPath)) {
        log('Importing gallery photos...');
        let count = 0;
        for await (const line of readLines(photosPath)) {
            const cols = parseTsvLine(line);
            const mysqlId = cols[0];
            const programId = getUUID('programs', cols[1]);
            const galleryId = getUUID('program_gallery', mysqlId);
            if (!programId) continue;

            try {
                await pgClient.query(`
                    INSERT INTO program_gallery (
                        id, program_id, title, image_url,
                        "order",
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    galleryId,
                    programId,
                    cols[2], // Use col 2 as title/caption fallback
                    cols[3] || cols[2], // url
                    parseInt(cols[4]) || 0, // order
                    toTimestamp(cols[5]) || new Date().toISOString(),
                    toTimestamp(cols[6]) || new Date().toISOString()
                ]);
                // Note: Schema has title, image_url.
                count++;
            } catch (err) {
                stats.errors.push({ table: 'program_gallery', error: `ID ${mysqlId}: ${err.message}` });
            }
        }
    }
}

// ============================================================================
// PROGRAM PRICING TIERS
// ============================================================================

async function importProgramPricingTiers(pgClient) {
    const pricingPath = path.join(EXPORT_DIR, 'program_payments.csv');
    if (!fs.existsSync(pricingPath)) {
        log('No program_payments.csv found, skipping pricing tiers', 'warn');
        return;
    }

    log('Importing program pricing tiers...');
    let count = 0;

    for await (const line of readLines(pricingPath)) {
        const cols = parseTsvLine(line);
        const mysqlId = cols[0];
        const programId = getUUID('programs', cols[1]);
        const tierId = getUUID('program_pricing_tiers', mysqlId);

        if (!programId) {
            console.log(`DEBUG Tier ${mysqlId}: No program mapping for program_id=${cols[1]}`);
            continue;
        }

        try {
            // Map category: registration, program_fee_1, program_fee_2 -> early_bird, regular, vip
            let category = 'regular';
            if (cols[7] === 'registration') category = 'early_bird';
            else if (cols[7] === 'program_fee_1') category = 'regular';
            else if (cols[7] === 'program_fee_2') category = 'vip';

            // Determine primary currency and price (prefer IDR)
            const idrAmount = parseFloat(cols[5]) || 0;
            const usdAmount = parseFloat(cols[6]) || 0;
            const currency = idrAmount > 0 ? 'IDR' : 'USD';
            const price = idrAmount > 0 ? idrAmount : usdAmount;

            // Set validity dates (use program dates as fallback)
            const createdAt = toTimestamp(cols[10]) || new Date().toISOString();
            const validFrom = createdAt;
            const validUntil = new Date(new Date(createdAt).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // +1 year

            await pgClient.query(`
                INSERT INTO program_pricing_tiers (
                    id, program_id, name, description, price, currency,
                    valid_from, valid_until, "order", is_active,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (id) DO NOTHING
            `, [
                tierId,
                programId,
                cols[2], // name
                cols[3], // description
                price,
                currency,
                validFrom,
                validUntil,
                parseInt(cols[4]) || 0, // order_number
                toBool(cols[9]), // is_active
                createdAt,
                toTimestamp(cols[11]) || new Date().toISOString()
            ]);
            count++;
        } catch (err) {
            stats.errors.push({ table: 'program_pricing_tiers', error: `ID ${mysqlId}: ${err.message}` });
        }
    }

    stats.tables.program_pricing_tiers = count;
    log(`Imported ${count} pricing tiers`, 'success');
}

// ============================================================================
// AMBASSADOR REFERRALS
// ============================================================================

async function importAmbassadorReferrals(pgClient) {
    const referralsPath = path.join(EXPORT_DIR, 'ambassador_participant_referrals.csv');
    if (!fs.existsSync(referralsPath)) return;

    log('Importing ambassador referral links...');
    let count = 0;

    for await (const line of readLines(referralsPath)) {
        const cols = parseTsvLine(line);
        const mysqlId = cols[0];

        // MySQL columns: id, participant_id, ambassador_id, created_at, updated_at, is_active, is_deleted
        const participantId = getUUID('participants', cols[1]); // participant_id from MySQL
        const ambassadorId = getUUID('ambassadors', cols[2]);   // ambassador_id from MySQL

        if (!ambassadorId || !participantId) {
            // Skip if either mapping not found
            continue;
        }

        try {
            await pgClient.query(`
                INSERT INTO ambassador_referrals (
                    id, ambassador_id, participant_id,
                    referred_at, status, 
                    legacy_id
                ) VALUES (gen_random_uuid(), $1, $2, $3, 'referred', $4)
                ON CONFLICT (legacy_id) DO NOTHING
            `, [
                ambassadorId,
                participantId,
                toTimestamp(cols[3]),
                parseInt(mysqlId)
            ]);
            count++;
        } catch (err) {
            stats.errors.push({ table: 'ambassador_referrals', error: `ID ${mysqlId}: ${err.message}` });
        }
    }
    stats.tables.ambassador_referrals = count;
    log(`Imported ${count} referrals`, 'success');
}


async function loadExistingMappings(pgClient) {
    log('Loading existing ID mappings from DB...');

    // Programs
    const progs = await pgClient.query('SELECT id, legacy_id FROM programs WHERE legacy_id IS NOT NULL');
    for (const row of progs.rows) idMappings.set(`programs:${row.legacy_id}`, row.id);
    log(`Loaded ${progs.rowCount} program mappings`);

    // Categories
    const cats = await pgClient.query('SELECT id, legacy_id FROM program_categories WHERE legacy_id IS NOT NULL');
    for (const row of cats.rows) idMappings.set(`program_categories:${row.legacy_id}`, row.id);
    log(`Loaded ${cats.rowCount} category mappings`);

    // Users (Batch load if too large? 177k is fine for Node.js memory)
    const users = await pgClient.query('SELECT id, legacy_id FROM users WHERE legacy_id IS NOT NULL');
    for (const row of users.rows) idMappings.set(`users:${row.legacy_id}`, row.id);
    log(`Loaded ${users.rowCount} user mappings`);

    // Admins
    const admins = await pgClient.query('SELECT id, legacy_id FROM admins WHERE legacy_id IS NOT NULL');
    for (const row of admins.rows) idMappings.set(`admins:${row.legacy_id}`, row.id);
    log(`Loaded ${admins.rowCount} admin mappings`);

    // Ambassadors
    const ambassadors = await pgClient.query('SELECT id, legacy_id FROM ambassadors WHERE legacy_id IS NOT NULL');
    for (const row of ambassadors.rows) idMappings.set(`ambassadors:${row.legacy_id}`, row.id);
    log(`Loaded ${ambassadors.rowCount} ambassador mappings`);

    // Participants
    const participants = await pgClient.query('SELECT id, legacy_id FROM participants WHERE legacy_id IS NOT NULL');
    for (const row of participants.rows) idMappings.set(`participants:${row.legacy_id}`, row.id);
    log(`Loaded ${participants.rowCount} participant mappings`);
}

// =============================================================================
// MAIN
// =============================================================================

// ============================================================================
// PAYMENT SERVICE IMPORTS
// ============================================================================

async function importPayments(pgPaymentClient) {
    const paymentsPath = path.join(EXPORT_DIR, 'payments.csv');
    if (!fs.existsSync(paymentsPath)) {
        log('No payments.csv found', 'warn');
        return;
    }

    log('Importing payments to Payment Service DB...');
    let count = 0;

    for await (const line of readLines(paymentsPath)) {
        const cols = parseTsvLine(line);
        const mysqlId = parseInt(cols[0]);

        // Get mapped UUIDs for relationships
        const participantId = getUUID('participants', cols[3]); // participant_id
        const programId = getUUID('programs', cols[4]); // program_payment_id -> use as program reference

        if (!participantId) {
            // Skip if participant not found
            continue;
        }

        try {
            const paymentId = uuidv4();
            const amount = parseFloat(cols[11]) || 0; // amount

            // Skip payments with invalid amounts
            if (amount <= 0) {
                continue;
            }

            const currency = cols[13] || 'IDR'; // currency
            const status = mapPaymentStatus(parseInt(cols[8])); // Map numeric status to string
            const paymentMethod = cols[14] || null; // source_name

            await pgPaymentClient.query(`
                INSERT INTO payments (
                    id, user_id, application_id, amount, currency, status,
                    payment_method, paid_at, created_at, updated_at,
                    legacy_id, legacy_participant_id, legacy_program_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (legacy_id) DO UPDATE SET updated_at = EXCLUDED.updated_at
                WHERE payments.legacy_id IS NOT NULL
            `, [
                paymentId,
                participantId, // Using participant UUID as user_id
                null, // application_id - would need to map participant+program to application
                amount,
                currency,
                status,
                paymentMethod,
                toTimestamp(cols[7]), // payment_date
                toTimestamp(cols[19]) || new Date().toISOString(), // created_at
                toTimestamp(cols[20]) || new Date().toISOString(), // updated_at
                mysqlId,
                parseInt(cols[3]), // legacy_participant_id
                parseInt(cols[4])  // legacy_program_id
            ]);

            // Store mapping for gateway transactions
            idMappings.set(`payments:${mysqlId}`, paymentId);
            count++;
        } catch (err) {
            stats.errors.push({ table: 'payments', error: `ID ${mysqlId}: ${err.message}` });
        }
    }

    stats.tables.payments = count;
    log(`Imported ${count} payments`, 'success');
}

async function importMidtransTransactions(pgPaymentClient) {
    const midtransPath = path.join(EXPORT_DIR, 'midtrans_payment.csv');
    if (!fs.existsSync(midtransPath)) {
        log('No midtrans_payment.csv found', 'warn');
        return;
    }

    log('Importing Midtrans transactions...');
    let count = 0;

    for await (const line of readLines(midtransPath)) {
        const cols = parseTsvLine(line);
        const mysqlId = parseInt(cols[0]);

        // Get payment UUID
        const paymentId = getUUID('payments', cols[2]); // payment_id from MySQL

        if (!paymentId) {
            // Skip if parent payment not found
            continue;
        }

        try {
            await pgPaymentClient.query(`
                INSERT INTO gateway_transactions (
                    id, payment_id, gateway_name, gateway_transaction_id, gateway_order_id,
                    amount, currency, status, status_code, payment_type, payment_method,
                    bank, va_number, pdf_url, redirect_url, customer_email,
                    description, transaction_time, expired_at, created_at, updated_at,
                    legacy_id, legacy_table
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
                )
                ON CONFLICT (legacy_table, legacy_id) DO UPDATE SET updated_at = EXCLUDED.updated_at
            `, [
                paymentId,
                'midtrans',
                cols[14], // transaction_id
                cols[13], // order_id
                parseFloat(cols[8]) || 0, // gross_amount
                cols[7] || 'IDR', // currency
                cols[12], // transaction_status
                cols[11], // status_code
                cols[9], // payment_type
                cols[9], // payment_method (same as type for now)
                cols[15], // bank
                cols[16], // va_number
                cols[17], // pdf_url
                cols[18], // finish_redirect_url
                cols[6], // email
                cols[4], // description
                toTimestamp(cols[10]), // transaction_time
                toTimestamp(cols[19]), // expired_at
                toTimestamp(cols[20]) || new Date().toISOString(), // created_at
                toTimestamp(cols[21]) || new Date().toISOString(), // updated_at
                mysqlId,
                'midtrans_payment'
            ]);
            count++;
        } catch (err) {
            stats.errors.push({ table: 'midtrans_payment', error: `ID ${mysqlId}: ${err.message}` });
        }
    }

    stats.tables.midtrans_payment = count;
    log(`Imported ${count} Midtrans transactions`, 'success');
}

async function importXenditTransactions(pgPaymentClient) {
    const xenditPath = path.join(EXPORT_DIR, 'xendit_payment.csv');
    if (!fs.existsSync(xenditPath)) {
        log('No xendit_payment.csv found', 'warn');
        return;
    }

    log('Importing Xendit transactions...');
    let count = 0;

    for await (const line of readLines(xenditPath)) {
        const cols = parseTsvLine(line);
        const mysqlId = parseInt(cols[0]);

        // Get payment UUID
        const paymentId = getUUID('payments', cols[2]); // payment_id from MySQL

        if (!paymentId) {
            continue;
        }

        try {
            // Xendit columns: id, participant_id, payment_id, program_id, id_xendit, user_id_xendit,
            // external_id, status, amount, description, payment_url, email, currency, created_at, updated_at

            await pgPaymentClient.query(`
                INSERT INTO gateway_transactions (
                    id, payment_id, gateway_name, gateway_transaction_id, gateway_order_id,
                    gateway_user_id, amount, currency, status, redirect_url, customer_email,
                    description, created_at, updated_at, legacy_id, legacy_table
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
                )
                ON CONFLICT (legacy_table, legacy_id) DO UPDATE SET updated_at = EXCLUDED.updated_at
            `, [
                paymentId,
                'xendit',
                cols[4], // id_xendit
                cols[6], // external_id
                cols[5], // user_id_xendit
                parseFloat(cols[8]) || 0, // amount
                cols[12] || 'IDR', // currency
                cols[7], // status
                cols[10], // payment_url
                cols[11], // email
                cols[9], // description
                toTimestamp(cols[13]) || new Date().toISOString(), // created_at
                toTimestamp(cols[14]) || new Date().toISOString(), // updated_at
                mysqlId,
                'xendit_payment'
            ]);
            count++;
        } catch (err) {
            stats.errors.push({ table: 'xendit_payment', error: `ID ${mysqlId}: ${err.message}` });
        }
    }

    stats.tables.xendit_payment = count;
    log(`Imported ${count} Xendit transactions`, 'success');
}

function mapPaymentStatus(numericStatus) {
    // Map MySQL numeric status to Payment Service string status
    const statusMap = {
        0: 'pending',
        1: 'processing',
        2: 'success', // Changed from 'completed' to match constraint
        3: 'failed',
        4: 'cancelled',
        5: 'refunded'
    };
    return statusMap[numericStatus] || 'pending';
}

// ============================================================================
// MAIN MIGRATION ORCHESTRATION
// ============================================================================

async function main() {
    const pgApiClient = new Client(pgApiConfig);
    const pgPaymentClient = new Client(pgPaymentConfig);

    try {
        await pgApiClient.connect();
        await pgPaymentClient.connect();

        log('Connected to PostgreSQL');

        stats.startTime = new Date();

        // Load existing mappings
        await loadExistingMappings(pgApiClient);

        // Run imports in order (respecting dependencies)
        const migrations = [
            // { name: 'program_categories', fn: () => importProgramCategories(pgApiClient) },
            // { name: 'programs', fn: () => importPrograms(pgApiClient) },
            // { name: 'users', fn: () => importUsers(pgApiClient) },
            // { name: 'admins', fn: () => importAdmins(pgApiClient) },
            // { name: 'participants', fn: () => importParticipants(pgApiClient) },
            { name: 'applications', fn: () => importParticipantApplications(pgApiClient) },
            // { name: 'ambassadors', fn: () => importAmbassadorsV2(pgApiClient) },
            // { name: 'program_content', fn: () => importProgramContent(pgApiClient) },
            // { name: 'program_pricing_tiers', fn: () => importProgramPricingTiers(pgApiClient) },
            // { name: 'ambassador_referrals', fn: () => importAmbassadorReferrals(pgApiClient) },
            { name: 'payments', fn: () => importPayments(pgPaymentClient) },
            { name: 'midtrans_transactions', fn: () => importMidtransTransactions(pgPaymentClient) },
            { name: 'xendit_transactions', fn: () => importXenditTransactions(pgPaymentClient) },
        ];

        for (const migration of migrations) {
            if (SPECIFIC_TABLE && migration.name !== SPECIFIC_TABLE) {
                continue;
            }
            try {
                await migration.fn();
            } catch (error) {
                log(`Error in ${migration.name}: ${error.message}`, 'error');
                stats.errors.push({ table: migration.name, error: error.message });
            }
        }

        stats.endTime = new Date();
        const duration = (stats.endTime - stats.startTime) / 1000;

        console.log('');
        log('Import completed!', 'end');
        console.log('');
        console.log('📊 Import Summary:');
        console.log(`   Duration: ${duration.toFixed(2)}s`);
        console.log(`   ID Mappings: ${idMappings.size}`);
        console.log('');
        console.log('   Records imported:');
        for (const [table, count] of Object.entries(stats.tables)) {
            console.log(`     ${table}: ${count}`);
        }

        if (stats.errors.length > 0) {
            console.log('');
            console.log(`   ⚠️ Errors (${stats.errors.length}):`);
            const uniqueErrors = [...new Map(stats.errors.map(e => [`${e.table}:${e.error}`, e])).values()];
            for (const err of uniqueErrors.slice(0, 20)) {
                console.log(`     ${err.table}: ${err.error}`);
            }
            if (uniqueErrors.length > 20) {
                console.log(`     ... and ${uniqueErrors.length - 20} more`);
            }
        }

    } catch (error) {
        log(`Import failed: ${error.message}`, 'error');
        console.error(error);
        process.exit(1);
    } finally {
        if (pgApiClient) await pgApiClient.end();
        if (pgPaymentClient) await pgPaymentClient.end();
    }
}

// Run import
main();

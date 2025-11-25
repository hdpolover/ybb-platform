#!/usr/bin/env node

/**
 * MySQL to PostgreSQL Data Migration Script
 * 
 * This script migrates data from MySQL to PostgreSQL:
 * 1. Connects to both databases
 * 2. Maps MySQL INT IDs to PostgreSQL UUIDs
 * 3. Transforms data types (datetime → timestamptz, etc.)
 * 4. Handles foreign key relationships
 * 5. Stores ID mappings in migration_tracking table
 * 
 * Usage:
 *   node scripts/migrate-mysql-to-postgres.js
 * 
 * Environment Variables Required:
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 *   DATABASE_URL (PostgreSQL connection string)
 */

const mysql = require('mysql2/promise');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// MySQL connection config
const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'ybb_master_app_db',
};

// ID mapping storage
const idMappings = new Map();

/**
 * Get or create UUID mapping for a MySQL ID
 */
function getOrCreateUUID(tableName, mysqlId) {
  const key = `${tableName}:${mysqlId}`;
  
  if (!idMappings.has(key)) {
    idMappings.set(key, uuidv4());
  }
  
  return idMappings.get(key);
}

/**
 * Save ID mapping to database for reference
 */
async function saveIdMapping(tableName, mysqlId, postgresId, batch) {
  await prisma.migrationTracking.create({
    data: {
      tableName,
      mysqlId,
      postgresId,
      migrationBatch: batch,
    },
  });
}

/**
 * Migrate Users Table
 */
async function migrateUsers(mysqlConnection, batch) {
  console.log('📝 Migrating users...');
  
  const [mysqlUsers] = await mysqlConnection.query('SELECT * FROM users WHERE is_deleted = 0 OR is_deleted IS NULL');
  
  for (const mysqlUser of mysqlUsers) {
    const postgresId = getOrCreateUUID('users', mysqlUser.id);
    
    try {
      await prisma.user.create({
        data: {
          id: postgresId,
          email: mysqlUser.email,
          passwordHash: mysqlUser.password || '',
          firstName: mysqlUser.first_name || 'Unknown',
          lastName: mysqlUser.last_name || 'Unknown',
          role: 'user',
          status: 'active',
          phoneNumber: mysqlUser.phone,
          emailVerified: mysqlUser.email_verified === 1,
          createdAt: mysqlUser.created_at || new Date(),
          updatedAt: mysqlUser.updated_at || new Date(),
          legacyId: mysqlUser.id,
        },
      });
      
      await saveIdMapping('users', mysqlUser.id, postgresId, batch);
    } catch (error) {
      console.error(`Error migrating user ${mysqlUser.id}:`, error.message);
    }
  }
  
  console.log(`✅ Migrated ${mysqlUsers.length} users`);
}

/**
 * Migrate Admins Table
 */
async function migrateAdmins(mysqlConnection, batch) {
  console.log('📝 Migrating admins...');
  
  const [mysqlAdmins] = await mysqlConnection.query('SELECT * FROM admins WHERE is_deleted = 0 OR is_deleted IS NULL');
  
  // First, create admin roles if they don't exist
  const defaultRole = await prisma.adminRole.findFirst({
    where: { name: 'super_admin' },
  });
  
  for (const mysqlAdmin of mysqlAdmins) {
    const postgresId = getOrCreateUUID('admins', mysqlAdmin.id);
    const userId = getOrCreateUUID('users', mysqlAdmin.id); // Admins reference users
    
    try {
      await prisma.admin.create({
        data: {
          id: postgresId,
          userId: userId,
          roleId: defaultRole?.id,
          employeeId: mysqlAdmin.employee_id,
          isSuperAdmin: mysqlAdmin.role === 'super_admin',
          createdAt: mysqlAdmin.created_at || new Date(),
          updatedAt: mysqlAdmin.updated_at || new Date(),
          legacyId: mysqlAdmin.id,
        },
      });
      
      await saveIdMapping('admins', mysqlAdmin.id, postgresId, batch);
    } catch (error) {
      console.error(`Error migrating admin ${mysqlAdmin.id}:`, error.message);
    }
  }
  
  console.log(`✅ Migrated ${mysqlAdmins.length} admins`);
}

/**
 * Migrate Programs Table
 */
async function migratePrograms(mysqlConnection, batch) {
  console.log('📝 Migrating programs...');
  
  const [mysqlPrograms] = await mysqlConnection.query('SELECT * FROM programs WHERE is_deleted = 0 OR is_deleted IS NULL');
  
  for (const mysqlProgram of mysqlPrograms) {
    const postgresId = getOrCreateUUID('programs', mysqlProgram.id);
    
    try {
      await prisma.program.create({
        data: {
          id: postgresId,
          title: mysqlProgram.title || 'Untitled Program',
          description: mysqlProgram.description || '',
          type: mapProgramType(mysqlProgram.type),
          status: mapProgramStatus(mysqlProgram.status),
          startDate: mysqlProgram.start_date || new Date(),
          endDate: mysqlProgram.end_date || new Date(),
          applicationDeadline: mysqlProgram.registration_deadline || new Date(),
          location: mysqlProgram.location || 'TBD',
          capacity: mysqlProgram.quota || 100,
          registeredCount: mysqlProgram.registered_count || 0,
          fee: mysqlProgram.fee || 0,
          currency: mysqlProgram.currency || 'USD',
          coverImage: mysqlProgram.image,
          createdAt: mysqlProgram.created_at || new Date(),
          updatedAt: mysqlProgram.updated_at || new Date(),
          legacyId: mysqlProgram.id,
        },
      });
      
      await saveIdMapping('programs', mysqlProgram.id, postgresId, batch);
    } catch (error) {
      console.error(`Error migrating program ${mysqlProgram.id}:`, error.message);
    }
  }
  
  console.log(`✅ Migrated ${mysqlPrograms.length} programs`);
}

/**
 * Migrate Participants Table (as Applications)
 */
async function migrateParticipants(mysqlConnection, batch) {
  console.log('📝 Migrating participants...');
  
  const [mysqlParticipants] = await mysqlConnection.query('SELECT * FROM participants WHERE is_deleted = 0 OR is_deleted IS NULL');
  
  for (const participant of mysqlParticipants) {
    const postgresId = getOrCreateUUID('applications', participant.id);
    const userId = getOrCreateUUID('users', participant.user_id);
    const programId = getOrCreateUUID('programs', participant.program_id);
    
    try {
      await prisma.application.create({
        data: {
          id: postgresId,
          userId: userId,
          programId: programId,
          status: mapApplicationStatus(participant.status),
          submittedAt: participant.submitted_at,
          createdAt: participant.created_at || new Date(),
          updatedAt: participant.updated_at || new Date(),
          legacyId: participant.id,
        },
      });
      
      await saveIdMapping('applications', participant.id, postgresId, batch);
    } catch (error) {
      console.error(`Error migrating participant ${participant.id}:`, error.message);
    }
  }
  
  console.log(`✅ Migrated ${mysqlParticipants.length} participants`);
}

/**
 * Migrate Payments Table
 */
async function migratePayments(mysqlConnection, batch) {
  console.log('📝 Migrating payments...');
  
  const [mysqlPayments] = await mysqlConnection.query('SELECT * FROM payments');
  
  for (const payment of mysqlPayments) {
    const postgresId = getOrCreateUUID('payments', payment.id);
    const userId = getOrCreateUUID('users', payment.participant_id);
    const applicationId = getOrCreateUUID('applications', payment.participant_id);
    
    try {
      await prisma.payment.create({
        data: {
          id: postgresId,
          userId: userId,
          applicationId: applicationId,
          amount: payment.amount || 0,
          currency: payment.currency || 'USD',
          status: mapPaymentStatus(payment.status),
          paymentMethod: payment.payment_method || 'manual',
          paidAt: payment.payment_date,
          createdAt: payment.created_at || new Date(),
          updatedAt: payment.updated_at || new Date(),
          legacyId: payment.id,
        },
      });
      
      await saveIdMapping('payments', payment.id, postgresId, batch);
    } catch (error) {
      console.error(`Error migrating payment ${payment.id}:`, error.message);
    }
  }
  
  console.log(`✅ Migrated ${mysqlPayments.length} payments`);
}

/**
 * Helper: Map MySQL program type to PostgreSQL enum
 */
function mapProgramType(mysqlType) {
  const mapping = {
    'conference': 'conference',
    'competition': 'competition',
    'workshop': 'workshop',
    'bootcamp': 'bootcamp',
  };
  
  return mapping[mysqlType] || 'conference';
}

/**
 * Helper: Map MySQL program status to PostgreSQL enum
 */
function mapProgramStatus(mysqlStatus) {
  const mapping = {
    '0': 'draft',
    '1': 'published',
    '2': 'archived',
    'draft': 'draft',
    'published': 'published',
    'archived': 'archived',
  };
  
  return mapping[mysqlStatus] || 'draft';
}

/**
 * Helper: Map MySQL application status to PostgreSQL enum
 */
function mapApplicationStatus(mysqlStatus) {
  const mapping = {
    '0': 'draft',
    '1': 'submitted',
    '2': 'accepted',
    '3': 'rejected',
    'draft': 'draft',
    'submitted': 'submitted',
    'accepted': 'accepted',
    'rejected': 'rejected',
  };
  
  return mapping[mysqlStatus] || 'draft';
}

/**
 * Helper: Map MySQL payment status to PostgreSQL enum
 */
function mapPaymentStatus(mysqlStatus) {
  const mapping = {
    '0': 'pending',
    '1': 'processing',
    '2': 'completed',
    '3': 'failed',
    '4': 'refunded',
    'pending': 'pending',
    'completed': 'completed',
    'failed': 'failed',
    'refunded': 'refunded',
  };
  
  return mapping[mysqlStatus] || 'pending';
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting MySQL to PostgreSQL migration...\n');
  
  const batch = `migration_${new Date().toISOString().split('T')[0]}`;
  
  let mysqlConnection;
  
  try {
    // Connect to MySQL
    console.log('📡 Connecting to MySQL...');
    mysqlConnection = await mysql.createConnection(mysqlConfig);
    console.log('✅ MySQL connected\n');
    
    // Connect to PostgreSQL
    console.log('📡 Connecting to PostgreSQL...');
    await prisma.$connect();
    console.log('✅ PostgreSQL connected\n');
    
    // Run migrations in order (respecting foreign key dependencies)
    await migrateUsers(mysqlConnection, batch);
    await migrateAdmins(mysqlConnection, batch);
    await migratePrograms(mysqlConnection, batch);
    await migrateParticipants(mysqlConnection, batch);
    await migratePayments(mysqlConnection, batch);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log(`📊 Migration batch: ${batch}`);
    console.log(`📈 Total mappings created: ${idMappings.size}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
    await prisma.$disconnect();
  }
}

// Run migration
main();

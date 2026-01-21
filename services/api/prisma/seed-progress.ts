import { PrismaClient, TimelineCompletionType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

// -------------------------------------------------------------
// Fix for Prisma 7 + Postgres Adapter in Seed Script
// -------------------------------------------------------------
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
// -------------------------------------------------------------

async function main() {
  console.log('🌱 Starting participant progress seeding...');

  try {
    // 1. Ensure Dependencies (User & Program)
    // ----------------------------------------
    
    // Create/Get Test User
    const email = 'participant@mailinator.com';
    const password = 'password123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Get IYS Brand
    const brand = await prisma.programCategory.findUnique({ where: { slug: 'iys' } });
    if (!brand) throw new Error("IYS Brand not found. Run main seed first.");

    const user = await prisma.user.upsert({
      where: { email_programCategoryId: { email, programCategoryId: brand.id } },
      update: {},
      create: {
        email,
        programCategoryId: brand.id,
        passwordHash,
        emailVerified: true,
        isActive: true,
      },
    });

    // Create Participant Profile
    const participant = await prisma.participant.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        fullName: 'Test Participant',
        birthdate: new Date('2000-01-01'),
        gender: 'male',
        nationality: 'Indonesia',
        phoneNumber: '+6281234567890',
      },
    });
    
    console.log(`👤 User & Participant created: ${email}`);

    // Get IYS 2025 Program
    const program = await prisma.program.findFirst({
      where: { slug: 'istanbul-youth-summit-2025' },
    });
    if (!program) throw new Error("IYS 2025 Program not found. Run main seed first.");


    // 2. Setup Robust Timeline for Testing
    // ------------------------------------
    // We will clear existing timeline for this program to avoid confusion during this test, 
    // or upsert carefully. Let's delete for clean state on this specific program dev.
    await prisma.programTimeline.deleteMany({ where: { programId: program.id } });

    const timelineSteps = [
      {
        title: 'Registration',
        description: 'Fill out the application form',
        date: new Date('2024-08-01'),
        endDate: new Date('2024-11-30'),
        type: 'registration',
        completionType: 'status_change', // Completed when application exists/submitted?
        completionConfig: { status: 'submitted' }, 
        order: 1,
      },
      {
        title: 'Application Review',
        description: 'Wait for the committee to review your application',
        date: new Date('2024-12-01'),
        endDate: new Date('2024-12-14'),
        type: 'announcement_loa', // was 'review' (invalid)
        completionType: 'status_change',
        completionConfig: { status: 'accepted' }, // Completed if accepted
        order: 2,
      },
      {
        title: 'Payment',
        description: 'Pay the program fee to secure your slot',
        date: new Date('2024-12-15'),
        endDate: new Date('2025-01-15'),
        type: 'payment_1', // was 'payment' (invalid)
        completionType: 'payment_completed',
        completionConfig: { feeType: 'full_fee' },
        order: 3,
      },
      {
        title: 'Pre-Departure Briefing',
        description: 'Attend the online briefing',
        date: new Date('2025-01-20'),
        type: 'onboarding', // was 'event' (invalid)
        completionType: 'date_passed', // Auto-complete after date
        completionConfig: {},
        order: 4,
      },
      {
        title: 'IYS 2025 Summit',
        description: 'The main event!',
        date: new Date('2025-02-10'),
        endDate: new Date('2025-02-13'),
        type: 'program_start', // was 'event' (invalid)
        completionType: 'date_passed',
        completionConfig: {},
        order: 5,
      }
    ];

    for (const step of timelineSteps) {
      await prisma.programTimeline.create({
        data: {
          programId: program.id,
          title: step.title,
          description: step.description,
          date: step.date,
          endDate: step.endDate,
          // @ts-ignore - dynamic string to enum mapping
          type: step.type,
          // @ts-ignore
          completionType: step.completionType, // Cast to enum
          completionConfig: step.completionConfig,
          order: step.order,
          isActive: true,
        },
      });
    }
    console.log(`📅 Timeline steps refreshed (Count: ${timelineSteps.length})`);


    // 3. Create Application (Simulate 'In Progress')
    // ----------------------------------------------
    const application = await prisma.participantApplication.create({
      data: {
        programId: program.id,
        participantId: participant.id,
        status: 'accepted', // Simulate they passed step 1 and 2
        paymentStatus: 'unpaid', // Stuck at step 3
      },
    });
    console.log(`📝 Application created with status: ${application.status}`);


    // 4. Create Partial Payment (Optional Test)
    // -----------------------------------------
    // If we want to test payment progression, we could add a transaction here.
    // For now, let's leave it unpaid to see if the "Payment" step shows as "in_progress" or "active".

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

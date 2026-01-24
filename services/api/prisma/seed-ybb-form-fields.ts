import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
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
  console.log('🌱 Seeding Application Form Fields for YBB Ambassador 2025...');

  // 1. Find the Program
  const programSlug = 'ybb-ambassador-2025';
  const program = await prisma.program.findFirst({
    where: { slug: programSlug },
  });

  if (!program) {
    console.error(`❌ Program with slug '${programSlug}' not found. Please run the main seed first.`);
    process.exit(1);
  }

  console.log(`✅ Found Program: ${program.name} (${program.id})`);

  // 2. Define Form Fields
  const formFields = [
    {
      name: 'full_name',
      label: 'Full Name',
      placeholder: 'Enter your full name as per identity card',
      helpText: 'Please ensure your name matches your passport or ID.',
      type: 'text',
      isRequired: true,
      order: 1,
      validationRules: { minLength: 3, maxLength: 100 },
    },
    {
      name: 'whatsapp_number',
      label: 'WhatsApp Number',
      placeholder: '+6281234567890',
      helpText: 'Include country code.',
      type: 'phone', // or text
      isRequired: true,
      order: 2,
    },
    {
      name: 'gender',
      label: 'Gender',
      placeholder: 'Select your gender',
      type: 'select',
      isRequired: true,
      order: 3,
      options: ['Male', 'Female', 'Prefer not to say'],
    },
    {
      name: 'occupation',
      label: 'Current Occupation',
      placeholder: 'e.g. Student, Professional',
      type: 'text',
      isRequired: true,
      order: 4,
    },
    {
      name: 'institution',
      label: 'Institution / Company',
      placeholder: 'University Name or Company Name',
      type: 'text',
      isRequired: true,
      order: 5,
    },
    {
      name: 'motivation_letter',
      label: 'Motivation Letter',
      placeholder: 'Why do you want to join this program?',
      helpText: 'Explain your motivation and what you hope to achieve (min 150 words).',
      type: 'textarea', // Maps to Textarea in frontend
      isRequired: true,
      order: 6,
      validationRules: { minLength: 150 },
    },
    {
      name: 'leadership_experience',
      label: 'Leadership Experience',
      placeholder: 'Describe your past leadership roles...',
      type: 'textarea',
      isRequired: false,
      order: 7,
    },
    {
      name: 'program_source',
      label: 'Where did you hear about us?',
      type: 'checkbox', // allow multiple
      isRequired: true,
      order: 8,
      options: ['Instagram', 'Facebook', 'LinkedIn', 'Friend', 'Website', 'Other'],
    },
    {
      name: 'cv_upload',
      label: 'Curriculum Vitae',
      helpText: 'Upload your latest CV in PDF format (max 2MB).',
      type: 'file',
      isRequired: true,
      order: 9,
      validationRules: { allowedTypes: ['pdf'], maxSize: 2048 },
    },
    {
      name: 'action_plan',
      label: 'Proposed Action Plan',
      helpText: 'If selected, what will you do as an ambassador?',
      type: 'textarea',
      isRequired: true,
      order: 10,
    }
  ];

  // 3. Clear existing fields (optional, but good for idempotency)
  console.log('🧹 Clearing existing form fields for this program...');
  await prisma.applicationFormField.deleteMany({
    where: { programId: program.id },
  });

  // 4. Insert new fields
  console.log('📝 Creating form fields...');
  
  for (const field of formFields) {
    await prisma.applicationFormField.create({
      data: {
        programId: program.id,
        ...field,
      },
    });
  }

  console.log(`✅ Successfully created ${formFields.length} form fields.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

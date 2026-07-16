
// @ts-nocheck
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { prisma } from './utils';

const MIGRATION_DIR = path.join(process.cwd(), '../../../migration_data');

// Helper to read CSV/TSV
function readCSV(filename: string, delimiter: string = ',') {
  const filePath = path.join(MIGRATION_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filename}. Skipping...`);
    return [];
  }
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return parse(fileContent, {
    columns: false, // We use index based on our manual inspection
    skip_empty_lines: true,
    delimiter: delimiter,
    relax_quotes: true,
    relax_column_count: true,
  });
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-')   // Replace multiple - with single -
    .replace(/^-+/, '')       // Trim - from start of text
    .replace(/-+$/, '');      // Trim - from end of text
}

export async function seedExtendedCSV() {
  console.log('🌱 Starting Extended CSV Seeding...');
  
  if (!fs.existsSync(MIGRATION_DIR)) {
    console.log('⚠️ Migration directory not found. Skipping extended CSV seed.');
    return;
  }

  await seedProgramCategories();
  await seedProgramTimelines(); // Maps from program_schedules.csv
  await seedProgramFaqs();
  
  console.log('✅ Extended CSV Seeding Completed.');
}

async function seedProgramCategories() {
  console.log('Processing Program Categories...');
  const records = readCSV('program_categories.csv', '\t'); // TSV
  
  for (const record of records) {
    // Mapping based on visual inspection:
    // 0: id (legacyId)
    // 1: name
    // 2: description (short)
    // 3: ?
    // 4: website
    // 5: about (rich text)
    // 6: logo_url
    // 7: banner_url
    // 8: email
    // 9: phone
    // 10: social_link
    // 11: location (default city)
    // 12: created_at
    // 13: updated_at

    const legacyId = parseInt(record[0]);
    if (isNaN(legacyId)) continue;
    
    const name = record[1];
    const slug = slugify(name);
    
    // Check if category exists by legacyId or slug
    const existing = await prisma.brand.findFirst({
        where: { OR: [{ legacyId }, { slug }] }
    });

    const data = {
      name: name,
      slug: slug,
      description: record[2],
      websiteUrl: record[4],
      about: record[5]?.length > 10 ? record[5] : null,
      logoUrl: record[6],
      bannerUrl: record[7],
      contactEmail: record[8],
      contactPhone: record[9],
      // social: record[10] // We need to parse into JSON if we want to use it
      defaultLocation: record[11],
      legacyId: legacyId,
    };

    if (existing) {
        // Update
        await prisma.brand.update({
            where: { id: existing.id },
            data
        });
    } else {
        // Create
        await prisma.brand.create({
            data
        });
    }
  }
  console.log(`Processed ${records.length} Program Categories.`);
}

async function seedProgramTimelines() {
  console.log('Processing Program Schedules (Timelines)...');
  const records = readCSV('program_schedules.csv', '\t');
  
  // Cache programs by legacy ID to minimize DB calls
  const programs = await prisma.program.findMany({
      where: { legacyId: { not: null } },
      select: { id: true, legacyId: true }
  });
  
  const programMap = new Map<number, string>();
  programs.forEach(p => {
      if (p.legacyId) programMap.set(p.legacyId, p.id);
  });

  let count = 0;
  for (const record of records) {
    // 0: id
    // 1: program_id (legacy)
    // 2: title
    // 3: description
    // 4: start_date
    // 5: end_date
    // 6: order
    
    const legacyProgramId = parseInt(record[1]);
    const programId = programMap.get(legacyProgramId);
    
    if (!programId) continue; // Skip if program not found

    const startDate = new Date(record[4]);
    const endDate = record[5] ? new Date(record[5]) : null;
    
    if (isNaN(startDate.getTime())) continue;

    const title = record[2];

    // Try to find existing timeline entry to avoid dupes
    // Complex to identify unique row without legacy ID on Timeline model
    // But since we are seeding, we can check by (programId, title, date)
    
    const existing = await prisma.programTimeline.findFirst({
        where: {
            programId,
            title: title,
            date: startDate
        }
    });

    if (!existing) {
        await prisma.programTimeline.create({
            data: {
                programId,
                title,
                description: record[3] === 'desc' ? null : record[3],
                date: startDate,
                endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
                order: parseInt(record[6]) || 0,
                type: 'custom'
            }
        });
        count++;
    }
  }
  console.log(`Processed ${count} Program Timeline events.`);
}

async function seedProgramFaqs() {
  console.log('Processing Program FAQs...');
  const records = readCSV('program_faqs.csv', '\t');
  
  const programs = await prisma.program.findMany({
      where: { legacyId: { not: null } },
      select: { id: true, legacyId: true }
  });
  
  const programMap = new Map<number, string>();
  programs.forEach(p => {
      if (p.legacyId) programMap.set(p.legacyId, p.id);
  });

  let count = 0;
  for (const record of records) {
      // 0: id
      // 1: program_id (legacy)
      // 2: question
      // 3: answer
      
      const legacyProgramId = parseInt(record[1]);
      const programId = programMap.get(legacyProgramId);
      
      if (!programId) continue;

      const question = record[2];
      const answer = record[3];

      const existing = await prisma.programFaq.findFirst({
          where: { programId, question }
      });

      if (!existing) {
          await prisma.programFaq.create({
              data: {
                  programId,
                  question,
                  answer,
                  order: count // Simple auto-increment for order
              }
          });
          count++;
      }
  }
  console.log(`Processed ${count} Program FAQs.`);
}

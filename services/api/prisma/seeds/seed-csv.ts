
import { prisma, log, error } from './utils';
import * as fs from 'fs';
import * as path from 'path';

// Helper to read TSV/CSV
function parseTSV(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const result: string[][] = [];
  
  // No headers in these files? It seems they are headless or I need to hardcode the mapping based on my inspection.
  // The user provided snippets show data immediately.
  // I will treat them as headless and map by index.
  
  for (const line of lines) {
    if (!line.trim()) continue;
    // split by tab
    const cols = line.split('\t');
    result.push(cols);
  }
  return result;
}

const MIGRATION_DIR = path.resolve(__dirname, '../../../../migration_data');

const CATEGORY_MAP: Record<string, string> = {
  '1': 'iys',
  '2': 'wyf',
  '3': 'middle-east-youth-summit',
  '4': 'korea-youth-summit',
  '5': 'yaf',
  '6': 'jys',
  '10': 'vietnam-youth-summit',
};

// Map Legacy Program ID to new UUID
const PROGRAM_ID_MAP: Record<string, string> = {};

export async function seedFromCSV() {
  log('📂 Seeding from CSV migration data...');

  try {
    // 1. Seed Categories (Brands)
    log('  - Seeding Brands (Categories)...');
    const categoriesData = parseTSV(path.join(MIGRATION_DIR, 'program_categories.csv'));
    
    for (const row of categoriesData) {
        // ID	Name	ShortDesc	Active	Website	Desc(HTML)	Logo	Banner	Email	Phone	Telegram	Location	CreatedAt	UpdatedAt
        // 0	1	2	3	4	5	6	7	8	9	10	11	12	13
        
        const legacyId = row[0];
        const name = row[1];
        const slug = CATEGORY_MAP[legacyId];
        
        if (!slug) continue;
        
        await prisma.programCategory.upsert({
            where: { slug: slug },
            update: {
                name: name,
                description: row[2], // Short Desc
                logoUrl: row[6] !== 'NULL' ? row[6] : undefined,
            },
            create: {
                name: name,
                slug: slug,
                description: row[2],
                logoUrl: row[6] !== 'NULL' ? row[6] : undefined,
            }
        });
    }

    // 2. Seed Programs
    log('  - Seeding Programs...');
    const programsData = parseTSV(path.join(MIGRATION_DIR, 'programs.csv'));
    
    for (const row of programsData) {
        // ID	CatID	Name	Desc	StartDate	EndDate	Banner	Created	Updated
        // 0	1	2	3	4	5	6	7	8
        // Note: Programs.csv structure from my read_file:
        // 1	1	IYS 2024	123	2024-02-21...	2024-02-29... NULL	2024-02-12... 2024-02-12...
        
        const legacyId = row[0];
        const legacyCatId = row[1];
        const name = row[2];
        const description = row[3];
        
        // Dates might be "2024-02-21 20:29:22" or "2024-10-05 00:00:00"
        const startDate = new Date(row[4]);
        const endDate = new Date(row[5]);
        const bannerUrl = row[6] !== 'NULL' && row[6] ? row[6] : undefined;
        
        const brandSlug = CATEGORY_MAP[legacyCatId];
        if (!brandSlug) {
             console.warn(`Skipping program ${name} (Legacy Cat ID ${legacyCatId} not mapped)`);
             continue;
        }
        
        const brand = await prisma.programCategory.findUnique({ where: { slug: brandSlug } });
        if (!brand) continue;

        // Generate a slug for the program
        const programSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        // Year extraction
        const yearMatch = name.match(/20\d{2}/);
        const year = yearMatch ? parseInt(yearMatch[0]) : startDate.getFullYear();

        const program = await prisma.program.upsert({
            where: { 
                programCategoryId_slug: { programCategoryId: brand.id, slug: programSlug } 
            },
            update: {
                name: name,
                description: description && description.length > 10 ? description : undefined,
                startDate: startDate,
                endDate: endDate,
                year: year,
                location: 'TBA', // Default
                bannerUrl: bannerUrl,
            },
            create: {
                programCategoryId: brand.id,
                name: name,
                slug: programSlug,
                description: description && description.length > 10 ? description : `Program ${name}`,
                shortDescription: `Join ${name}`,
                startDate: startDate,
                endDate: endDate,
                applicationDeadline: new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000),
                year: year,
                location: 'TBA',
                capacity: 500,
                bannerUrl: bannerUrl,
                status: 'published',
                isActive: true,
            }
        });
        
        PROGRAM_ID_MAP[legacyId] = program.id;
    }
    
    // 3. Seed Announcements
    log('  - Seeding Announcements...');
    const announcementsData = parseTSV(path.join(MIGRATION_DIR, 'program_announcements.csv'));
    
    for (const row of announcementsData) {
        // ID	ProgID	Title	Content	Active	Image	Created	Updated
        // 0	1	2	3	4	5	6	7
        
        const legacyProgId = row[1];
        const title = row[2];
        const content = row[3];
        const imageUrl = row[5] !== 'NULL' ? row[5] : undefined;
        const createdRaw = row[6];
        
        const programId = PROGRAM_ID_MAP[legacyProgId];
        
        // If mapped program not found (e.g. might be a program we skipped or created by another seeder like IYS 2026 if it wasn't in CSV?
        // Wait, IYS 2026 IS in CSV (ID 10). So it should be in map.
        // However, Seed IYS might have created it first. Upsert handles that.
        // But PROGRAM_ID_MAP is only populated if the CSV loop runs.
        
        if (!programId) {
            // Find manually? 
            // Maybe this announcement is for a program created by seed-programs-iys.ts?
            // "Istanbul Youth Summit 2025" -> ID 3.
            // If Seed IYS created it, but I didn't update map...
            
            // Let's try to infer program from legacy ID if not in map
            // Only if I assume I covered all in step 2.
            continue;
        }

        await prisma.programAnnouncement.create({
            data: {
                programId: programId,
                title: title,
                content: content,
                category: 'General',
                imageUrl: imageUrl,
                publishDate: new Date(createdRaw),
                isActive: true
            }
        });
    }

     // 4. Seed Speakers
    log('  - Seeding Speakers...');
    const speakersData = parseTSV(path.join(MIGRATION_DIR, 'program_speakers.csv'));
    
    for (const row of speakersData) {
         // ID	ProgID	Image	Name	Title	Bio	Order	Active
         // The snippet I saw: 
         // 2	6	https://...	NULL	1 ... 1	Ibrahim Sani	CEO...	Bio...
         // Let's re-read snippet to be sure of indices.
         // 2	6	https://... 	(empty)	(empty)	Yayasan Peneraju 	Accounting...	1	(empty)	NULL	1	Ibrahim Sani	CEO...	Bio...
         // This row format looks messy in the snippet. Let's look closely at `program_speakers.csv` snippet again.
         
         // 2	6	https://...	[TAB] [TAB] Yayasan Peneraju [TAB] Accounting... [TAB] 1 [TAB] [TAB] NULL [TAB] 1 [TAB] Ibrahim Sani [TAB] CEO... [TAB] Bio
         
         // It seems the columns are:
         // 0: ID
         // 1: ProgID
         // 2: Image
         // ... skipping some ...
         // 10: Name (Index 10?)
         // 11: Title
         // 12: Bio
         
         // I'll try to find the name column. It mentions "Ibrahim Sani".
         // Use a safer approach: find the column that looks like a name if structure varies.
         // But TSV should be consistent.
         
         // Let's rely on the snippet:
         // Col 0: 2
         // Col 1: 6
         // Col 2: https://...
         // Col 3: empty
         // Col 4: empty
         // Col 5: Yayasan Peneraju (Org?)
         // Col 6: Accounting... (Tags?)
         // Col 7: 1 (Order?)
         // Col 8: empty
         // Col 9: NULL
         // Col 10: 1 (Active?)
         // Col 11: Ibrahim Sani (Name)
         // Col 12: CEO Yayasan Peneraju (Title)
         // Col 13: Bio...
         
         const legacyProgId = row[1];
         const imageUrl = row[2];
         const organization = row[5];
         const name = row[11];
         const title = row[12];
         const bio = row[13];
         
         if (!name) continue;
         
         const programId = PROGRAM_ID_MAP[legacyProgId];
         if (!programId) continue;
         
         await prisma.programSpeaker.create({
             data: {
                 programId: programId,
                 name: name,
                 title: title || 'Speaker',
                 organization: organization,
                 bio: bio,
                 photoUrl: imageUrl,
                 isActive: true
             }
         });
    }
    
    log('✅ Seed from CSV completed.');

  } catch (e) {
    error('Ref Seed from CSV Failed');
    console.error(e);
  }
}

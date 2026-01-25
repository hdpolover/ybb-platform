import { prisma, log } from './utils';
import { BRANDS } from './seed-brands';

export async function seedScoring() {
  log('🌱 Seeding Scoring Rubrics & Reviews...');

  // 1. Get Program
  const iys = await prisma.programCategory.findUnique({ where: { slug: BRANDS.IYS } });
  if (!iys) return;

  const iys2026 = await prisma.program.findFirst({
    where: { 
      programCategoryId: iys.id, 
      slug: 'istanbul-youth-summit-2026' 
    }
  });

  if (!iys2026) {
    log('⚠️ IYS 2026 Not found, skipping scoring seed');
    return;
  }

  // 2. Create Scoring Schema
  const schema = await prisma.scoringSchema.create({
    data: {
      programId: iys2026.id,
      name: "IYS 2026 Selection Rubric",
      description: "Standard rubric for assessing essays and achievements.",
      isActive: true
    }
  });

  // 3. Create Categories & Criteria based on CSV logic
  // Essay Category (60%)
  const essayCat = await prisma.scoringCategory.create({
    data: {
      schemaId: schema.id,
      name: "Essay Assessment",
      weight: 0.60,
      order: 1,
      criteria: {
        create: [
          { name: "Topic Relevance to SDGS Themes", weight: 0.30, maxScore: 100, order: 1 },
          { name: "Argumentation, Innovation, and Creativity", weight: 0.50, maxScore: 100, order: 2 },
          { name: "Validity of Sources and References", weight: 0.10, maxScore: 100, order: 3 },
          { name: "Writing Format", weight: 0.10, maxScore: 100, order: 4 }
        ]
      }
    },
    include: { criteria: true }
  });

  // Achievement Category (40%)
  const achCat = await prisma.scoringCategory.create({
    data: {
      schemaId: schema.id,
      name: "Achievement & Experience",
      weight: 0.40,
      order: 2,
      criteria: {
        create: [
          { name: "Project Experiences", weight: 0.30, maxScore: 100, order: 1 },
          { name: "Achievement", weight: 0.40, maxScore: 100, order: 2 },
          { name: "Leadership", weight: 0.30, maxScore: 100, order: 3 }
        ]
      }
    },
    include: { criteria: true }
  });

  // 4. Seed Review for 'Alex Winner'
  // Find Admin (Reviewer)
  const admin = await prisma.admin.findFirst();
  if (!admin) {
      log('⚠️ No admin found for reviewing');
      return;
  }

  // Find Application
  const winnerApp = await prisma.participantApplication.findFirst({
    where: {
        programId: iys2026.id, 
        participant: { fullName: { contains: 'Winner' } }
    },
    include: { participant: true } 
  });

  if (winnerApp) {
      // Calculate total for simulation
      const essayScore = 95;
      const achScore = 96;
      const total = (essayScore * 0.6) + (achScore * 0.4);

      // Create Review
      const review = await prisma.applicationReview.create({
          data: {
              applicationId: winnerApp.id,
              schemaId: schema.id,
              reviewerId: admin.id,
              status: 'submitted',
              totalScore: total,
              notes: "Exceptional candidate. Strong alignment with SDGS."
          }
      });

      // Add scores
      // Essay Scores
      for (const crit of essayCat.criteria) {
          await prisma.applicationScoreItem.create({
              data: {
                  reviewId: review.id,
                  criterionId: crit.id,
                  score: essayScore, 
                  notes: "Excellent point"
              }
          });
      }
      
      // Ach Scores
      for (const crit of achCat.criteria) {
          await prisma.applicationScoreItem.create({
              data: {
                  reviewId: review.id,
                  criterionId: crit.id,
                  score: achScore, 
                  notes: "Very impressive background"
              }
          });
      }
      
      log(`✅ Created review for ${winnerApp.participant.fullName}`);
  }

  log('✅ Scoring Rubrics seeded');
}

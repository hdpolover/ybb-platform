// services/api/prisma/seeds/seed-scoring.ts
// Idempotent backfill: gives every program an application-stage scoring
// rubric (version 1) if it does not already have an active one. Safe to
// re-run against production. No interview-stage rubric is ever seeded here;
// a SuperAdmin authors that one on the Rubric page.
import { prisma, log } from './utils';

const APPLICATION_STAGE_RUBRIC = {
  name: 'Application Assessment Rubric',
  description: 'Default application-stage scoring rubric ported from the legacy assessment forms.',
  passThreshold: 75,
  categories: [
    {
      name: 'Achievement and Experience',
      weight: 0.4,
      order: 1,
      criteria: [
        { name: 'Project Experiences', weight: 0.3, maxScore: 100, order: 1 },
        { name: 'Achievement', weight: 0.4, maxScore: 100, order: 2 },
        { name: 'Leadership', weight: 0.3, maxScore: 100, order: 3 },
      ],
    },
    {
      name: 'Essay Assessment',
      weight: 0.6,
      order: 2,
      criteria: [
        { name: 'Topic Relevance to SDGs Themes', weight: 0.3, maxScore: 100, order: 1 },
        { name: 'Argumentation, Innovation, and Creativity', weight: 0.5, maxScore: 100, order: 2 },
        { name: 'Validity of Sources and References', weight: 0.1, maxScore: 100, order: 3 },
        { name: 'Writing Format', weight: 0.1, maxScore: 100, order: 4 },
      ],
    },
  ],
} as const;

const APPLICATION_STAGE = 'application' as const;

export async function seedScoring(): Promise<void> {
  log('Seeding application-stage scoring rubrics...');

  const programs = await prisma.program.findMany({ select: { id: true, name: true } });

  let created = 0;
  let skipped = 0;

  for (const program of programs) {
    // isActive + deletedAt: null mirrors the lookup used by
    // ScoringRubricRepository.findActive (mintRubricVersion), the source of
    // truth for what "already has a rubric" means for this stage.
    const existingActive = await prisma.scoringSchema.findFirst({
      where: {
        programId: program.id,
        stage: APPLICATION_STAGE,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingActive) {
      skipped += 1;
      log(`  skip  ${program.name}: active application rubric already exists`);
      continue;
    }

    // Version 1 is only safe when nothing has ever reserved it. A prior
    // non-idempotent seed run or a manually soft-deleted schema can still
    // occupy version 1 because @@unique([programId, stage, version]) has no
    // deletedAt filter, so derive the next version from MAX(version) across
    // ALL rows (including soft-deleted) rather than hardcoding 1.
    const versionAggregate = await prisma.scoringSchema.aggregate({
      where: { programId: program.id, stage: APPLICATION_STAGE },
      _max: { version: true },
    });
    const nextVersion = (versionAggregate._max.version ?? 0) + 1;

    await prisma.scoringSchema.create({
      data: {
        programId: program.id,
        stage: APPLICATION_STAGE,
        version: nextVersion,
        isActive: true,
        name: APPLICATION_STAGE_RUBRIC.name,
        description: APPLICATION_STAGE_RUBRIC.description,
        passThreshold: APPLICATION_STAGE_RUBRIC.passThreshold,
        categories: {
          create: APPLICATION_STAGE_RUBRIC.categories.map((cat) => ({
            name: cat.name,
            weight: cat.weight,
            order: cat.order,
            criteria: {
              create: cat.criteria.map((crit) => ({
                name: crit.name,
                weight: crit.weight,
                maxScore: crit.maxScore,
                order: crit.order,
              })),
            },
          })),
        },
      },
    });

    created += 1;
    log(`  create ${program.name}: application rubric v${nextVersion} created`);
  }

  log(`Application rubric backfill complete: ${created} created, ${skipped} skipped (already had an active rubric).`);
  log('No interview-stage rubric is seeded; a super admin authors one on the Rubric page when ready.');
}

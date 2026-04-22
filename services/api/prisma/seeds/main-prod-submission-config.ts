import { prisma, log, error } from './utils';
import { BRANDS, seedBrands } from './seed-brands';
import { buildLegacySubmissionFormFields } from './data/shared-submission-form-fields';
import { CYS_2026_DATA } from './data/cys-2026-data';
import { JYS_2026_DATA } from './data/jys-2026-data';

type SubmissionSeedKey = 'cys' | 'jys';

type SubmissionProgramSeed = {
  key: SubmissionSeedKey;
  label: string;
  brandSlug: string;
  programSlug: string;
  participationCategories: Array<{
    name: string;
    description?: string;
    benefits?: string;
    eligibility?: string;
    order: number;
  }>;
  subthemes: Array<{
    name: string;
    description?: string;
  }>;
  essays: Array<{
    question: string;
    description?: string;
    wordLimit?: number;
    isRequired: boolean;
    order?: number;
  }>;
};

const SUBMISSION_PROGRAM_SEEDS: Record<SubmissionSeedKey, SubmissionProgramSeed> = {
  cys: {
    key: 'cys',
    label: 'China Youth Summit 2026',
    brandSlug: BRANDS.CYS,
    programSlug: CYS_2026_DATA.program.slug,
    participationCategories: CYS_2026_DATA.participationCategories,
    subthemes: CYS_2026_DATA.subthemes,
    essays: CYS_2026_DATA.essays,
  },
  jys: {
    key: 'jys',
    label: 'Japan Youth Summit 2026',
    brandSlug: BRANDS.JYS,
    programSlug: JYS_2026_DATA.program.slug,
    participationCategories: JYS_2026_DATA.participationCategories,
    subthemes: JYS_2026_DATA.subthemes,
    essays: JYS_2026_DATA.essays,
  },
};

function resolveSelectedPrograms(): SubmissionSeedKey[] {
  const rawValue = process.env.SUBMISSION_CONFIG_PROGRAMS?.trim();
  if (!rawValue) {
    return ['cys'];
  }

  const selectedPrograms = Array.from(
    new Set(
      rawValue
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  const invalidPrograms = selectedPrograms.filter(
    (value): value is string => !(value in SUBMISSION_PROGRAM_SEEDS),
  );

  if (invalidPrograms.length > 0) {
    throw new Error(
      `Unsupported SUBMISSION_CONFIG_PROGRAMS value(s): ${invalidPrograms.join(', ')}. ` +
        `Supported values: ${Object.keys(SUBMISSION_PROGRAM_SEEDS).join(', ')}`,
    );
  }

  return selectedPrograms as SubmissionSeedKey[];
}

async function seedSubmissionConfig(seed: SubmissionProgramSeed) {
  const brand = await prisma.brand.findUnique({ where: { slug: seed.brandSlug } });
  if (!brand) {
    log(`⚠️  Skipping ${seed.label}: brand ${seed.brandSlug} not found.`);
    return;
  }

  const program = await prisma.program.findUnique({
    where: {
      brandId_slug: {
        brandId: brand.id,
        slug: seed.programSlug,
      },
    },
  });

  if (!program) {
    log(`⚠️  Skipping ${seed.label}: program ${seed.programSlug} not found for brand ${seed.brandSlug}.`);
    return;
  }

  const formFields = buildLegacySubmissionFormFields().map((field) => ({
    programId: program.id,
    ...field,
    isActive: true,
  }));

  const participationCategories = seed.participationCategories.map((category) => ({
    programId: program.id,
    ...category,
    isActive: true,
  }));

  const subthemes = seed.subthemes.map((subtheme, index) => ({
    programId: program.id,
    name: subtheme.name,
    description: subtheme.description,
    order: index + 1,
    isActive: true,
  }));

  const essays = seed.essays.map((essay, index) => ({
    programId: program.id,
    question: essay.question,
    description: essay.description,
    wordLimit: essay.wordLimit,
    isRequired: essay.isRequired,
    order: essay.order ?? index + 1,
    isActive: true,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.applicationFormField.deleteMany({ where: { programId: program.id } });
    await tx.applicationFormField.createMany({ data: formFields });

    await tx.programParticipationCategory.deleteMany({ where: { programId: program.id } });
    await tx.programParticipationCategory.createMany({ data: participationCategories });

    await tx.programSubtheme.deleteMany({ where: { programId: program.id } });
    await tx.programSubtheme.createMany({ data: subthemes });

    await tx.programEssay.deleteMany({ where: { programId: program.id } });
    await tx.programEssay.createMany({ data: essays });
  });

  log(
    `✅ Seeded submission config for ${seed.label} (${program.id}) — ` +
      `${formFields.length} fields, ${participationCategories.length} categories, ` +
      `${subthemes.length} subthemes, ${essays.length} essays.`,
  );
}

async function main() {
  log('🚀 Starting production submission-config seed...');
  try {
    await seedBrands();

    const selectedPrograms = resolveSelectedPrograms();
    for (const programKey of selectedPrograms) {
      await seedSubmissionConfig(SUBMISSION_PROGRAM_SEEDS[programKey]);
    }

    log('🎉 Production submission-config seed completed successfully!');
  } catch (e) {
    error('Production submission-config seed failed');
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
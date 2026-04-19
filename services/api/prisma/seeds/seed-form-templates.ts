import { prisma, log } from './utils';

const STANDARD_TEMPLATE_NAME = 'Standard Program Application';

type TemplateField = {
  key: string; // system field key
  section: string;
  isRequired: boolean;
  order: number;
};

const STANDARD_FIELDS: TemplateField[] = [
  { key: 'full_name',                  section: 'personal_details',     isRequired: true,  order: 1 },
  { key: 'nickname',                   section: 'personal_details',     isRequired: false, order: 2 },
  { key: 'email',                      section: 'personal_details',     isRequired: true,  order: 3 },
  { key: 'phone',                      section: 'personal_details',     isRequired: true,  order: 4 },
  { key: 'date_of_birth',              section: 'personal_details',     isRequired: true,  order: 5 },
  { key: 'gender',                     section: 'personal_details',     isRequired: true,  order: 6 },
  { key: 'nationality',                section: 'personal_details',     isRequired: true,  order: 7 },
  { key: 'origin_address',             section: 'personal_details',     isRequired: true,  order: 8 },
  { key: 'current_address',            section: 'personal_details',     isRequired: false, order: 9 },
  { key: 'profile_picture',            section: 'personal_details',     isRequired: false, order: 10 },
  { key: 'instagram_account',          section: 'personal_details',     isRequired: false, order: 11 },
  { key: 'occupation',                 section: 'professional_profile', isRequired: false, order: 20 },
  { key: 'institution',                section: 'professional_profile', isRequired: true,  order: 21 },
  { key: 'major',                      section: 'professional_profile', isRequired: false, order: 22 },
  { key: 'education_level',            section: 'professional_profile', isRequired: true,  order: 23 },
  { key: 'organizations',              section: 'professional_profile', isRequired: false, order: 24 },
  { key: 'cv_upload',                  section: 'professional_profile', isRequired: true,  order: 25 },
  { key: 'category',                   section: 'entry_information',    isRequired: true,  order: 30 },
  { key: 'program_subtheme_id',        section: 'entry_information',    isRequired: true,  order: 31 },
  { key: 'tshirt_size',                section: 'miscellaneous',        isRequired: false, order: 40 },
  { key: 'disease_history',            section: 'miscellaneous',        isRequired: false, order: 41 },
  { key: 'emergency_contact_name',     section: 'miscellaneous',        isRequired: true,  order: 42 },
  { key: 'emergency_contact_phone',    section: 'miscellaneous',        isRequired: true,  order: 43 },
  { key: 'emergency_contact_relation', section: 'miscellaneous',        isRequired: true,  order: 44 },
  { key: 'referral_source',            section: 'miscellaneous',        isRequired: true,  order: 50 },
  { key: 'referral_source_detail',     section: 'miscellaneous',        isRequired: false, order: 51 },
  { key: 'ambassador_referral_code',   section: 'miscellaneous',        isRequired: false, order: 52 },
  { key: 'twibbon_link',               section: 'miscellaneous',        isRequired: false, order: 53 },
];

export async function seedFormTemplates() {
  const description =
    'Default template covering the full set of fields historically collected on the participants table.';

  // Find by name (no unique on name, so this is the best we can do)
  const existing = await prisma.applicationFormTemplate.findFirst({
    where: { name: STANDARD_TEMPLATE_NAME, deletedAt: null },
    select: { id: true },
  });

  const template = existing
    ? await prisma.applicationFormTemplate.update({
        where: { id: existing.id },
        data: {
          description,
          category: 'standard',
          isDefault: true,
        },
      })
    : await prisma.applicationFormTemplate.create({
        data: {
          name: STANDARD_TEMPLATE_NAME,
          description,
          category: 'standard',
          isDefault: true,
        },
      });

  // Idempotent: wipe this template's field rows, then recreate from source list
  await prisma.applicationFormTemplateField.deleteMany({
    where: { templateId: template.id },
  });

  await prisma.applicationFormTemplateField.createMany({
    data: STANDARD_FIELDS.map((f) => ({
      templateId: template.id,
      source: 'system',
      systemFieldKey: f.key,
      section: f.section,
      isRequired: f.isRequired,
      order: f.order,
    })),
  });

  log(`✓ Seeded template "${STANDARD_TEMPLATE_NAME}" with ${STANDARD_FIELDS.length} fields`);
}

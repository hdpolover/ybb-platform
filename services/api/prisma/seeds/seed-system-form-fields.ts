import { prisma, log } from './utils';

type SeedEntry = {
  key: string;
  label: string;
  category: string;
  type: string;
  defaultOptions?: Array<{ label: string; value: string }>;
  isMagic?: boolean;
  helpText?: string;
  order?: number;
};

const GENERIC_CATALOG: SeedEntry[] = [
  // Identity
  { key: 'full_name', label: 'Full Name', category: 'identity', type: 'text', order: 1 },
  { key: 'nickname', label: 'Nickname / Preferred Name', category: 'identity', type: 'text', order: 2 },
  { key: 'email', label: 'Email Address', category: 'identity', type: 'email', order: 3 },
  { key: 'phone', label: 'Phone Number', category: 'identity', type: 'phone', order: 4 },
  { key: 'date_of_birth', label: 'Date of Birth', category: 'identity', type: 'date', order: 5 },
  {
    key: 'gender',
    label: 'Gender',
    category: 'identity',
    type: 'radio',
    defaultOptions: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Prefer not to say', value: 'prefer-not' },
      { label: 'Other', value: 'other' },
    ],
    order: 6,
  },
  { key: 'nationality', label: 'Nationality', category: 'identity', type: 'country', order: 7 },
  { key: 'origin_address', label: 'Origin Address', category: 'identity', type: 'textarea', order: 8, helpText: 'Hometown / permanent address.' },
  { key: 'current_address', label: 'Current Address', category: 'identity', type: 'textarea', order: 9 },
  { key: 'profile_picture', label: 'Profile Picture', category: 'identity', type: 'file', order: 10 },
  { key: 'instagram_account', label: 'Instagram Handle', category: 'identity', type: 'text', order: 11 },

  // Professional
  { key: 'occupation', label: 'Occupation', category: 'professional', type: 'text', order: 20 },
  { key: 'institution', label: 'Institution / University', category: 'professional', type: 'text', order: 21 },
  { key: 'major', label: 'Major / Field of Study', category: 'professional', type: 'text', order: 22 },
  {
    key: 'education_level',
    label: 'Highest Education Level',
    category: 'professional',
    type: 'select',
    defaultOptions: [
      { label: 'High School', value: 'high_school' },
      { label: 'Diploma', value: 'diploma' },
      { label: "Bachelor's", value: 'bachelors' },
      { label: "Master's", value: 'masters' },
      { label: 'Doctorate', value: 'doctorate' },
      { label: 'Other', value: 'other' },
    ],
    order: 23,
  },
  { key: 'organizations', label: 'Organizations / Extracurriculars', category: 'professional', type: 'textarea', order: 24 },
  { key: 'linkedin_url', label: 'LinkedIn URL', category: 'professional', type: 'url', order: 25 },
  { key: 'cv_upload', label: 'CV / Resume', category: 'professional', type: 'file', order: 26 },

  // Logistics
  {
    key: 'tshirt_size',
    label: 'T-Shirt Size',
    category: 'logistics',
    type: 'radio',
    defaultOptions: [
      { label: 'XS', value: 'XS' },
      { label: 'S', value: 'S' },
      { label: 'M', value: 'M' },
      { label: 'L', value: 'L' },
      { label: 'XL', value: 'XL' },
      { label: 'XXL', value: 'XXL' },
    ],
    order: 40,
  },
  { key: 'dietary_restrictions', label: 'Dietary Restrictions', category: 'logistics', type: 'text', order: 41 },
  { key: 'disease_history', label: 'Medical / Health History', category: 'logistics', type: 'textarea', order: 42 },
  { key: 'emergency_contact_name', label: 'Emergency Contact Name', category: 'logistics', type: 'text', order: 43 },
  { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', category: 'logistics', type: 'phone', order: 44 },
  { key: 'emergency_contact_relation', label: 'Relation to Emergency Contact', category: 'logistics', type: 'text', order: 45 },

  // Misc
  {
    key: 'referral_source',
    label: 'How did you hear about us?',
    category: 'misc',
    type: 'select',
    defaultOptions: [
      { label: 'Instagram', value: 'instagram' },
      { label: 'Twitter/X', value: 'twitter' },
      { label: 'Friend', value: 'friend' },
      { label: 'School', value: 'school' },
      { label: 'Ambassador', value: 'ambassador' },
      { label: 'Other', value: 'other' },
    ],
    order: 60,
  },
  { key: 'referral_source_detail', label: 'Referral source detail', category: 'misc', type: 'text', order: 61 },
  { key: 'ambassador_referral_code', label: 'Ambassador Referral Code', category: 'misc', type: 'text', order: 62 },
  { key: 'twibbon_link', label: 'Twibbon / Social Media Post Link', category: 'misc', type: 'url', order: 63 },
];

const MAGIC_SEED: SeedEntry[] = [
  {
    key: 'category',
    label: 'Application Category',
    category: 'program_structure',
    type: 'radio',
    isMagic: true,
    order: 30,
  },
  {
    key: 'program_subtheme_id',
    label: 'Subtheme Selection',
    category: 'program_structure',
    type: 'select',
    isMagic: true,
    order: 31,
  },
  // NOTE: program_id is intentionally NOT seeded into the catalog — it is
  // a reserved, non-admin-facing key managed entirely in code.
];

export async function seedSystemFormFields() {
  const entries = [...GENERIC_CATALOG, ...MAGIC_SEED];
  for (const e of entries) {
    await prisma.systemFormFieldDefinition.upsert({
      where: { key: e.key },
      update: {
        label: e.label,
        category: e.category,
        type: e.type,
        defaultOptions: e.defaultOptions ?? [],
        helpText: e.helpText ?? null,
        isMagic: e.isMagic ?? false,
        isActive: true,
        order: e.order ?? 0,
        deletedAt: null,
      },
      create: {
        key: e.key,
        label: e.label,
        category: e.category,
        type: e.type,
        defaultOptions: e.defaultOptions ?? [],
        helpText: e.helpText ?? null,
        isMagic: e.isMagic ?? false,
        order: e.order ?? 0,
      },
    });
  }
  log(`✓ Seeded ${entries.length} system form field definitions`);
}

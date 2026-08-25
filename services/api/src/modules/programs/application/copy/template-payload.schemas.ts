// services/api/src/modules/programs/application/copy/template-payload.schemas.ts
import { BadRequestException } from '@nestjs/common';
import {
  ApplicationCategory,
  FaqCategory,
  Prisma,
  PricingFeeType,
  PricingTarget,
  TimelineCompletionType,
  TimelineType,
} from '@prisma/client';
import { z } from 'zod';
import { PROGRAM_LANDING_CONTENT_KEYS } from './program-landing-content.constants';

// Prisma serializes a Decimal to JSON as a *string* (e.g. "55.00"), and a
// raw Decimal instance fails z.number() outright — verified empirically
// against this repo's installed @prisma/client. This codebase already has
// a convention for reading a Decimal|number union: `value instanceof
// Prisma.Decimal ? value.toNumber() : value` (get-scoring-rubrics.handler.ts,
// upsert-scoring-rubric.handler.ts). Mirrored here so a copier's
// exportTemplate can hand a live Decimal straight off a Prisma row without
// remembering to convert it first. parseTemplateItems runs on the write
// path BEFORE the payload is persisted to ContentTemplate.payload (a Json
// column) — see CreateContentTemplateHandler (Task 13) — so the normalized
// number this preprocessing produces, never a raw Decimal or its string
// form, is what's actually stored and later read back on the apply path.
// The numeric-string branch below is defense-in-depth against any future or
// legacy path that bypasses that single choke point (e.g. Task 19's
// ApplicationFormTemplate migration, or a hand-edited row).
function coerceDecimal(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}
const decimalSchema = z.preprocess(coerceDecimal, z.number());
const nullableDecimalSchema = z.preprocess(coerceDecimal, z.number().nullable());

// Same shape of problem for DateTime columns: a raw Date instance fails
// z.string().datetime() outright (also verified empirically). Normalizes to
// the same ISO-8601 string form Date#toJSON()/JSON.stringify already
// produce, so a copier's exportTemplate can hand a live Date straight off a
// Prisma row (e.g. TimelineRow.date, PricingTierValidityPeriod.startDate).
function coerceDateTime(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
const dateTimeSchema = z.preprocess(coerceDateTime, z.string().datetime());
const nullableDateTimeSchema = z.preprocess(coerceDateTime, z.string().datetime().nullable());

// Built from the generated Prisma enum objects (enums.prisma) rather than a
// hand-copied literal list, so these schemas can't silently drift from the
// database's actual enum members if one is ever added, removed, or renamed.
function enumSchema<T extends Record<string, string>>(prismaEnum: T) {
  return z.enum(Object.values(prismaEnum) as [string, ...string[]]);
}
const timelineTypeSchema = enumSchema(TimelineType);
const timelineCompletionTypeSchema = enumSchema(TimelineCompletionType);
const pricingTargetSchema = enumSchema(PricingTarget);
const faqCategorySchema = enumSchema(FaqCategory);
const pricingFeeTypeSchema = enumSchema(PricingFeeType);
const applicationCategorySchema = enumSchema(ApplicationCategory);

// form-fields: system-sourced items are intentionally thin (see
// program-copier.interface.ts's TemplatePayload doc and this plan's Global
// Constraints) — label/type/helpText/options are always re-resolved from
// SystemFormFieldDefinition at apply time, never frozen at export time.
// Custom-sourced items and migrated legacy items (which may carry
// labelOverride/helpTextOverride from the old ApplicationFormTemplateField
// shape) carry the full shape. All of the "full shape" fields are optional
// so both the thin and the legacy shape validate against one schema.
//
// mediaUrl/mediaAlt/helpAssets are NOT part of the system catalog — unlike
// label/type/helpText/options, form-fields.copier.ts's copy() copies these
// three verbatim for every field regardless of source (see its own
// comment: "Media and help assets are copied verbatim by design"). They're
// optional+nullable here (not required) so either a thin or a
// media-carrying export validates, but — critically — a slot exists at all,
// so a value that's present is preserved instead of silently stripped by
// zod's default strip-unknown-keys behavior (the defect this whole schema
// exists to prevent, per .strict() below).
const formFieldsItemSchema = z
  .object({
    source: z.enum(['system', 'custom']),
    systemFieldKey: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    placeholder: z.string().nullable().optional(),
    helpText: z.string().nullable().optional(),
    mediaUrl: z.string().nullable().optional(),
    mediaAlt: z.string().nullable().optional(),
    helpAssets: z.unknown().optional(),
    options: z.unknown().optional(),
    validationRules: z.unknown().optional(),
    section: z.string(),
    isRequired: z.boolean(),
    order: z.number(),
    labelOverride: z.string().nullable().optional(),
    helpTextOverride: z.string().nullable().optional(),
  })
  .strict();

const participationCategoriesItemSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable(),
    benefits: z.string().nullable(),
    eligibility: z.string().nullable(),
    isActive: z.boolean(),
  })
  .strict();

const timelinesItemSchema = z
  .object({
    date: dateTimeSchema,
    endDate: nullableDateTimeSchema,
    title: z.string().min(1),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    type: timelineTypeSchema,
    completionType: timelineCompletionTypeSchema,
    completionConfig: z.unknown(),
    targetAudience: pricingTargetSchema,
    isActive: z.boolean(),
  })
  .strict();

const rundownsItemSchema = z
  .object({
    day: z.string().min(1),
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
    activity: z.string().min(1),
    description: z.string().nullable(),
    location: z.string().nullable(),
    speaker: z.string().nullable(),
    isActive: z.boolean(),
  })
  .strict();

const faqsItemSchema = z
  .object({
    question: z.string().min(1),
    answer: z.string().min(1),
    category: faqCategorySchema,
    isActive: z.boolean(),
  })
  .strict();

const validityPeriodSchema = z
  .object({
    startDate: dateTimeSchema,
    endDate: dateTimeSchema,
    description: z.string().nullable(),
  })
  .strict();

const paymentsItemSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable(),
    price: decimalSchema,
    currency: z.string(),
    usdPrice: nullableDecimalSchema,
    idrPrice: nullableDecimalSchema,
    capacity: z.number().nullable(),
    benefits: z.array(z.string()),
    requirements: z.array(z.string()),
    feeType: pricingFeeTypeSchema,
    allowedCategories: z.array(applicationCategorySchema),
    icon: z.string().nullable(),
    isActive: z.boolean(),
    validityPeriods: z.array(validityPeriodSchema),
  })
  .strict();

const programDetailsItemSchema = z
  .object({
    requirementsDescription: z.string().nullable(),
    benefitsDescription: z.string().nullable(),
    termsAndConditions: z.string().nullable(),
  })
  .strict();

// ContactCopier (Task 7): four scalars on the Program row, same shape as
// programDetailsItemSchema above. No length caps here — none of this
// codebase's other template schemas enforce a column's VarChar width either
// (e.g. participationCategoriesItemSchema's `name` is VarChar(255) with no
// `.max()`), so this stays consistent with that existing precedent rather
// than inventing a new one.
// Lengths mirror Program's column widths (program.prisma: contact_email
// VarChar(255), contact_phone/contact_whatsapp VarChar(50), contact_address
// Text). The template path does NOT go through UpdateProgramContactDto, so its
// @MaxLength guards do not protect this ingress — without these caps an
// oversized value passes validation and only fails at Postgres, as a 22001 that
// surfaces to the admin as an opaque 500. That failure shape has recurred here.
const contactItemSchema = z
  .object({
    contactEmail: z.string().max(255).nullable(),
    contactPhone: z.string().max(50).nullable(),
    contactWhatsapp: z.string().max(50).nullable(),
    contactAddress: z.string().nullable(),
  })
  .strict();

// LandingCopier (Task 8): one JSON bucket, built from
// PROGRAM_LANDING_CONTENT_KEYS rather than a hand-copied literal list, so
// this schema can't silently drift from that single source of truth (see
// its own comment: "imported by ... the landing copier (Task 8) ... so the
// three can never drift out of sync with each other"). Every key is
// optional+unknown — landingContent's per-key shape is deliberately untyped
// (program-landing-content.constants.ts), and a template item only carries
// whichever keys were populated on the source program. `.strict()` still
// catches a stray top-level key outside the allow-list, matching every
// other schema in this file.
const landingContentItemSchema = z
  .object(Object.fromEntries(PROGRAM_LANDING_CONTENT_KEYS.map((key) => [key, z.unknown().optional()])))
  .strict();

const speakersItemSchema = z
  .object({
    name: z.string().min(1),
    title: z.string().nullable(),
    organization: z.string().nullable(),
    bio: z.string().nullable(),
    photoUrl: z.string().nullable(),
    email: z.string().nullable(),
    linkedinUrl: z.string().nullable(),
    twitterUrl: z.string().nullable(),
    instagramUrl: z.string().nullable(),
    sessionTitle: z.string().nullable(),
    sessionDescription: z.string().nullable(),
    sessionTime: nullableDateTimeSchema,
    isKeynote: z.boolean(),
    expertiseAreas: z.string().nullable(),
    isActive: z.boolean(),
  })
  .strict();

const testimonialsItemSchema = z
  .object({
    name: z.string().min(1),
    role: z.string().nullable(),
    company: z.string().nullable(),
    testimonial: z.string().min(1),
    category: z.string(),
    type: z.string(),
    videoUrl: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    rating: z.number().nullable(),
    alumniYear: z.number().nullable(),
    isFeatured: z.boolean(),
    isActive: z.boolean(),
  })
  .strict();

// Keyed by ProgramCopier.key — adding another copier means adding one
// entry here, not touching any call site.
const TEMPLATE_ITEM_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'form-fields': formFieldsItemSchema,
  'participation-categories': participationCategoriesItemSchema,
  timelines: timelinesItemSchema,
  rundowns: rundownsItemSchema,
  faqs: faqsItemSchema,
  payments: paymentsItemSchema,
  'program-details': programDetailsItemSchema,
  contact: contactItemSchema,
  landing: landingContentItemSchema,
  speakers: speakersItemSchema,
  testimonials: testimonialsItemSchema,
};

/**
 * Validates a TemplatePayload's `items` array against its entityType's
 * schema. Called on the write path (CreateContentTemplateHandler, right
 * after exportTemplate) and on the apply path (every copier's applyTemplate,
 * before touching the database) — the spec requires both.
 */
export function parseTemplateItems(entityType: string, items: unknown): Record<string, unknown>[] {
  const schema = TEMPLATE_ITEM_SCHEMAS[entityType];
  if (!schema) {
    throw new BadRequestException({
      code: 'unknown_template_entity_type',
      message: `No template payload schema registered for entityType '${entityType}'.`,
    });
  }
  const result = z.array(schema).safeParse(items);
  if (!result.success) {
    throw new BadRequestException({
      code: 'invalid_template_payload',
      message: `Template payload for '${entityType}' failed validation: ${result.error.message}`,
    });
  }
  return result.data as Record<string, unknown>[];
}

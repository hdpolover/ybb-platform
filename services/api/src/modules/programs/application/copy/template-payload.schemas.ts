// services/api/src/modules/programs/application/copy/template-payload.schemas.ts
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

// form-fields: system-sourced items are intentionally thin (see
// program-copier.interface.ts's TemplatePayload doc and this plan's Global
// Constraints) — label/type/helpText/options are always re-resolved from
// SystemFormFieldDefinition at apply time, never frozen at export time.
// Custom-sourced items and migrated legacy items (which may carry
// labelOverride/helpTextOverride from the old ApplicationFormTemplateField
// shape) carry the full shape. All of the "full shape" fields are optional
// so both the thin and the legacy shape validate against one schema.
const formFieldsItemSchema = z.object({
  source: z.enum(['system', 'custom']),
  systemFieldKey: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  helpText: z.string().nullable().optional(),
  options: z.unknown().optional(),
  validationRules: z.unknown().optional(),
  section: z.string(),
  isRequired: z.boolean(),
  order: z.number(),
  labelOverride: z.string().nullable().optional(),
  helpTextOverride: z.string().nullable().optional(),
});

const participationCategoriesItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  benefits: z.string().nullable(),
  eligibility: z.string().nullable(),
  isActive: z.boolean(),
});

const timelinesItemSchema = z.object({
  date: z.string().datetime(),
  endDate: z.string().datetime().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  type: z.string(),
  completionType: z.string(),
  completionConfig: z.unknown(),
  targetAudience: z.string(),
  isActive: z.boolean(),
});

const rundownsItemSchema = z.object({
  day: z.string().min(1),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  activity: z.string().min(1),
  description: z.string().nullable(),
  location: z.string().nullable(),
  speaker: z.string().nullable(),
  isActive: z.boolean(),
});

const faqsItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string(),
  isActive: z.boolean(),
});

const validityPeriodSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  description: z.string().nullable(),
});

const paymentsItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  price: z.number(),
  currency: z.string(),
  usdPrice: z.number().nullable(),
  idrPrice: z.number().nullable(),
  capacity: z.number().nullable(),
  benefits: z.array(z.string()),
  requirements: z.array(z.string()),
  feeType: z.string(),
  allowedCategories: z.array(z.string()),
  icon: z.string().nullable(),
  isActive: z.boolean(),
  validityPeriods: z.array(validityPeriodSchema),
});

const programDetailsItemSchema = z.object({
  requirementsDescription: z.string().nullable(),
  benefitsDescription: z.string().nullable(),
  termsAndConditions: z.string().nullable(),
});

// Keyed by ProgramCopier.key — adding an eighth copier means adding one
// entry here, not touching any call site.
const TEMPLATE_ITEM_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'form-fields': formFieldsItemSchema,
  'participation-categories': participationCategoriesItemSchema,
  timelines: timelinesItemSchema,
  rundowns: rundownsItemSchema,
  faqs: faqsItemSchema,
  payments: paymentsItemSchema,
  'program-details': programDetailsItemSchema,
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

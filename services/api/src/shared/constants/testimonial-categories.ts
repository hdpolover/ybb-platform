// src/shared/constants/testimonial-categories.ts

/**
 * Canonical values for `program_testimonials.category`.
 *
 * The column is a free-text VARCHAR(50), so a typo silently yields an empty
 * public section instead of an error. Every read path that filters by category
 * must use these constants rather than an inline string literal.
 */
export const TESTIMONIAL_CATEGORY = {
  DELEGATE: 'delegate',
  ALUMNI: 'alumni',
  SPEAKER: 'speaker',
} as const;

export type TestimonialCategory =
  (typeof TESTIMONIAL_CATEGORY)[keyof typeof TESTIMONIAL_CATEGORY];

export const TESTIMONIAL_CATEGORIES: readonly TestimonialCategory[] =
  Object.values(TESTIMONIAL_CATEGORY);

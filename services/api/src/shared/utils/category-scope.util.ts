// src/shared/utils/category-scope.util.ts

/**
 * Single source of truth for "does this category-scoped item apply to a
 * given applicant's category" — used to filter application_form_fields and
 * program_essays for a participant's application_category.
 *
 * Mirrors the existing ProgramPricingTier.allowedCategories convention:
 * an empty/null array means "applies to every category" (so all pre-existing
 * rows keep their current behaviour with no backfill), and a null/undefined
 * current category (application not yet categorized) never hides anything.
 */
export function isAllowedForCategory(
    allowedCategories: string[] | null | undefined,
    currentCategory: string | null | undefined,
): boolean {
    if (!allowedCategories || allowedCategories.length === 0) return true;
    if (currentCategory == null) return true;
    return allowedCategories.includes(currentCategory);
}

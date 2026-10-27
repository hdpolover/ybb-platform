// services/admin-dashboard/lib/misc-extra-fields.ts
import type { SubmissionSectionAdmin } from "@/src/shared/api-client";

export interface MiscExtraField {
  name: string;
  label: string;
  value: string;
  isLink: boolean;
}

// Fields the Miscellaneous tab already renders from participant/application columns.
// Skipping them here avoids a duplicate row.
const COVERED_BY_FIXED_ROWS = new Set([
  "knowledge_source",
  "source_account_name",
  "twibbon_link",
  "requirement_link",
  "ref_code_ambassador",
]);

/**
 * Answered fields of the program's `miscellaneous` form section that the fixed
 * rows don't cover, in form order. Unanswered fields are dropped so conditional
 * questions (visibleWhen) don't show up as empty rows.
 */
export function getMiscExtraFields(
  sections: SubmissionSectionAdmin[] | undefined,
): MiscExtraField[] {
  const misc = sections?.find((s) => s.section === "miscellaneous");
  if (!misc) return [];
  return [...misc.fields]
    .filter((f) => !COVERED_BY_FIXED_ROWS.has(f.name) && f.value.trim() !== "")
    .sort((a, b) => a.order - b.order)
    .map((f) => ({
      name: f.name,
      label: f.label,
      value: f.value,
      isLink: f.type.toLowerCase() === "url" && /^https?:\/\//i.test(f.value),
    }));
}

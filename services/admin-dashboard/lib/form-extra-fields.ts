// services/admin-dashboard/lib/form-extra-fields.ts
import type { SubmissionFormFieldAdmin, SubmissionSectionAdmin } from "@/src/shared/api-client";
import { isHttpUrl } from "@/lib/contact-links";
import { formatFieldValue } from "@/lib/field-value-format";

export interface ExtraField {
  name: string;
  label: string;
  value: string;
  isLink: boolean;
}

export interface ExtraFieldsByTab {
  personal: ExtraField[];
  professional: ExtraField[];
  entry: ExtraField[];
  misc: ExtraField[];
}

type TabKey = keyof ExtraFieldsByTab;

const SECTION_TAB: Record<string, TabKey> = {
  personal_details: "personal",
  personal_info: "personal",
  contact_information: "personal",
  professional_profile: "professional",
  entry_information: "entry",
  essay: "entry",
};

// Names already rendered by a fixed row somewhere on the page; skipped in every tab.
const COVERED = new Set([
  "full_name", "nickname", "email", "gender", "birthdate", "date_of_birth", "nationality",
  "origin_address", "current_address", "phone", "phone_number", "phone_country_code",
  "emergency_contact_name", "emergency_contact_phone", "emergency_phone_number",
  "emergency_country_code", "emergency_contact_country_code", "contact_relation",
  "emergency_contact_relation", "tshirt_size", "disease_history",
  "education_level", "institution", "major", "occupation", "organizations",
  "experience", "experiences", "achievements", "cv_upload", "resume_url",
  "category", "program_subtheme_id", "knowledge_source", "referral_source",
  "ref_code_ambassador", "ambassador_referral_code", "instagram_account",
  "source_account_name", "account_person_name", "twibbon_link", "requirement_link",
  // informational link, not an answer
  "essay_guidelines",
]);

// Option label, country name, long date or humanized code; free text as entered.
const displayValue = (f: SubmissionFormFieldAdmin): string => formatFieldValue(f.value, f);

function toExtra(f: SubmissionFormFieldAdmin): ExtraField {
  const value = displayValue(f);
  return { name: f.name, label: f.label, value, isLink: isHttpUrl(value) };
}

/**
 * Answered form fields that no fixed row covers, bucketed by the tab their
 * section belongs to and sorted by form order. Unanswered fields are dropped so
 * conditional questions (visibleWhen) don't show up as empty rows.
 */
export function getExtraFieldsByTab(sections: SubmissionSectionAdmin[] | undefined): ExtraFieldsByTab {
  const buckets: Record<TabKey, SubmissionFormFieldAdmin[]> = { personal: [], professional: [], entry: [], misc: [] };
  for (const section of sections ?? []) {
    const tab = SECTION_TAB[section.section] ?? "misc";
    for (const f of section.fields) {
      if (!COVERED.has(f.name) && f.value.trim() !== "") buckets[tab].push(f);
    }
  }
  const sorted = (fields: SubmissionFormFieldAdmin[]) =>
    [...fields].sort((a, b) => a.order - b.order).map(toExtra);
  return {
    personal: sorted(buckets.personal),
    professional: sorted(buckets.professional),
    entry: sorted(buckets.entry),
    misc: sorted(buckets.misc),
  };
}

/** Display value (see formatFieldValue) of the first answered field with this name. */
export function getFieldDisplayValue(
  sections: SubmissionSectionAdmin[] | undefined,
  name: string,
): string | undefined {
  for (const section of sections ?? []) {
    const f = section.fields.find((x) => x.name === name && x.value.trim() !== "");
    if (f) return displayValue(f);
  }
  return undefined;
}

/** First form field with one of these names, answered or not: its type and options drive formatFieldValue. */
export function findFormField(
  sections: SubmissionSectionAdmin[] | undefined,
  ...names: string[]
): SubmissionFormFieldAdmin | undefined {
  for (const name of names) {
    for (const section of sections ?? []) {
      const f = section.fields.find((x) => x.name === name);
      if (f) return f;
    }
  }
  return undefined;
}

export interface SubmittedField {
  /** "<store>.<name>", the key edit-history changes use. */
  key: string;
  name: string;
  label: string;
  /** Display value (see formatFieldValue); "" when unanswered. */
  value: string;
  isLink: boolean;
}

export interface SubmittedSection {
  section: string;
  label: string;
  fields: SubmittedField[];
}

/** The form exactly as the program defines it: every section and field in `order`, answered or not. */
export function getSubmittedSections(sections: SubmissionSectionAdmin[] | undefined): SubmittedSection[] {
  return (sections ?? []).map((s) => ({
    section: s.section,
    label: s.label,
    fields: [...s.fields]
      .sort((a, b) => a.order - b.order)
      .map((f) => {
        const value = displayValue(f);
        return { key: `${f.store}.${f.name}`, name: f.name, label: f.label, value, isLink: isHttpUrl(value) };
      }),
  }));
}

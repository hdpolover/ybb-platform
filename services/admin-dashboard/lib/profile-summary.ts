// services/admin-dashboard/lib/profile-summary.ts
// Plain-text participant summary for pasting into WhatsApp / handover notes.

export interface ProfileSummaryFields {
  name: string;
  email: string;
  phone: string;
  program: string;
  category: string;
  applicationStatus: string;
  registrationFee: string;
  programFee: string;
  nationality: string;
  institution: string;
  major: string;
}

const LINES: ReadonlyArray<readonly [label: string, key: keyof ProfileSummaryFields]> = [
  ["Name", "name"],
  ["Email", "email"],
  ["Phone", "phone"],
  ["Program", "program"],
  ["Category", "category"],
  ["Application status", "applicationStatus"],
  ["Registration fee", "registrationFee"],
  ["Program fee", "programFee"],
  ["Nationality", "nationality"],
  ["Institution", "institution"],
  ["Major", "major"],
];

const isBlank = (v: string | null | undefined): boolean => {
  const t = (v ?? "").trim();
  return t === "" || t === "—" || t === "-";
};

/** Admin link without the query string (tab / list filters are not part of the participant's identity). */
export function stripQuery(href: string): string {
  return href.split(/[?#]/)[0];
}

/** One "Label: value" line per non-empty field, then the admin link. */
export function buildProfileSummary(fields: ProfileSummaryFields, adminLink: string): string {
  const lines = LINES.filter(([, key]) => !isBlank(fields[key])).map(
    ([label, key]) => `${label}: ${fields[key].trim()}`,
  );
  if (!isBlank(adminLink)) lines.push(`Admin link: ${stripQuery(adminLink.trim())}`);
  return lines.join("\n");
}

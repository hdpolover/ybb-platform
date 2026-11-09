// lib/loa-template-issues.ts
import type { DocumentTemplateLayoutConfig } from "@/src/shared/api-client";

export interface LoaTemplateIssue {
  key: "logo" | "letterhead" | "signature";
  message: string;
}

/**
 * Plain-language list of what a generated Invitation Letter will be missing,
 * so admins can see why the PDF looks the way it does without asking.
 * Letterhead checks are skipped for legacy freeform headers, which the
 * editor already explains with its own notice.
 */
export function getLoaTemplateIssues(
  layout: DocumentTemplateLayoutConfig,
  { isLegacyHeader }: { isLegacyHeader: boolean },
): LoaTemplateIssue[] {
  const issues: LoaTemplateIssue[] = [];

  if (!isLegacyHeader && !layout.logoUrl?.trim()) {
    issues.push({
      key: "logo",
      message: "No logo: the letterhead shows only the program name. Upload one under Logo in the sidebar.",
    });
  }

  const hasLetterheadDetails = Object.values(layout.header ?? {}).some((value) => value?.trim());
  if (!isLegacyHeader && !hasLetterheadDetails) {
    issues.push({
      key: "letterhead",
      message:
        "Letterhead details are empty: the right side of the header stays blank. Fill Tagline, Website, Email or Phone under Letterhead Details.",
    });
  }

  if (!layout.signatureId && !layout.signatureUrl?.trim()) {
    issues.push({
      key: "signature",
      message: "No signature selected: the letter is generated unsigned. Pick or add one under Signature.",
    });
  }

  return issues;
}

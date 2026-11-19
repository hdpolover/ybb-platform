// services/admin-dashboard/app/components/participants/InvalidPhoneFlag.tsx
import React from "react";
import { AlertTriangle } from "lucide-react";

/** Amber warning, only for an explicit `false`; undefined/null (older API, or no number) shows nothing. */
export function InvalidPhoneFlag({ valid }: { valid: boolean | null | undefined }) {
  if (valid !== false) return null;
  return (
    <span
      title="This number failed phone-format validation. Double-check before contacting."
      className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      Format looks invalid
    </span>
  );
}

// services/admin-dashboard/app/components/participants/CopySummaryButton.tsx
"use client";

import React from "react";
import { Copy } from "lucide-react";
import { Button } from "@/src/ui/button";
import { buildProfileSummary, type ProfileSummaryFields } from "@/lib/profile-summary";
import { copyText } from "./IconActions";

export function CopySummaryButton({ fields }: { fields: ProfileSummaryFields }) {
  // Built at click time so the admin link reflects the current URL.
  const handleCopy = () => void copyText(buildProfileSummary(fields, window.location.href), "Profile summary");

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      aria-label="Copy profile summary"
      title="Copy a plain-text summary for WhatsApp or handover"
    >
      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      Copy summary
    </Button>
  );
}

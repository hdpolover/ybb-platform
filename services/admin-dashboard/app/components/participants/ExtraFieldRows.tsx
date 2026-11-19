// services/admin-dashboard/app/components/participants/ExtraFieldRows.tsx
import React from "react";
import { ExternalLink } from "lucide-react";
import type { ExtraField } from "@/lib/form-extra-fields";
import { InfoField } from "./InfoField";

/** Answered program-form fields no fixed row covers; copy on all, open when the value is a URL. */
export function ExtraFieldRows({ fields }: { fields: ExtraField[] }) {
  return (
    <>
      {fields.map((f) => (
        <InfoField
          key={f.name}
          label={f.label}
          value={f.value}
          copyValue={f.value}
          actions={f.isLink ? [{ href: f.value, label: `Open ${f.label}`, icon: ExternalLink }] : undefined}
        />
      ))}
    </>
  );
}

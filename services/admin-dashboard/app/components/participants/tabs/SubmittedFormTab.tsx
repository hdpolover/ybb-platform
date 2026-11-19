// services/admin-dashboard/app/components/participants/tabs/SubmittedFormTab.tsx
import React from "react";
import { ClipboardList, ExternalLink } from "lucide-react";
import type { SubmittedSection } from "@/lib/form-extra-fields";
import { EmptyState } from "@/src/admin/empty-state";
import { InfoField } from "../InfoField";

export interface SubmittedForm {
  sections: SubmittedSection[];
}

const NOT_ANSWERED = <span className="font-normal text-zinc-400">Not answered</span>;

/** Read-only, faithful copy of the program form: unanswered fields stay visible, unlike the per-tab extras. */
export function SubmittedFormTab({ data }: { data: SubmittedForm }) {
  if (data.sections.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No submitted form"
        description="This program has no structured form definition, so there is no as-submitted view for this application."
      />
    );
  }

  return (
    <div className="space-y-10">
      {data.sections.map((section) => (
        <section key={section.section}>
          <h3 className="mb-6 text-base font-semibold text-zinc-900">{section.label}</h3>
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            {section.fields.map((f) =>
              f.value === "" ? (
                <InfoField key={f.name} label={f.label} value={NOT_ANSWERED} />
              ) : (
                <InfoField
                  key={f.name}
                  label={f.label}
                  value={f.value}
                  isLink={f.isLink}
                  copyValue={f.value}
                  actions={f.isLink ? [{ href: f.value, label: `Open ${f.label}`, icon: ExternalLink }] : undefined}
                />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

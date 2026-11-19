// services/admin-dashboard/app/components/participants/tabs/SubmittedFormTab.tsx
"use client";

import React, { useMemo } from "react";
import { ClipboardList, ExternalLink } from "lucide-react";
import type { SubmittedSection } from "@/lib/form-extra-fields";
import type { FieldFormatShape } from "@/lib/field-value-format";
import { originalValuesByKey } from "@/lib/edit-history";
import { EmptyState } from "@/src/admin/empty-state";
import { InfoField } from "../InfoField";
import { useEditHistory } from "./EditHistoryTab";

export interface SubmittedForm {
  sections: SubmittedSection[];
}

const NOT_ANSWERED = <span className="font-normal text-zinc-400">Not answered</span>;
const NO_ORIGINALS: ReadonlyMap<string, string> = new Map();

interface SubmittedFormTabProps {
  data: SubmittedForm;
  applicationId: string;
  /** From buildChangeFields(application.submissionForm.sections). */
  changeFields: ReadonlyMap<string, FieldFormatShape>;
}

/** Mounted only while the tab is open; shares the Edit History query, so the history is fetched at most once. */
export function SubmittedFormTab({ data, applicationId, changeFields }: SubmittedFormTabProps) {
  // Pending or failed history: the form still renders, just without the "edited" notes.
  const { data: history } = useEditHistory(applicationId);
  const originals = useMemo(
    () => (history ? originalValuesByKey(history, changeFields) : NO_ORIGINALS),
    [history, changeFields],
  );
  return <SubmittedFormView data={data} originals={originals} />;
}

/** Read-only, faithful copy of the program form: unanswered fields stay visible, unlike the per-tab extras. */
export function SubmittedFormView({
  data,
  originals = NO_ORIGINALS,
}: {
  data: SubmittedForm;
  /** Field key -> formatted value before the first admin edit (originalValuesByKey). */
  originals?: ReadonlyMap<string, string>;
}) {
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
      <p className="text-xs text-zinc-500">
        Every field of the program form with its current value. Fields an admin changed are marked with what the
        participant originally submitted; the Edit History tab has who changed them and why.
      </p>
      {data.sections.map((section) => (
        <section key={section.section}>
          <h3 className="mb-6 text-base font-semibold text-zinc-900">{section.label}</h3>
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            {section.fields.map((f) => {
              const original = originals.get(f.key);
              const note = original === undefined ? undefined : <EditedNote original={original} />;
              return f.value === "" ? (
                <InfoField key={f.name} label={f.label} value={NOT_ANSWERED} warning={note} />
              ) : (
                <InfoField
                  key={f.name}
                  label={f.label}
                  value={f.value}
                  isLink={f.isLink}
                  copyValue={f.value}
                  actions={f.isLink ? [{ href: f.value, label: `Open ${f.label}`, icon: ExternalLink }] : undefined}
                  warning={note}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function EditedNote({ original }: { original: string }) {
  return (
    <div className="flex flex-wrap items-start gap-x-2 gap-y-1 text-xs">
      <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
        Edited by admin
      </span>
      <span className="line-clamp-3 min-w-0 whitespace-pre-wrap break-words text-zinc-500" title={original}>
        Originally: <span className="text-zinc-700">{original}</span>
      </span>
    </div>
  );
}

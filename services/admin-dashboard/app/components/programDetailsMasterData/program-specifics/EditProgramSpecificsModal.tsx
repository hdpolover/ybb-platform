"use client";

import { useEffect, useState } from "react";
import { DocumentTextIcon, MapPinIcon, IdentificationIcon } from "@heroicons/react/24/solid";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { FormSection } from "@/src/ui/drawer/form-section";
import { RichTextEditor } from "@/src/admin/components/rich-text-editor";

export interface ProgramSpecificsFormValues {
  year: string;
  theme: string;
  startDate: string;
  endDate: string;
  applicationDeadline: string;
  isPublished: boolean;
  location: string;
  capacity: string;
  requirePayment: boolean;
  requirementsDescription: string;
  benefitsDescription: string;
  termsAndConditions: string;
}

interface EditProgramSpecificsModalProps {
  open?: boolean;
  programName: string;
  initialValues: ProgramSpecificsFormValues;
  onSubmit: (values: ProgramSpecificsFormValues) => Promise<void>;
  isSaving: boolean;
  errorMessage: string | null;
  onClose: () => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function EditProgramSpecificsModal({
  open = true,
  programName,
  initialValues,
  onSubmit,
  isSaving,
  errorMessage,
  onClose,
}: EditProgramSpecificsModalProps) {
  const [formValues, setFormValues] = useState<ProgramSpecificsFormValues>(initialValues);

  useEffect(() => {
    setFormValues(initialValues);
  }, [initialValues]);

  const updateField = <K extends keyof ProgramSpecificsFormValues>(
    field: K,
    value: ProgramSpecificsFormValues[K],
  ) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    await onSubmit(formValues);
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title="Edit Program Specifics"
      description={
        <>
          Update settings for{" "}
          <span className="font-semibold text-zinc-900">{programName}</span> — dates, registration,
          fees, capacity, and participant-facing copy.
        </>
      }
      error={errorMessage}
      locked={isSaving}
      width="sm:max-w-4xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <FormSection
        icon={IdentificationIcon}
        title="Program Shell"
        description="Core identifiers and schedule for this program cohort."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Year</label>
            <input
              type="number"
              min="2000"
              max="2100"
              value={formValues.year}
              onChange={(event) => updateField("year", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div className="xl:col-span-3">
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Theme</label>
            <input
              type="text"
              value={formValues.theme}
              onChange={(event) => updateField("theme", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Start Date</label>
            <input
              type="date"
              value={formValues.startDate}
              onChange={(event) => updateField("startDate", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">End Date</label>
            <input
              type="date"
              value={formValues.endDate}
              onChange={(event) => updateField("endDate", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Application Deadline</label>
            <input
              type="date"
              value={formValues.applicationDeadline}
              onChange={(event) => updateField("applicationDeadline", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 shadow-sm">
              <input
                type="checkbox"
                checked={formValues.isPublished}
                onChange={(event) => updateField("isPublished", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              Published
            </label>
          </div>
        </div>
      </FormSection>

      <FormSection
        icon={MapPinIcon}
        title="Operations"
        description="Configure venue, capacity, and registration controls."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Location</label>
            <input
              type="text"
              value={formValues.location}
              onChange={(event) => updateField("location", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Capacity</label>
            <input
              type="number"
              min="0"
              value={formValues.capacity}
              onChange={(event) => updateField("capacity", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50">
            <input
              type="checkbox"
              checked={formValues.requirePayment}
              onChange={(event) => updateField("requirePayment", event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            Require payment
          </label>
        </div>
      </FormSection>

      <FormSection
        icon={DocumentTextIcon}
        title="Participant-Facing Content"
        description="Operational copy used during registration and payment flows."
      >
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Requirements Description</label>
            <RichTextEditor
              content={formValues.requirementsDescription}
              onChange={(html) => updateField("requirementsDescription", html)}
              placeholder="Describe what participants need to qualify…"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Benefits Description</label>
            <RichTextEditor
              content={formValues.benefitsDescription}
              onChange={(html) => updateField("benefitsDescription", html)}
              placeholder="Describe the benefits participants will receive…"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Terms &amp; Conditions</label>
            <RichTextEditor
              content={formValues.termsAndConditions}
              onChange={(html) => updateField("termsAndConditions", html)}
              placeholder="Enter the terms and conditions…"
            />
          </div>
        </div>
      </FormSection>
    </DrawerShell>
  );
}

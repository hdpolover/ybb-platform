"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  /** datetime-local value (business timezone, WIB), empty string clears the bound. */
  registrationOpenDate: string;
  /** datetime-local value (business timezone, WIB), empty string clears the bound. */
  registrationCloseDate: string;
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
  const params = useParams<{ programId?: string }>();
  const programId = params?.programId ?? null;
  const [formValues, setFormValues] = useState<ProgramSpecificsFormValues>(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setFormValues(initialValues);
    setValidationError(null);
  }, [initialValues]);

  const updateField = <K extends keyof ProgramSpecificsFormValues>(
    field: K,
    value: ProgramSpecificsFormValues[K],
  ) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  // datetime-local values ("YYYY-MM-DDTHH:mm") sort lexicographically the same
  // as chronologically, so plain string comparison is safe here.
  const registrationWindowInvalid =
    formValues.registrationOpenDate !== "" &&
    formValues.registrationCloseDate !== "" &&
    formValues.registrationCloseDate < formValues.registrationOpenDate;

  // applicationDeadline is a date-only value ("YYYY-MM-DD"); compare against
  // the date portion of the registration window bounds.
  const applicationDeadlineOutsideWindow =
    formValues.applicationDeadline !== "" &&
    ((formValues.registrationOpenDate !== "" &&
      formValues.applicationDeadline < formValues.registrationOpenDate.slice(0, 10)) ||
      (formValues.registrationCloseDate !== "" &&
        formValues.applicationDeadline > formValues.registrationCloseDate.slice(0, 10)));

  const handleSubmit = async () => {
    if (registrationWindowInvalid) {
      setValidationError("Registration close date must be on or after the registration open date.");
      return;
    }

    // application_deadline is NOT NULL in the database, so an empty value would
    // fail on write rather than clear the field.
    if (formValues.applicationDeadline === "") {
      setValidationError("Application deadline is required.");
      return;
    }

    setValidationError(null);
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
          <span className="font-semibold text-zinc-900">{programName}</span> — landing-facing dates,
          location, and participant-facing copy.
        </>
      }
      error={validationError ?? errorMessage}
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
        description="Configure landing-facing location and the registration window."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Location</label>
            <input
              type="text"
              value={formValues.location}
              onChange={(event) => updateField("location", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Opens</label>
            <input
              type="datetime-local"
              value={formValues.registrationOpenDate}
              onChange={(event) => updateField("registrationOpenDate", event.target.value)}
              className={INPUT_CLS}
            />
            <p className="mt-1.5 text-xs text-zinc-500">Leave blank to clear this bound.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Closes</label>
            <input
              type="datetime-local"
              value={formValues.registrationCloseDate}
              onChange={(event) => updateField("registrationCloseDate", event.target.value)}
              className={INPUT_CLS}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Leave blank to clear this bound. This bound alone does not make a category
              purchasable: that is driven by each pricing tier's validity windows in{" "}
              {programId ? (
                <Link
                  href={`/programs/${programId}/master-data/program-payments`}
                  className="cursor-pointer font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
                >
                  Program Payments
                </Link>
              ) : (
                "Program Payments"
              )}
              .
            </p>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Application Deadline</label>
            <input
              type="date"
              value={formValues.applicationDeadline}
              onChange={(event) => updateField("applicationDeadline", event.target.value)}
              className={INPUT_CLS}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Required. Drives submission reminders, and is separate from the registration window above.
            </p>
          </div>
          {applicationDeadlineOutsideWindow && !registrationWindowInvalid && (
            <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              The application deadline falls outside the registration window above. Participants may be able to
              apply after registration has closed, or be blocked from applying before it opens.
            </div>
          )}
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

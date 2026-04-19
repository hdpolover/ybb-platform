"use client";

import { useEffect, useState } from "react";
import { DocumentTextIcon, CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/solid";
import { DrawerShell } from "@/src/ui/drawer/drawer-shell";
import { FormSection } from "@/src/ui/drawer/form-section";

export interface ProgramSpecificsFormValues {
  location: string;
  capacity: string;
  registrationOpenDate: string;
  registrationCloseDate: string;
  allowRegistration: boolean;
  requirePayment: boolean;
  currency: string;
  registrationFee: string;
  requirementsDescription: string;
  benefitsDescription: string;
  termsAndConditions: string;
}

interface EditProgramSpecificsModalProps {
  /** The drawer is always rendered; parent controls visibility with `open`. */
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

/**
 * The component name stays `EditProgramSpecificsModal` for import compatibility,
 * but internally it's now a right-side drawer wrapping the same form.
 */
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
          Update operational settings for{" "}
          <span className="font-semibold text-zinc-900">{programName}</span> — registration
          windows, fees, capacity, and participant-facing copy.
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
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Top-level shell fields such as brand, year, and main program dates stay in the platform
        admin area. This form is limited to program-admin operational settings.
      </div>

      <FormSection
        icon={MapPinIcon}
        title="Operations"
        description="Configure venue, capacity, and registration controls."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
          <label className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 shadow-sm">
            <input
              type="checkbox"
              checked={formValues.allowRegistration}
              onChange={(event) => updateField("allowRegistration", event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            Allow registration
          </label>
          <label className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 shadow-sm">
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
        icon={CalendarDaysIcon}
        title="Registration & Payment"
        description="Set the application window and payment defaults."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Open Date</label>
            <input
              type="date"
              value={formValues.registrationOpenDate}
              onChange={(event) => updateField("registrationOpenDate", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Close Date</label>
            <input
              type="date"
              value={formValues.registrationCloseDate}
              onChange={(event) => updateField("registrationCloseDate", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Currency</label>
            <input
              type="text"
              value={formValues.currency}
              onChange={(event) => updateField("currency", event.target.value.toUpperCase())}
              className={`${INPUT_CLS} uppercase`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Fee</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formValues.registrationFee}
              onChange={(event) => updateField("registrationFee", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
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
            <textarea
              rows={4}
              value={formValues.requirementsDescription}
              onChange={(event) => updateField("requirementsDescription", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Benefits Description</label>
            <textarea
              rows={4}
              value={formValues.benefitsDescription}
              onChange={(event) => updateField("benefitsDescription", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Terms &amp; Conditions</label>
            <textarea
              rows={5}
              value={formValues.termsAndConditions}
              onChange={(event) => updateField("termsAndConditions", event.target.value)}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </FormSection>
    </DrawerShell>
  );
}

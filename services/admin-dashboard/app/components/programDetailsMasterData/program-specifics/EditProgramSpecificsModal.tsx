"use client";

import { useEffect, useState } from "react";
import { DocumentTextIcon, CalendarDaysIcon, MapPinIcon, CurrencyDollarIcon } from "@heroicons/react/24/solid";

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
  programName: string;
  initialValues: ProgramSpecificsFormValues;
  onSubmit: (values: ProgramSpecificsFormValues) => Promise<void>;
  isSaving: boolean;
  errorMessage: string | null;
  onClose: () => void;
}

export function EditProgramSpecificsModal({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Edit Program Specifics</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Update operational settings for <span className="font-semibold text-zinc-900">{programName}</span>,
              including registration windows, fees, capacity, and participant-facing operational copy.
            </p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {errorMessage ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Top-level shell fields such as brand, year, and main program dates stay in the platform admin area. This form is limited to program-admin operational settings.
          </div>

          {/* Operations */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <MapPinIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Operations</h3>
                <p className="text-xs text-zinc-500">Configure venue, capacity, and registration controls.</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Location</label>
                <input
                  type="text"
                  value={formValues.location}
                  onChange={(event) => updateField("location", event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Capacity</label>
                <input
                  type="number"
                  min="0"
                  value={formValues.capacity}
                  onChange={(event) => updateField("capacity", event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
          </section>

          {/* Registration & Payment */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <CalendarDaysIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Registration &amp; Payment</h3>
                <p className="text-xs text-zinc-500">Set the application window and payment defaults.</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Open Date</label>
                <input
                  type="date"
                  value={formValues.registrationOpenDate}
                  onChange={(event) => updateField("registrationOpenDate", event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Close Date</label>
                <input
                  type="date"
                  value={formValues.registrationCloseDate}
                  onChange={(event) => updateField("registrationCloseDate", event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Currency</label>
                <input
                  type="text"
                  value={formValues.currency}
                  onChange={(event) => updateField("currency", event.target.value.toUpperCase())}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm uppercase text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </section>

          {/* Participant Content */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <DocumentTextIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Participant-Facing Content</h3>
                <p className="text-xs text-zinc-500">Operational copy used during registration and payment flows.</p>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Requirements Description</label>
                <textarea
                  rows={4}
                  value={formValues.requirementsDescription}
                  onChange={(event) => updateField("requirementsDescription", event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Benefits Description</label>
                <textarea
                  rows={4}
                  value={formValues.benefitsDescription}
                  onChange={(event) => updateField("benefitsDescription", event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Terms &amp; Conditions</label>
                <textarea
                  rows={5}
                  value={formValues.termsAndConditions}
                  onChange={(event) => updateField("termsAndConditions", event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
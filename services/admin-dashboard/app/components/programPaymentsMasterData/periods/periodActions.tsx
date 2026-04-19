"use client";

import { useState } from "react";
import { PencilSquareIcon, TrashIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";
import type { PeriodRow } from "./PaymentPeriodsTable";
import { createValidityPeriod, updateValidityPeriod, deleteValidityPeriod } from "@/app/platform/api";

// FORM MODAL COMPONENT
function PeriodModal({
  isOpen,
  onClose,
  onSaved,
  initialData,
  tierId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialData?: PeriodRow;
  tierId?: string;
}) {
  const isEditing = !!initialData;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const description = (fd.get("name") as string).trim();
    const startDate = fd.get("startDate") as string;
    const endDate = fd.get("endDate") as string;

    setSaving(true);
    setError(null);
    try {
      if (isEditing && initialData) {
        await updateValidityPeriod(initialData.id, { startDate, endDate, description });
      } else {
        if (!tierId) throw new Error("Tier ID is required");
        await createValidityPeriod(tierId, { startDate, endDate, description });
      }
      onClose();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl text-left">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              {isEditing ? "Edit Period" : "Add Period"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditing
                ? "Update the configuration for this payment period."
                : "Define a new base period or extension period for this payment option."}
            </p>
          </div>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700" onClick={onClose}>
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <form id="period-form" onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                Period Name <span className="text-rose-500">*</span>
              </label>
              <input name="name" type="text" defaultValue={initialData?.name} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder='e.g., "Main Registration"' required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                Extends From Period
              </label>
              <select defaultValue={initialData?.base === false ? "registration-period" : "none"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="none">None (Create Base Period)</option>
                <option value="registration-period">Registration Period</option>
              </select>
              <p className="mt-1.5 text-xs text-zinc-500">
                Leave as <b className="text-zinc-700">None</b> to create a standalone base period.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description</label>
            <textarea rows={3} defaultValue={initialData?.description} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Optional description for this period." />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                Start Date & Time <span className="text-rose-500">*</span>
              </label>
              <input name="startDate" type="datetime-local" className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                End Date & Time <span className="text-rose-500">*</span>
              </label>
              <input name="endDate" type="datetime-local" className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="mb-1 text-sm font-semibold text-zinc-900">Note</p>
            <p className="text-sm text-zinc-700 leading-relaxed">
              Base periods cannot overlap with other base periods. Extension periods can overlap with their parent period.
            </p>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="period-form" disabled={saving} className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60">
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Period"}
          </button>
        </div>
      </div>
    </div>
  );
}

// EXPORTED ACTION BUTTONS
export function AddPeriodAction({
  tierId,
  onSaved,
}: {
  tierId?: string;
  onSaved?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <CalendarDaysIcon className="h-4 w-4" />
        <span>Add Period</span>
      </button>
      <PeriodModal isOpen={isOpen} onClose={() => setIsOpen(false)} onSaved={onSaved} tierId={tierId} />
    </>
  );
}

export function EditPeriodAction({
  period,
  onSaved,
}: {
  period: PeriodRow;
  onSaved?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
        title="Edit Period"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <PeriodModal isOpen={isOpen} onClose={() => setIsOpen(false)} onSaved={onSaved} initialData={period} />
    </>
  );
}

export function DeletePeriodAction({
  id,
  onDeleted,
}: {
  id: string;
  onDeleted?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteValidityPeriod(id);
      onDeleted?.();
    } catch {
      // silent
    } finally {
      setDeleting(false);
      setConfirm(false);
    }
  };

  if (confirm) {
    return (
      <div className="inline-flex items-center gap-1">
        <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-md bg-rose-500 px-2 py-1 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60">
          {deleting ? "…" : "Confirm"}
        </button>
        <button type="button" onClick={() => setConfirm(false)} className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700"
      title="Delete Period"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
"use client";

import { useState } from "react";
import { PencilSquareIcon, TrashIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import type { PeriodRow } from "./PaymentPeriodsTable";
import { createValidityPeriod, updateValidityPeriod, deleteValidityPeriod } from "@/app/platform/api";
import { toLocalDatetimeInputValue, toUtcIsoFromLocalInput } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/src/ui/sheet";

// FORM SHEET COMPONENT
function PeriodSheet({
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const description = (fd.get("name") as string).trim();
    const startDateInput = fd.get("startDate") as string;
    const endDateInput = fd.get("endDate") as string;

    setSaving(true);
    setError(null);
    try {
      const startDate = toUtcIsoFromLocalInput(startDateInput);
      const endDate = toUtcIsoFromLocalInput(endDateInput);
      if (!startDate || !endDate) {
        throw new Error("Invalid date/time value.");
      }
      if (isEditing && initialData) {
        await updateValidityPeriod(initialData.id, { startDate, endDate, description });
        toast.success("Period updated.");
      } else {
        if (!tierId) throw new Error("Tier ID is required");
        await createValidityPeriod(tierId, { startDate, endDate, description });
        toast.success("Period created.");
      }
      onClose();
      onSaved?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col p-0 sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-zinc-200 px-6 py-5">
            <SheetTitle>{isEditing ? "Edit Period" : "Add Period"}</SheetTitle>
            <SheetDescription>
              {isEditing
                ? "Update the configuration for this payment period."
                : "Define a new base period or extension period for this payment option."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-5 px-6 py-5">
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                  Period Name <span className="text-rose-500">*</span>
                </label>
                <input name="name" type="text" defaultValue={initialData?.name} className={inputCls} placeholder='e.g., "Main Registration"' required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                  Extends From Period
                </label>
                <select defaultValue={initialData?.base === false ? "registration-period" : "none"} className={inputCls}>
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
              <textarea name="description" rows={3} defaultValue={initialData?.description} className={inputCls} placeholder="Optional description for this period." />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                  Start Date & Time <span className="text-rose-500">*</span>
                </label>
                <input name="startDate" type="datetime-local" defaultValue={initialData?.startRaw ? toLocalDatetimeInputValue(initialData.startRaw) : undefined} className={inputCls} required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                  End Date & Time <span className="text-rose-500">*</span>
                </label>
                <input name="endDate" type="datetime-local" defaultValue={initialData?.endRaw ? toLocalDatetimeInputValue(initialData.endRaw) : undefined} className={inputCls} required />
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-1 text-sm font-semibold text-zinc-900">Note</p>
              <p className="text-sm text-zinc-700 leading-relaxed">
                Base periods cannot overlap with other base periods. Extension periods can overlap with their parent period.
              </p>
            </div>
          </div>

          <SheetFooter className="border-t border-zinc-200 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60">
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Period"}
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const inputCls = "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

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
      <PeriodSheet isOpen={isOpen} onClose={() => setIsOpen(false)} onSaved={onSaved} tierId={tierId} />
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
      <PeriodSheet isOpen={isOpen} onClose={() => setIsOpen(false)} onSaved={onSaved} initialData={period} />
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

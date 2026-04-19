"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { 
  PencilSquareIcon, 
  TrashIcon, 
  PlusIcon, 
  CalendarDaysIcon, 
  ExclamationTriangleIcon 
} from "@heroicons/react/24/solid";
import type { PaymentOptionRow } from "./PaymentOptionTable";
import { createPricingTier, updatePricingTier, deletePricingTier } from "@/app/platform/api";

// SEARCH COMPONENT
export function PaymentOptionSearch({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchTerm) {
        params.set("search", searchTerm);
      } else {
        params.delete("search");
      }
      router.push(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, pathname, router, searchParams]);

  return (
    <div className="w-full">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search by name, category..."
        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// FORM MODAL COMPONENT (Internal)
function PaymentOptionModal({
  isOpen,
  onClose,
  onSaved,
  initialData,
  programId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialData?: PaymentOptionRow;
  programId?: string;
}) {
  const isEditMode = !!initialData;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const feeTypeValue =
    initialData?.category === "Registration Fee" ? "registration_fee" : "program_fee";
  const allowedCatsValue = (() => {
    if (!initialData) return "self_funded,fully_funded";
    if (initialData.fundingType === "Self Funded") return "self_funded";
    if (initialData.fundingType === "Fully Funded") return "fully_funded";
    return "self_funded,fully_funded";
  })();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const name = (fd.get("name") as string).trim();
    const description = (fd.get("description") as string).trim();
    const price = parseFloat(fd.get("price") as string);
    const currency = fd.get("currency") as string;
    const feeType = fd.get("feeType") as string;
    const allowedCategoriesRaw = fd.get("allowedCategories") as string;
    const isActive = fd.get("isActive") === "true";
    const validFrom = fd.get("validFrom") as string;
    const validUntil = fd.get("validUntil") as string;
    const allowedCategories = allowedCategoriesRaw
      ? allowedCategoriesRaw.split(",").map((c) => c.trim())
      : [];

    setSaving(true);
    setError(null);
    try {
      if (isEditMode && initialData) {
        await updatePricingTier(initialData._id, {
          name, description, price, currency, feeType, allowedCategories, isActive, validFrom, validUntil,
        });
      } else {
        if (!programId) throw new Error("Program ID is required");
        await createPricingTier(programId, {
          name, description, price, currency, feeType, allowedCategories, isActive, validFrom, validUntil,
        });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 text-left">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl text-left">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditMode ? "Edit Payment Option" : "Add Payment Option"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">Configure payment amount, funding type, and status.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <form id="payment-option-form" className="space-y-5 px-6 py-6 max-h-[70vh] overflow-y-auto" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Option Name</label>
              <input name="name" type="text" defaultValue={initialData?.optionName} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Fee Type</label>
              <select name="feeType" defaultValue={feeTypeValue} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="registration_fee">Registration Fee</option>
                <option value="program_fee">Program Fee</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Allowed Categories</label>
              <select name="allowedCategories" defaultValue={allowedCatsValue} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="self_funded,fully_funded">All</option>
                <option value="self_funded">Self Funded</option>
                <option value="fully_funded">Fully Funded</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">USD Amount</label>
              <input name="price" type="number" step="0.01" defaultValue={initialData?.amountUsd} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Currency</label>
              <select name="currency" defaultValue="USD" className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="USD">USD</option>
                <option value="IDR">IDR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description</label>
            <textarea name="description" rows={3} defaultValue={initialData?.description} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status</label>
              <select name="isActive" defaultValue={initialData?.status !== "Inactive" ? "true" : "false"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Valid From</label>
              <input name="validFrom" type="datetime-local" className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Valid Until</label>
              <input name="validUntil" type="datetime-local" className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-amber-500" />
              <p className="text-xs text-zinc-700">
                <b className="text-zinc-900">Valid From / Until</b> is the overall active window.
                Fine-grained wave periods are managed from the Periods page.
              </p>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">Cancel</button>
          <button type="submit" form="payment-option-form" disabled={saving} className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60">
            {saving ? "Saving…" : isEditMode ? "Save Changes" : "Add Option"}
          </button>
        </div>
      </div>
    </div>
  );
}

// EXPORTED ACTION BUTTONS
export function AddPaymentOptionAction({
  programId,
  onSaved,
}: {
  programId?: string;
  onSaved?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Payment Option</span>
      </button>
      <PaymentOptionModal isOpen={isOpen} onClose={() => setIsOpen(false)} onSaved={onSaved} programId={programId} />
    </>
  );
}

export function ManagePeriodsAction({ optionId }: { optionId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <button
      type="button"
      onClick={() => router.push(`${pathname}/${optionId}`)}
      className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-600 transition hover:bg-sky-100 hover:text-sky-700"
      title="Manage Periods"
    >
      <CalendarDaysIcon className="h-4 w-4" />
    </button>
  );
}

export function EditPaymentOptionAction({
  option,
  onSaved,
}: {
  option: PaymentOptionRow;
  onSaved?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
        title="Edit Option"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <PaymentOptionModal isOpen={isOpen} onClose={() => setIsOpen(false)} onSaved={onSaved} initialData={option} />
    </>
  );
}

export function DeletePaymentOptionAction({
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
      await deletePricingTier(id);
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
      title="Delete Option"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
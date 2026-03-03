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
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: PaymentOptionRow;
}) {
  if (!isOpen) return null;
  const isEditMode = !!initialData;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(isEditMode ? "Update" : "Create", "Payment Option");
    onClose();
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
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Option Name</label>
              <input type="text" defaultValue={initialData?.optionName} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Category</label>
              <select defaultValue={initialData?.category || "Registration Fee"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="Registration Fee">Registration Fee</option>
                <option value="Program Fee 1">Program Fee 1</option>
                <option value="Program Fee 2">Program Fee 2</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Funding Type</label>
              <select defaultValue={initialData?.fundingType || "All"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="All">All</option>
                <option value="Self Funded">Self Funded</option>
                <option value="Fully Funded">Fully Funded</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">USD Amount</label>
              <input type="number" defaultValue={initialData?.amountUsd} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
            </div>
            <div className="flex items-end">
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm">
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-amber-500" />
                <div>
                  <p className="text-xs font-bold text-zinc-900">Important</p>
                  <p className="text-xs text-zinc-700">Must manage availability periods later.</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description</label>
            <textarea rows={3} defaultValue={initialData?.description} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status</label>
              <select defaultValue={initialData?.status || "Active"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">Cancel</button>
          <button type="submit" form="payment-option-form" className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// EXPORTED ACTION BUTTONS
export function AddPaymentOptionAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Payment Option</span>
      </button>
      <PaymentOptionModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function ManagePeriodsAction({ optionId }: { optionId: number }) {
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

export function EditPaymentOptionAction({ option }: { option: PaymentOptionRow }) {
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
      <PaymentOptionModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialData={option} />
    </>
  );
}

export function DeletePaymentOptionAction({ id }: { id: number }) {
  return (
    <button 
      type="button" 
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700" 
      title="Delete Option"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
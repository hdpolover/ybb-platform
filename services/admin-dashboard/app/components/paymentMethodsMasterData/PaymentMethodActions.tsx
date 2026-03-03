"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import { EyeIcon, PencilSquareIcon, TrashIcon, PlusIcon, CreditCardIcon } from "@heroicons/react/24/solid";
import type { PaymentMethodRow } from "./PaymentMethodsTable";

// SEARCH COMPONENT
export function SearchInput({ initialSearch }: { initialSearch: string }) {
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
        placeholder="Search by name or type..."
        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// FORM MODAL COMPONENT (Add & Edit)
function PaymentMethodFormModal({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: PaymentMethodRow;
}) {
  if (!isOpen) return null;
  const isEditMode = !!initialData;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [selectedImageName, setSelectedImageName] = useState<string | null>(initialData?.imageSrc ?? null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 text-left">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditMode ? "Edit Payment Method" : "Add Payment Method"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditMode
                ? "Update configuration for this payment method."
                : "Define a new payment method and usage instructions."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <form id="payment-method-form" onSubmit={handleSubmit} className="space-y-5 px-6 py-6 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Method Name <span className="text-rose-500">*</span></label>
            <input type="text" defaultValue={initialData?.name} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="e.g., Credit / Debit Card (Visa/Mastercard)" required />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Payment Type <span className="text-rose-500">*</span></label>
              <select defaultValue={initialData?.paymentType || "Manual"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="Manual">Manual</option>
                <option value="Gateway">Gateway</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status <span className="text-rose-500">*</span></label>
              <select defaultValue={initialData?.status || "Active"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-500">Payment Method Image</label>
            <p className="text-xs text-zinc-500">Upload an image for the payment method (recommended size: 200x100px).</p>
            <button
              type="button"
              className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="space-y-1.5 px-4">
                <div className="text-sm font-semibold text-zinc-700">
                  {selectedImageName ? "Image selected" : "Drop image here or click to upload."}
                </div>
                {selectedImageName ? (
                  <div className="truncate text-xs font-medium text-blue-600">{selectedImageName}</div>
                ) : (
                  <div className="text-xs text-zinc-500">Supported formats: JPG, PNG, GIF. Max size: 2MB</div>
                )}
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setSelectedImageName(e.target.files?.[0]?.name ?? null)} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description</label>
            <textarea rows={5} defaultValue={initialData?.description} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Explain how to use this payment method." />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">Cancel</button>
          <button type="submit" form="payment-method-form" className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// DETAIL MODAL COMPONENT (View)
function PaymentMethodDetailModal({
  isOpen,
  onClose,
  method,
}: {
  isOpen: boolean;
  onClose: () => void;
  method: PaymentMethodRow;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 text-left">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Payment Method Details</h3>
            <p className="mt-1 text-sm text-zinc-500">Review configuration and description for this payment method.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="space-y-6 px-6 py-6 max-h-[70vh] overflow-y-auto">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-2">Method Name</div>
            <div className="flex items-center gap-3">
              {method.imageSrc ? (
                 <div className="flex h-10 w-16 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white shadow-sm">
                   <Image src={method.imageSrc} alt={method.imageAlt} width={64} height={40} className="object-contain" />
                 </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                   <CreditCardIcon className="h-5 w-5" />
                </div>
              )}
              <h4 className="text-base font-bold text-zinc-900">{method.name}</h4>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1.5">Payment Type</div>
              <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                {method.paymentType}
              </span>
            </div>
            <div>
               <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1.5">Method Type</div>
               <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
                 {method.type}
               </span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1.5">Status</div>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${method.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-600"}`}>
                {method.status}
              </span>
            </div>
            <div>
               <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">Image Source (Alt)</div>
               <div className="text-sm font-medium text-zinc-900">{method.imageAlt || "Not set"}</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-2">Description</div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
              {method.description || "No description provided for this payment method."}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ACTION BUTTON EXPORTS 
export function AddPaymentMethodAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Payment Method</span>
      </button>
      <PaymentMethodFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function ViewPaymentMethodAction({ method }: { method: PaymentMethodRow }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-600 transition hover:bg-sky-100 hover:text-sky-700" 
        aria-label="View details"
      >
        <EyeIcon className="h-4 w-4" />
      </button>
      <PaymentMethodDetailModal isOpen={isOpen} onClose={() => setIsOpen(false)} method={method} />
    </>
  );
}

export function EditPaymentMethodAction({ method }: { method: PaymentMethodRow }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700" 
        aria-label="Edit method"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <PaymentMethodFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialData={method} />
    </>
  );
}

export function DeletePaymentMethodAction({ id }: { id: number }) {
  return (
    <button 
      type="button" 
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700" 
      aria-label="Delete method"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
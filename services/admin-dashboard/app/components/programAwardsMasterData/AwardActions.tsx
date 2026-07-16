"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { 
  EyeIcon, 
  PencilSquareIcon, 
  PlusIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  XMarkIcon
} from "@heroicons/react/24/solid";
import type { ProgramAward, AwardStatus } from "./ProgramAwardsTable";

// SEARCH COMPONENT (Shareable URL State & Full Width)
export function AwardSearch({ initialSearch }: { initialSearch: string }) {
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
        placeholder="Search by award, title, type, or description..."
        className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// FORM MODAL COMPONENT (Add & Edit)
function AwardFormModal({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: ProgramAward;
}) {
  const isEditMode = !!initialData;

  const [award, setAward] = useState(initialData?.award ?? "");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [type, setType] = useState<ProgramAward["type"]>(initialData?.type ?? "Winner");
  const [order, setOrder] = useState<number>(initialData?.order ?? 1);
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [status, setStatus] = useState<AwardStatus>(initialData?.status ?? "Active");

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log(isEditMode ? "Edit Award Submitted" : "Add Award Submitted", { award, title, type, order, description, status });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 text-left">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditMode ? "Edit Award" : "Add Award"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditMode
                ? "Update the award configuration, description, and visibility."
                : "Create a new award for this program and configure its details."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          <form id="award-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-5">
                <div className="border-b border-zinc-200 pb-3 mb-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Basic Information</h4>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Award <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" value={award} onChange={(e) => setAward(e.target.value)} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="e.g., Best Delegate" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="e.g., Best Delegate - Global Youth Summit" required />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                      Award Type <span className="text-rose-500">*</span>
                    </label>
                    <select value={type} onChange={(e) => setType(e.target.value as ProgramAward["type"])} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required>
                      <option value="Winner">Winner</option>
                      <option value="Runner Up">Runner Up</option>
                      <option value="Honorable Mention">Honorable Mention</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                      Order <span className="text-rose-500">*</span>
                    </label>
                    <input type="number" min={1} value={order} onChange={(e) => setOrder(Number(e.target.value) || 1)} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="border-b border-zinc-200 pb-3 mb-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Details & Visibility</h4>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Describe the criteria and purpose of this award." required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Status <span className="text-rose-500">*</span>
                  </label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as AwardStatus)} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">
            Cancel
          </button>
          <button type="submit" form="award-form" className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
            {isEditMode ? "Save Changes" : "Add Award"}
          </button>
        </div>
      </div>
    </div>
  );
}

// DETAIL MODAL COMPONENT (View)
function AwardDetailModal({
  isOpen,
  onClose,
  award,
}: {
  isOpen: boolean;
  onClose: () => void;
  award: ProgramAward;
}) {
  if (!isOpen) return null;

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "Winner": return "bg-emerald-50 text-emerald-700";
      case "Runner Up": return "bg-blue-50 text-blue-700";
      case "Honorable Mention": return "bg-amber-50 text-amber-700";
      default: return "bg-zinc-100 text-zinc-700";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6 text-left">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Award Details</h3>
            <p className="mt-1 text-sm text-zinc-500">Overview of the award configuration and description.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Award</div>
            <div className="text-base font-bold text-zinc-900">{award.award}</div>
            <div className="text-sm text-zinc-700">{award.title}</div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Award Type</div>
              <div className={`inline-flex items-center justify-center rounded px-2.5 py-0.5 text-xs font-semibold capitalize ${getBadgeColor(award.type)}`}>
                {award.type}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Order</div>
              <div className="text-sm font-semibold text-zinc-900">#{award.order}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</div>
              <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${award.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-600"}`}>
                {award.status === "Active" ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                <span>{award.status}</span>
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Description</div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-5 text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
              {award.description}
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

// ACTION BUTTON EXPORTS (SOLID COLORS, NO BORDERS/SHADOWS)
export function AddAwardAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Award</span>
      </button>
      <AwardFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function ViewAwardAction({ award }: { award: ProgramAward }) {
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
      <AwardDetailModal isOpen={isOpen} onClose={() => setIsOpen(false)} award={award} />
    </>
  );
}

export function EditAwardAction({ award }: { award: ProgramAward }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700" 
        aria-label="Edit award"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <AwardFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialData={award} />
    </>
  );
}

export function DeleteAwardAction({ id }: { id: number }) {
  return (
    <button 
      type="button" 
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700" 
      aria-label="Delete award"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
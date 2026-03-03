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
  XMarkIcon,
} from "@heroicons/react/24/solid";
import type { ProgramFaq, FaqStatus, FaqCategory } from "./ProgramFaqsTable";

// FILTER COMPONENTS (Shareable URL State)
export function FaqFilters({
  initialSearch,
  initialCategory,
}: {
  initialSearch: string;
  initialCategory: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      
      if (searchTerm) params.set("search", searchTerm);
      else params.delete("search");

      if (category && category !== "All") params.set("category", category);
      else params.delete("category");

      router.push(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, category, pathname, router, searchParams]);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-5">
      <div className="w-full md:w-64 shrink-0">
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="All">All Categories</option>
          <option value="Basic">Basic</option>
          <option value="Event Details">Event Details</option>
          <option value="Registration">Registration</option>
          <option value="Payments">Payments</option>
        </select>
      </div>
      <div className="w-full">
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search FAQs</label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by question or answer..."
          className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>
    </div>
  );
}

// FORM MODAL COMPONENT (Add & Edit)
function FaqFormModal({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: ProgramFaq;
}) {
  const isEditMode = !!initialData;

  const [order, setOrder] = useState<number>(initialData?.order ?? 1);
  const [question, setQuestion] = useState(initialData?.question ?? "");
  const [answer, setAnswer] = useState(initialData?.answer ?? "");
  const [category, setCategory] = useState<FaqCategory>(initialData?.category ?? "Basic");
  const [status, setStatus] = useState<FaqStatus>(initialData?.status ?? "Active");

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log(isEditMode ? "Edit FAQ Submitted" : "Add FAQ Submitted", { order, question, answer, category, status });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 text-left">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditMode ? "Edit FAQ" : "Add FAQ"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditMode
                ? "Update the question, answer, category, and status."
                : "Create a new frequently asked question for this program."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          <form id="faq-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
              <div className="space-y-5">
                <div className="border-b border-zinc-200 pb-3 mb-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Content</h4>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Question <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="e.g., What is this program about?" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Answer <span className="text-rose-500">*</span>
                  </label>
                  <textarea rows={8} value={answer} onChange={(e) => setAnswer(e.target.value)} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Provide a clear and helpful answer for participants." required />
                </div>
              </div>

              <div className="space-y-5">
                <div className="border-b border-zinc-200 pb-3 mb-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Settings</h4>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Order <span className="text-rose-500">*</span>
                  </label>
                  <input type="number" min={1} value={order} onChange={(e) => setOrder(Number(e.target.value) || 1)} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as FaqCategory)} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required>
                    <option value="Basic">Basic</option>
                    <option value="Event Details">Event Details</option>
                    <option value="Registration">Registration</option>
                    <option value="Payments">Payments</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                    Status <span className="text-rose-500">*</span>
                  </label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as FaqStatus)} className="block w-full rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required>
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
          <button type="submit" form="faq-form" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            {isEditMode ? "Save Changes" : "Add FAQ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// DETAIL MODAL COMPONENT (View)
function FaqDetailModal({
  isOpen,
  onClose,
  faq,
}: {
  isOpen: boolean;
  onClose: () => void;
  faq: ProgramFaq;
}) {
  if (!isOpen) return null;

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Basic": return "bg-blue-50 text-blue-700";
      case "Event Details": return "bg-purple-50 text-purple-700";
      case "Registration": return "bg-emerald-50 text-emerald-700";
      case "Payments": default: return "bg-amber-50 text-amber-700";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6 text-left">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">FAQ Details</h3>
            <p className="mt-1 text-sm text-zinc-500">Overview of the question, answer, and metadata.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Question</div>
            <div className="text-base font-bold text-zinc-900">{faq.question}</div>
          </div>
          
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Answer</div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-5 text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
              {faq.answer}
            </div>
          </div>

          <div className="grid gap-6 border-t border-zinc-200 pt-5 md:grid-cols-3">
            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Category</div>
              <div className={`inline-flex items-center justify-center rounded px-2.5 py-0.5 text-xs font-semibold capitalize ${getCategoryColor(faq.category)}`}>
                {faq.category}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Order</div>
              <div className="text-sm font-semibold text-zinc-900">#{faq.order}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</div>
              <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${faq.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                {faq.status === "Active" ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                <span>{faq.status}</span>
              </span>
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
export function AddFaqAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        <PlusIcon className="h-4 w-4" />
        <span>Add FAQ</span>
      </button>
      <FaqFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function ViewFaqAction({ faq }: { faq: ProgramFaq }) {
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
      <FaqDetailModal isOpen={isOpen} onClose={() => setIsOpen(false)} faq={faq} />
    </>
  );
}

export function EditFaqAction({ faq }: { faq: ProgramFaq }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700" 
        aria-label="Edit FAQ"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <FaqFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialData={faq} />
    </>
  );
}

export function DeleteFaqAction({ id }: { id: number }) {
  return (
    <button 
      type="button" 
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700" 
      aria-label="Delete FAQ"
      onClick={() => console.log("Delete", id)}
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
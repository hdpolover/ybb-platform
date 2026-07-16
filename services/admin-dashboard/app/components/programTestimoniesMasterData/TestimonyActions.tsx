"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import type { ProgramTestimonyRow } from "./ProgramTestimoniesTable";

// SEARCH COMPONENT (Shareable URL State)
export function TestimonySearch({ initialSearch }: { initialSearch: string }) {
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
        placeholder="Search by name, role, or country..."
        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// FORM MODAL COMPONENT (Internal)
function TestimonyFormModal({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: ProgramTestimonyRow;
}) {
  if (!isOpen) return null;
  const isEditMode = !!initialData;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [selectedImageName, setSelectedImageName] = useState<string | null>(initialData?.photoUrl ?? null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log(isEditMode ? "Edit Mode Submitted" : "Add Mode Submitted");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 text-left">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditMode ? "Edit Testimony" : "Add Testimony"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditMode
                ? "Update the person details and testimonial content."
                : "Add a new testimonial from a delegate or alumnus."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <form id="testimony-form" onSubmit={handleSubmit} className="space-y-6 px-6 py-6 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
            
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">Name <span className="text-rose-500">*</span></label>
                  <input type="text" defaultValue={initialData?.name} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="e.g., Aisyah Putri Fadhilah" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-500">Country <span className="text-rose-500">*</span></label>
                  <input type="text" defaultValue={initialData?.country} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="e.g., Indonesia" required />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Role / Program <span className="text-rose-500">*</span></label>
                <input type="text" defaultValue={initialData?.role} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="e.g., Delegate - Japan Youth Summit 2025" required />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Testimony <span className="text-rose-500">*</span></label>
                <textarea rows={6} defaultValue={initialData?.testimony} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Write the testimony or story from this person." required />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Photo</div>
                <button
                  type="button"
                  className="flex h-40 w-full items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-white text-center transition hover:border-blue-400 hover:bg-blue-50/40"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="space-y-1.5 px-4">
                    <div className="text-sm font-semibold text-zinc-700">
                      {selectedImageName ? "Image selected" : "Click to upload"}
                    </div>
                    {selectedImageName ? (
                      <div className="truncate text-xs font-medium text-blue-600">{selectedImageName}</div>
                    ) : (
                      <div className="text-xs text-zinc-500">Max size: 2MB.<br/>Recommended: 400x400px</div>
                    )}
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setSelectedImageName(e.target.files?.[0]?.name ?? null)} />
              </div>
            </div>

          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">
            Cancel
          </button>
          <button type="submit" form="testimony-form" className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
            {isEditMode ? "Save Changes" : "Add Testimony"}
          </button>
        </div>

      </div>
    </div>
  );
}

// EXPORTED ACTION BUTTONS 
export function AddTestimonyAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      {/* Tombol Add umumnya tetap memakai warna solid untuk penekanan */}
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Testimony</span>
      </button>
      <TestimonyFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function EditTestimonyAction({ testimony }: { testimony: ProgramTestimonyRow }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
        aria-label="Edit testimony"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <TestimonyFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialData={testimony} />
    </>
  );
}

export function DeleteTestimonyAction({ id }: { id: number }) {
  return (
    <button 
      type="button" 
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700"
      aria-label="Delete testimony"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
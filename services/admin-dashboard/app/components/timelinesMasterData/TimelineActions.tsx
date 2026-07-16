"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  CalendarDaysIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import type { TimelineRow } from "./TimelinesTable";
import { toLocalDatetimeInputValue } from "@/lib/utils";

// SEARCH COMPONENT (State via URL)
export function TimelineSearch({ initialSearch }: { initialSearch: string }) {
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
        placeholder="Search by name or date..."
        className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// FORM MODAL COMPONENT (Internal)
function TimelineFormModal({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: TimelineRow;
}) {
  if (!isOpen) return null;
  const isEditMode = !!initialData;

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
              {isEditMode ? "Edit Timeline" : "Add Timeline"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditMode ? "Update the configuration for this timeline." : "Define a new timeline entry for this program."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <form id="timeline-form" onSubmit={handleSubmit} className="space-y-5 px-6 py-6 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Name <span className="text-rose-500">*</span></label>
              <input type="text" defaultValue={initialData?.name} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="e.g., Registration Period" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Order Number <span className="text-rose-500">*</span></label>
              <input type="number" min={1} defaultValue={initialData?.order} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="e.g., 1" required />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Start Date <span className="text-rose-500">*</span></label>
              <input type="datetime-local" defaultValue={initialData?.startDateIso ? toLocalDatetimeInputValue(initialData.startDateIso) : undefined} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">End Date <span className="text-rose-500">*</span></label>
              <input type="datetime-local" defaultValue={initialData?.endDateIso ? toLocalDatetimeInputValue(initialData.endDateIso) : undefined} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status <span className="text-rose-500">*</span></label>
              <select defaultValue={initialData?.status || "Active"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" required>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description <span className="text-rose-500">*</span></label>
            <textarea rows={4} defaultValue={initialData?.description} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Short description about this timeline." required />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">Cancel</button>
          <button type="submit" form="timeline-form" className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// DETAIL MODAL COMPONENT
function TimelineDetailModal({
  isOpen,
  onClose,
  timeline,
}: {
  isOpen: boolean;
  onClose: () => void;
  timeline: TimelineRow;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6 text-left">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Timeline Details</h3>
            <p className="mt-1 text-sm text-zinc-500">Review configuration for this program timeline.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="flex items-center gap-4 border-b border-zinc-100 pb-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <CalendarDaysIcon className="h-6 w-6" />
            </span>
            <div>
              <div className="text-base font-bold text-zinc-900">{timeline.name}</div>
              <div className="text-sm font-medium text-zinc-500">Order #{timeline.order}</div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-zinc-500 mb-1">Start Date</div>
              <div className="text-sm font-semibold text-zinc-900">{timeline.startDate}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-500 mb-1">End Date</div>
              <div className="text-sm font-semibold text-zinc-900">{timeline.endDate}</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500 mb-2">Status</div>
            <span className={`inline-flex rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${timeline.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-600"}`}>
              {timeline.status}
            </span>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500 mb-1.5">Description</div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
              {timeline.description}
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
export function AddTimelineAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Timeline</span>
      </button>
      <TimelineFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function ViewTimelineAction({ timeline }: { timeline: TimelineRow }) {
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
      <TimelineDetailModal isOpen={isOpen} onClose={() => setIsOpen(false)} timeline={timeline} />
    </>
  );
}

export function EditTimelineAction({ timeline }: { timeline: TimelineRow }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700" 
        aria-label="Edit timeline"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <TimelineFormModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialData={timeline} />
    </>
  );
}

export function DeleteTimelineAction({ id }: { id: number }) {
  return (
    <button 
      type="button" 
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700" 
      aria-label="Delete timeline"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}

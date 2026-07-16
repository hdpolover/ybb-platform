"use client";

import { useState } from "react";
import { PencilSquareIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/solid";
import type { ParticipationCategoryRow } from "./ParticipationCategoriesTable";

function CategoryModal({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: ParticipationCategoryRow;
}) {
  if (!isOpen) return null;
  const isEditing = !!initialData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {isEditing ? "Edit Category" : "Add Category"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Update category information used in the submission form.
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="space-y-5 px-6 py-6 text-left">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Category Name</label>
            <input type="text" defaultValue={initialData?.name || ""} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Description</label>
            <textarea rows={4} defaultValue={initialData?.description || ""} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Status</label>
            <select defaultValue={initialData?.status || "Active"} className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100">Cancel</button>
          <button type="button" onClick={onClose} className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// --- EXPORTED ACTION BUTTONS (SOFT UI STYLE) ---

export function AddCategoryAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
        <PlusIcon className="h-4 w-4" />
        <span>Add Category</span>
      </button>
      <CategoryModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export function EditCategoryAction({ category }: { category: ParticipationCategoryRow }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 transition hover:bg-amber-100 hover:text-amber-700"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </button>
      <CategoryModal isOpen={isOpen} onClose={() => setIsOpen(false)} initialData={category} />
    </>
  );
}

export function DeleteCategoryAction({ id }: { id: number }) {
  return (
    <button 
      type="button" 
      className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
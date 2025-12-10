"use client";

import { useState } from "react";
import { UsersIcon, PencilSquareIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/solid";

interface ParticipationCategoryRow {
  id: number;
  name: string;
  description: string;
  status: "Active" | "Inactive";
}

const mockCategories: ParticipationCategoryRow[] = [
  {
    id: 1,
    name: "Fully Funded",
    description: "Delegates who receive full funding for program fee and accommodation.",
    status: "Active",
  },
  {
    id: 2,
    name: "Self Funded",
    description: "Delegates who cover their own program fee and travel expenses.",
    status: "Active",
  },
  {
    id: 3,
    name: "Observer",
    description: "Participants who join selected sessions without full delegate privileges.",
    status: "Inactive",
  },
];

export function GeneralCategoriesTable() {
  const [rows] = useState<ParticipationCategoryRow[]>(mockCategories);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ParticipationCategoryRow | null>(null);

  const handleEditClick = (row: ParticipationCategoryRow) => {
    setSelectedRow(row);
    setShowEditModal(true);
  };

   const handleAddClick = () => {
     setSelectedRow({
       id: 0,
       name: "",
       description: "",
       status: "Active",
     });
     setShowEditModal(true);
   };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <UsersIcon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Participation Categories</h2>
            <p className="text-xs text-zinc-500 md:text-sm">
              Define available participation categories for this program.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
          onClick={handleAddClick}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Category</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-sm md:text-sm">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">No</th>
              <th className="px-3 py-2">Category Name</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[12px] text-zinc-500">
                  No participation categories configured yet.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2 align-top font-medium text-zinc-900">{row.name}</td>
                  <td className="px-3 py-2 align-top text-xs text-zinc-600">{row.description}</td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        row.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        aria-label="Edit category"
                        onClick={() => handleEditClick(row)}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-red-600 shadow-sm hover:bg-red-50"
                        aria-label="Delete category"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showEditModal && selectedRow && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-3 md:px-4">
          <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2.5">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Edit Participation Category</h3>
                <p className="text-[11px] text-zinc-500">Update category information used in the submission form.</p>
              </div>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => setShowEditModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 px-4 py-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Category Name</label>
                <input
                  type="text"
                  defaultValue={selectedRow.name}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Description</label>
                <textarea
                  rows={3}
                  defaultValue={selectedRow.description}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Status</label>
                <select
                  defaultValue={selectedRow.status}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-2.5">
              <button
                type="button"
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
                onClick={() => setShowEditModal(false)}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

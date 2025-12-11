"use client";

import { useState } from "react";
import { DocumentTextIcon, PencilSquareIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/solid";

interface SubmissionEssayRow {
  id: number;
  question: string;
  wordLimit: number;
  status: "Active" | "Inactive";
}

const mockEssays: SubmissionEssayRow[] = [
  {
    id: 1,
    question: "Describe a youth-led initiative you have been involved in and its impact.",
    wordLimit: 400,
    status: "Active",
  },
  {
    id: 2,
    question: "Why do you want to join the Japan Youth Summit and how will you contribute?",
    wordLimit: 350,
    status: "Active",
  },
  {
    id: 3,
    question: "What is one global challenge you care about and what solution would you propose?",
    wordLimit: 450,
    status: "Inactive",
  },
];

export function SubmissionEssaysTable() {
  const [rows] = useState<SubmissionEssayRow[]>(mockEssays);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<SubmissionEssayRow | null>(null);

  const handleEditClick = (row: SubmissionEssayRow) => {
    setSelectedRow(row);
    setShowEditModal(true);
  };

  const handleAddClick = () => {
    setSelectedRow({
      id: 0,
      question: "",
      wordLimit: 0,
      status: "Active",
    });
    setShowEditModal(true);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <DocumentTextIcon className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Essays</h2>
            <p className="text-xs text-zinc-500 md:text-sm">
              Configure essay questions used in the submission form.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
          onClick={handleAddClick}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Essay</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-sm md:text-sm">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">No</th>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2">Word Limit</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[12px] text-zinc-500">
                  No essay questions configured yet.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2 align-top text-xs text-zinc-900">{row.question}</td>
                  <td className="px-3 py-2 align-top text-xs text-zinc-700">{row.wordLimit} words</td>
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
                        aria-label="Edit essay"
                        onClick={() => handleEditClick(row)}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-red-600 shadow-sm hover:bg-red-50"
                        aria-label="Delete essay"
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
                <h3 className="text-sm font-semibold text-zinc-900">Edit Essay Question</h3>
                <p className="text-[11px] text-zinc-500">Update essay question configuration for this program.</p>
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
                <label className="mb-1 block text-xs font-medium text-zinc-700">Question</label>
                <textarea
                  rows={3}
                  defaultValue={selectedRow.question}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Word Limit</label>
                <input
                  type="number"
                  defaultValue={selectedRow.wordLimit}
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

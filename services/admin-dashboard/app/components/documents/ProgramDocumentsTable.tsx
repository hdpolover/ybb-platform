"use client";

import React, { useState } from "react";
import { DocumentTextIcon, EyeIcon, PencilSquareIcon } from "@heroicons/react/24/solid";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";

interface ProgramDocumentRow {
  id: number;
  name: string;
  type: "Letter of Acceptance (LOA)" | "Agreement Letter" | "Complementary Document";
  description?: string;
  dateAdded: string;
  status: "Active" | "Inactive";
}

const mockProgramDocuments: ProgramDocumentRow[] = [
  {
    id: 1,
    name: "Letter of Acceptance - Batch 1 (Fully Funded)",
    type: "Letter of Acceptance (LOA)",
    description: "Standard LOA template for fully funded participants.",
    dateAdded: "Dec 4, 2025, 10:15 GMT+7",
    status: "Active",
  },
  {
    id: 2,
    name: "Letter of Acceptance - Self Funded",
    type: "Letter of Acceptance (LOA)",
    description: "LOA template for self funded participants.",
    dateAdded: "Dec 2, 2025, 17:42 GMT+7",
    status: "Active",
  },
  {
    id: 3,
    name: "Standard Agreement Letter",
    type: "Agreement Letter",
    description: "Agreement covering code of conduct and payment terms.",
    dateAdded: "Nov 30, 2025, 09:05 GMT+7",
    status: "Active",
  },
  {
    id: 4,
    name: "Parental Consent Form (Under 18)",
    type: "Complementary Document",
    description: "Consent form for participants below 18 years old.",
    dateAdded: "Nov 28, 2025, 15:20 GMT+7",
    status: "Inactive",
  },
  {
    id: 5,
    name: "Scholarship Terms Addendum",
    type: "Complementary Document",
    description: "Additional conditions for scholarship recipients.",
    dateAdded: "Nov 25, 2025, 13:00 GMT+7",
    status: "Inactive",
  },
];

const inputCls =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function ProgramDocumentsTable() {
  const rows = mockProgramDocuments;

  const [page, setPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, rows.length);
  const visibleRows = rows.slice(startIndex, endIndex);

  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <section className="relative rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:text-sm">
      <div className="mb-2.5 flex flex-wrap items-center justify-end gap-2 text-[11px] text-zinc-500">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-600"
            onClick={() => setSheetOpen(true)}
          >
            <DocumentTextIcon className="h-3.5 w-3.5" />
            <span>Add Document</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
            onClick={() => {
              // TODO: Nanti disambungin ke logic pengaturan visibility dokumen beneran
              console.info("Visibility setting clicked");
            }}
          >
            <EyeIcon className="h-3.5 w-3.5" />
            <span>Visibility Setting</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Document Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Date Added</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[12px] text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No documents found</span>
                    <span className="text-[11px] text-zinc-400">Add a new document to get started.</span>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{startIndex + index + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-zinc-900">{row.name}</div>
                      {row.description && (
                        <div className="line-clamp-2 text-[11px] text-zinc-500">{row.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-xs text-zinc-900">{row.dateAdded}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <ProgramDocumentStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="inline-flex flex-wrap gap-1 text-[11px]">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        onClick={() => console.info("View document clicked", row.id)}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        onClick={() => console.info("Edit document clicked", row.id)}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Showing {rows.length === 0 ? 0 : startIndex + 1} to {endIndex} of {rows.length} entries
        </span>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={clampedPage === 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={clampedPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>

      <AddDocumentSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </section>
  );
}

function ProgramDocumentStatusBadge({ status }: { status: ProgramDocumentRow["status"] }) {
  const className =
    status === "Active"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-zinc-100 text-zinc-600";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}
    >
      {status}
    </span>
  );
}

function AddDocumentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col p-0 sm:max-w-lg">
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            // TODO: integrate save document
            console.info("Save document clicked");
            onClose();
          }}
        >
          <SheetHeader className="border-b border-zinc-200 px-6 py-5">
            <SheetTitle>Add Program Document</SheetTitle>
            <SheetDescription>
              Configure a new document template used across participants in this program.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Document Name <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="text"
                className={inputCls}
                placeholder="e.g. Letter of Acceptance - Batch 2"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Document Type <span className="text-rose-500">*</span>
                </label>
                <select required className={inputCls}>
                  <option value="">Select type…</option>
                  <option>Letter of Acceptance (LOA)</option>
                  <option>Agreement Letter</option>
                  <option>Complementary Document</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Visibility
                </label>
                <select className={inputCls}>
                  <option>Public</option>
                  <option>Private</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Description
              </label>
              <textarea
                rows={4}
                className={`${inputCls} resize-none`}
                placeholder="Short description of how and when this document is used."
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Status</label>
              <select className={inputCls}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>

          <SheetFooter className="border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              Save Document
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

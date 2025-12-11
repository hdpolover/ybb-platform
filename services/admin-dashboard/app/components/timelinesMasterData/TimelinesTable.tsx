"use client";

import { useState } from "react";
import {
  CalendarDaysIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

export type TimelineRow = {
  id: number;
  name: string;
  order: number;
  /** Human-readable date range shown in table/detail */
  startDate: string;
  endDate: string;
  /** ISO datetime values used in forms (datetime-local). */
  startDateIso: string;
  endDateIso: string;
  description: string;
  status: "Active" | "Inactive";
};

const mockTimelines: TimelineRow[] = [
  {
    id: 1,
    name: "Registration Period",
    order: 1,
    startDate: "Nov 19, 2025 12:01 AM",
    endDate: "Feb 10, 2026 11:59 PM",
    startDateIso: "2025-11-19T00:01",
    endDateIso: "2026-02-10T23:59",
    description: "Main registration period for participants.",
    status: "Active",
  },
  {
    id: 2,
    name: "Document Verification",
    order: 2,
    startDate: "Feb 11, 2026 12:01 AM",
    endDate: "Feb 20, 2026 11:59 PM",
    startDateIso: "2026-02-11T00:01",
    endDateIso: "2026-02-20T23:59",
    description: "Verification of submitted documents.",
    status: "Inactive",
  },
  {
    id: 3,
    name: "Interview Period",
    order: 3,
    startDate: "Mar 01, 2026 09:00 AM",
    endDate: "Mar 10, 2026 05:00 PM",
    startDateIso: "2026-03-01T09:00",
    endDateIso: "2026-03-10T17:00",
    description: "Online or onsite interview sessions.",
    status: "Inactive",
  },
  {
    id: 4,
    name: "Final Announcement",
    order: 4,
    startDate: "Apr 01, 2026 10:00 AM",
    endDate: "Apr 01, 2026 11:59 PM",
    startDateIso: "2026-04-01T10:00",
    endDateIso: "2026-04-01T23:59",
    description: "Final selection results announcement.",
    status: "Inactive",
  },
  {
    id: 5,
    name: "Program Dates",
    order: 5,
    startDate: "Jul 10, 2026 09:00 AM",
    endDate: "Jul 15, 2026 05:00 PM",
    startDateIso: "2026-07-10T09:00",
    endDateIso: "2026-07-15T17:00",
    description: "Actual program implementation dates.",
    status: "Inactive",
  },
];

export function TimelinesTable() {
  const [rows] = useState<TimelineRow[]>(mockTimelines);
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingRow, setEditingRow] = useState<TimelineRow | null>(null);
  const [selectedRow, setSelectedRow] = useState<TimelineRow | null>(null);

  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.name.toLowerCase().includes(q) ||
      row.startDate.toLowerCase().includes(q) ||
      row.endDate.toLowerCase().includes(q)
    );
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Timelines</h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Configure important milestones and phases for this program, such as registration,
            verification, interviews, and final announcements.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={() => {
            setEditingRow(null);
            setShowFormModal(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Timeline</span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or date..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-sm md:text-sm">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">No</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Start Date</th>
              <th className="px-3 py-2">End Date</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-[12px] text-zinc-500"
                >
                  No timelines configured yet.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50"
                >
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <CalendarDaysIcon className="h-4 w-4" />
                      </span>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-zinc-900">{row.name}</div>
                        <div className="text-[11px] text-zinc-500">Program timeline</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-700">{row.startDate}</td>
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-700">{row.endDate}</td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        row.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-700 shadow-sm hover:bg-sky-100"
                        aria-label="View details"
                        onClick={() => {
                          setSelectedRow(row);
                          setShowDetailModal(true);
                        }}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                        aria-label="Edit timeline"
                        onClick={() => {
                          setEditingRow(row);
                          setShowFormModal(true);
                        }}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                        aria-label="Delete timeline"
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

      {showFormModal && (
        <TimelineFormModal
          mode={editingRow ? "edit" : "add"}
          initialValues={editingRow ?? undefined}
          onClose={() => {
            setShowFormModal(false);
            setEditingRow(null);
          }}
        />
      )}

      {showDetailModal && selectedRow && (
        <TimelineDetailModal
          timeline={selectedRow}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedRow(null);
          }}
        />
      )}
    </section>
  );
}

interface TimelineFormModalProps {
  onClose: () => void;
  mode?: "add" | "edit";
  initialValues?: TimelineRow;
}

function TimelineFormModal({ onClose, mode = "add", initialValues }: TimelineFormModalProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [orderNumber, setOrderNumber] = useState<number | "">(
    typeof initialValues?.order === "number" ? initialValues.order : "",
  );
  const [startDate, setStartDate] = useState(initialValues?.startDateIso ?? "");
  const [endDate, setEndDate] = useState(initialValues?.endDateIso ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [status, setStatus] = useState<TimelineRow["status"]>(
    initialValues?.status ?? "Active",
  );

  const isEditMode = mode === "edit";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name,
      order: typeof orderNumber === "number" ? orderNumber : 0,
      startDate,
      endDate,
      description,
      status,
    };
    // TODO: integrate with backend / parent state
    console.log(isEditMode ? "Edit timeline:" : "Create timeline:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-lg rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Timeline" : "Add Timeline"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the name, dates, and status for this program timeline."
                : "Define a new timeline entry for this program."}
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-3">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g., Registration Period, Interview Period"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Order Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={orderNumber}
                onChange={(event) =>
                  setOrderNumber(event.target.value === "" ? "" : Number(event.target.value))
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g., 1"
                required
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  End Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as TimelineRow["status"])
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Short description about this timeline (e.g., what happens in this period)."
                required
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
            >
              {isEditMode ? "Save Changes" : "Add Timeline"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface TimelineDetailModalProps {
  timeline: TimelineRow;
  onClose: () => void;
}

function TimelineDetailModal({ timeline, onClose }: TimelineDetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Timeline Details</h3>
            <p className="text-[11px] text-zinc-500">
              Review configuration for this program timeline.
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <CalendarDaysIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-zinc-900">{timeline.name}</div>
              <div className="text-[11px] text-zinc-500">Program timeline (Order #{timeline.order})</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-medium text-zinc-500">Start Date</div>
              <div className="text-sm text-zinc-900">{timeline.startDate}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-zinc-500">End Date</div>
              <div className="text-sm text-zinc-900">{timeline.endDate}</div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium text-zinc-500">Status</div>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                timeline.status === "Active"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {timeline.status}
            </span>
          </div>

          <div>
            <div className="text-[11px] font-medium text-zinc-500">Description</div>
            <div className="mt-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-800 md:text-sm whitespace-pre-wrap">
              {timeline.description}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-2.5">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 md:text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

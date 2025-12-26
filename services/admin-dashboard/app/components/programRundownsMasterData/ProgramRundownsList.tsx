"use client";

import { useState } from "react";
import {
  CheckCircleIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

export type ProgramRundown = {
  id: number;
  title: string;
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "10:30"
  description: string;
  status: "Active" | "Inactive";
};

const mockRundowns: ProgramRundown[] = [
  {
    id: 1,
    title: "Opening & Registration",
    startTime: "08:00",
    endTime: "09:00",
    description:
      "Participant arrival, registration, and welcome desk services before the official opening.",
    status: "Active",
  },
  {
    id: 2,
    title: "Opening Ceremony & Keynote Speech",
    startTime: "09:00",
    endTime: "10:30",
    description:
      "Formal opening session with national anthem, remarks from organizers, and keynote from invited speaker.",
    status: "Active",
  },
  {
    id: 3,
    title: "Plenary Session: Youth & Global Leadership",
    startTime: "10:45",
    endTime: "12:00",
    description:
      "Plenary discussion highlighting youth roles in global leadership and sustainable development.",
    status: "Active",
  },
  {
    id: 4,
    title: "Networking Lunch",
    startTime: "12:00",
    endTime: "13:00",
    description:
      "Buffet lunch and informal networking time for delegates, speakers, and partners.",
    status: "Inactive",
  },
  {
    id: 5,
    title: "Breakout Workshops",
    startTime: "13:00",
    endTime: "15:00",
    description:
      "Parallel thematic workshops facilitated by mentors focusing on skills and project development.",
    status: "Active",
  },
  {
    id: 6,
    title: "Project Presentations",
    startTime: "15:15",
    endTime: "17:00",
    description:
      "Delegates present their projects and receive feedback from a panel of judges.",
    status: "Active",
  },
  {
    id: 7,
    title: "Awards & Closing Ceremony",
    startTime: "19:00",
    endTime: "20:30",
    description:
      "Recognition of outstanding delegates, award announcements, and official closing remarks.",
    status: "Inactive",
  },
];

export function ProgramRundownsList() {
  const [rundowns] = useState<ProgramRundown[]>(mockRundowns);
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRundown, setEditingRundown] = useState<ProgramRundown | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRundown, setSelectedRundown] = useState<ProgramRundown | null>(null);

  const filtered = rundowns.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.title.toLowerCase().includes(q) ||
      row.startTime.toLowerCase().includes(q) ||
      row.endTime.toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q)
    );
  });

  return (
    <section className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program Rundowns</h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Manage the detailed schedule blocks for this program.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={() => {
            setEditingRundown(null);
            setShowFormModal(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Rundown</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, time, or status..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Rundown cards */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-xs text-zinc-500 md:text-sm">
            <p className="font-medium text-zinc-700">No rundowns configured yet</p>
            <p className="mt-1 max-w-md text-[11px] text-zinc-500">
              Add rundown blocks to define the flow of sessions and activities for this program.
            </p>
          </div>
        ) : (
          filtered.map((row, index) => (
            <article
              key={row.id}
              className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-700 shadow-sm md:flex-row md:items-center md:justify-between md:text-sm"
            >
              <div className="flex flex-1 items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-700">
                  {index + 1}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-zinc-900 md:text-sm">{row.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 md:text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200">
                      <span>Start:</span>
                      <span>{row.startTime}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200">
                      <span>End:</span>
                      <span>{row.endTime}</span>
                    </span>
                  </div>
                  <p className="max-w-xl text-[11px] text-zinc-600 line-clamp-2 md:text-xs">
                    {row.description}
                  </p>
                </div>
              </div>

              <div className="mt-1 flex flex-col items-start justify-between gap-2 md:mt-0 md:flex-row md:items-center">
                <div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      row.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                    }`}
                  >
                    {row.status === "Active" ? (
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                    ) : (
                      <XCircleIcon className="h-3.5 w-3.5" />
                    )}
                    <span>{row.status}</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 self-end md:self-auto">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100"
                    aria-label="View rundown details"
                    onClick={() => {
                      setSelectedRundown(row);
                      setShowDetailModal(true);
                    }}
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                    aria-label="Edit rundown"
                    onClick={() => {
                      setEditingRundown(row);
                      setShowFormModal(true);
                    }}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                    aria-label="Delete rundown"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {showFormModal && (
        <ProgramRundownFormModal
          mode={editingRundown ? "edit" : "add"}
          initialValues={editingRundown ?? undefined}
          onClose={() => {
            setShowFormModal(false);
            setEditingRundown(null);
          }}
        />
      )}

      {showDetailModal && selectedRundown && (
        <ProgramRundownDetailModal
          rundown={selectedRundown}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedRundown(null);
          }}
        />
      )}
    </section>
  );
}

interface ProgramRundownFormModalProps {
  onClose: () => void;
  mode?: "add" | "edit";
  initialValues?: ProgramRundown;
}

function ProgramRundownFormModal({
  onClose,
  mode = "add",
  initialValues,
}: ProgramRundownFormModalProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [startTime, setStartTime] = useState(initialValues?.startTime ?? "");
  const [endTime, setEndTime] = useState(initialValues?.endTime ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [status, setStatus] = useState<"Active" | "Inactive">(initialValues?.status ?? "Active");

  const isEditMode = mode === "edit";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      title,
      startTime,
      endTime,
      description,
      status,
    };
    // TODO: Nanti disambungin ke backend / state di parent pas udah mulai integrasi beneran
    console.log(isEditMode ? "Edit program rundown:" : "Create program rundown:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-lg rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Rundown" : "Add Rundown"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the time, title, and status of this rundown block."
                : "Create a new rundown block with time, title, and status."}
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
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g., Opening Ceremony & Keynote Speech"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Short explanation of what happens in this rundown block."
                required
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Start Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  End Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                onChange={(event) => setStatus(event.target.value as "Active" | "Inactive")}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
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
              {isEditMode ? "Save Changes" : "Add Rundown"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProgramRundownDetailModalProps {
  rundown: ProgramRundown;
  onClose: () => void;
}

function ProgramRundownDetailModal({ rundown, onClose }: ProgramRundownDetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-lg rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Rundown Details</h3>
            <p className="text-[11px] text-zinc-500">Overview of this schedule block.</p>
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
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Title</div>
            <div className="text-xs font-semibold text-zinc-900 md:text-sm">{rundown.title}</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Start Time
              </div>
              <div className="text-xs text-zinc-800">{rundown.startTime}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                End Time
              </div>
              <div className="text-xs text-zinc-800">{rundown.endTime}</div>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Status</div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                rundown.status === "Active"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                  : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
              }`}
            >
              {rundown.status === "Active" ? (
                <CheckCircleIcon className="h-3.5 w-3.5" />
              ) : (
                <XCircleIcon className="h-3.5 w-3.5" />
              )}
              <span>{rundown.status}</span>
            </span>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Description
            </div>
            <div className="text-xs text-zinc-700 md:text-sm whitespace-pre-line">
              {rundown.description}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5">
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
    </div>
  );
}

// TODO: Nanti implement ProgramRundownsList beneran (nyambung ke data rundown asli)

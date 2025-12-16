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

export type AwardStatus = "Active" | "Inactive";

export type ProgramAward = {
  id: number;
  award: string; // contoh: "Best Delegate"
  title: string; // contoh: "Best Delegate - Asia Pacific Track"
  type: "Winner" | "Runner Up" | "Honorable Mention" | "Other"; // Tipe award
  order: number; // urutan tampil di list
  description: string;
  status: AwardStatus;
};

function getAwardTypeBadgeClass(type: ProgramAward["type"]): string {
  switch (type) {
    case "Winner":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
    case "Runner Up":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-100";
    case "Honorable Mention":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
    case "Other":
    default:
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
  }
}

const mockAwards: ProgramAward[] = [
  {
    id: 1,
    award: "Best Delegate",
    title: "Best Delegate - Global Youth Summit",
    type: "Winner",
    order: 1,
    description:
      "Awarded to the most outstanding delegate who demonstrates exceptional leadership, collaboration, and impact throughout the program.",
    status: "Active",
  },
  {
    id: 2,
    award: "Best Project",
    title: "Best Social Impact Project",
    type: "Runner Up",
    order: 2,
    description:
      "Given to the project team that designs the most impactful and feasible social initiative aligned with program values.",
    status: "Active",
  },
  {
    id: 3,
    award: "Most Inspiring Story",
    title: "Most Inspiring Personal Journey",
    type: "Honorable Mention",
    order: 3,
    description:
      "Recognizes a delegate whose personal story and growth journey inspires fellow participants and communities.",
    status: "Inactive",
  },
];

export function ProgramAwardsTable() {
  const [awards] = useState<ProgramAward[]>(mockAwards);
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAward, setEditingAward] = useState<ProgramAward | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAward, setSelectedAward] = useState<ProgramAward | null>(null);

  const filteredAwards = awards.filter((award) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      award.award.toLowerCase().includes(q) ||
      award.title.toLowerCase().includes(q) ||
      award.type.toLowerCase().includes(q) ||
      award.description.toLowerCase().includes(q) ||
      award.status.toLowerCase().includes(q)
    );
  });

  return (
    <section className="space-y-3 text-xs text-zinc-700 md:text-sm">
      {/* Bagian toolbar atas */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program Awards</h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Manage program-level awards, their order, descriptions, and visibility.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={() => {
            setEditingAward(null);
            setShowFormModal(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Award</span>
        </button>
      </div>

      {/* Bagian search / filter */}
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by award, title, type, or description..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs md:text-sm">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">No.</th>
              <th className="px-3 py-2">Award</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Award Type</th>
              <th className="px-3 py-2 text-center">Order</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAwards.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-10 text-center text-[12px] text-zinc-500"
                >
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No awards configured yet</span>
                    <span className="text-[11px] text-zinc-400">
                      Use the Add Award button to create program awards.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAwards.map((award, index) => (
                <tr
                  key={award.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 align-top font-medium text-zinc-900">
                    {award.award}
                  </td>
                  <td className="px-3 py-2 align-top text-zinc-700">{award.title}</td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex max-w-[140px] items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize whitespace-nowrap ${getAwardTypeBadgeClass(
                        award.type,
                      )}`}
                    >
                      {award.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-center text-zinc-700">
                    {award.order}
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] leading-relaxed text-zinc-700 md:text-sm">
                    {award.description}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        award.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                          : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                      }`}
                    >
                      {award.status === "Active" ? (
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                      ) : (
                        <XCircleIcon className="h-3.5 w-3.5" />
                      )}
                      <span>{award.status}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100"
                        aria-label="View award details"
                        onClick={() => {
                          setSelectedAward(award);
                          setShowDetailModal(true);
                        }}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                        aria-label="Edit award"
                        onClick={() => {
                          setEditingAward(award);
                          setShowFormModal(true);
                        }}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                        aria-label="Delete award"
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
        <ProgramAwardFormModal
          mode={editingAward ? "edit" : "add"}
          initialValues={editingAward ?? undefined}
          onClose={() => {
            setShowFormModal(false);
            setEditingAward(null);
          }}
        />
      )}

      {showDetailModal && selectedAward && (
        <ProgramAwardDetailModal
          award={selectedAward}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedAward(null);
          }}
        />
      )}
    </section>
  );
}

type AwardFormMode = "add" | "edit";

interface ProgramAwardFormModalProps {
  onClose: () => void;
  mode?: AwardFormMode;
  initialValues?: ProgramAward;
}

function ProgramAwardFormModal({
  onClose,
  mode = "add",
  initialValues,
}: ProgramAwardFormModalProps) {
  const [award, setAward] = useState(initialValues?.award ?? "");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [type, setType] = useState<ProgramAward["type"]>(initialValues?.type ?? "Winner");
  const [order, setOrder] = useState<number>(initialValues?.order ?? 1);
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [status, setStatus] = useState<AwardStatus>(initialValues?.status ?? "Active");

  const isEditMode = mode === "edit";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: ProgramAward = {
      id: initialValues?.id ?? Date.now(),
      award,
      title,
      type,
      order,
      description,
      status,
    };
    // TODO: Nanti disambungin ke backend / state di parent pas udah ada API beneran
    console.log(isEditMode ? "Edit program award:" : "Create program award:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Award" : "Add Award"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the award configuration, description, and visibility."
                : "Create a new award for this program and configure its details."}
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
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Award <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={award}
                  onChange={(event) => setAward(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., Best Delegate"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., Best Delegate - Global Youth Summit"
                  required
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                    Award Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as ProgramAward["type"])}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="Winner">Winner</option>
                    <option value="Runner Up">Runner Up</option>
                    <option value="Honorable Mention">Honorable Mention</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                    Order <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={order}
                    onChange={(event) => setOrder(Number(event.target.value) || 1)}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g., 1"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={6}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Describe the criteria and purpose of this award."
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as AwardStatus)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
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
              {isEditMode ? "Save Changes" : "Add Award"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProgramAwardDetailModalProps {
  award: ProgramAward;
  onClose: () => void;
}

function ProgramAwardDetailModal({ award, onClose }: ProgramAwardDetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Award Details</h3>
            <p className="text-[11px] text-zinc-500">Overview of the award configuration and description.</p>
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

        <div className="space-y-4 px-4 py-3">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Award
            </div>
            <div className="text-sm font-semibold text-zinc-900 md:text-base">{award.award}</div>
            <div className="text-[11px] text-zinc-600 md:text-xs">{award.title}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Award Type
              </div>
              <div
                className={`inline-flex max-w-[160px] items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize whitespace-nowrap ${getAwardTypeBadgeClass(
                  award.type,
                )}`}
              >
                {award.type}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Order
              </div>
              <div className="text-sm font-medium text-zinc-900">#{award.order}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  award.status === "Active"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                }`}
              >
                {award.status === "Active" ? (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                ) : (
                  <XCircleIcon className="h-3.5 w-3.5" />
                )}
                <span>{award.status}</span>
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Description
            </div>
            <div className="whitespace-pre-line text-xs text-zinc-700 md:text-sm">
              {award.description}
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

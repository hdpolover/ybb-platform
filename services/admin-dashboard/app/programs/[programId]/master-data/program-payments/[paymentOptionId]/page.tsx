"use client";

import { use, useState } from "react";
import { PaymentPeriodsHeader } from "@/app/components/programPaymentsMasterData/PaymentPeriodsHeader";
import {
  PaymentPeriodsTable,
  type PeriodRow,
} from "@/app/components/programPaymentsMasterData/PaymentPeriodsTable";

function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

export default function PaymentPeriodsPage({
  params,
}: {
  params: Promise<{ programId: string; paymentOptionId: string }>;
}) {
  const { programId } = use(params);
  const programName = formatProgramName(programId);
  const [showAddPeriodModal, setShowAddPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PeriodRow | null>(null);

  return (
    <div className="space-y-4 text-sm md:text-base">
      <PaymentPeriodsHeader programName={programName} />
      <PaymentPeriodsTable
        onAddPeriod={() => {
          setEditingPeriod(null);
          setShowAddPeriodModal(true);
        }}
        onEditPeriod={(period) => {
          setEditingPeriod(period);
          setShowAddPeriodModal(true);
        }}
      />
      {showAddPeriodModal && (
        <AddPeriodModal
          mode={editingPeriod ? "edit" : "add"}
          initialValues={
            editingPeriod
              ? {
                  periodName: editingPeriod.name,
                  description: editingPeriod.description,
                  // For now we only distinguish base vs continuation; in real data this would map to actual parent period id.
                  extendsFrom: editingPeriod.base ? "none" : "registration-period",
                  startDateTime: "",
                  endDateTime: "",
                }
              : undefined
          }
          onClose={() => {
            setShowAddPeriodModal(false);
            setEditingPeriod(null);
          }}
        />
      )}
    </div>
  );
}

type AddPeriodModalInitialValues = {
  periodName?: string;
  description?: string;
  extendsFrom?: string;
  startDateTime?: string;
  endDateTime?: string;
};

type AddPeriodModalProps = {
  onClose: () => void;
  mode?: "add" | "edit";
  initialValues?: AddPeriodModalInitialValues;
};

function AddPeriodModal({ onClose, mode = "add", initialValues }: AddPeriodModalProps) {
  const [periodName, setPeriodName] = useState(initialValues?.periodName ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [extendsFrom, setExtendsFrom] = useState(initialValues?.extendsFrom ?? "none");
  const [startDateTime, setStartDateTime] = useState(initialValues?.startDateTime ?? "");
  const [endDateTime, setEndDateTime] = useState(initialValues?.endDateTime ?? "");

  const isEditMode = mode === "edit";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      periodName,
      description,
      extendsFrom,
      startDateTime,
      endDateTime,
    };
    // TODO: send to backend or lift state up when integrating
    console.log(isEditMode ? "Edit period:" : "Create period:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-2xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Period" : "Add Period"}
            </h2>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update the configuration for this payment period."
                : "Define a new base period or extension period for this payment option."}
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
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Period Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={periodName}
                onChange={(e) => setPeriodName(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder='e.g., "Main Registration", "Extension", "Final Extension"'
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Extends From Period
              </label>
              <select
                value={extendsFrom}
                onChange={(e) => setExtendsFrom(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="none">None (Create Base Period)</option>
                <option value="registration-period">
                  Registration Period (Nov 19, 2025 - Feb 10, 2026)
                </option>
              </select>
              <p className="mt-1 text-[10px] text-zinc-500">
                Leave as <b>None</b> to create a standalone base period.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Optional description for this period."
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Start Date &amp; Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                End Date &amp; Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>
          </div>

          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 shadow-sm">
            <p className="font-semibold">Note</p>
            <p>
              Base periods cannot overlap with other base periods. Extension periods can overlap
              with their parent period.
            </p>
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
              {isEditMode ? "Save Changes" : "Add Period"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

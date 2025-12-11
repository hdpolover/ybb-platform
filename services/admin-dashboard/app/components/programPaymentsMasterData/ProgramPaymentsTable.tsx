"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";

interface PaymentOptionRow {
  id: number;
  optionName: string;
  category: "Registration Fee" | "Program Fee 1" | "Program Fee 2";
  fundingType: "All" | "Self Funded" | "Fully Funded";
  amountUsd: number;
  amountIdrApprox: string;
  currentActivePeriodLabel: string;
  currentActivePeriodRange: string | null;
  currentActiveStatusBadge?: "Active Now" | null;
  lastActivePeriodLabel: string | null;
  lastActivePeriodRange: string | null;
  lastActiveStatusBadge?: "Upcoming" | null;
  status: "Active" | "Inactive";
}

const mockPaymentOptions: PaymentOptionRow[] = [
  {
    id: 1,
    optionName: "Fully Funded Registration Fee",
    category: "Registration Fee",
    fundingType: "Fully Funded",
    amountUsd: 10,
    amountIdrApprox: "Approx. Rp 169.000",
    currentActivePeriodLabel: "Registration Period",
    currentActivePeriodRange: "19 Nov 2025 12:01 AM - 10 Feb 2026 11:59 PM",
    currentActiveStatusBadge: "Active Now",
    lastActivePeriodLabel: null,
    lastActivePeriodRange: null,
    lastActiveStatusBadge: null,
    status: "Active",
  },
  {
    id: 2,
    optionName: "Self Funded Registration Fee",
    category: "Registration Fee",
    fundingType: "Self Funded",
    amountUsd: 15,
    amountIdrApprox: "Approx. Rp 253.500",
    currentActivePeriodLabel: "Main Period",
    currentActivePeriodRange: "20 Nov 2025 12:01 AM - 11 Apr 2026 11:59 PM",
    currentActiveStatusBadge: "Active Now",
    lastActivePeriodLabel: null,
    lastActivePeriodRange: null,
    lastActiveStatusBadge: null,
    status: "Active",
  },
  {
    id: 3,
    optionName: "Batch 1 Installment",
    category: "Program Fee 1",
    fundingType: "Self Funded",
    amountUsd: 360,
    amountIdrApprox: "Approx. Rp 6.084.000",
    currentActivePeriodLabel: "No Active Period",
    currentActivePeriodRange: null,
    currentActiveStatusBadge: null,
    lastActivePeriodLabel: "Main Period",
    lastActivePeriodRange: "25 Dec 2025 12:01 AM - 28 Feb 2026 11:59 PM",
    lastActiveStatusBadge: "Upcoming",
    status: "Active",
  },
  {
    id: 4,
    optionName: "Batch 2 Installment",
    category: "Program Fee 2",
    fundingType: "Self Funded",
    amountUsd: 450,
    amountIdrApprox: "Approx. Rp 7.605.000",
    currentActivePeriodLabel: "No Active Period",
    currentActivePeriodRange: null,
    currentActiveStatusBadge: null,
    lastActivePeriodLabel: "Main Period",
    lastActivePeriodRange: "25 Dec 2025 12:01 AM - 31 Mar 2026 11:59 PM",
    lastActiveStatusBadge: "Upcoming",
    status: "Active",
  },
];

export function ProgramPaymentsTable() {
  const [rows] = useState<PaymentOptionRow[]>(mockPaymentOptions);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentOptionRow | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const match = pathname.match(/\/programs\/([^/]+)/);
  const programId = match?.[1] ?? "";

  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.optionName.toLowerCase().includes(q) ||
      row.category.toLowerCase().includes(q) ||
      row.fundingType.toLowerCase().includes(q)
    );
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Program Payments</h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Configure payment options, funding types, and their active periods for this program.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={() => setShowAddModal(true)}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Payment Option</span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by option name, category, funding type..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-sm md:text-sm">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Payment Option</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Current Active Period</th>
              <th className="px-3 py-2">Last Active Period</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-[12px] text-zinc-500"
                >
                  No payment options configured yet.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50"
                >
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-900">{row.optionName}</div>
                      <div className="inline-flex items-center gap-1">
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                          {row.category}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-0.5 text-xs">
                      <div className="font-semibold text-zinc-900">
                        ${row.amountUsd.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-zinc-500">{row.amountIdrApprox}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.currentActivePeriodRange ? (
                      <div className="space-y-0.5 text-xs">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          <CalendarDaysIcon className="h-3.5 w-3.5" />
                          <span>{row.currentActivePeriodLabel}</span>
                        </button>
                        <div className="text-[11px] text-zinc-600">
                          {row.currentActivePeriodRange}
                        </div>
                        {row.currentActiveStatusBadge === "Active Now" && (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Active Now
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-0.5 text-[11px] text-zinc-500">
                        <div>No Active Period</div>
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Configure Periods
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.lastActivePeriodLabel ? (
                      <div className="space-y-0.5 text-xs">
                        <div className="font-semibold text-zinc-900">
                          {row.lastActivePeriodLabel}
                        </div>
                        {row.lastActivePeriodRange && (
                          <div className="text-[11px] text-zinc-600">
                            {row.lastActivePeriodRange}
                          </div>
                        )}
                        {row.lastActiveStatusBadge === "Upcoming" && (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Upcoming
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-0.5 text-[11px] text-zinc-500">
                        <div>No Period Set</div>
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Configure Periods
                        </button>
                      </div>
                    )}
                  </td>
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
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                        aria-label="Manage periods"
                        onClick={() => {
                          if (!programId) return;
                          router.push(
                            `/programs/${encodeURIComponent(
                              programId,
                            )}/master-data/program-payments/${encodeURIComponent(String(row.id))}`,
                          );
                        }}
                      >
                        <CalendarDaysIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100"
                        aria-label="Edit payment option"
                        onClick={() => {
                          setEditingPayment(row);
                          setShowAddModal(true);
                        }}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                        aria-label="Delete payment option"
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

      {showAddModal && (
        <AddPaymentOptionModal
          onClose={() => {
            setShowAddModal(false);
            setEditingPayment(null);
          }}
          mode={editingPayment ? "edit" : "add"}
          initialValues={
            editingPayment
              ? {
                  optionName: editingPayment.optionName,
                  category: editingPayment.category,
                  fundingType: editingPayment.fundingType,
                  amountUsd: editingPayment.amountUsd,
                  description: editingPayment.optionName,
                  status: editingPayment.status,
                }
              : undefined
          }
        />
      )}
    </section>
  );
}

type PaymentOptionInitialValues = {
  optionName?: string;
  category?: PaymentOptionRow["category"];
  fundingType?: PaymentOptionRow["fundingType"];
  amountUsd?: number;
  description?: string;
  status?: PaymentOptionRow["status"];
};

interface AddPaymentOptionModalProps {
  onClose: () => void;
  mode?: "add" | "edit";
  initialValues?: PaymentOptionInitialValues;
}

function AddPaymentOptionModal({ onClose, mode = "add", initialValues }: AddPaymentOptionModalProps) {
  const [optionName, setOptionName] = useState(initialValues?.optionName ?? "");
  const [category, setCategory] = useState<PaymentOptionRow["category"]>(
    initialValues?.category ?? "Registration Fee",
  );
  const [fundingType, setFundingType] = useState<PaymentOptionRow["fundingType"]>(
    initialValues?.fundingType ?? "All",
  );
  const [amountUsd, setAmountUsd] = useState<number | "">(
    typeof initialValues?.amountUsd === "number" ? initialValues.amountUsd : "",
  );
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [status, setStatus] = useState<PaymentOptionRow["status"]>(
    initialValues?.status ?? "Active",
  );

  const isEditMode = mode === "edit";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      optionName,
      category,
      fundingType,
      amountUsd: typeof amountUsd === "number" ? amountUsd : 0,
      description,
      status,
    };
    // TODO: integrate with backend / parent state
    console.log(isEditMode ? "Edit payment option:" : "Create payment option:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Payment Option" : "Add Payment Option"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update payment amount, funding type, and status for this program payment option."
                : "Configure payment amount, funding type, and status for this program payment option."}
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
                Option Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={optionName}
                onChange={(e) => setOptionName(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g., Fully Funded Registration Fee"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as PaymentOptionRow["category"])
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              >
                <option value="Registration Fee">Registration Fee</option>
                <option value="Program Fee 1">Program Fee 1</option>
                <option value="Program Fee 2">Program Fee 2</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Funding Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={fundingType}
                onChange={(e) =>
                  setFundingType(e.target.value as PaymentOptionRow["fundingType"])
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              >
                <option value="All">All</option>
                <option value="Self Funded">Self Funded</option>
                <option value="Fully Funded">Fully Funded</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                USD Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={amountUsd}
                onChange={(e) =>
                  setAmountUsd(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g., 10"
                required
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 shadow-sm">
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-amber-500" />
                <div>
                  <p className="font-semibold">Important</p>
                  <p>
                    After creating this payment option, you must manage its availability periods by
                    clicking the <span className="font-semibold">Manage Periods</span> button.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Short description about this payment option."
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PaymentOptionRow["status"])}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-0 py-2.5 pt-3">
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
              {isEditMode ? "Save Changes" : "Add Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

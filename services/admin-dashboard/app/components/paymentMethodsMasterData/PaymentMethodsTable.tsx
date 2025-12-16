"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  CreditCardIcon,
} from "@heroicons/react/24/solid";

export type PaymentMethodRow = {
  id: number;
  name: string;
  type: "Bank Transfer" | "Virtual Account" | "E-Wallet" | "Credit/Debit Card";
  imageAlt: string;
  imageSrc: string | null;
  /** Manual vs Gateway, used in the form but not shown in the main table. */
  paymentType: "Manual" | "Gateway";
  /** Long-form description explaining how to use this payment method. */
  description: string;
  status: "Active" | "Inactive";
};

const mockPaymentMethods: PaymentMethodRow[] = [
  {
    id: 1,
    name: "Bank Transfer - BCA",
    type: "Bank Transfer",
    imageAlt: "BCA Logo",
    imageSrc: null,
    paymentType: "Manual",
    description: "Pay via manual bank transfer to the provided BCA account number.",
    status: "Active",
  },
  {
    id: 2,
    name: "Bank Transfer - BNI",
    type: "Bank Transfer",
    imageAlt: "BNI Logo",
    imageSrc: null,
    paymentType: "Manual",
    description: "Manual bank transfer option using BNI accounts.",
    status: "Active",
  },
  {
    id: 3,
    name: "Virtual Account - BRI",
    type: "Virtual Account",
    imageAlt: "BRIVA Logo",
    imageSrc: null,
    paymentType: "Gateway",
    description: "Virtual account payment through BRIVA.",
    status: "Active",
  },
  {
    id: 4,
    name: "QRIS / E-Wallet Aggregator",
    type: "E-Wallet",
    imageAlt: "QRIS Logo",
    imageSrc: null,
    paymentType: "Gateway",
    description: "QRIS and e-wallets via integrated payment gateway.",
    status: "Active",
  },
  {
    id: 5,
    name: "Credit / Debit Card (Visa/Mastercard)",
    type: "Credit/Debit Card",
    imageAlt: "Card Logos",
    imageSrc: null,
    paymentType: "Gateway",
    description:
      "Debit or Credit Card (Visa or Mastercard). Go to the checkout page and select Credit/Debit Card as the payment method, then follow the on-screen instructions.",
    status: "Inactive",
  },
];

export function PaymentMethodsTable() {
  const [rows] = useState<PaymentMethodRow[]>(mockPaymentMethods);
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingRow, setEditingRow] = useState<PaymentMethodRow | null>(null);
  const [selectedRow, setSelectedRow] = useState<PaymentMethodRow | null>(null);

  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return row.name.toLowerCase().includes(q) || row.type.toLowerCase().includes(q);
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Payment Methods</h2>
          <p className="text-xs text-zinc-500 md:text-sm">
            Configure available payment methods for this program, including bank transfers,
            virtual accounts, and e-wallets.
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
          <span>Add Payment Method</span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or type..."
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
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Image</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-[12px] text-zinc-500"
                >
                  No payment methods configured yet.
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
                        <CreditCardIcon className="h-4 w-4" />
                      </span>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-zinc-900">{row.name}</div>
                        <div className="text-[11px] text-zinc-500">Program-wide payment method</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white">
                        {row.imageSrc ? (
                          <Image
                            src={row.imageSrc}
                            alt={row.imageAlt}
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold text-zinc-500">
                            {row.imageAlt.charAt(0)}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500">{row.imageAlt}</span>
                    </div>
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
                        aria-label="Edit payment method"
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
                        aria-label="Delete payment method"
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
        <PaymentMethodFormModal
          mode={editingRow ? "edit" : "add"}
          initialValues={editingRow ?? undefined}
          onClose={() => {
            setShowFormModal(false);
            setEditingRow(null);
          }}
        />
      )}

      {showDetailModal && selectedRow && (
        <PaymentMethodDetailModal
          method={selectedRow}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedRow(null);
          }}
        />
      )}
    </section>
  );
}

interface PaymentMethodFormModalProps {
  onClose: () => void;
  mode?: "add" | "edit";
  initialValues?: PaymentMethodRow;
}

function PaymentMethodFormModal({
  onClose,
  mode = "add",
  initialValues,
}: PaymentMethodFormModalProps) {
  const [methodName, setMethodName] = useState(initialValues?.name ?? "");
  const [paymentType, setPaymentType] = useState<PaymentMethodRow["paymentType"]>(
    initialValues?.paymentType ?? "Manual",
  );
  const [status, setStatus] = useState<PaymentMethodRow["status"]>(
    initialValues?.status ?? "Active",
  );
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [selectedImageName, setSelectedImageName] = useState<string | null>(
    initialValues?.imageSrc ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isEditMode = mode === "edit";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: methodName,
      paymentType,
      status,
      description,
      imageFileName: selectedImageName,
    };
    // TODO: Nanti disambungin ke backend / state di parent pas udah siap
    console.log(isEditMode ? "Edit payment method:" : "Create payment method:", payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-lg rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">
              {isEditMode ? "Edit Payment Method" : "Add Payment Method"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {isEditMode
                ? "Update configuration for this payment method, including type, image, and usage instructions."
                : "Define a new payment method, configure its type, image, and usage instructions."}
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
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Method Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={methodName}
                onChange={(event) => setMethodName(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="e.g., Credit / Debit Card (Visa/Mastercard)"
                required
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Payment Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentType}
                  onChange={(event) =>
                    setPaymentType(event.target.value as PaymentMethodRow["paymentType"])
                  }
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                >
                  <option value="Manual">Manual</option>
                  <option value="Gateway">Gateway</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as PaymentMethodRow["status"])
                  }
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Payment Method Image
              </label>
              <p className="mb-1 text-[10px] text-zinc-500">
                Upload an image for the payment method (recommended size: 200x100px).
              </p>
              <button
                type="button"
                className="flex h-32 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-center text-[11px] text-zinc-500 hover:border-blue-400 hover:bg-blue-50/40"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
              >
                <div className="space-y-1 px-4">
                  <div className="text-sm font-medium text-zinc-700">
                    {selectedImageName ? "Image selected" : "Drop image here or click to upload."}
                  </div>
                  {selectedImageName ? (
                    <div className="truncate text-[11px] text-zinc-600">{selectedImageName}</div>
                  ) : (
                    <div>Supported formats: JPG, PNG, GIF. Max size: 2MB</div>
                  )}
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedImageName(file ? file.name : null);
                }}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Description
              </label>
              <textarea
                rows={6}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Explain how to use this payment method, for example: steps for paying via card, virtual account, or e-wallet."
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
              {isEditMode ? "Save Changes" : "Add Payment Method"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PaymentMethodDetailModalProps {
  method: PaymentMethodRow;
  onClose: () => void;
}

function PaymentMethodDetailModal({ method, onClose }: PaymentMethodDetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-lg md:text-sm">
        {/* bagian Headernya */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Payment Method Details</h3>
            <p className="text-[11px] text-zinc-500">
              Review configuration and description for this payment method.
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
          {/* bagian Top Card : Logo + Summarynya */}
          <section className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-4">
              <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded bg-white">
                {method.imageSrc ? (
                  <Image
                    src={method.imageSrc}
                    alt={method.imageAlt}
                    width={180}
                    height={80}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-sm font-semibold text-zinc-500">
                    {method.imageAlt.charAt(0)}
                  </span>
                )}
              </div>
              <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                {method.type}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 md:text-base">
                    {method.name}
                  </h4>
                  <p className="text-[11px] text-zinc-500">Method Name</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] font-medium text-zinc-500">Payment Type</span>
                  <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                    {method.paymentType}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-medium text-zinc-500">Status</div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      method.status === "Active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {method.status}
                  </span>
                </div>
                <div className="space-y-0.5 md:col-span-2">
                  <div className="text-[11px] font-medium text-zinc-500">Image URL</div>
                  <div className="truncate rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-700">
                    {method.imageSrc || "Not set"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Card bagian Deskripsi */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Description
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-800 md:text-sm whitespace-pre-wrap">
              {method.description || "No description provided for this payment method."}
            </div>
          </section>
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

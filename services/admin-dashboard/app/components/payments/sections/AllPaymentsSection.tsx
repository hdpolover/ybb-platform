"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRightIcon,
  BanknotesIcon,
  ArrowPathIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";

interface AllPaymentsSectionProps {
  onOpenMakePayment: () => void;
}

export function AllPaymentsSection({ onOpenMakePayment }: AllPaymentsSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPaymentDetail = (paymentId: string) => {
    const query = searchParams.toString();
    router.push(query ? `/payments/${paymentId}?${query}` : `/payments/${paymentId}`);
  };

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">All Payments</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Daftar seluruh transaksi pembayaran untuk program ini.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-500 px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            onClick={onOpenMakePayment}
          >
            <ArrowUpRightIcon className="h-3.5 w-3.5" />
            Make Payment
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <BanknotesIcon className="h-3.5 w-3.5 text-emerald-500" />
            Export Data (Excel)
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            <FunnelIcon className="h-3.5 w-3.5" />
            Apply Filters
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-medium text-zinc-700">
          Search
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by participant name, email, transaction ID, payment amount..."
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-600"
          >
            <MagnifyingGlassIcon className="h-3.5 w-3.5" />
            Search
          </button>
        </div>
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">
            Payment Status
          </label>
          <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            <option>All Status</option>
            <option>Created</option>
            <option>Pending</option>
            <option>Success</option>
            <option>Cancelled</option>
            <option>Rejected</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">
            Program Payment
          </label>
          <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            <option>All Program Payments</option>
            <option>Fully Funded Registration Fee</option>
            <option>Self Funded Registration Fee</option>
            <option>Batch 1 Installment</option>
            <option>Batch 2 Installment</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">
            Payment Method
          </label>
          <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            <option>All Methods</option>
            <option>Debit or Credit Card ( Visa or MasterCard )</option>
            <option>Vakif Bankasi</option>
            <option>BCA</option>
            <option>Paypal</option>
            <option>Debit or Credit Card ( Manual Confirmation )</option>
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-zinc-200">
        <table className="min-w-full border-collapse text-left text-[11px]">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Payment Info</th>
              <th className="px-3 py-2 font-semibold">Participant</th>
              <th className="px-3 py-2 font-semibold">Payment Details</th>
              <th className="px-3 py-2 text-right font-semibold">Status</th>
              <th className="px-3 py-2 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {/* Row 1 */}
            <tr className="bg-white">
              <td className="align-top px-3 py-2 text-zinc-800">
                <div className="font-medium">Nov 30, 2025 16:18</div>
              </td>
              <td className="align-top px-3 py-2 text-zinc-700">
                <div className="font-medium text-zinc-900">Payment ID: 18502</div>
                <div className="text-zinc-600">Transaction Code: TR-18502-1764320001</div>
                <div className="text-[10px] text-zinc-500">
                  Order ID: 185021764320001958756
                </div>
              </td>
              <td className="align-top px-3 py-2 text-zinc-700">
                <div className="font-semibold text-zinc-900">AYA GAMAL</div>
                <div className="text-zinc-600">ayagamal453@gmail.com</div>
                <div className="text-[10px] text-zinc-500">Egypt</div>
              </td>
              <td className="align-top px-3 py-2 text-zinc-700">
                <div className="font-medium">Fully Funded Registration Fee</div>
                <div className="text-zinc-600">Rp169.000,00</div>
                <div className="text-[10px] text-zinc-500">
                  Debit or Credit card ( Visa or Mastercard )
                </div>
              </td>
              <td className="align-top px-3 py-2 text-right">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Success
                </span>
              </td>
              <td className="align-top px-3 py-2 text-right text-zinc-500">
                <button
                  type="button"
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                  onClick={() => goToPaymentDetail("18502")}
                >
                  View details
                </button>
              </td>
            </tr>

            {/* Row 2 */}
            <tr className="bg-zinc-50/60">
              <td className="align-top px-3 py-2 text-zinc-800">
                <div className="font-medium">Nov 29, 2025 10:42</div>
              </td>
              <td className="align-top px-3 py-2 text-zinc-700">
                <div className="font-medium text-zinc-900">Payment ID: 18488</div>
                <div className="text-zinc-600">Transaction Code: TR-18488-1764301001</div>
                <div className="text-[10px] text-zinc-500">
                  Order ID: 184881764301001958756
                </div>
              </td>
              <td className="align-top px-3 py-2 text-zinc-700">
                <div className="font-semibold text-zinc-900">Nur Aisyah</div>
                <div className="text-zinc-600">nur.aisyah@example.com</div>
                <div className="text-[10px] text-zinc-500">Indonesia</div>
              </td>
              <td className="align-top px-3 py-2 text-zinc-700">
                <div className="font-medium">Self Funded Registration Fee</div>
                <div className="text-zinc-600">Rp1.352.000,00</div>
                <div className="text-[10px] text-zinc-500">BCA</div>
              </td>
              <td className="align-top px-3 py-2 text-right">
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Pending
                </span>
              </td>
              <td className="align-top px-3 py-2 text-right text-zinc-500">
                <button
                  type="button"
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                >
                  View details
                </button>
              </td>
            </tr>

            {/* Row 3 */}
            <tr className="bg-white">
              <td className="align-top px-3 py-2 text-zinc-800">
                <div className="font-medium">Nov 28, 2025 21:05</div>
              </td>
              <td className="align-top px-3 py-2 text-zinc-700">
                <div className="font-medium text-zinc-900">Payment ID: 18460</div>
                <div className="text-zinc-600">Transaction Code: TR-18460-1764200008</div>
                <div className="text-[10px] text-zinc-500">
                  Order ID: 184601764200008958756
                </div>
              </td>
              <td className="align-top px-3 py-2 text-zinc-700">
                <div className="font-semibold text-zinc-900">Mohammed Ali</div>
                <div className="text-zinc-600">mohammed.ali@example.com</div>
                <div className="text-[10px] text-zinc-500">Pakistan</div>
              </td>
              <td className="align-top px-3 py-2 text-zinc-700">
                <div className="font-medium">Batch 1 Installment</div>
                <div className="text-zinc-600">$ 120.00</div>
                <div className="text-[10px] text-zinc-500">Paypal</div>
              </td>
              <td className="align-top px-3 py-2 text-right">
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  Rejected
                </span>
              </td>
              <td className="align-top px-3 py-2 text-right text-zinc-500">
                <button
                  type="button"
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                >
                  View details
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

"use client";

import React from "react";
import { ClipboardDocumentListIcon, ClockIcon, CheckCircleIcon } from "@heroicons/react/24/solid";

export function PaymentNotesSection() {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-6 py-5 text-sm shadow-sm">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Transaction Notes */}
        <div>
          <h2 className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            <ClipboardDocumentListIcon className="h-4 w-4" />
            Transaction Notes
          </h2>
          <div className="space-y-2 rounded-md border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
            <p>
              Payment for YBB Program. This transaction was created from the online registration
              form and linked to the participant dashboard.
            </p>
            <p className="text-[13px] text-zinc-600">
              Additional note: please verify if the participant has submitted all required
              documents before re-opening the payment status.
            </p>
          </div>

          <div className="mt-4 text-xs text-zinc-600">
            <span className="font-semibold text-zinc-800">2025-11-30 20:00:06</span>
            <span className="mx-1">-</span>
            <span>
              Status updated: Payment automatically cancelled after 1 hour of pending status.
            </span>
          </div>
        </div>

        {/* Status Timeline */}
        <div>
          <h2 className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            <ClockIcon className="h-4 w-4" />
            Status Timeline
          </h2>

          <ol className="relative border-l border-zinc-200 pl-4 text-sm text-zinc-700">
            <li className="mb-4 ml-1">
              <div className="absolute -left-2 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white">
                <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Payment Created
              </div>
              <div className="mt-0.5 text-[13px] font-medium text-zinc-800">30 Nov 2025 - 18:04</div>
              <p className="mt-0.5 text-[12px] text-zinc-600">
                Payment record was created in the system.
              </p>
            </li>

            <li className="ml-1">
              <div className="absolute -left-2 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white">
                <ClockIcon className="h-3 w-3 text-rose-500" />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Payment Status Updated
              </div>
              <div className="mt-0.5 text-[13px] font-medium text-zinc-800">30 Nov 2025 - 20:00</div>
              <p className="mt-0.5 text-[12px] text-zinc-600">
                Payment status updated to: <span className="font-semibold">Cancelled</span>.
              </p>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

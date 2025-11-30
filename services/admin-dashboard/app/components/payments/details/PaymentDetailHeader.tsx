"use client";

import React from "react";
import {
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

interface PaymentDetailHeaderProps {
  transactionId: string;
  amountLabel: string;
  statusLabel: string;
  statusVariant: "success" | "pending" | "cancelled";
  transactionCode: string;
  orderId: string;
  createdAt: string;
  onOpenUpdateStatus?: () => void;
}

export function PaymentDetailHeader({
  transactionId,
  amountLabel,
  statusLabel,
  statusVariant,
  transactionCode,
  orderId,
  createdAt,
  onOpenUpdateStatus,
}: PaymentDetailHeaderProps) {
  const statusClasses =
    statusVariant === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : statusVariant === "pending"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-rose-50 text-rose-700 border-rose-200";

  const StatusIcon =
    statusVariant === "success"
      ? CheckCircleIcon
      : statusVariant === "pending"
      ? ExclamationTriangleIcon
      : XCircleIcon;

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-6 py-5 text-sm shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Transaction #{transactionId}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <span className="text-3xl font-semibold text-zinc-900">{amountLabel}</span>
            <span className="text-sm font-medium text-zinc-500">
              Payment for Program
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClasses}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {statusLabel}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
            Back to Payments
          </button>
        </div>
      </div>

      <div className="grid gap-4 border-t border-zinc-100 pt-4 text-[12px] text-zinc-700 md:grid-cols-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">
            Transaction Code
          </div>
          <div className="mt-1 font-semibold text-zinc-900">{transactionCode}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Order ID</div>
          <div className="mt-1 font-semibold text-zinc-900 break-all">{orderId}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Created</div>
          <div className="mt-1 font-semibold text-zinc-900">{createdAt}</div>
        </div>
        <div className="flex items-end justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-blue-500 bg-blue-500 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-600"
            onClick={onOpenUpdateStatus}
          >
            Update Status
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3.5 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Edit
          </button>
        </div>
      </div>
    </section>
  );
}

"use client";

import React from "react";
import { BanknotesIcon } from "@heroicons/react/24/solid";

interface ProgramPaymentCardProps {
  title: string;
  tagLabel: string;
  idrPrice: string;
  usdPrice: string;
  validPeriod?: string;
  description: string;
}

export function ProgramPaymentCard({
  title,
  tagLabel,
  idrPrice,
  usdPrice,
  validPeriod,
  description,
}: ProgramPaymentCardProps) {
  return (
    <section className="rounded-md border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm shadow-sm">
      <h2 className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        <BanknotesIcon className="h-4 w-4" />
        Program Payment
      </h2>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
            {tagLabel}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-md border border-emerald-100 bg-white px-3.5 py-3 text-xs text-zinc-700">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">IDR Price</span>
          <span className="text-sm font-semibold text-zinc-900">{idrPrice}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">USD Price</span>
          <span className="text-sm font-semibold text-zinc-900">{usdPrice}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Valid Period</span>
          <span className="font-semibold text-zinc-900">{validPeriod ?? "N/A - N/A"}</span>
        </div>
      </div>

      <div className="mt-3 text-xs text-zinc-700">
        <div className="text-[12px] font-semibold text-zinc-900">Payment Description</div>
        <p className="mt-1 leading-relaxed text-[12px] text-zinc-600">{description}</p>
      </div>
    </section>
  );
}

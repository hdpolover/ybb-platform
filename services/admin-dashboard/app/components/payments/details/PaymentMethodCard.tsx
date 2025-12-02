"use client";

import React from "react";
import { CreditCardIcon, InformationCircleIcon } from "@heroicons/react/24/solid";

interface PaymentMethodCardProps {
  title: string;
  provider: string;
  description: string;
}

export function PaymentMethodCard({ title, provider, description }: PaymentMethodCardProps) {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 px-5 py-4 text-sm shadow-sm">
      <h2 className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
        <CreditCardIcon className="h-4 w-4" />
        Payment Method
      </h2>

      <div className="mt-1 text-sm font-semibold text-zinc-900">{provider}</div>
      <div className="mt-1 text-[13px] text-zinc-600">{title}</div>

      <div className="mt-3 space-y-2 rounded-md border border-amber-100 bg-white px-3.5 py-3 text-xs text-zinc-700">
        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-900">
          <InformationCircleIcon className="h-3.5 w-3.5 text-amber-500" />
          Instructions
        </div>
        <p className="leading-relaxed text-[12px] text-zinc-600">{description}</p>
      </div>
    </section>
  );
}

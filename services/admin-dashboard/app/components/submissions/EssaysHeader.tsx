"use client";

import React from "react";
import { PencilSquareIcon, DocumentTextIcon } from "@heroicons/react/24/solid";

export function EssaysHeader() {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-base font-semibold text-zinc-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <PencilSquareIcon className="h-4 w-4" />
            </span>
            <span>Essay Submissions Overview</span>
          </h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            View and manage all participant essay submissions for the current program. Track completion
            status and review responses.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Total Essays
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <DocumentTextIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">128</div>
          <div className="mt-1 text-[11px] text-zinc-500">For current program</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Submitted
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <PencilSquareIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">96</div>
          <div className="mt-1 text-[11px] text-zinc-500">Completed essay submissions</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Pending
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
              <PencilSquareIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">32</div>
          <div className="mt-1 text-[11px] text-zinc-500">Awaiting participant submission</div>
        </div>
      </div>
    </section>
  );
}

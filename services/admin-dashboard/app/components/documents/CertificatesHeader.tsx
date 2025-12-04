"use client";

import React from "react";
import { TrophyIcon, UserGroupIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/solid";

export function CertificatesHeader() {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-base font-semibold text-zinc-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
              <TrophyIcon className="h-4 w-4" />
            </span>
            <span>Certificates Overview</span>
          </h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Configure awards, certificate templates, and recipients. Track issuance progress for this program.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Total Awards</div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <TrophyIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">8</div>
          <div className="mt-1 text-[11px] text-zinc-500">Configured award categories</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Recipients</div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <UserGroupIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">0</div>
          <div className="mt-1 text-[11px] text-zinc-500">Total recipients assigned</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Certificates Issued</div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">0</div>
          <div className="mt-1 text-[11px] text-zinc-500">Successfully generated certificates</div>
        </div>
      </div>
    </section>
  );
}

"use client";

import React from "react";
import { DocumentTextIcon } from "@heroicons/react/24/solid";

export function ProgramDocumentsHeader() {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-base font-semibold text-zinc-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <DocumentTextIcon className="h-4 w-4" />
            </span>
            <span>Program Documents Overview</span>
          </h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Manage LOA, agreement letters, and complementary document templates used across this program.
          </p>
        </div>
      </div>
    </section>
  );
}

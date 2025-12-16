"use client";

import { use } from "react";
import { programs } from "@/app/components/navbar/ProgramSelect";
import { ProgramFaqsTable } from "@/app/components/programFaqsMasterData/ProgramFaqsTable";

function getProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const program = programs.find((item) => item.id === programId);
  return program?.name ?? "Selected Program";
}

export default function ProgramFaqsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const programName = getProgramName(programId);

  return (
    <main className="space-y-4 text-sm md:text-base">
      <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm md:text-base">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="text-base font-semibold text-zinc-900 md:text-lg">
              {programName} FAQs
            </h1>
            <p className="text-xs text-zinc-500 md:text-sm">
              Configure and manage frequently asked questions for this program.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700 shadow-sm md:text-base">
        <ProgramFaqsTable />
      </section>
    </main>
  );
}

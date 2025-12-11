"use client";

import { use, useState } from "react";
import { GeneralCategoriesTable } from "@/app/components/submissionsMasterData/ParticipationCategoriesTable";
import { SubThemesTable } from "@/app/components/submissionsMasterData/SubThemesTable";
import { SubmissionEssaysTable } from "@/app/components/submissionsMasterData/SubmissionEssaysTable";

function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  const titled = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return titled;
}

export default function SubmissionFormPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const programName = formatProgramName(programId);

  const [activeTab, setActiveTab] = useState<"categories" | "subthemes" | "essays">("categories");

  return (
    <main className="space-y-4 text-sm md:text-base">
      {/* Header */}
      <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm md:text-base">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="text-base font-semibold text-zinc-900 md:text-lg">
              {programName} Submission Form
            </h1>
            <p className="text-xs text-zinc-500 md:text-sm">
              Configure participation categories, sub themes, and essay questions for this program.
            </p>
          </div>
        </div>
      </section>

      {/* Tabs + content */}
      <section className="rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700 shadow-sm md:text-base">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex gap-1 rounded-md bg-zinc-100 p-0.5 text-xs md:text-sm">
            <button
              type="button"
              className={`rounded-[6px] px-3 py-1.5 text-xs md:text-sm font-semibold shadow-sm transition-colors ${
                activeTab === "categories"
                  ? "bg-white text-zinc-900"
                  : "bg-transparent text-zinc-500 hover:text-zinc-700"
              }`}
              onClick={() => setActiveTab("categories")}
            >
              Participation Categories
            </button>
            <button
              type="button"
              className={`rounded-[6px] px-3 py-1.5 text-xs md:text-sm font-semibold shadow-sm transition-colors ${
                activeTab === "subthemes"
                  ? "bg-white text-zinc-900"
                  : "bg-transparent text-zinc-500 hover:text-zinc-700"
              }`}
              onClick={() => setActiveTab("subthemes")}
            >
              Sub Theme
            </button>
            <button
              type="button"
              className={`rounded-[6px] px-3 py-1.5 text-xs md:text-sm font-semibold shadow-sm transition-colors ${
                activeTab === "essays"
                  ? "bg-white text-zinc-900"
                  : "bg-transparent text-zinc-500 hover:text-zinc-700"
              }`}
              onClick={() => setActiveTab("essays")}
            >
              Essays
            </button>
          </div>
        </div>

        {activeTab === "categories" && <GeneralCategoriesTable />}
        {activeTab === "subthemes" && <SubThemesTable />}
        {activeTab === "essays" && <SubmissionEssaysTable />}
      </section>
    </main>
  );
}

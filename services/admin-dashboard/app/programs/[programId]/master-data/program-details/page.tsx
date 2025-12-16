"use client";

import { use, useState } from "react";
import { InformationCircleIcon, PencilSquareIcon } from "@heroicons/react/24/solid";
import { programs } from "@/app/components/navbar/ProgramSelect";
import { GeneralInformationTab } from "@/app/components/program-details/GeneralInformationTab";
import { ProgramSpecificsTab } from "@/app/components/program-details/ProgramSpecificsTab";
import { EditGeneralInformationModal } from "@/app/components/program-details/EditGeneralInformationModal";
import { EditProgramSpecificsModal } from "@/app/components/program-details/EditProgramSpecificsModal";

function getProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const program = programs.find((item) => item.id === programId);
  return program?.name ?? "Selected Program";
}

export default function ProgramDetailsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const programName = getProgramName(programId);

  const [activeTab, setActiveTab] = useState<"general" | "specifics">("general");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProgramSpecificsModal, setShowProgramSpecificsModal] = useState(false);

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
              {programName} Program Details
            </h1>
            <p className="text-xs text-zinc-500 md:text-sm">
              Configure core information, identity, and key communication assets for this program.
            </p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700 shadow-sm md:text-base">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex gap-1 rounded-md bg-zinc-100 p-0.5 text-xs md:text-sm">
            <button
              type="button"
              className={`rounded-[6px] px-3 py-1.5 text-xs md:text-sm font-semibold shadow-sm transition-colors ${
                activeTab === "general"
                  ? "bg-white text-zinc-900"
                  : "bg-transparent text-zinc-500 hover:text-zinc-700"
              }`}
              onClick={() => setActiveTab("general")}
            >
              General Information
            </button>
            <button
              type="button"
              className={`rounded-[6px] px-3 py-1.5 text-xs md:text-sm font-semibold shadow-sm transition-colors ${
                activeTab === "specifics"
                  ? "bg-white text-zinc-900"
                  : "bg-transparent text-zinc-500 hover:text-zinc-700"
              }`}
              onClick={() => setActiveTab("specifics")}
            >
              Program Specifics
            </button>
          </div>

          {activeTab === "general" ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
              onClick={() => setShowEditModal(true)}
            >
              <span>Edit General Information</span>
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 md:text-sm"
              onClick={() => setShowProgramSpecificsModal(true)}
            >
              <span>Edit Program Specifics</span>
            </button>
          )}
        </div>

        {activeTab === "general" && <GeneralInformationTab />}
        {activeTab === "specifics" && <ProgramSpecificsTab />}
      </section>
      {showEditModal && (
        <EditGeneralInformationModal programName={programName} onClose={() => setShowEditModal(false)} />
      )}
      {showProgramSpecificsModal && (
        <EditProgramSpecificsModal
          programName={programName}
          onClose={() => setShowProgramSpecificsModal(false)}
        />
      )}
    </main>
  );
}

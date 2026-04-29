"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { HeaderSection } from "@/app/components/submissionsMasterData/HeaderSection";
import { TabNavigation } from "@/app/components/submissionsMasterData/TabNavigation";
import { FormFieldsTable } from "@/app/components/submissionsMasterData/form-fields/FormFieldsTable";
import { ParticipationCategoriesTable } from "@/app/components/submissionsMasterData/categories/ParticipationCategoriesTable";
import { SubThemesTable } from "@/app/components/submissionsMasterData/subthemes/SubThemesTable";
import { SubmissionEssaysTable } from "@/app/components/submissionsMasterData/essays/SubmissionEssaysTable";
import { PreviewSettingsTab } from "@/app/components/submissionsMasterData/preview/PreviewSettingsTab";

export default function SubmissionFormPage({
  params,
}: {
  params: Promise<{ programId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { programId } = use(params);
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab =
    requestedTab && ["fields", "categories", "subthemes", "essays", "preview"].includes(requestedTab)
      ? requestedTab
      : "fields";

  const { accessiblePrograms } = useAuth();
  const programName =
    accessiblePrograms.find((p) => p.programId === programId)?.programName ?? "Selected Program";

  return (
    <main className="space-y-4">
      <HeaderSection programName={programName} />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          <TabNavigation activeTab={activeTab} />
        </div>

        <div className="pt-2">
          {activeTab === "fields" && <FormFieldsTable programId={programId} />}
          {activeTab === "categories" && <ParticipationCategoriesTable programId={programId} />}
          {activeTab === "subthemes" && <SubThemesTable programId={programId} />}
          {activeTab === "essays" && <SubmissionEssaysTable programId={programId} />}
          {activeTab === "preview" && <PreviewSettingsTab programId={programId} />}
        </div>
      </section>
    </main>
  );
}

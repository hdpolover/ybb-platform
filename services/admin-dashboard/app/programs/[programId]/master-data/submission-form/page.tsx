import { HeaderSection } from "@/app/components/submissionsMasterData/HeaderSection";
import { TabNavigation } from "@/app/components/submissionsMasterData/TabNavigation";
import { FormFieldsTable } from "@/app/components/submissionsMasterData/form-fields/FormFieldsTable";
import { ParticipationCategoriesTable } from "@/app/components/submissionsMasterData/categories/ParticipationCategoriesTable";
import { SubThemesTable } from "@/app/components/submissionsMasterData/subthemes/SubThemesTable";
import { SubmissionEssaysTable } from "@/app/components/submissionsMasterData/essays/SubmissionEssaysTable";

function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export default async function SubmissionFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const programId = resolvedParams.programId;
  const programName = formatProgramName(programId);
  const activeTab = resolvedSearchParams.tab || "categories";

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
        </div>
      </section>
    </main>
  );
}
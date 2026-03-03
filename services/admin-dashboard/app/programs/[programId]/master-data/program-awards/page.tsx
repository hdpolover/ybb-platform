import { programs } from "@/app/components/navbar/ProgramSelect";
import { ProgramAwardsTable, type ProgramAward } from "@/app/components/programAwardsMasterData/ProgramAwardsTable";

// --- UTILITY ---
function getProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  if (!Array.isArray(programs)) return "Selected Program"; 
  const program = programs.find((item: any) => item.id === programId);
  return program?.name ?? "Selected Program";
}

// --- LOCAL MOCK DATA ---
const MOCK_AWARDS: ProgramAward[] = [
  {
    id: 1,
    award: "Best Delegate",
    title: "Best Delegate - Global Youth Summit",
    type: "Winner",
    order: 1,
    description: "Awarded to the most outstanding delegate who demonstrates exceptional leadership, collaboration, and impact throughout the program.",
    status: "Active",
  },
  {
    id: 2,
    award: "Best Project",
    title: "Best Social Impact Project",
    type: "Runner Up",
    order: 2,
    description: "Given to the project team that designs the most impactful and feasible social initiative aligned with program values.",
    status: "Active",
  },
  {
    id: 3,
    award: "Most Inspiring Story",
    title: "Most Inspiring Personal Journey",
    type: "Honorable Mention",
    order: 3,
    description: "Recognizes a delegate whose personal story and growth journey inspires fellow participants and communities.",
    status: "Inactive",
  },
];

export default async function ProgramAwardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const programName = getProgramName(resolvedParams.programId);
  const searchQuery = resolvedSearchParams.search?.toLowerCase() || "";

  // Data filtering dilakukan di Server
  const filteredData = MOCK_AWARDS.filter((award) => {
    if (!searchQuery) return true;
    return (
      award.award.toLowerCase().includes(searchQuery) ||
      award.title.toLowerCase().includes(searchQuery) ||
      award.type.toLowerCase().includes(searchQuery) ||
      award.description.toLowerCase().includes(searchQuery) ||
      award.status.toLowerCase().includes(searchQuery)
    );
  });

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="mt-1 text-lg font-bold text-zinc-900">
              {programName} Program Awards
            </h1>
            <p className="text-sm text-zinc-500">
              Configure and manage awards that will be presented for this program.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ProgramAwardsTable data={filteredData} currentSearch={searchQuery} />
      </section>
    </main>
  );
}
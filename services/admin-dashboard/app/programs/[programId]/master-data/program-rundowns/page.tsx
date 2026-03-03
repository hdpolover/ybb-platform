import { ProgramRundownsTable, type ProgramRundownRow } from "@/app/components/programRundownsMasterData/ProgramRundownsTable";

// --- UTILITY ---
function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

// --- MOCK DATA ---
const MOCK_RUNDOWNS: ProgramRundownRow[] = [
  {
    id: 1,
    title: "Opening & Registration",
    startTime: "08:00",
    endTime: "09:00",
    description: "Participant arrival, registration, and welcome desk services before the official opening.",
    status: "Active",
  },
  {
    id: 2,
    title: "Opening Ceremony & Keynote Speech",
    startTime: "09:00",
    endTime: "10:30",
    description: "Formal opening session with national anthem, remarks from organizers, and keynote from invited speaker.",
    status: "Active",
  },
  {
    id: 3,
    title: "Plenary Session: Youth & Global Leadership",
    startTime: "10:45",
    endTime: "12:00",
    description: "Plenary discussion highlighting youth roles in global leadership and sustainable development.",
    status: "Active",
  },
];

export default async function ProgramRundownsPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const programName = formatProgramName(resolvedParams.programId);
  const searchQuery = resolvedSearchParams.search?.toLowerCase() || "";

  // Logika filter dipindah ke Server untuk SSR optimal
  const filteredData = MOCK_RUNDOWNS.filter((row) => {
    if (!searchQuery) return true;
    return (
      row.title.toLowerCase().includes(searchQuery) ||
      row.startTime.toLowerCase().includes(searchQuery) ||
      row.endTime.toLowerCase().includes(searchQuery) ||
      row.status.toLowerCase().includes(searchQuery)
    );
  });

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="text-lg font-bold text-zinc-900">
              {programName} Program Rundowns
            </h1>
            <p className="text-sm text-zinc-500">
              Manage schedule blocks and timing for this program.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ProgramRundownsTable data={filteredData} currentSearch={searchQuery} />
      </section>
    </main>
  );
}
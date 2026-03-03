import { TimelinesTable, type TimelineRow } from "@/app/components/timelinesMasterData/TimelinesTable";

// --- UTILITY ---
function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

// --- MOCK DATA ---
const MOCK_TIMELINES: TimelineRow[] = [
  {
    id: 1,
    name: "Registration Period",
    order: 1,
    startDate: "Nov 19, 2025 12:01 AM",
    endDate: "Feb 10, 2026 11:59 PM",
    startDateIso: "2025-11-19T00:01",
    endDateIso: "2026-02-10T23:59",
    description: "Main registration period for participants.",
    status: "Active",
  },
  {
    id: 2,
    name: "Document Verification",
    order: 2,
    startDate: "Feb 11, 2026 12:01 AM",
    endDate: "Feb 20, 2026 11:59 PM",
    startDateIso: "2026-02-11T00:01",
    endDateIso: "2026-02-20T23:59",
    description: "Verification of submitted documents.",
    status: "Inactive",
  },
  {
    id: 3,
    name: "Interview Period",
    order: 3,
    startDate: "Mar 01, 2026 09:00 AM",
    endDate: "Mar 10, 2026 05:00 PM",
    startDateIso: "2026-03-01T09:00",
    endDateIso: "2026-03-10T17:00",
    description: "Online or onsite interview sessions.",
    status: "Inactive",
  },
];

export default async function ProgramTimelinesPage({
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

  const filteredData = MOCK_TIMELINES.filter((row) => {
    if (!searchQuery) return true;
    return (
      row.name.toLowerCase().includes(searchQuery) ||
      row.startDate.toLowerCase().includes(searchQuery) ||
      row.endDate.toLowerCase().includes(searchQuery)
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
          <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Timelines</h1>
          <p className="text-sm text-zinc-500">
            Manage key dates and milestones for this program.
          </p>
        </div>
      </div>
    </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <TimelinesTable data={filteredData} currentSearch={searchQuery} />
      </section>
    </main>
  );
}
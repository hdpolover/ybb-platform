import { ProgramTestimoniesTable, type ProgramTestimonyRow } from "@/app/components/programTestimoniesMasterData/ProgramTestimoniesTable";

// --- UTILITY ---
function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

// --- MOCK DATA  ---
const MOCK_TESTIMONIES: ProgramTestimonyRow[] = [
  {
    id: 1,
    name: "Aisyah Putri Fadhilah",
    role: "Delegate - Japan Youth Summit 2025",
    country: "Indonesia",
    photoUrl: undefined,
    testimony: "Participating in Japan Youth Summit helped me grow my global network and confidence to lead social projects back home.",
  },
  {
    id: 2,
    name: "Michael Tan",
    role: "Alumnus - Turkey Youth Summit 2024",
    country: "Singapore",
    photoUrl: undefined,
    testimony: "The program gave me real exposure to international collaboration and cross-cultural teamwork.",
  },
];

export default async function ProgramTestimoniesPage({
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

  const filteredData = MOCK_TESTIMONIES.filter((row) => {
    if (!searchQuery) return true;
    return (
      row.name.toLowerCase().includes(searchQuery) ||
      row.role.toLowerCase().includes(searchQuery) ||
      row.country.toLowerCase().includes(searchQuery) ||
      row.testimony.toLowerCase().includes(searchQuery)
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
              {programName} Program Testimonies
            </h1>
            <p className="text-sm text-zinc-500">
              Manage testimonial content shown on the program landing pages.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ProgramTestimoniesTable data={filteredData} currentSearch={searchQuery} />
      </section>
    </main>
  );
}
import { VideoTestimonialsTable, type VideoTestimonyRow } from "@/app/components/videoTestimonialsMasterData/VideoTestimonialsTable";

// --- UTILITY ---
function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

// --- MOCK DATA ---
const MOCK_VIDEO_TESTIMONIALS: VideoTestimonyRow[] = [
  {
    id: 1,
    thumbnailUrl: "/img/mock/video-thumb-1.jpg",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    description: "A short highlight video from delegates sharing their experience at Japan Youth Summit.",
    status: "active",
  },
  {
    id: 2,
    thumbnailUrl: "/img/mock/video-thumb-2.jpg",
    youtubeUrl: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
    description: "Alumni stories on how the program helped them build an international network.",
    status: "inactive",
  },
];

export default async function VideoTestimonialsPage({
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

  const filteredData = MOCK_VIDEO_TESTIMONIALS.filter((row) => {
    if (!searchQuery) return true;
    return (
      row.youtubeUrl.toLowerCase().includes(searchQuery) ||
      row.description.toLowerCase().includes(searchQuery) ||
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
              {programName} Video Testimonials
            </h1>
            <p className="text-sm text-zinc-500">
              Manage video testimonial content shown on the program landing pages.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <VideoTestimonialsTable data={filteredData} currentSearch={searchQuery} />
      </section>
    </main>
  );
}

// TODO: Nanti implement halaman Video Testimonials lengkap ngikutin pattern halaman program-testimonies

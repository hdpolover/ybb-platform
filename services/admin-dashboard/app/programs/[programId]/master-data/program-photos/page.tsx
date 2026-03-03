import { ProgramPhotosGallery, type ProgramPhoto } from "@/app/components/programPhotosMasterData/ProgramPhotosGallery";

// --- UTILITY ---
function formatProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const cleaned = programId.replace(/[-_]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "Selected Program";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

// --- MOCK DATA ---
const MOCK_PHOTOS: ProgramPhoto[] = [
  {
    id: 1,
    title: "Opening Plenary - Global Youth Leaders",
    year: "2025",
    imageUrl: "/img/mock/program-photo-1.jpg",
    description: "A global gathering of young leaders, innovators, and change-makers, focused on fostering cross-cultural collaboration.",
  },
  {
    id: 2,
    title: "Collaborative Sharing Session",
    year: "2025",
    imageUrl: "/img/mock/program-photo-2.jpg",
    description: "A collaborative session where delegates shared their experiences, insights, and ideas, fostering mutual learning.",
  },
  {
    id: 3,
    title: "Delegates Group Photo",
    year: "2025",
    imageUrl: "/img/mock/program-photo-3.jpg",
    description: "A special moment for delegates to capture memories and celebrate their participation in the summit.",
  },
  {
    id: 4,
    title: "Certificate Awarding Ceremony",
    year: "2025",
    imageUrl: "/img/mock/program-photo-4.jpg",
    description: "A formal ceremony where delegates were recognized and awarded certificates for their active participation.",
  },
];

export default async function ProgramPhotosPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const resolvedParams = await params;
  const programName = formatProgramName(resolvedParams.programId);

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="text-lg font-bold text-zinc-900">
              {programName} Program Photos
            </h1>
            <p className="text-sm text-zinc-500">
              Manage photo gallery content displayed on the program landing pages.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ProgramPhotosGallery data={MOCK_PHOTOS} />
      </section>
    </main>
  );
}

// TODO: Nanti diisi logic beneran buat Program Photos master data page

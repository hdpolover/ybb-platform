"use client";

import { use } from "react";
import { ProgramPhotosGallery } from "@/app/components/programPhotosMasterData/ProgramPhotosGallery";

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

export default function ProgramPhotosPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const programName = formatProgramName(programId);

  return (
    <main className="space-y-4 text-sm md:text-base">
      <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm md:text-base">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="text-base font-semibold text-zinc-900 md:text-lg">
              {programName} Program Photos
            </h1>
            <p className="text-xs text-zinc-500 md:text-sm">
              Manage photo gallery content displayed on the program landing pages.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700 shadow-sm md:text-base">
        <ProgramPhotosGallery />
      </section>
    </main>
  );
}

// TODO: Nanti diisi logic beneran buat Program Photos master data page

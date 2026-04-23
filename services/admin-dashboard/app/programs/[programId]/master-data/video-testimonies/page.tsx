"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  VideoTestimonialsTable,
  type VideoTestimonyRow,
} from "@/app/components/videoTestimonialsMasterData/VideoTestimonialsTable";
import { listProgramTestimonials } from "@/src/shared/api-client";

export default function VideoTestimonialsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const [items, setItems] = useState<VideoTestimonyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const program = accessiblePrograms.find((p) => p.programId === params.programId);
  const programName = program?.programName ?? "Selected Program";

  const load = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true);
    setError(null);
    try {
      const all = await listProgramTestimonials(params.programId);
      const videos = all
        .filter((t) => t.type === "video")
        .map((t) => ({
          id: t.id,
          name: t.name,
          youtubeUrl: t.videoUrl ?? "",
          description: t.testimonial,
          isActive: t.isActive ?? true,
        }));
      setItems(videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [params.programId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = search.trim()
    ? items.filter(
        (r) =>
          r.youtubeUrl.toLowerCase().includes(search.toLowerCase()) ||
          r.description.toLowerCase().includes(search.toLowerCase()) ||
          r.name.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

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
        {error && (
          <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        )}
        <VideoTestimonialsTable
          data={filtered}
          loading={loading}
          programId={params.programId}
          search={search}
          onSearchChange={setSearch}
          onRefresh={load}
        />
      </section>
    </main>
  );
}


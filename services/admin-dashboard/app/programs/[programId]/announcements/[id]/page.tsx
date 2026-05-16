"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  getProgramAnnouncement,
  type ProgramAnnouncement,
} from "@/src/shared/api-client";
import { formatDateTime } from "@/lib/utils";
import { formatAnnouncementLabel } from "../_components/program-announcement-utils";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div className="text-[11px] text-zinc-700">{children}</div>
    </div>
  );
}

export default function ProgramAnnouncementDetailPage() {
  const params = useParams<{ programId: string; id: string }>();
  const { accessiblePrograms } = useAuth();

  const [data, setData] = useState<ProgramAnnouncement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const program = useMemo(
    () => accessiblePrograms.find((item) => item.programId === params.programId),
    [accessiblePrograms, params.programId],
  );

  useEffect(() => {
    if (!params.id) return;

    getProgramAnnouncement(params.id)
      .then((announcement) => {
        if (announcement.programId !== params.programId) {
          throw new Error("This announcement does not belong to the selected program.");
        }
        setData(announcement);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Failed to load announcement.");
      });
  }, [params.id, params.programId]);

  if (!data && !loadError) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  const announcement = data!;

  return (
    <div className="-mx-4 -my-6 flex flex-col sm:-mx-6 lg:-mx-8">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3 shadow-sm">
        <Link
          href={`/programs/${params.programId}/announcements`}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back
        </Link>

        <div>
          <h1 className="max-w-sm truncate text-sm font-semibold text-zinc-900">
            {announcement.title}
          </h1>
          <p className="text-[11px] text-zinc-500">{program?.programName ?? "Selected Program"}</p>
        </div>

        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            announcement.isActive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {announcement.isActive ? "Active" : "Hidden"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/programs/${params.programId}/announcements/${announcement.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-64px-53px)] flex-col lg:flex-row">
        <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
          {announcement.imageUrl && (
            <img
              src={announcement.imageUrl}
              alt=""
              className="mb-6 max-h-72 w-full rounded-xl border border-zinc-200 object-cover shadow-sm"
            />
          )}

          <h2 className="mb-3 text-2xl font-bold text-zinc-900">{announcement.title}</h2>

          <div
            className="prose prose-sm max-w-none text-zinc-800"
            dangerouslySetInnerHTML={{ __html: announcement.content }}
          />
        </main>

        <aside className="w-full shrink-0 space-y-4 overflow-y-auto border-t border-zinc-200 bg-zinc-50/50 px-5 py-5 lg:w-72 lg:border-l lg:border-t-0">
          <Field label="Category">
            {formatAnnouncementLabel(announcement.category) || "General"}
          </Field>

          <Field label="Target Audience">
            {formatAnnouncementLabel(announcement.targetAudience)}
          </Field>

          <Field label="Status">
            {announcement.isActive ? "Visible" : "Hidden"}
          </Field>

          <Field label="Pinned">
            {announcement.isPinned ? "Yes" : "No"}
          </Field>

          <Field label="Send Email">
            {announcement.sendEmail ? "Yes" : "No"}
          </Field>

          <Field label="Tags">
            {(announcement.tags ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {announcement.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              "—"
            )}
          </Field>

          <div className="border-t border-zinc-200" />

          <Field label="Created">
            {formatDateTime(announcement.createdAt)}
          </Field>

          <Field label="Last Updated">
            {formatDateTime(announcement.updatedAt)}
          </Field>
        </aside>
      </div>
    </div>
  );
}

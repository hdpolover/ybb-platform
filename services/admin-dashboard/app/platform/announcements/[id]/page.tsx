"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  GlobeAltIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  getSystemAnnouncementAdmin,
  publishSystemAnnouncement,
  type SystemAnnouncement,
} from "@/src/shared/api-client";
import { formatDate, formatDateTime } from "@/lib/utils";

const TYPE_BADGE: Record<string, string> = {
  general: "bg-zinc-100 text-zinc-700",
  maintenance: "bg-yellow-50 text-yellow-700",
  deadline: "bg-red-50 text-red-700",
  feature: "bg-blue-50 text-blue-700",
  alert: "bg-orange-50 text-orange-700",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-500",
  normal: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="text-[11px] text-zinc-700">{children}</div>
    </div>
  );
}

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SystemAnnouncement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSystemAnnouncementAdmin(id)
      .then(setData)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load"));
  }, [id]);

  async function handleTogglePublish() {
    if (!data) return;
    setPublishing(true);
    try {
      const updated = await publishSystemAnnouncement(data.id, !data.isPublished);
      setData(updated);
      toast.success(updated.isPublished ? "Published!" : "Unpublished.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setPublishing(false);
    }
  }

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

  const ann = data!;
  const isPublished = ann.isPublished;
  const imageUrl = ann.metadata?.imageUrl as string | undefined;
  const author = ann.metadata?.author as string | undefined;

  return (
    <div className="-mx-4 -my-6 flex flex-col sm:-mx-6 lg:-mx-8">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3 shadow-sm">
        <Link
          href="/platform/announcements"
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back
        </Link>

        <h1 className="max-w-sm truncate text-sm font-semibold text-zinc-900">{ann.title}</h1>

        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isPublished ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {isPublished ? "Published" : "Draft"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={publishing}
            onClick={handleTogglePublish}
            className={[
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium disabled:opacity-60",
              isPublished
                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
            ].join(" ")}
          >
            {isPublished ? (
              <EyeSlashIcon className="h-3.5 w-3.5" />
            ) : (
              <GlobeAltIcon className="h-3.5 w-3.5" />
            )}
            {publishing ? "Updating…" : isPublished ? "Unpublish" : "Publish"}
          </button>
          <Link
            href={`/platform/announcements/${ann.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-[calc(100vh-64px-53px)] flex-col lg:flex-row">
        {/* Content area */}
        <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="mb-6 max-h-64 w-full rounded-xl border border-zinc-200 object-cover shadow-sm"
            />
          )}

          <h2 className="mb-2 text-2xl font-bold text-zinc-900">{ann.title}</h2>

          {author && (
            <p className="mb-6 text-[11px] text-zinc-400">By {author}</p>
          )}

          {ann.summary && (
            <p className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm italic text-zinc-600">
              {ann.summary}
            </p>
          )}

          <div
            className="prose prose-sm max-w-none text-zinc-800"
            dangerouslySetInnerHTML={{ __html: ann.content }}
          />

          {ann.actionUrl && ann.actionLabel && (
            <div className="mt-8">
              <a
                href={ann.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
              >
                {ann.actionLabel}
              </a>
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="w-full shrink-0 space-y-4 overflow-y-auto border-t border-zinc-200 bg-zinc-50/50 px-5 py-5 lg:w-64 lg:border-l lg:border-t-0">
          <Field label="Type">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_BADGE[ann.type] ?? "bg-zinc-100 text-zinc-600"}`}>
              {ann.type}
            </span>
          </Field>

          <Field label="Priority">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_BADGE[ann.priority] ?? "bg-zinc-100 text-zinc-600"}`}>
              {ann.priority}
            </span>
          </Field>

          <Field label="Target Audience">
            {ann.targetAudience ?? "all"}
          </Field>

          <div className="border-t border-zinc-200" />

          <Field label="Status">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
              {isPublished ? "Published" : "Draft"}
            </span>
          </Field>

          {ann.publishedAt && (
            <Field label="Published At">
              {formatDateTime(ann.publishedAt)}
            </Field>
          )}

          {(ann.startDate || ann.endDate) && (
            <Field label="Display Window">
              {ann.startDate ? formatDate(ann.startDate) : "∞"}
              {" → "}
              {ann.endDate ? formatDate(ann.endDate) : "∞"}
            </Field>
          )}

          <div className="border-t border-zinc-200" />

          <Field label="Show Banner">
            {ann.showBanner ? "Yes" : "No"}
          </Field>

          <Field label="Dismissible">
            {ann.isDismissible ? "Yes" : "No"}
          </Field>

          <div className="border-t border-zinc-200" />

          <Field label="Created">
            {formatDateTime(ann.createdAt)}
          </Field>

          <Field label="Last Updated">
            {formatDateTime(ann.updatedAt)}
          </Field>
        </aside>
      </div>
    </div>
  );
}

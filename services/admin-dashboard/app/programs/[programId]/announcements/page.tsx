"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";
import { EmptyState } from "@/src/admin/empty-state";
import {
  deleteProgramAnnouncement,
  listProgramAnnouncements,
  type ProgramAnnouncement,
} from "@/src/shared/api-client";
import { formatDateTime } from "@/lib/utils";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  buildAnnouncementExcerpt,
  formatAnnouncementLabel,
  getProgramAnnouncementStatus,
  getProgramAnnouncementStatusClasses,
  getProgramAnnouncementStatusLabel,
} from "./_components/program-announcement-utils";

export default function ProgramAnnouncementsPage() {
  const params = useParams<{ programId: string }>();
  const router = useRouter();
  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useResolvedProgramId(params.programId);

  const [items, setItems] = useState<ProgramAnnouncement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramAnnouncement | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const limit = 20;
  const program = useMemo(
    () =>
      accessiblePrograms.find(
        (item) => item.programId === params.programId || item.programSlug === params.programId,
      ),
    [accessiblePrograms, params.programId],
  );
  const programName = program?.programName ?? "Selected Program";

  const load = useCallback(async () => {
    if (!resolvedProgramId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await listProgramAnnouncements(resolvedProgramId, { page, limit });
      setItems(response.data ?? []);
      setTotal(response.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, [page, resolvedProgramId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    try {
      await deleteProgramAnnouncement(deleteTarget.id);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete announcement.");
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Program Content
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Announcements</h1>
        <p className="text-sm text-zinc-500">
          Publish program updates to the public announcements page and participant dashboard feeds
          with one-off media and attachment uploads directly from the editor.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">{total} announcement(s)</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Refresh
            </button>
            <Link
              href={`/programs/${params.programId}/announcements/new`}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              New Announcement
            </Link>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        {!loading && items.length === 0 ? (
          <EmptyState
            title="No announcements yet"
            description="Create the first announcement for this program."
            action={{
              label: "Create announcement",
              onClick: () => router.push(`/programs/${params.programId}/announcements/new`),
            }}
          />
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-[11px]">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Audience</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Updated</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                      <td className="max-w-md px-3 py-2">
                        <Link
                          href={`/programs/${params.programId}/announcements/${item.id}`}
                          className="font-medium text-zinc-900 hover:text-blue-600 hover:underline"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-0.5 line-clamp-2 text-zinc-500">
                          {buildAnnouncementExcerpt(item.content) || "No preview available."}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.isPinned && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              Pinned
                            </span>
                          )}
                          {item.sendEmail && (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                              Email
                            </span>
                          )}
                          {(item.tags ?? []).slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-600">
                        {formatAnnouncementLabel(item.category) || "General"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">
                        {formatAnnouncementLabel(item.targetAudience)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getProgramAnnouncementStatusClasses(getProgramAnnouncementStatus(item))}`}
                          >
                            {getProgramAnnouncementStatusLabel(getProgramAnnouncementStatus(item))}
                          </span>
                          <p className="text-[10px] text-zinc-400">
                            Publish at {formatDateTime(item.publishDate)}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {formatDateTime(item.updatedAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/programs/${params.programId}/announcements/${item.id}/edit`}
                            className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"
                          >
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
            >
              Previous
            </button>
            <span className="text-[11px] text-zinc-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete announcement?</h2>
            <p className="text-[11px] text-zinc-600">
              Remove <span className="font-semibold">{deleteTarget.title}</span>? This cannot be
              undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleteLoading}
                className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

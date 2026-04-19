"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import {
  listSystemAnnouncements,
  deleteSystemAnnouncement,
  publishSystemAnnouncement,
  type SystemAnnouncement,
} from "@/src/shared/api-client";

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-600",
  normal: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
};

const TYPE_BADGE: Record<string, string> = {
  general: "bg-zinc-100 text-zinc-700",
  maintenance: "bg-yellow-50 text-yellow-700",
  deadline: "bg-red-50 text-red-700",
  feature: "bg-blue-50 text-blue-700",
  alert: "bg-orange-50 text-orange-700",
};

export default function SystemAnnouncementsPage() {
  const [items, setItems] = useState<SystemAnnouncement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemAnnouncement | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState<string | null>(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSystemAnnouncements({ page, limit });
      setItems(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteSystemAnnouncement(deleteTarget.id);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleTogglePublish(item: SystemAnnouncement) {
    setPublishLoading(item.id);
    try {
      await publishSystemAnnouncement(item.id, !item.isPublished);
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update publish status");
    } finally {
      setPublishLoading(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Platform Content
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">System Announcements</h1>
        <p className="text-sm text-zinc-500">
          Manage public-facing announcements displayed on the announcements page for all program participants.
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
              href="/platform/announcements/new"
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

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Priority</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Published At</th>
                <th className="px-3 py-2 font-semibold">Dates</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-400">
                    No announcements yet. Create one to get started.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((a, idx) => (
                  <tr key={a.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                    <td className="max-w-xs truncate px-3 py-2 font-medium text-zinc-900">
                      {a.title}
                      {a.showBanner && (
                        <span className="ml-1.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700">
                          BANNER
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          (TYPE_BADGE[a.type] ?? "bg-zinc-100 text-zinc-600")
                        }
                      >
                        {a.type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          (PRIORITY_BADGE[a.priority] ?? "bg-zinc-100 text-zinc-600")
                        }
                      >
                        {a.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {a.isPublished ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {a.startDate || a.endDate ? (
                        <span>
                          {a.startDate ? new Date(a.startDate).toLocaleDateString() : "∞"}
                          {" → "}
                          {a.endDate ? new Date(a.endDate).toLocaleDateString() : "∞"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title={a.isPublished ? "Unpublish" : "Publish"}
                          disabled={publishLoading === a.id}
                          onClick={() => handleTogglePublish(a)}
                          className={
                            "rounded-md border p-1 " +
                            (a.isPublished
                              ? "border-amber-100 text-amber-500 hover:bg-amber-50"
                              : "border-emerald-100 text-emerald-500 hover:bg-emerald-50")
                          }
                        >
                          {a.isPublished ? (
                            <EyeSlashIcon className="h-3.5 w-3.5" />
                          ) : (
                            <GlobeAltIcon className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <Link
                          href={`/platform/announcements/${a.id}/edit`}
                          className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(a)}
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

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
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
              onClick={() => setPage((p) => p + 1)}
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
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete Announcement?</h2>
            <p className="text-[11px] text-zinc-600">
              Remove{" "}
              <span className="font-semibold">{deleteTarget.title}</span>? This cannot be
              undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
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


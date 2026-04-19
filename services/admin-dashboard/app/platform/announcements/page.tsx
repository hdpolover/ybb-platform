"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import {
  listSystemAnnouncements,
  createSystemAnnouncement,
  updateSystemAnnouncement,
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
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<SystemAnnouncement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemAnnouncement | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState<string | null>(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSystemAnnouncements({ page, limit });
      setItems(res.data);
      setTotal(res.meta.total);
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
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              New Announcement
            </button>
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
                        <button
                          type="button"
                          onClick={() => setEditTarget(a)}
                          className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                        </button>
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

      {showCreate && (
        <AnnouncementModal onClose={() => setShowCreate(false)} onSaved={load} />
      )}
      {editTarget && (
        <AnnouncementModal
          item={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={load}
        />
      )}
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

function AnnouncementModal({
  item,
  onClose,
  onSaved,
}: {
  item?: SystemAnnouncement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [summary, setSummary] = useState(item?.summary ?? "");
  const [type, setType] = useState(item?.type ?? "general");
  const [priority, setPriority] = useState(item?.priority ?? "normal");
  const [targetAudience, setTargetAudience] = useState(item?.targetAudience ?? "all");
  const [isPublished, setIsPublished] = useState(item?.isPublished ?? false);
  const [showBanner, setShowBanner] = useState(item?.showBanner ?? false);
  const [isDismissible, setIsDismissible] = useState(item?.isDismissible ?? true);
  const [actionUrl, setActionUrl] = useState(item?.actionUrl ?? "");
  const [actionLabel, setActionLabel] = useState(item?.actionLabel ?? "");
  const [startDate, setStartDate] = useState(
    item?.startDate ? item.startDate.slice(0, 10) : "",
  );
  const [endDate, setEndDate] = useState(
    item?.endDate ? item.endDate.slice(0, 10) : "",
  );
  const [imageUrl, setImageUrl] = useState(
    (item?.metadata?.imageUrl as string) ?? "",
  );
  const [author, setAuthor] = useState(
    (item?.metadata?.author as string) ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      title,
      content,
      summary: summary || undefined,
      type,
      priority,
      targetAudience,
      isPublished,
      showBanner,
      isDismissible,
      actionUrl: actionUrl || undefined,
      actionLabel: actionLabel || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      metadata: {
        ...(item?.metadata ?? {}),
        imageUrl: imageUrl || undefined,
        author: author || undefined,
      },
    };

    try {
      if (item) {
        await updateSystemAnnouncement(item.id, payload);
      } else {
        await createSystemAnnouncement(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 py-8">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            {item ? "Edit Announcement" : "New Announcement"}
          </h2>
          <button onClick={onClose}>
            <XMarkIcon className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Title<span className="ml-0.5 text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Content<span className="ml-0.5 text-red-500">*</span>
            </label>
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Summary / Excerpt
              <span className="ml-1 text-zinc-400">(shown on listing page)</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={inputCls}
              >
                <option value="general">General</option>
                <option value="maintenance">Maintenance</option>
                <option value="deadline">Deadline</option>
                <option value="feature">Feature</option>
                <option value="alert">Alert</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputCls}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Target Audience
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className={inputCls}
              >
                <option value="all">All</option>
                <option value="participants">Participants</option>
                <option value="ambassadors">Ambassadors</option>
                <option value="specific_program">Specific Program</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Image URL
                <span className="ml-1 text-zinc-400">(shown on listing)</span>
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Author</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="YBB Team"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                CTA Label
              </label>
              <input
                type="text"
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                placeholder="Read More"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">CTA URL</label>
              <input
                type="url"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <div className="flex items-center gap-2">
              <input
                id="published"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <label htmlFor="published" className="text-[11px] font-medium text-zinc-700">
                Published
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="banner"
                type="checkbox"
                checked={showBanner}
                onChange={(e) => setShowBanner(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <label htmlFor="banner" className="text-[11px] font-medium text-zinc-700">
                Show Banner
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="dismissible"
                type="checkbox"
                checked={isDismissible}
                onChange={(e) => setIsDismissible(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <label htmlFor="dismissible" className="text-[11px] font-medium text-zinc-700">
                Dismissible
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Saving…" : item ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

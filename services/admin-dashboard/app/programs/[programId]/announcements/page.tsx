"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  listProgramAnnouncements,
  createProgramAnnouncement,
  updateProgramAnnouncement,
  deleteProgramAnnouncement,
  type ProgramAnnouncement,
} from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";

const PRIORITY_BADGE: Record<string, string> = {
  LOW: "bg-zinc-100 text-zinc-600",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-red-50 text-red-700",
};

export default function AnnouncementsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const [items, setItems] = useState<ProgramAnnouncement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramAnnouncement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramAnnouncement | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const limit = 20;

  const programName = accessiblePrograms.find((p) => p.programId === params.programId)?.programName ?? "Selected Program";

  const fetch = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true); setError(null);
    try {
      const res = await listProgramAnnouncements(params.programId, { page, limit });
      setItems(res.data ?? []); setTotal(res.meta?.total ?? 0);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [params.programId, page]);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try { await deleteProgramAnnouncement(deleteTarget.id); setDeleteTarget(null); fetch(); }
    catch (err) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleteLoading(false); }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Announcements</div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Announcements</h1>
        <p className="text-sm text-zinc-500">Manage important program-wide announcements such as reminders, schedule updates, and logistics.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">{total} announcement(s)</p>
          <div className="flex gap-2">
            <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />New Announcement</button>
          </div>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Priority</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Created</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">Loading…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">No announcements yet.</td></tr>}
              {!loading && items.map((a, idx) => (
                <tr key={a.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2 font-medium text-zinc-900 max-w-xs truncate">{a.title}</td>
                  <td className="px-3 py-2 text-zinc-600">{a.type}</td>
                  <td className="px-3 py-2"><span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (PRIORITY_BADGE[a.priority] ?? "bg-zinc-100 text-zinc-600")}>{a.priority}</span></td>
                  <td className="px-3 py-2">{a.isActive ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span> : <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">Inactive</span>}</td>
                  <td className="px-3 py-2 text-zinc-500">{formatDate(a.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setEditTarget(a)} className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"><PencilSquareIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setDeleteTarget(a)} className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50">Previous</button>
            <span className="text-[11px] text-zinc-600">Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50">Next</button>
          </div>
        )}
      </section>

      {showCreate && <AnnouncementModal programId={params.programId} onClose={() => setShowCreate(false)} onSaved={fetch} />}
      {editTarget && <AnnouncementModal programId={params.programId} item={editTarget} onClose={() => setEditTarget(null)} onSaved={fetch} />}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete?</h2>
            <p className="text-[11px] text-zinc-600">Remove <span className="font-semibold">{deleteTarget.title}</span>? This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">{deleteLoading ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function AnnouncementModal({ programId, item, onClose, onSaved }: { programId: string; item?: ProgramAnnouncement; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [type, setType] = useState(item?.type ?? "general");
  const [priority, setPriority] = useState(item?.priority ?? "MEDIUM");
  const [target, setTarget] = useState(item?.target ?? "ALL");
  const [showBanner, setShowBanner] = useState(item?.showBanner ?? false);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      if (item) { await updateProgramAnnouncement(item.id, { title, content, type, priority, target, showBanner, isActive }); }
      else { await createProgramAnnouncement(programId, { title, content, type, priority, target, showBanner }); }
      onSaved(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  }

  const inputCls = "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">{item ? "Edit Announcement" : "New Announcement"}</h2>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-zinc-400" /></button>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="mb-1 block text-[11px] font-medium text-zinc-700">Title<span className="ml-0.5 text-red-500">*</span></label><input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></div>
          <div><label className="mb-1 block text-[11px] font-medium text-zinc-700">Content<span className="ml-0.5 text-red-500">*</span></label><textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={4} className={inputCls} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="mb-1 block text-[11px] font-medium text-zinc-700">Type</label><select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}><option value="general">General</option><option value="reminder">Reminder</option><option value="update">Update</option><option value="alert">Alert</option></select></div>
            <div><label className="mb-1 block text-[11px] font-medium text-zinc-700">Priority</label><select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></div>
            <div><label className="mb-1 block text-[11px] font-medium text-zinc-700">Target</label><select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}><option>ALL</option><option>PARTICIPANTS</option><option>APPLICANTS</option></select></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><input id="banner" type="checkbox" checked={showBanner} onChange={(e) => setShowBanner(e.target.checked)} className="h-3.5 w-3.5" /><label htmlFor="banner" className="text-[11px] font-medium text-zinc-700">Show Banner</label></div>
            {item && <div className="flex items-center gap-2"><input id="active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-3.5 w-3.5" /><label htmlFor="active" className="text-[11px] font-medium text-zinc-700">Active</label></div>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">{loading ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

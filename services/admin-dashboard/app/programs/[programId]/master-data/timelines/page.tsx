"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { PlusIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { formatDate } from "@/lib/utils";
import {
  listProgramTimeline,
  createProgramTimelineItem,
  updateProgramTimelineItem,
  deleteProgramTimelineItem,
  type ProgramTimeline,
} from "@/src/shared/api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/src/ui/sheet";
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";

export default function TimelinesPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useResolvedProgramId(params.programId);
  const [items, setItems] = useState<ProgramTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"date-asc" | "date-desc" | "title-asc" | "title-desc">("date-asc");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramTimeline | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramTimeline | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
  const [copyFromTemplateOpen, setCopyFromTemplateOpen] = useState(false);

  const programName = accessiblePrograms.find((p) => p.programId === params.programId)?.programName ?? "Selected Program";

  const fetch = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true); setError(null);
    try { setItems(await listProgramTimeline(resolvedProgramId)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [resolvedProgramId]);

  useEffect(() => { fetch(); }, [fetch]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        const matchesSearch = !normalizedSearch || [item.title, item.description ?? "", item.type ?? ""].join(" ").toLowerCase().includes(normalizedSearch);
        const matchesDate = !dateFilter || item.date.slice(0, 10) === dateFilter || item.endDate?.slice(0, 10) === dateFilter;
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? item.isActive : !item.isActive);
        return matchesSearch && matchesDate && matchesStatus;
      })
      .sort((left, right) => compareTimelineItems(left, right, sortBy));
  }, [items, searchTerm, dateFilter, statusFilter, sortBy]);

  function resetFilters() {
    setSearchTerm("");
    setDateFilter("");
    setStatusFilter("all");
    setSortBy("date-asc");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteProgramTimelineItem(deleteTarget.id);
      toast.success("Timeline item deleted.");
      setDeleteTarget(null);
      fetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally { setDeleteLoading(false); }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Master Data</div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Timelines</h1>
        <p className="text-sm text-zinc-500">Manage important dates and milestones for this program.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">Showing {filteredItems.length} of {items.length} timeline item(s)</p>
          <div className="flex gap-2">
            <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button
              type="button"
              onClick={() => setCopyFromProgramOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from program</span>
            </button>
            <button
              type="button"
              onClick={() => setCopyFromTemplateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from template</span>
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add</button>
          </div>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search title, description, or type..." className={`${inputCls} pl-8`} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Date</label>
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={inputCls}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={inputCls}>
                <option value="date-asc">Date: earliest first</option>
                <option value="date-desc">Date: latest first</option>
                <option value="title-asc">Title: A-Z</option>
                <option value="title-desc">Title: Z-A</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={resetFilters} className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50">Reset filters</button>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Order</th>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Start Date</th>
                <th className="px-3 py-2 font-semibold">End Date</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">Loading…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">No timeline items yet.</td></tr>}
              {!loading && items.length > 0 && filteredItems.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">No timeline items match the current filters.</td></tr>}
              {!loading && filteredItems.map((t, idx) => (
                <tr key={t.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2 text-zinc-500">{t.order}</td>
                  <td className="px-3 py-2 font-medium text-zinc-900">{t.title}</td>
                  <td className="px-3 py-2 text-zinc-600">{formatDate(t.date)}</td>
                  <td className="px-3 py-2 text-zinc-600">{formatDate(t.endDate)}</td>
                  <td className="px-3 py-2 text-zinc-600">{t.type}</td>
                  <td className="px-3 py-2">{t.isActive ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span> : <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">Inactive</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setEditTarget(t)} className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"><PencilSquareIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setDeleteTarget(t)} className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <TimelineSheet
        open={showCreate || editTarget !== null}
        programId={resolvedProgramId}
        item={editTarget ?? undefined}
        items={items}
        onClose={() => { setShowCreate(false); setEditTarget(null); }}
        onSaved={fetch}
      />

      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="timelines"
        entityLabel="Timelines"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
          fetch();
        }}
      />

      <CopyFromTemplateDialog
        open={copyFromTemplateOpen}
        entityKey="timelines"
        entityLabel="Timelines"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromTemplateOpen(false)}
        onApplied={() => {
          setCopyFromTemplateOpen(false);
          fetch();
        }}
      />

      {deleteTarget && <ConfirmDelete name={deleteTarget.title} loading={deleteLoading} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
    </main>
  );
}

function TimelineSheet({
  open,
  programId,
  item,
  items,
  onClose,
  onSaved,
}: {
  open: boolean;
  programId: string;
  item?: ProgramTimeline;
  items: ProgramTimeline[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.order)) + 1 : 0;

  const [title, setTitle] = useState(item?.title ?? "");
  const [date, setDate] = useState(item?.date ? item.date.split("T")[0] : "");
  const [endDate, setEndDate] = useState(item?.endDate ? item.endDate.split("T")[0] : "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [order, setOrder] = useState<number>(item?.order ?? nextOrder);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(item?.title ?? "");
      setDate(item?.date ? item.date.split("T")[0] : "");
      setEndDate(item?.endDate ? item.endDate.split("T")[0] : "");
      setDescription(item?.description ?? "");
      setIsActive(item?.isActive ?? true);
      setOrder(item?.order ?? nextOrder);
      setError(null);
    }
  // nextOrder is derived from items length, intentionally not in deps to avoid
  // resetting a user-typed value when items list changes mid-open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      if (item) {
        await updateProgramTimelineItem(item.id, { title, date, endDate: endDate || undefined, description, isActive, order });
        toast.success("Timeline item updated.");
      } else {
        await createProgramTimelineItem(programId, { title, date, endDate: endDate || undefined, description, order });
        toast.success("Timeline item created.");
      }
      onSaved(); onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col p-0 sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-zinc-200 px-6 py-5">
            <SheetTitle>{item ? "Edit Timeline Item" : "Add Timeline Item"}</SheetTitle>
            <SheetDescription>
              {item ? "Update this timeline milestone or event." : "Add a new date or milestone to the program timeline."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <Field label="Order Number">
              <input
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
                className={inputCls}
              />
            </Field>
            <Field label="Title" required>
              <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Start Date" required>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="End Date">
              <input type="date" value={endDate} min={date || undefined} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium text-zinc-700">Active</span>
            </label>
          </div>

          <SheetFooter className="border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
            >
              {loading ? "Saving…" : item ? "Save Changes" : "Create Item"}
            </button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ConfirmDelete({ name, loading, onCancel, onConfirm }: { name: string; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Delete?</h2>
        <p className="text-[11px] text-zinc-600">Remove <span className="font-semibold">{name}</span>? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="rounded-md bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">{loading ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-700">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>
      {children}
    </div>
  );
}

const inputCls = "block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function compareTimelineItems(
  left: ProgramTimeline,
  right: ProgramTimeline,
  sortBy: "date-asc" | "date-desc" | "title-asc" | "title-desc",
): number {
  if (sortBy === "title-asc") return left.title.localeCompare(right.title);
  if (sortBy === "title-desc") return right.title.localeCompare(left.title);
  const leftDate = new Date(left.date).getTime();
  const rightDate = new Date(right.date).getTime();
  if (sortBy === "date-desc") return rightDate - leftDate || left.title.localeCompare(right.title);
  return leftDate - rightDate || left.title.localeCompare(right.title);
}

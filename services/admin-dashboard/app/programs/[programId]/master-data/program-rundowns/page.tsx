"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { PlusIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  listProgramSchedules,
  createProgramSchedule,
  updateProgramSchedule,
  deleteProgramSchedule,
  type ProgramSchedule,
} from "@/src/shared/api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/src/ui/sheet";

export default function ProgramRundownsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useResolvedProgramId(params.programId);
  const [items, setItems] = useState<ProgramSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "morning" | "afternoon" | "evening" | "unscheduled">("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date-asc" | "date-desc" | "time-asc" | "time-desc" | "activity-asc" | "activity-desc">("date-asc");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramSchedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramSchedule | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const programName = accessiblePrograms.find((p) => p.programId === params.programId)?.programName ?? "Selected Program";

  const fetch = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true); setError(null);
    try { setItems(await listProgramSchedules(resolvedProgramId)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [resolvedProgramId]);

  useEffect(() => { fetch(); }, [fetch]);

  const locationOptions = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((item) => (item.location ?? "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const next = items.filter((item) => {
      const matchesSearch = !normalizedSearch || [
        item.activity,
        item.description ?? "",
        item.location ?? "",
        formatDay(item.day),
        item.startTime ?? "",
        item.endTime ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);

      const matchesDate = !dateFilter || toDateInputValue(item.day) === dateFilter;
      const normalizedLocation = (item.location ?? "").trim();
      const matchesLocation = locationFilter === "all" || normalizedLocation === locationFilter;
      const matchesTime = timeFilter === "all" || matchTimeFilter(item.startTime, timeFilter);

      return matchesSearch && matchesDate && matchesLocation && matchesTime;
    });

    return next.sort((left, right) => compareSchedules(left, right, sortBy));
  }, [items, searchTerm, dateFilter, locationFilter, timeFilter, sortBy]);

  function resetFilters() {
    setSearchTerm("");
    setDateFilter("");
    setTimeFilter("all");
    setLocationFilter("all");
    setSortBy("date-asc");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteProgramSchedule(deleteTarget.id);
      toast.success("Session deleted.");
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
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Rundowns</h1>
        <p className="text-sm text-zinc-500">Manage the program schedule and rundown.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">
            Showing {filteredItems.length} of {items.length} session(s)
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add Session</button>
          </div>
        </div>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search activity, description, date, location..."
                  className="block w-full rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Time</label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All times</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="unscheduled">No time set</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Location</label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All locations</option>
                {locationOptions.map((location) => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="date-asc">Date: earliest first</option>
                <option value="date-desc">Date: latest first</option>
                <option value="time-asc">Time: earliest first</option>
                <option value="time-desc">Time: latest first</option>
                <option value="activity-asc">Activity: A-Z</option>
                <option value="activity-desc">Activity: Z-A</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              Reset filters
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Order</th>
                <th className="px-3 py-2 font-semibold">Session</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Time</th>
                <th className="px-3 py-2 font-semibold">Location</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">Loading…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">No sessions yet.</td></tr>}
              {!loading && items.length > 0 && filteredItems.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">No sessions match the current filters.</td></tr>}
              {!loading && filteredItems.map((s, idx) => (
                <tr key={s.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2 text-zinc-500">{s.order}</td>
                  <td className="px-3 py-2 font-medium text-zinc-900">{s.activity}</td>
                  <td className="px-3 py-2 text-zinc-600">{formatDay(s.day)}</td>
                  <td className="px-3 py-2 text-zinc-600">{s.startTime ? s.startTime + (s.endTime ? " – " + s.endTime : "") : "—"}</td>
                  <td className="px-3 py-2 text-zinc-600">{s.location ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setEditTarget(s)} className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"><PencilSquareIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setDeleteTarget(s)} className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ScheduleSheet
        open={showCreate || editTarget !== null}
        programId={resolvedProgramId}
        item={editTarget ?? undefined}
        items={items}
        onClose={() => { setShowCreate(false); setEditTarget(null); }}
        onSaved={fetch}
      />

      {deleteTarget && <ConfirmDelete name={deleteTarget.activity} loading={deleteLoading} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
    </main>
  );
}

function ScheduleSheet({
  open,
  programId,
  item,
  items,
  onClose,
  onSaved,
}: {
  open: boolean;
  programId: string;
  item?: ProgramSchedule;
  items: ProgramSchedule[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.order)) + 1 : 0;

  const [activity, setActivity] = useState(item?.activity ?? "");
  const [day, setDay] = useState(toDateInputValue(item?.day));
  const [startTime, setStartTime] = useState(item?.startTime ?? "");
  const [endTime, setEndTime] = useState(item?.endTime ?? "");
  const [location, setLocation] = useState(item?.location ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [order, setOrder] = useState<number>(item?.order ?? nextOrder);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setActivity(item?.activity ?? "");
      setDay(toDateInputValue(item?.day));
      setStartTime(item?.startTime ?? "");
      setEndTime(item?.endTime ?? "");
      setLocation(item?.location ?? "");
      setDescription(item?.description ?? "");
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
      const payload = {
        day,
        activity,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        location: location || undefined,
        description: description || undefined,
        order,
      };
      if (item) {
        await updateProgramSchedule(item.id, payload);
        toast.success("Session updated.");
      } else {
        await createProgramSchedule(programId, payload);
        toast.success("Session created.");
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
            <SheetTitle>{item ? "Edit Session" : "Add Session"}</SheetTitle>
            <SheetDescription>
              {item ? "Update this rundown session." : "Add a new session to the program rundown."}
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
            <Field label="Activity" required>
              <input required type="text" value={activity} onChange={(e) => setActivity(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Date" required>
              <input required type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time">
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
              </Field>
              <Field label="End Time">
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Location">
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
            </Field>
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
              {loading ? "Saving…" : item ? "Save Changes" : "Create Session"}
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

// `day` is stored as a free-form VARCHAR(100) on the backend. New entries use
// ISO YYYY-MM-DD, but legacy rows may contain "Day 1", "Monday", etc. — coerce
// to empty so the native date input doesn't throw on non-ISO values.
function toDateInputValue(day: string | null | undefined): string {
  if (!day) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

function formatDay(day: string | null | undefined): string {
  if (!day) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const d = new Date(day + "T00:00:00");
    if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  return day;
}

function parseDateRank(day: string | null | undefined): number {
  if (!day) return Number.MAX_SAFE_INTEGER;
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const parsed = new Date(`${day}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  const parsed = new Date(day);
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
}

function parseTimeRank(time: string | null | undefined): number {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

function matchTimeFilter(startTime: string | null | undefined, filter: "morning" | "afternoon" | "evening" | "unscheduled"): boolean {
  const timeRank = parseTimeRank(startTime);
  if (filter === "unscheduled") return timeRank === Number.MAX_SAFE_INTEGER;
  if (timeRank === Number.MAX_SAFE_INTEGER) return false;
  if (filter === "morning") return timeRank < 12 * 60;
  if (filter === "afternoon") return timeRank >= 12 * 60 && timeRank < 17 * 60;
  return timeRank >= 17 * 60;
}

function compareSchedules(
  left: ProgramSchedule,
  right: ProgramSchedule,
  sortBy: "date-asc" | "date-desc" | "time-asc" | "time-desc" | "activity-asc" | "activity-desc",
): number {
  if (sortBy === "activity-asc") {
    return left.activity.localeCompare(right.activity);
  }
  if (sortBy === "activity-desc") {
    return right.activity.localeCompare(left.activity);
  }

  const leftDate = parseDateRank(left.day);
  const rightDate = parseDateRank(right.day);
  const leftTime = parseTimeRank(left.startTime);
  const rightTime = parseTimeRank(right.startTime);

  if (sortBy === "date-asc") {
    return leftDate - rightDate || leftTime - rightTime || left.activity.localeCompare(right.activity);
  }
  if (sortBy === "date-desc") {
    return rightDate - leftDate || leftTime - rightTime || left.activity.localeCompare(right.activity);
  }
  if (sortBy === "time-asc") {
    return leftTime - rightTime || leftDate - rightDate || left.activity.localeCompare(right.activity);
  }
  return rightTime - leftTime || leftDate - rightDate || left.activity.localeCompare(right.activity);
}

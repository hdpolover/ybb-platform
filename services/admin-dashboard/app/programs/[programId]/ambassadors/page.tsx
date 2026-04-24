"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { ArrowPathIcon, MagnifyingGlassIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/solid";
import {
  listAmbassadors,
  createAmbassador,
  updateAmbassador,
  activateAmbassador,
  deactivateAmbassador,
  deleteAmbassador,
  type Ambassador,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";

export default function AmbassadorsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();

  const resolvedProgramId = useMemo(() => {
    const p = accessiblePrograms.find(
      (p) => p.programId === params.programId || p.programSlug === params.programId,
    );
    return p?.programId ?? params.programId;
  }, [accessiblePrograms, params.programId]);

  const [items, setItems] = useState<Ambassador[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, lastPage: 1 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Ambassador | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ambassador | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "", fullName: "", phoneNumber: "", institution: "", gender: "", notes: "",
  });

  const fetchData = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true); setError(null);
    try {
      const res = await listAmbassadors({ programId: resolvedProgramId, search: search || undefined, page, limit: 20 });
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditTarget(null);
    setForm({ email: "", fullName: "", phoneNumber: "", institution: "", gender: "", notes: "" });
    setFormError(null);
    setSheetOpen(true);
  }

  function openEdit(amb: Ambassador) {
    setEditTarget(amb);
    setForm({
      email: amb.user?.email ?? "",
      fullName: amb.fullName,
      phoneNumber: amb.phoneNumber ?? "",
      institution: amb.institution ?? "",
      gender: amb.gender ?? "",
      notes: amb.notes ?? "",
    });
    setFormError(null);
    setSheetOpen(true);
  }

  async function handleSave() {
    setSaving(true); setFormError(null);
    try {
      if (editTarget) {
        await updateAmbassador(editTarget.id, {
          fullName: form.fullName || undefined,
          phoneNumber: form.phoneNumber || undefined,
          institution: form.institution || undefined,
          gender: form.gender || undefined,
          notes: form.notes || undefined,
        });
      } else {
        await createAmbassador({
          email: form.email,
          fullName: form.fullName,
          programId: resolvedProgramId,
          phoneNumber: form.phoneNumber || undefined,
          institution: form.institution || undefined,
          gender: form.gender || undefined,
          notes: form.notes || undefined,
        });
      }
      setSheetOpen(false);
      fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(amb: Ambassador) {
    try {
      if (amb.isActive) await deactivateAmbassador(amb.id);
      else await activateAmbassador(amb.id);
      fetchData();
    } catch {}
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAmbassador(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch {}
  }

  const activeCount = items.filter(a => a.isActive).length;

  return (
    <main className="space-y-4">
      {/* Stats + controls */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Total Ambassadors</p>
              <p className="text-2xl font-bold text-zinc-900">{loading ? "—" : meta.total}</p>
            </div>
            <div className="h-10 w-px bg-zinc-100" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Active</p>
              <p className="text-2xl font-bold text-emerald-600">{loading ? "—" : activeCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name, code…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="block w-52 rounded-md border border-zinc-200 py-1.5 pl-8 pr-3 text-[11px] outline-none focus:border-blue-500"
              />
            </div>
            <button type="button" onClick={fetchData}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">
              <ArrowPathIcon className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700">
              <UserPlusIcon className="h-3.5 w-3.5" />
              Add Ambassador
            </button>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Ambassador</th>
                <th className="px-3 py-2 font-semibold">Referral Code</th>
                <th className="px-3 py-2 font-semibold">Referrals</th>
                <th className="px-3 py-2 font-semibold">Institution</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">Loading…</td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">No ambassadors found.</td></tr>
              )}
              {!loading && items.map((amb, idx) => (
                <tr key={amb.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-zinc-900">{amb.fullName}</p>
                    <p className="text-zinc-400">{amb.user?.email ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-700">{amb.referralCode}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{amb.totalReferrals}</span>
                      <span className="text-zinc-400">{amb.successfulReferrals} converted</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{amb.institution ?? "—"}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => handleToggleActive(amb)}
                      className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                        (amb.isActive ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200")}>
                      {amb.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openEdit(amb)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50">
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(amb)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta.lastPage > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50">Previous</button>
            <span className="text-[11px] text-zinc-600">Page {page} of {meta.lastPage}</span>
            <button type="button" disabled={page >= meta.lastPage} onClick={() => setPage(p => p + 1)}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50">Next</button>
          </div>
        )}
      </section>

      {/* Drawer sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="border-b border-zinc-200 px-6 py-4 shrink-0">
            <SheetTitle>{editTarget ? "Edit Ambassador" : "Add Ambassador"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}

            {!editTarget && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Email <span className="text-red-500">*</span></label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500" />
              </div>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Full Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Phone</label>
                <input type="tel" value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                  className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Gender</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500">
                  <option value="">— Select —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Institution</label>
              <input type="text" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500" />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Notes</label>
              <textarea rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 resize-none" />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 shrink-0">
            <button type="button" onClick={() => setSheetOpen(false)}
              className="rounded-md border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : editTarget ? "Save Changes" : "Create Ambassador"}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Ambassador"
        description={`Remove ${deleteTarget?.fullName} as an ambassador? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </main>
  );
}

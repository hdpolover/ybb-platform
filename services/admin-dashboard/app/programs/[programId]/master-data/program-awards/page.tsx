// services/admin-dashboard/app/programs/[programId]/master-data/program-awards/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { PlusIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { SearchX, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { deleteProgramAward, listProgramAwards, updateProgramAward, type ProgramAward } from "@/src/shared/api-client";
import { EmptyState } from "@/src/admin/empty-state";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { ProgramAwardsTable } from "@/app/components/programAwardsMasterData/ProgramAwardsTable";
import { AwardSheet } from "@/app/components/programAwardsMasterData/AwardSheet";
import { filterAwards, nextAwardOrder } from "@/app/components/programAwardsMasterData/award-form";

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export default function ProgramAwardsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const programId = useResolvedProgramId(params.programId);
  const [awards, setAwards] = useState<ProgramAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramAward | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramAward | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const programName =
    accessiblePrograms.find((p) => p.programId === programId)?.programName ?? "Selected Program";

  const load = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    setError(null);
    try { setAwards(await listProgramAwards(programId)); }
    catch (err) { setError(errorMessage(err, "Failed to load awards")); }
    finally { setLoading(false); }
  }, [programId]);

  useEffect(() => { load(); }, [load]);

  const visibleAwards = useMemo(() => filterAwards(awards, search), [awards, search]);

  async function handleToggleActive(award: ProgramAward) {
    setTogglingId(award.id);
    try {
      const updated = await updateProgramAward(programId, award.id, { isActive: !award.isActive });
      setAwards((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toast.success(updated.isActive ? "Award activated." : "Award deactivated.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update award"));
    } finally { setTogglingId(null); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProgramAward(programId, deleteTarget.id);
      toast.success("Award deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete award"));
    }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Master Data
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Program Awards</h1>
        <p className="text-sm text-zinc-500">Configure the awards presented in this program. Active awards show on the public landing page.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full max-w-xs">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, category, tier or description…"
              className="block w-full rounded-md border border-zinc-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add Award</button>
          </div>
        </div>

        {!loading && !error && awards.length > 0 && (
          <p className="mb-2 text-[11px] text-zinc-500">Showing {visibleAwards.length} of {awards.length} award(s)</p>
        )}

        {loading && <p className="py-10 text-center text-xs text-zinc-400">Loading awards…</p>}

        {!loading && error && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            <span>{error}</span>
            <button type="button" onClick={load} className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100">Retry</button>
          </div>
        )}

        {!loading && !error && awards.length === 0 && (
          <EmptyState
            icon={Trophy}
            title="No awards yet"
            description="Add the awards this program presents so they appear on the landing page."
            action={{ label: "Add Award", onClick: () => setShowCreate(true) }}
          />
        )}

        {!loading && !error && awards.length > 0 && visibleAwards.length === 0 && (
          <EmptyState icon={SearchX} title="No awards match your search" description="Try a different name, category or tier." />
        )}

        {!loading && !error && visibleAwards.length > 0 && (
          <ProgramAwardsTable
            awards={visibleAwards}
            togglingId={togglingId}
            onEdit={setEditTarget}
            onDelete={setDeleteTarget}
            onToggleActive={handleToggleActive}
          />
        )}
      </section>

      <AwardSheet
        open={showCreate || editTarget !== null}
        programId={programId}
        item={editTarget ?? undefined}
        nextOrder={nextAwardOrder(awards)}
        onClose={() => { setShowCreate(false); setEditTarget(null); }}
        onSaved={load}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete award?"
        description={deleteTarget ? `"${deleteTarget.name}" will be removed from this program and its landing page.` : undefined}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </main>
  );
}

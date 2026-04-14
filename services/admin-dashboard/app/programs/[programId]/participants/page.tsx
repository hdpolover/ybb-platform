"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { listApplications, type Application } from "@/src/shared/api-client";

const PAYMENT_BADGE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  UNPAID: "bg-red-50 text-red-700",
};

export default function ParticipantsPage() {
  const params = useParams<{ programId: string }>();
  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  const fetch = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true); setError(null);
    try {
      const res = await listApplications({ programId: params.programId, status: "ACCEPTED", search: search || undefined, limit, offset: (page - 1) * limit });
      setItems(res.data); setTotal(res.total);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [params.programId, search, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Participants</div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">Accepted Participants</h1>
        <p className="text-sm text-zinc-500">All accepted participants for this program ({total} total).</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input type="text" placeholder="Search by name/email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="block w-full rounded-md border border-zinc-200 py-1.5 pl-8 pr-3 text-[11px] outline-none focus:border-blue-500" />
          </div>
          <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
        </div>

        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Participant</th>
                <th className="px-3 py-2 font-semibold">Country</th>
                <th className="px-3 py-2 font-semibold">Registration Payment</th>
                <th className="px-3 py-2 font-semibold">Program Payment</th>
                <th className="px-3 py-2 font-semibold">Accepted</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-400">Loading…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-400">No accepted participants yet.</td></tr>}
              {!loading && items.map((app, idx) => (
                <tr key={app.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-zinc-900">{app.participant?.fullName ?? "—"}</p>
                    <p className="text-zinc-400">{app.participant?.user?.email ?? ""}</p>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{app.participant?.originCountry ?? "—"}</td>
                  <td className="px-3 py-2"><span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (PAYMENT_BADGE[app.registrationPaymentStatus] ?? "bg-zinc-100 text-zinc-600")}>{app.registrationPaymentStatus}</span></td>
                  <td className="px-3 py-2"><span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (PAYMENT_BADGE[app.programPaymentStatus] ?? "bg-zinc-100 text-zinc-600")}>{app.programPaymentStatus}</span></td>
                  <td className="px-3 py-2 text-zinc-500">{new Date(app.updatedAt).toLocaleDateString()}</td>
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
    </main>
  );
}

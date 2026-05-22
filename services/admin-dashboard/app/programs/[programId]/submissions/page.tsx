"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";
import { listApplications, reviewApplication, type Application } from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  SUBMITTED: "bg-sky-50 text-sky-700",
  UNDER_REVIEW: "bg-purple-50 text-purple-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  WAITLISTED: "bg-orange-50 text-orange-700",
};

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SubmissionsPage() {
  const params = useParams<{ programId: string }>();
  const { adminProfile } = useAuth();
  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Application | null>(null);
  const limit = 20;

  const fetch = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true); setError(null);
    try {
      const res = await listApplications({ programId: params.programId, status: status || undefined, search: search || undefined, limit, offset: (page - 1) * limit });
      setItems(res.data); setTotal(res.total);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [params.programId, status, search, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Submissions</div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">Applications</h1>
        <p className="text-sm text-zinc-500">Review and manage incoming applications for this program.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input type="text" placeholder="Search by name/email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="block w-full rounded-md border border-zinc-200 py-1.5 pl-8 pr-3 text-[11px] outline-none focus:border-blue-500" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-blue-500">
            <option value="">All Statuses</option>
            <option>PENDING</option>
            <option>SUBMITTED</option>
            <option>UNDER_REVIEW</option>
            <option>ACCEPTED</option>
            <option>REJECTED</option>
            <option>WAITLISTED</option>
          </select>
          <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
          <p className="ml-auto text-[11px] text-zinc-500">{total} total</p>
        </div>

        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Applicant</th>
                <th className="px-3 py-2 font-semibold">Country</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Payment</th>
                <th className="px-3 py-2 font-semibold">Applied</th>
                <th className="px-3 py-2 text-right font-semibold">Review</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">Loading…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">No applications found.</td></tr>}
              {!loading && items.map((app, idx) => (
                <tr key={app.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-zinc-900">{app.participant?.fullName ?? "—"}</p>
                    <p className="text-zinc-400">{app.participant?.email ?? ""}</p>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{app.participant?.originCountry ?? "—"}</td>
                  <td className="px-3 py-2"><span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (STATUS_BADGE[app.status] ?? "bg-zinc-100 text-zinc-600")}>{app.status}</span></td>
                  <td className="px-3 py-2 text-zinc-600">
                    <div>{formatLabel(app.registrationPaymentStatus)}</div>
                    {app.ticketStatus ? (
                      <div className="text-zinc-400">Ticket: {formatLabel(app.ticketStatus)}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{formatDate(app.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => setReviewTarget(app)} className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50">Review</button>
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

      {reviewTarget && adminProfile && (
        <ReviewModal app={reviewTarget} reviewerId={adminProfile.id} onClose={() => setReviewTarget(null)} onSaved={fetch} />
      )}
    </main>
  );
}

function ReviewModal({ app, reviewerId, onClose, onSaved }: { app: Application; reviewerId: string; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(app.status);
  const [approvalMode, setApprovalMode] = useState<"participant" | "ambassador">(
    app.ticketStatus === "ambassador" ? "ambassador" : "participant",
  );
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      await reviewApplication(app.id, {
        status,
        reviewerNote: note || undefined,
        reviewerId,
        approvalMode: status === "ACCEPTED" ? approvalMode : undefined,
      });
      onSaved();
      onClose();
    }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-sm font-semibold text-zinc-900">Review Application</h2>
        <p className="mb-3 text-[11px] text-zinc-500">{app.participant?.fullName}</p>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">New Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500">
              <option>PENDING</option>
              <option>SUBMITTED</option>
              <option>UNDER_REVIEW</option>
              <option>ACCEPTED</option>
              <option>REJECTED</option>
              <option>WAITLISTED</option>
            </select>
          </div>
          {status === "ACCEPTED" && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Acceptance Mode</label>
              <select
                value={approvalMode}
                onChange={(e) => setApprovalMode(e.target.value as "participant" | "ambassador")}
                className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              >
                <option value="participant">Participant</option>
                <option value="ambassador">Ambassador</option>
              </select>
              <p className="mt-1 text-[11px] text-zinc-500">
                Ambassador acceptance skips payment collection and cancels unpaid invoices.
              </p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Reviewer Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500" />
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

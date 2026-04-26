"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowPathIcon, MagnifyingGlassIcon, UsersIcon } from "@heroicons/react/24/outline";
import { listApplications, type Application } from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";

const regionNames = typeof Intl !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
function formatCountry(raw: string | null | undefined): string {
  if (!raw) return "—";
  if (regionNames && /^[A-Z]{2}$/.test(raw)) {
    try { return regionNames.of(raw) ?? raw; } catch { return raw; }
  }
  return raw;
}

const PAYMENT_BADGE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  UNPAID: "bg-red-50 text-red-700",
  unpaid: "bg-red-50 text-red-700",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-500",
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  interview_scheduled: "bg-purple-50 text-purple-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  waitlisted: "bg-orange-50 text-orange-700",
  withdrawn: "bg-zinc-100 text-zinc-500",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  interview_scheduled: "Interview",
  accepted: "Accepted",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "interview_scheduled", label: "Interview" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "draft", label: "Draft" },
  { value: "withdrawn", label: "Withdrawn" },
];

export default function ParticipantsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();

  const resolvedProgramId = useMemo(() => {
    const p = accessiblePrograms.find(
      (p) => p.programId === params.programId || p.programSlug === params.programId,
    );
    return p?.programId ?? params.programId;
  }, [accessiblePrograms, params.programId]);

  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  const fetch = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listApplications({
        programId: resolvedProgramId,
        status: statusFilter || undefined,
        search: search || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setItems(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId, search, statusFilter, page]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main className="space-y-4">
      {/* Stats + Filters header */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
              <UsersIcon className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Participants</p>
              <p className="text-xl font-bold text-zinc-900 leading-tight">{loading ? "—" : total.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name/email…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="block w-52 rounded-md border border-zinc-200 py-1.5 pl-8 pr-3 text-[11px] outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={fetch}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={
                "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors " +
                (statusFilter === f.value
                  ? "border-zinc-800 bg-zinc-800 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Table */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Participant</th>
                <th className="px-3 py-2 font-semibold">Country</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Reg. Payment</th>
                <th className="px-3 py-2 font-semibold">Prog. Payment</th>
                <th className="px-3 py-2 font-semibold">Applied</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">Loading…</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">No participants found.</td>
                </tr>
              )}
              {!loading && items.map((app, idx) => (
                <tr
                  key={app.id}
                  className={(idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60") + " cursor-pointer hover:bg-blue-50/50 transition-colors"}
                >
                  <td className="px-3 py-2">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      <p className="font-medium text-zinc-900 hover:text-blue-600">{app.participant?.fullName ?? "—"}</p>
                      <p className="text-zinc-400">{app.participant?.email ?? ""}</p>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      {formatCountry(app.participant?.originCountry)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (STATUS_BADGE[app.status] ?? "bg-zinc-100 text-zinc-600")}>
                        {STATUS_LABEL[app.status] ?? app.status}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (PAYMENT_BADGE[app.registrationPaymentStatus] ?? "bg-zinc-100 text-zinc-600")}>
                        {app.registrationPaymentStatus}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (PAYMENT_BADGE[app.programPaymentStatus] ?? "bg-zinc-100 text-zinc-600")}>
                        {app.programPaymentStatus}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </Link>
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
            <span className="text-[11px] text-zinc-600">Page {page} of {totalPages}</span>
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
    </main>
  );
}

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon, NoSymbolIcon } from "@heroicons/react/24/solid";
import {
  listAmbassadors,
  activateAmbassador,
  deactivateAmbassador,
  deleteAmbassador,
  getAmbassadorReferrals,
  type AmbassadorRow,
  type AmbassadorReferral,
  type AmbassadorListMeta,
} from "../api";

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
      <CheckCircleIcon className="h-3 w-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
      <XCircleIcon className="h-3 w-3" /> Inactive
    </span>
  );
}

// ─── Funnel Status Badge ──────────────────────────────────────────────────────

const FUNNEL_COLORS: Record<string, string> = {
  referred: "bg-zinc-100 text-zinc-600",
  registered: "bg-blue-50 text-blue-700",
  applied: "bg-purple-50 text-purple-700",
  accepted: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
};

function FunnelBadge({ status }: { status: string }) {
  const cls = FUNNEL_COLORS[status.toLowerCase()] ?? "bg-zinc-100 text-zinc-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmClass,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1.5 text-xs text-zinc-500">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold text-white ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Referrals Side Panel ─────────────────────────────────────────────────────

function ReferralsSidePanel({
  ambassador,
  onClose,
}: {
  ambassador: AmbassadorRow | null;
  onClose: () => void;
}) {
  const [referrals, setReferrals] = useState<AmbassadorReferral[]>([]);
  const [meta, setMeta] = useState<AmbassadorListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ambassador) return;
    setPage(1);
    setReferrals([]);
    setMeta(null);
  }, [ambassador?.id]);

  useEffect(() => {
    if (!ambassador) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAmbassadorReferrals(ambassador.id, page)
      .then((res) => {
        if (cancelled) return;
        setReferrals(res.data ?? []);
        setMeta(res.meta ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load referrals.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [ambassador?.id, page]);

  if (!ambassador) return null;
  const name = ambassador.fullName || ambassador.user?.email || "Ambassador";

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Referrals — {name}</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Code: <span className="font-mono font-semibold text-zinc-700">{ambassador.referralCode}</span>
              {" · "}
              {ambassador.totalReferrals} total · {ambassador.successfulReferrals} completed
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-16 text-xs text-zinc-500">
              <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" /> Loading referrals…
            </div>
          )}
          {!loading && error && (
            <p className="rounded-md bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>
          )}
          {!loading && !error && referrals.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-xs text-zinc-500">
              <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
              <span>No referrals yet for this ambassador.</span>
            </div>
          )}
          {!loading && referrals.length > 0 && (
            <div className="overflow-hidden rounded-md border border-zinc-200">
              <table className="min-w-full border-collapse text-left text-[11px]">
                <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Participant</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Referred</th>
                    <th className="px-3 py-2 text-right">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r, i) => {
                    const participantName = r.participant?.fullName || r.participant?.user?.email || "—";
                    return (
                      <tr key={r.id} className={i % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}>
                        <td className="px-3 py-2 text-zinc-800">{participantName}</td>
                        <td className="px-3 py-2">
                          <FunnelBadge status={r.status} />
                        </td>
                        <td className="px-3 py-2 text-zinc-500">
                          {new Date(r.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-500">
                          {r.totalConversionDays != null ? `${r.totalConversionDays}d` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {meta && meta.lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3 text-[11px] text-zinc-500">
            <span>
              Page {meta.page} of {meta.lastPage}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded p-1 hover:bg-zinc-100 disabled:opacity-40"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={page >= meta.lastPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded p-1 hover:bg-zinc-100 disabled:opacity-40"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AmbassadorsPage() {
  const [rows, setRows] = useState<AmbassadorRow[]>([]);
  const [meta, setMeta] = useState<AmbassadorListMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [page, setPage] = useState(1);

  // Actions
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Referrals panel
  const [referralAmbassador, setReferralAmbassador] = useState<AmbassadorRow | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<AmbassadorRow | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const load = useCallback(async (s = search, p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAmbassadors({ search: s || undefined, page: p });
      setRows(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ambassadors.");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load(search, page);
  }, [search, page]);

  const handleSearch = () => {
    setSearch(draftSearch);
    setPage(1);
  };

  const handleReset = () => {
    setDraftSearch("");
    setSearch("");
    setPage(1);
  };

  const handleToggleActive = async (row: AmbassadorRow) => {
    const key = `toggle-${row.id}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      if (row.isActive) {
        await deactivateAmbassador(row.id);
        showToast(`${row.fullName} deactivated.`);
      } else {
        await activateAmbassador(row.id);
        showToast(`${row.fullName} activated.`);
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: !row.isActive } : r))
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const key = `delete-${deleteTarget.id}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await deleteAmbassador(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      showToast(`${deleteTarget.fullName} removed.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
      setDeleteTarget(null);
    }
  };

  const totalAmbassadors = meta?.total ?? rows.length;
  const activeCount = rows.filter((r) => r.isActive).length;
  const inactiveCount = rows.filter((r) => !r.isActive).length;

  return (
    <div className="space-y-4">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Ambassadors</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage program ambassadors, referral codes, and activation status.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Total Ambassadors</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {loading && totalAmbassadors === 0 ? "—" : totalAmbassadors}
              </p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
              <UserGroupIcon className="h-5 w-5 text-blue-600" />
            </span>
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Active</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{loading ? "—" : activeCount}</p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
            </span>
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Inactive</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{loading ? "—" : inactiveCount}</p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100">
              <XCircleIcon className="h-5 w-5 text-zinc-500" />
            </span>
          </div>
        </div>
      </div>

      {/* ── Table card ── */}
      <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-sm">

        {/* Search + refresh */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Name, email, or referral code…"
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={handleSearch}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-600"
              >
                <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                Search
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs text-zinc-700">
            <thead>
              <tr className="border-y border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Ambassador</th>
                <th className="px-3 py-2">Program</th>
                <th className="px-3 py-2">Referral Code</th>
                <th className="px-3 py-2 text-center">Referrals</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Joined</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-[12px] text-zinc-400">
                    <ArrowPathIcon className="mx-auto mb-1 h-5 w-5 animate-spin" />
                    Loading ambassadors…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-[12px] text-zinc-500">
                    <div className="inline-flex flex-col items-center gap-1">
                      <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                      <span className="font-medium">No ambassadors found</span>
                      <span className="text-[11px] text-zinc-400">
                        Adjust your search or invite new ambassadors.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const toggleKey = `toggle-${row.id}`;
                  const deleteKey = `delete-${row.id}`;
                  const name = row.fullName || "—";
                  const email = row.user?.email ?? "—";
                  const programName = row.program?.name ?? row.programName ?? "—";
                  const joined = row.createdAt
                    ? new Date(row.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";
                  const maxRef = Math.max(...rows.map((r) => r.totalReferrals), 1);

                  return (
                    <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-3 py-2.5 align-top text-[11px] text-zinc-400">
                        {(page - 1) * 20 + idx + 1}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900">{name}</p>
                            <p className="text-[11px] text-zinc-500">{email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-[11px] text-zinc-600">
                        {programName}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-700">
                          {row.referralCode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                            {row.totalReferrals}
                          </span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${(row.totalReferrals / maxRef) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <StatusBadge active={row.isActive} />
                      </td>
                      <td className="px-3 py-2.5 align-top text-[11px] text-zinc-500">{joined}</td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="inline-flex flex-wrap gap-1">
                          {/* View referrals */}
                          <button
                            type="button"
                            title="View referrals"
                            onClick={() => setReferralAmbassador(row)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
                          >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                          </button>

                          {/* Activate / Deactivate */}
                          <button
                            type="button"
                            title={row.isActive ? "Deactivate" : "Activate"}
                            disabled={!!actionLoading[toggleKey]}
                            onClick={() => handleToggleActive(row)}
                            className={`flex h-7 w-7 items-center justify-center rounded-md border shadow-sm transition disabled:opacity-50 ${
                              row.isActive
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {actionLoading[toggleKey] ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : row.isActive ? (
                              <NoSymbolIcon className="h-4 w-4" />
                            ) : (
                              <CheckBadgeIcon className="h-4 w-4" />
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            title="Delete ambassador"
                            disabled={!!actionLoading[deleteKey]}
                            onClick={() => setDeleteTarget(row)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-50"
                          >
                            {actionLoading[deleteKey] ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <TrashIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.lastPage > 1 && (
          <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] text-zinc-500">
            <span>
              Showing page {meta.page} of {meta.lastPage} ({meta.total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= meta.lastPage}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                Next <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Referrals Panel ── */}
      <ReferralsSidePanel
        ambassador={referralAmbassador}
        onClose={() => setReferralAmbassador(null)}
      />

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Ambassador"
        message={`Are you sure you want to remove ${deleteTarget?.fullName ?? "this ambassador"}? This action cannot be undone.`}
        confirmLabel="Remove"
        confirmClass="bg-rose-600 hover:bg-rose-700"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

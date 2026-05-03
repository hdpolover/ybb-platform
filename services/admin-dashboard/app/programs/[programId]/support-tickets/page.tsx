"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowPathIcon, EyeIcon, MagnifyingGlassIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  deleteProgramSupportTicket,
  listProgramSupportTickets,
  updateProgramSupportTicket,
  type ProgramSupportTicket,
} from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";

const STATUS_OPTIONS: ProgramSupportTicket["status"][] = [
  "open",
  "in_progress",
  "waiting_response",
  "resolved",
  "closed",
];

const PRIORITY_OPTIONS: ProgramSupportTicket["priority"][] = ["low", "normal", "high", "urgent"];

export default function ProgramSupportTicketsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();
  const [items, setItems] = useState<ProgramSupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const limit = 20;

  const programName = useMemo(
    () =>
      accessiblePrograms.find((p) => p.programId === params.programId || p.programSlug === params.programId)
        ?.programName ?? "Selected Program",
    [accessiblePrograms, params.programId],
  );

  const load = useCallback(async () => {
    if (!params.programId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listProgramSupportTickets(params.programId, {
        page,
        limit,
        status: (status || undefined) as ProgramSupportTicket["status"] | undefined,
        priority: (priority || undefined) as ProgramSupportTicket["priority"] | undefined,
        search: searchQuery || undefined,
      });
      setItems(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  }, [limit, page, params.programId, priority, searchQuery, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatusChange(ticketId: string, nextStatus: ProgramSupportTicket["status"]) {
    setUpdatingId(ticketId);
    setError(null);
    try {
      const updated = await updateProgramSupportTicket(params.programId, ticketId, { status: nextStatus });
      setItems((current) =>
        current.map((item) =>
          item.id === ticketId ? { ...item, status: updated.status, updatedAt: updated.updatedAt } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update support ticket.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(ticketId: string) {
    if (!confirm("Delete this support ticket? This cannot be undone.")) return;
    setDeletingId(ticketId);
    setError(null);
    try {
      await deleteProgramSupportTicket(params.programId, ticketId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete support ticket.");
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Support
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Support Tickets</h1>
        <p className="text-sm text-zinc-500">
          Review participant tickets, update status, and open detailed conversations.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-500">{total} ticket(s)</p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_160px_auto]">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by ticket number, subject, category"
              className="w-full rounded-md border border-zinc-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setPage(1);
                  setSearchQuery(searchInput.trim());
                }
              }}
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(event) => {
              setPriority(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSearchQuery(searchInput.trim());
            }}
            className="rounded-md bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600"
          >
            Apply
          </button>
        </div>

        {error ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Ticket</th>
                <th className="px-3 py-2 font-semibold">Participant</th>
                <th className="px-3 py-2 font-semibold">Priority</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Created</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                    No support tickets found.
                  </td>
                </tr>
              ) : null}
              {!loading &&
                items.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                    <td className="px-3 py-2 align-top">
                      <p className="font-semibold text-zinc-800">{item.ticketNumber}</p>
                      <p className="font-medium text-zinc-700">{item.subject}</p>
                      <p className="text-zinc-500">{item.category}</p>
                    </td>
                    <td className="px-3 py-2 align-top text-zinc-700">
                      <p className="font-medium">{item.participantName ?? "Participant"}</p>
                      <p className="text-zinc-500">{item.participantEmail ?? "—"}</p>
                    </td>
                    <td className="px-3 py-2 align-top text-zinc-600">{item.priority}</td>
                    <td className="px-3 py-2 align-top">
                      <select
                        value={item.status}
                        onChange={(event) =>
                          void handleStatusChange(item.id, event.target.value as ProgramSupportTicket["status"])
                        }
                        disabled={updatingId === item.id}
                        className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                      >
                        {STATUS_OPTIONS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top text-zinc-500">{formatDate(item.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/programs/${params.programId}/support-tickets/${item.id}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-60"
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

        {totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
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
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

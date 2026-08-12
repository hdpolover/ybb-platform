"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EyeIcon } from "@heroicons/react/24/solid";
import { ScoreStatusBadge } from "./ScoreStatusBadge";

export interface FullyFundedParticipantRow {
  id: number;
  accountId: string;
  name: string;
  email: string;
  participantId: string;
  nationality: string;
  formStatus: "Not Started" | "On Progress" | "Submitted";
  registeredOn: string;
  /** Essay-completeness summary from the list endpoint (see Application.essayFilled). */
  essayFilled?: "filled" | "partial" | "empty";
  scoreTotal: number | null;
  scoreStatus: string | null;
}

interface FullyFundedParticipantsTableProps {
  data: FullyFundedParticipantRow[];
  /** Current 1-based page, server-driven — rows are exactly this page's slice. */
  page: number;
  pageSize: number;
  /** Total row count across all pages, from the server response. */
  total: number;
  onPageChange: (page: number) => void;
}

export function FullyFundedParticipantsTable({
  data,
  page,
  pageSize,
  total,
  onPageChange,
}: FullyFundedParticipantsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const showingFrom = total === 0 ? 0 : startIndex + 1;
  const showingTo = total === 0 ? 0 : startIndex + data.length;

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
                <th className="w-12 px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Participant Details</th>
                <th className="px-4 py-3 font-semibold">Submission Status</th>
                <th className="px-4 py-3 font-semibold">Essay</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Registered On</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                    <div className="inline-flex flex-col items-center gap-2">
                      <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                      <span className="font-semibold text-zinc-900">No participants found</span>
                      <span className="text-xs text-zinc-500">
                        Adjust your filters or import participants to see them here.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, index) => (
                  <tr key={row.accountId} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-4 py-3 align-top text-xs font-medium text-zinc-500">
                      {startIndex + index + 1}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900">{row.name}</span>
                          <span className="text-xs text-zinc-500">{row.email}</span>
                          <span className="font-mono text-[11px] text-zinc-400">{row.accountId}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <FullyFundedStatusBadge status={row.formStatus} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <EssayFilledBadge status={row.essayFilled} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-zinc-900">
                          {row.scoreTotal ?? "—"}
                        </span>
                        <ScoreStatusBadge status={row.scoreStatus} />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-xs font-medium text-zinc-700">{row.registeredOn}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title="Review"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                          onClick={() => {
                            // Split-view participant detail page: essay and scoring
                            // panel side by side, so this is the only row action.
                            const params = new URLSearchParams(searchParams.toString());
                            params.set("source", "scoring");
                            const query = params.toString();
                            const match = pathname.match(/\/programs\/([^/]+)/);
                            const programId = match?.[1];
                            const basePath = programId
                              ? `/programs/${encodeURIComponent(programId)}/scoring/fully-funded/${encodeURIComponent(row.accountId)}`
                              : `/scoring/fully-funded/${encodeURIComponent(row.accountId)}`;
                            router.push(query ? `${basePath}?${query}` : basePath);
                          }}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-xs font-medium text-zinc-500">
        <span>
          Showing {showingFrom} to {showingTo} of {total} entries
        </span>
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function FullyFundedStatusBadge({ status }: { status: FullyFundedParticipantRow["formStatus"] }) {
  let className = "bg-zinc-100 text-zinc-700 border-zinc-200";

  if (status === "Submitted") className = "bg-emerald-50 text-emerald-700 border-emerald-200";
  else if (status === "On Progress") className = "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${className}`}>
      {status}
    </span>
  );
}

/**
 * Essay-completeness badge — driven by `Application.essayFilled`, a derived
 * (not stored) value computed by the list endpoint from required program
 * essays vs. answered essays. A row can legitimately show "Submitted" in
 * Submission Status while this reads "Empty" — the workflow status and the
 * essay-completeness check are independent signals, and that's intended.
 */
function EssayFilledBadge({ status }: { status: FullyFundedParticipantRow["essayFilled"] }) {
  const label = status === "filled" ? "Filled" : status === "partial" ? "Partial" : status === "empty" ? "Empty" : "—";
  let className = "bg-zinc-100 text-zinc-500 border-zinc-200";

  if (status === "filled") className = "bg-emerald-50 text-emerald-700 border-emerald-200";
  else if (status === "partial") className = "bg-amber-50 text-amber-700 border-amber-200";
  else if (status === "empty") className = "bg-rose-50 text-rose-700 border-rose-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

"use client";

import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserIcon } from "@heroicons/react/24/solid";

interface AgreementLetterRow {
  id: number;
  accountId: string;
  name: string;
  email: string;
  participantId: string;
  fundingPath: "Fully Funded" | "Self Funded";
  status: "Not Generated" | "Pending Signature" | "Signed" | "Overdue";
  createdAt: string; // formatted date string
}

const mockAgreementLetters: AgreementLetterRow[] = [
  {
    id: 1,
    accountId: "167920692d5fa1becc2",
    name: "SAMYIA AZIZAHMED MAKRANI",
    email: "samyiaazizahmed79@gmail.com",
    participantId: "#17061B",
    fundingPath: "Fully Funded",
    status: "Signed",
    createdAt: "Dec 4, 2025, 09:12 GMT+7",
  },
  {
    id: 2,
    accountId: "167920692d5fa1bedd1",
    name: "Alya Putri Nirmala",
    email: "alya.putri@example.com",
    participantId: "#17022A",
    fundingPath: "Self Funded",
    status: "Pending Signature",
    createdAt: "Dec 3, 2025, 21:45 GMT+7",
  },
  {
    id: 3,
    accountId: "167920692d5fa1bef31",
    name: "Kenji Sato",
    email: "kenji.sato@example.jp",
    participantId: "#17045J",
    fundingPath: "Fully Funded",
    status: "Overdue",
    createdAt: "Nov 28, 2025, 16:03 GMT+9",
  },
  {
    id: 4,
    accountId: "167920692d5fa1beaa9",
    name: "Nurul Huda",
    email: "nurul.huda@example.my",
    participantId: "#17030M",
    fundingPath: "Fully Funded",
    status: "Pending Signature",
    createdAt: "Nov 30, 2025, 11:27 GMT+8",
  },
  {
    id: 5,
    accountId: "167920692d5fa1becc3",
    name: "Ashwini Vaibhav Pol",
    email: "ash.jawale16@gmail.com",
    participantId: "#17070I",
    fundingPath: "Self Funded",
    status: "Not Generated",
    createdAt: "—",
  },
  {
    id: 6,
    accountId: "167920692d5fa1becc4",
    name: "Aya Gamal",
    email: "ayagamal453@gmail.com",
    participantId: "#17012E",
    fundingPath: "Fully Funded",
    status: "Signed",
    createdAt: "Dec 2, 2025, 14:18 GMT+2",
  },
];

export function AgreementLettersTable() {
  const rows = mockAgreementLetters;
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, rows.length);
  const visibleRows = rows.slice(startIndex, endIndex);

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:text-sm">
      <div className="mb-2.5 flex items-center justify-between text-[11px] text-zinc-500">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Agreement Letters</div>
          <div className="text-[11px] text-zinc-400">
            Monitor agreement letter generation and signature status for confirmed participants.
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Participant Details</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created At</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-[12px] text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No agreement letters found</span>
                    <span className="text-[11px] text-zinc-400">
                      Agreement letters will appear here once participants are confirmed.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{startIndex + index + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-600">
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-900">{row.name}</div>
                        <div className="text-[11px] text-zinc-500">{row.email}</div>
                        <div className="text-[10px] text-zinc-400">
                          {row.participantId} · {row.fundingPath}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <AgreementStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-xs text-zinc-900">{row.createdAt}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="inline-flex flex-wrap gap-1 text-[11px]">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams.toString());
                          params.set("source", "agreement-letters");
                          const query = params.toString();
                          const match = pathname.match(/\/programs\/([^/]+)/);
                          const programId = match?.[1];
                          const basePath = programId
                            ? `/programs/${encodeURIComponent(programId)}/participants/${encodeURIComponent(row.accountId)}`
                            : `/participants/${encodeURIComponent(row.accountId)}`;
                          router.push(query ? `${basePath}?${query}` : basePath);
                        }}
                      >
                        <UserIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Showing {rows.length === 0 ? 0 : startIndex + 1} to {endIndex} of {rows.length} entries
        </span>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={clampedPage === 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={clampedPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function AgreementStatusBadge({ status }: { status: AgreementLetterRow["status"] }) {
  let className = "bg-zinc-100 text-zinc-700";

  if (status === "Signed") className = "bg-emerald-100 text-emerald-700";
  else if (status === "Pending Signature") className = "bg-amber-100 text-amber-700";
  else if (status === "Overdue") className = "bg-rose-100 text-rose-700";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}
    >
      {status}
    </span>
  );
}

"use client";

import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DocumentTextIcon, UserIcon } from "@heroicons/react/24/solid";

interface EssayRow {
  id: number;
  accountId: string;
  name: string;
  email: string;
  participantId: string;
  category: "Fully Funded" | "Self Funded";
  totalQuestions: number;
  answeredQuestions: number;
  submittedOn: string | null; // null = belum submit
}

const mockEssays: EssayRow[] = [
  {
    id: 1,
    accountId: "173675",
    name: "Nguyễn Thị Thanh Huyền",
    email: "huyenlinh0329@gmail.com",
    participantId: "173675",
    category: "Self Funded",
    totalQuestions: 3,
    answeredQuestions: 3,
    submittedOn: "Dec 3, 2025",
  },
  {
    id: 2,
    accountId: "17022A",
    name: "Alya Putri Nirmala",
    email: "alya.putri@example.com",
    participantId: "17022A",
    category: "Fully Funded",
    totalQuestions: 3,
    answeredQuestions: 2,
    submittedOn: "Dec 2, 2025",
  },
  {
    id: 3,
    accountId: "17045J",
    name: "Kenji Sato",
    email: "kenji.sato@example.jp",
    participantId: "17045J",
    category: "Fully Funded",
    totalQuestions: 3,
    answeredQuestions: 1,
    submittedOn: null,
  },
  {
    id: 4,
    accountId: "17030M",
    name: "Nurul Huda",
    email: "nurul.huda@example.my",
    participantId: "17030M",
    category: "Fully Funded",
    totalQuestions: 3,
    answeredQuestions: 3,
    submittedOn: "Dec 1, 2025",
  },
  {
    id: 5,
    accountId: "17070I",
    name: "Ashwini Vaibhav Pol",
    email: "ash.jawale16@gmail.com",
    participantId: "17070I",
    category: "Fully Funded",
    totalQuestions: 3,
    answeredQuestions: 2,
    submittedOn: null,
  },
  {
    id: 6,
    accountId: "17012E",
    name: "Aya Gamal",
    email: "ayagamal453@gmail.com",
    participantId: "17012E",
    category: "Self Funded",
    totalQuestions: 3,
    answeredQuestions: 3,
    submittedOn: "Nov 30, 2025",
  },
  {
    id: 7,
    accountId: "17090K",
    name: "Mohamed Hassan",
    email: "m.hassan@example.eg",
    participantId: "17090K",
    category: "Self Funded",
    totalQuestions: 3,
    answeredQuestions: 1,
    submittedOn: null,
  },
  {
    id: 8,
    accountId: "17015P",
    name: "Putri Ayu Lestari",
    email: "putri.ayu@example.id",
    participantId: "17015P",
    category: "Fully Funded",
    totalQuestions: 3,
    answeredQuestions: 3,
    submittedOn: "Nov 28, 2025",
  },
  {
    id: 9,
    accountId: "17033C",
    name: "Chen Wei",
    email: "chen.wei@example.cn",
    participantId: "17033C",
    category: "Self Funded",
    totalQuestions: 3,
    answeredQuestions: 2,
    submittedOn: null,
  },
  {
    id: 10,
    accountId: "17088Z",
    name: "Zara Khan",
    email: "zara.khan@example.pk",
    participantId: "17088Z",
    category: "Fully Funded",
    totalQuestions: 3,
    answeredQuestions: 3,
    submittedOn: "Nov 25, 2025",
  },
];

export function EssaysTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [categoryFilter, setCategoryFilter] = useState<"All" | "Fully Funded" | "Self Funded">("All");

  type CategoryFilter = "All" | "Fully Funded" | "Self Funded";

  const filteredRows = mockEssays.filter((row) => {
    if (categoryFilter === "All") return true;
    return row.category === categoryFilter;
  });

  const [page, setPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRows.length);
  const visibleRows = filteredRows.slice(startIndex, endIndex);

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-700 shadow-sm md:text-sm">
      {/* Filters */}
      <div className="mb-2.5 space-y-1.5">
        <div className="grid gap-2.5 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Category</label>
            <select
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
            >
              <option value="All">All Categories</option>
              <option value="Fully Funded">Fully Funded</option>
              <option value="Self Funded">Self Funded</option>
            </select>
          </div>

          <div className="flex items-end gap-1.5">
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center rounded-md border border-blue-500 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
            >
              Apply Filters
            </button>
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              onClick={() => setCategoryFilter("All")}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Participant</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Essay Progress</th>
              <th className="px-3 py-2">Submitted On</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[12px] text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No essay submissions found</span>
                    <span className="text-[11px] text-zinc-400">
                      Adjust your filters to see essay submissions.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => {
                const progressPercent = (row.answeredQuestions / row.totalQuestions) * 100;

                return (
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
                          <div className="text-[10px] text-zinc-400">ID: {row.participantId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-900">
                            {row.answeredQuestions}/{row.totalQuestions}
                          </span>
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              row.submittedOn
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {row.submittedOn ? "Submitted" : "In Progress"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-xs text-zinc-900">
                        {row.submittedOn ? row.submittedOn : "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="inline-flex flex-wrap gap-1 text-[11px]">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                          onClick={() => {
                            const params = new URLSearchParams(searchParams.toString());
                            params.set("source", "essays");
                            const query = params.toString();
                            const match = pathname.match(/\/programs\/([^/]+)/);
                            const programId = match?.[1];
                            const basePath = programId
                              ? `/programs/${encodeURIComponent(programId)}/submissions/essays/${encodeURIComponent(row.accountId)}`
                              : `/submissions/essays/${encodeURIComponent(row.accountId)}`;
                            router.push(query ? `${basePath}?${query}` : basePath);
                          }}
                        >
                          <DocumentTextIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                          onClick={() => {
                            const params = new URLSearchParams(searchParams.toString());
                            params.set("source", "essays");
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Showing {filteredRows.length === 0 ? 0 : startIndex + 1} to {endIndex} of {filteredRows.length} entries
        </span>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            disabled={clampedPage === 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
            disabled={clampedPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

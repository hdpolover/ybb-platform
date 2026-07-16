"use client";

import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownTrayIcon,
  ClockIcon,
  UserPlusIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

interface ParticipantRow {
  id: number;
  accountId: string;
  name: string;
  email: string;
  participantId: string;
  nationality: string;
  category: "Fully Funded" | "Self Funded";
  formStatus: "Not Started" | "On Progress" | "Submitted";
  registeredOn: string;
}

const mockParticipants: ParticipantRow[] = [
  {
    id: 1,
    accountId: "167920692d5fa1becc2",
    name: "SAMYIA AZIZAHMED MAKRANI",
    email: "samyiaazizahmed79@gmail.com",
    participantId: "#17061B",
    nationality: "India",
    category: "Fully Funded",
    formStatus: "Submitted",
    registeredOn: "Dec 01, 2025",
  },
  {
    id: 2,
    accountId: "167920692d5fa1bedd1",
    name: "Alya Putri Nirmala",
    email: "alya.putri@example.com",
    participantId: "#17022A",
    nationality: "Indonesia",
    category: "Self Funded",
    formStatus: "On Progress",
    registeredOn: "Nov 28, 2025",
  },
  {
    id: 3,
    accountId: "167920692d5fa1bef31",
    name: "Kenji Sato",
    email: "kenji.sato@example.jp",
    participantId: "#17045J",
    nationality: "Japan",
    category: "Fully Funded",
    formStatus: "Not Started",
    registeredOn: "Nov 25, 2025",
  },
  {
    id: 4,
    accountId: "167920692d5fa1beaa9",
    name: "Nurul Huda",
    email: "nurul.huda@example.my",
    participantId: "#17030M",
    nationality: "Malaysia",
    category: "Fully Funded",
    formStatus: "Submitted",
    registeredOn: "Nov 20, 2025",
  },
  {
    id: 5,
    accountId: "167920692d5fa1becc3",
    name: "Ashwini Vaibhav Pol",
    email: "ash.jawale16@gmail.com",
    participantId: "#17070I",
    nationality: "India",
    category: "Fully Funded",
    formStatus: "Not Started",
    registeredOn: "Dec 01, 2025",
  },
  {
    id: 6,
    accountId: "167920692d5fa1becc4",
    name: "Aya Gamal",
    email: "ayagamal453@gmail.com",
    participantId: "#17012E",
    nationality: "Egypt",
    category: "Self Funded",
    formStatus: "On Progress",
    registeredOn: "Nov 30, 2025",
  },
];

export function ParticipantsTable() {
  const rows = mockParticipants;
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [page, setPage] = useState(1);
  const pageSize = 3;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, rows.length);
  const visibleRows = rows.slice(startIndex, endIndex);

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:text-sm">
      <div className="mb-2.5 flex flex-wrap items-center justify-end gap-2 text-[11px] text-zinc-500">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-500 px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
            <span>Export Data ( Excel )</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <ClockIcon className="h-3.5 w-3.5" />
            <span>Export History</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-blue-600"
          >
            <UserPlusIcon className="h-3.5 w-3.5" />
            <span>Add New Participant</span>
          </button>
        </div>
      </div>

      <div className="mb-2.5 space-y-1.5">
        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by name, email, account ID, participant ID..."
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-600"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-2.5 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Category</label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>All Categories</option>
              <option>Fully Funded</option>
              <option>Self Funded</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Form Status</label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>All Status</option>
              <option>Not Started</option>
              <option>On Progress</option>
              <option>Submitted</option>
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
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Account ID</th>
              <th className="px-3 py-2">Participant Details</th>
              <th className="px-3 py-2">Submission Status</th>
              <th className="px-3 py-2">Registered On</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[12px] text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No participants found</span>
                    <span className="text-[11px] text-zinc-400">
                      Adjust your filters or import participants to see them here.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{startIndex + index + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-[11px] text-zinc-500">{row.accountId}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-600">
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-900">{row.name}</div>
                        <div className="text-[11px] text-zinc-500">{row.email}</div>
                        <div className="text-[10px] text-zinc-400">{row.participantId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <StatusBadge status={row.formStatus} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-xs text-zinc-900">{row.registeredOn}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="inline-flex flex-wrap gap-1 text-[11px]">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams.toString());
                          params.set("source", "users");
                          const query = params.toString();
                          const match = pathname.match(/\/programs\/([^/]+)/);
                          const programId = match?.[1];
                          const basePath = programId
                            ? `/programs/${encodeURIComponent(programId)}/participants/${encodeURIComponent(row.accountId)}`
                            : `/participants/${encodeURIComponent(row.accountId)}`;
                          router.push(query ? `${basePath}?${query}` : basePath);
                        }}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                      >
                        <TrashIcon className="h-4 w-4" />
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

function StatusBadge({ status }: { status: ParticipantRow["formStatus"] }) {
  let className = "bg-zinc-100 text-zinc-700";

  if (status === "Submitted") className = "bg-emerald-100 text-emerald-700";
  else if (status === "On Progress") className = "bg-amber-100 text-amber-700";
  else className = "bg-zinc-100 text-zinc-600";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}
    >
      {status}
    </span>
  );
}

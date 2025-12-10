"use client";

import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserPlusIcon, EyeIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/solid";

interface AmbassadorRow {
  id: number;
  accountId: string;
  name: string;
  email: string;
  institution: string;
  status: "Active" | "Inactive" | "Suspended";
  joinedOn: string;
  referralCode: string;
  referralCount: number;
}

const mockAmbassadors: AmbassadorRow[] = [
  {
    id: 1,
    accountId: "167920692d5fa1becc2",
    name: "Jalwa Nawab",
    email: "g4264107@gmail.com",
    institution: "Some University",
    status: "Active",
    joinedOn: "21 Nov 2025",
    referralCode: "JALW645",
    referralCount: 1,
  },
  {
    id: 2,
    accountId: "167920692d5fa1bee01",
    name: "Alya Putri Nirmala",
    email: "alya.putri@example.com",
    institution: "Institut Teknologi Bandung",
    status: "Active",
    joinedOn: "19 Nov 2025",
    referralCode: "ALYA221",
    referralCount: 3,
  },
  {
    id: 3,
    accountId: "167920692d5fa1bee02",
    name: "Kenji Sato",
    email: "kenji.sato@example.jp",
    institution: "Tokyo International College",
    status: "Inactive",
    joinedOn: "15 Nov 2025",
    referralCode: "KENJ903",
    referralCount: 0,
  },
  {
    id: 4,
    accountId: "167920692d5fa1bee03",
    name: "Nurul Huda",
    email: "nurul.huda@example.my",
    institution: "Universiti Malaya",
    status: "Active",
    joinedOn: "10 Nov 2025",
    referralCode: "NURL732",
    referralCount: 5,
  },
  {
    id: 5,
    accountId: "167920692d5fa1bee04",
    name: "Ashwini Vaibhav Pol",
    email: "ash.jawale16@gmail.com",
    institution: "ABC International School",
    status: "Suspended",
    joinedOn: "01 Nov 2025",
    referralCode: "ASHW120",
    referralCount: 2,
  },
  {
    id: 6,
    accountId: "167920692d5fa1bee05",
    name: "Aya Gamal",
    email: "ayagamal453@gmail.com",
    institution: "Cairo Youth Institute",
    status: "Active",
    joinedOn: "28 Oct 2025",
    referralCode: "AYAG554",
    referralCount: 4,
  },
];

export function AmbassadorsTable() {
  const rows = mockAmbassadors;
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

  const maxReferrals = rows.reduce((max, row) => Math.max(max, row.referralCount), 0) || 1;

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:text-sm">
      <div className="mb-2.5 flex flex-wrap items-center justify-end gap-2 text-[11px] text-zinc-500">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-blue-600"
          >
            <UserPlusIcon className="h-3.5 w-3.5" />
            <span>Add New Ambassador</span>
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
                placeholder="Search by name, email, account ID, referral code..."
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
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Status</label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>All Status</option>
              <option>Active</option>
              <option>Inactive</option>
              <option>Suspended</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">Sort By</label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>Registration Date (Newest)</option>
              <option>Registration Date (Oldest)</option>
              <option>Most Referrals</option>
              <option>Fewest Referrals</option>
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
              <th className="px-3 py-2">Details</th>
              <th className="px-3 py-2">Referral Code</th>
              <th className="px-3 py-2">Referrals</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-[12px] text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No ambassadors found</span>
                    <span className="text-[11px] text-zinc-400">
                      Adjust your filters or invite new ambassadors to see them here.
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
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-zinc-900">{row.name}</span>
                          <StatusBadge status={row.status} />
                        </div>
                        <div className="text-[11px] text-zinc-500">{row.email}</div>
                        <div className="text-[11px] text-zinc-500">{row.institution}</div>
                        <div className="text-[10px] text-zinc-400">Joined: {row.joinedOn}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-xs font-semibold text-zinc-900">{row.referralCode}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[11px] font-semibold text-white">
                        {row.referralCount}
                      </span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${(row.referralCount / maxReferrals) * 100}%` }}
                        />
                      </div>
                    </div>
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

function StatusBadge({ status }: { status: AmbassadorRow["status"] }) {
  let className = "bg-zinc-100 text-zinc-700";

  if (status === "Active") className = "bg-emerald-100 text-emerald-700";
  else if (status === "Suspended") className = "bg-rose-100 text-rose-700";
  else className = "bg-zinc-100 text-zinc-600";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      {status}
    </span>
  );
}

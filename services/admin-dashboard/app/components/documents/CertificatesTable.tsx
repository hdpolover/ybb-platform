"use client";

import React, { useState } from "react";
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  TrophyIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  EyeIcon,
  UserIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/solid";

interface CertificateAwardRow {
  id: number;
  award: string;
  type: "Winner" | "Finalist" | "Participant";
  description: string;
  recipients: number;
  progressPercent: number; // 0-100
  certificateStatus: "No Template" | "Draft" | "Active";
}

const mockAwards: CertificateAwardRow[] = [
  {
    id: 1,
    award: "The Best Content Creator",
    type: "Winner",
    description: "The Best Content Creator",
    recipients: 0,
    progressPercent: 0,
    certificateStatus: "No Template",
  },
  {
    id: 2,
    award: "The Best Group",
    type: "Winner",
    description: "The Best Group for Junior and Senior Category",
    recipients: 0,
    progressPercent: 0,
    certificateStatus: "No Template",
  },
  {
    id: 3,
    award: "The Best Leader",
    type: "Winner",
    description: "The Best Leader for Junior and Senior Group",
    recipients: 0,
    progressPercent: 0,
    certificateStatus: "No Template",
  },
  {
    id: 4,
    award: "The Best National Costume",
    type: "Winner",
    description: "The Best National Costume (Male & Female)",
    recipients: 0,
    progressPercent: 0,
    certificateStatus: "No Template",
  },
  {
    id: 5,
    award: "The Best Participant",
    type: "Winner",
    description: "The Best Participant",
    recipients: 0,
    progressPercent: 0,
    certificateStatus: "No Template",
  },
  {
    id: 6,
    award: "The Best Presenter",
    type: "Winner",
    description: "The Best Presenter (Male & Female)",
    recipients: 0,
    progressPercent: 0,
    certificateStatus: "No Template",
  },
  {
    id: 7,
    award: "The Best Project",
    type: "Winner",
    description: "The Best Project for Junior and Senior Category",
    recipients: 0,
    progressPercent: 0,
    certificateStatus: "No Template",
  },
  {
    id: 8,
    award: "The Most Active Group",
    type: "Winner",
    description: "The Most Active Group Junior and Senior Category",
    recipients: 0,
    progressPercent: 0,
    certificateStatus: "No Template",
  },
];

export function CertificatesTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const filteredRows = mockAwards.filter((row) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      row.award.toLowerCase().includes(term) ||
      row.description.toLowerCase().includes(term) ||
      row.type.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRows.length);
  const visibleRows = filteredRows.slice(startIndex, endIndex);

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:text-sm">
      {/* Buat bagian Toolbar */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            onClick={() => {
              // TODO: Nanti disambungin ke action refresh data yang beneran
              console.info("Certificates refresh clicked");
            }}
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="w-full max-w-xs">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-zinc-400">
                <MagnifyingGlassIcon className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search award or description..."
                className="block w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-7 pr-2 text-[11px] text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* bagian Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Award</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Recipients</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2">Certificate Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-[12px] text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No awards found</span>
                    <span className="text-[11px] text-zinc-400">
                      Adjust your search keyword to see configured certificate awards.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top text-sm font-semibold text-zinc-900">{row.award}</td>
                  <td className="px-3 py-2 align-top">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      <TrophyIcon className="h-3 w-3" />
                      <span>{row.type}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-zinc-700">{row.description}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="inline-flex items-center gap-1 text-xs text-zinc-900">
                      <UserGroupIcon className="h-3.5 w-3.5 text-zinc-400" />
                      <span>{row.recipients}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${row.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-500">{row.progressPercent}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <CertificateStatusBadge status={row.certificateStatus} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="inline-flex flex-wrap gap-1 text-[11px]">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        onClick={() => {
                          // TODO: Nanti buka detail konfigurasi sertifikat
                          console.info("View certificate config", row.id);
                        }}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        onClick={() => {
                          // TODO: Nanti disambungin ke fitur manage penerima sertifikat
                          console.info("Manage recipients", row.id);
                        }}
                      >
                        <UserIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                        onClick={() => {
                          // TODO: Nanti dibikin halaman / modal edit template sertifikat
                          console.info("Edit certificate template", row.id);
                        }}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Buat Paginationnya */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Showing {filteredRows.length === 0 ? 0 : startIndex + 1} to {endIndex} of {filteredRows.length} entries
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

function CertificateStatusBadge({
  status,
}: {
  status: CertificateAwardRow["certificateStatus"];
}) {
  let className = "bg-zinc-100 text-zinc-700";
  const label = status;

  if (status === "No Template") {
    className = "bg-amber-100 text-amber-700";
  } else if (status === "Draft") {
    className = "bg-blue-100 text-blue-700";
  } else if (status === "Active") {
    className = "bg-emerald-100 text-emerald-700";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

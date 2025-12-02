"use client";

import React from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";

interface InterviewParticipantRow {
  id: number;
  name: string;
  email: string;
  submissionStatus: "Completed" | "Incomplete" | "Pending";
  registeredOn: string;
  scoreStatus: "High" | "Medium" | "Low" | "Not Scored";
}

const mockRows: InterviewParticipantRow[] = [
  {
    id: 1,
    name: "SAMYIA AZIZAHMED MAKRANI",
    email: "samyiaazizahmed79@gmail.com",
    submissionStatus: "Completed",
    registeredOn: "12 Mar 2024, 14:32",
    scoreStatus: "High",
  },
  {
    id: 2,
    name: "Alya Putri Nirmala",
    email: "alya.putri@example.com",
    submissionStatus: "Completed",
    registeredOn: "11 Mar 2024, 09:15",
    scoreStatus: "Medium",
  },
  {
    id: 3,
    name: "Kenji Sato",
    email: "kenji.sato@example.jp",
    submissionStatus: "Pending",
    registeredOn: "10 Mar 2024, 19:05",
    scoreStatus: "Not Scored",
  },
  {
    id: 4,
    name: "Nurul Huda",
    email: "nurul.huda@example.my",
    submissionStatus: "Incomplete",
    registeredOn: "09 Mar 2024, 08:47",
    scoreStatus: "Low",
  },
];

interface InterviewParticipantsTableProps {
  onExport?: () => void;
}

export function InterviewParticipantsTable({ onExport }: InterviewParticipantsTableProps) {
  const rows = mockRows;

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-xs text-zinc-700 shadow-sm md:text-sm">
      <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center gap-1">
          <span>Show</span>
          <select className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-700 focus:border-blue-500 focus:outline-none">
            <option>10</option>
            <option>25</option>
            <option>50</option>
          </select>
          <span>entries</span>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-600"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          <span>Export Data</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Participant Details</th>
              <th className="px-3 py-2">Submission Status</th>
              <th className="px-3 py-2">Registered On</th>
              <th className="px-3 py-2">Score Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-[12px] text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No data available in table</span>
                    <span className="text-[11px] text-zinc-400">
                      Adjust your filters or import participants to see them here.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-semibold text-zinc-900">{row.name}</div>
                    <div className="text-[11px] text-zinc-500">{row.email}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <StatusBadge type="submission" status={row.submissionStatus} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div>{row.registeredOn}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <StatusBadge type="score" status={row.scoreStatus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Showing 0 to 0 of 0 entries
        </span>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({
  type,
  status,
}: {
  type: "submission" | "score";
  status: InterviewParticipantRow["submissionStatus"] | InterviewParticipantRow["scoreStatus"];
}) {
  const label = String(status);
  let className = "bg-zinc-100 text-zinc-700";

  if (type === "submission") {
    if (status === "Completed") className = "bg-emerald-100 text-emerald-700";
    else if (status === "Incomplete") className = "bg-rose-100 text-rose-700";
    else className = "bg-amber-100 text-amber-700";
  } else {
    if (status === "High") className = "bg-emerald-100 text-emerald-700";
    else if (status === "Medium") className = "bg-amber-100 text-amber-700";
    else if (status === "Low") className = "bg-rose-100 text-rose-700";
    else className = "bg-zinc-100 text-zinc-600";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

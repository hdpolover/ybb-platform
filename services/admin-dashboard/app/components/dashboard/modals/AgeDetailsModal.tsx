"use client";

import React from "react";

interface AgeDatum {
  range: string;
  count: number;
}

interface AgeDetailsModalProps {
  open: boolean;
  onClose: () => void;
  data: AgeDatum[];
}

export function AgeDetailsModal({ open, onClose, data }: AgeDetailsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Age Distribution Details</h2>
            <p className="text-[11px] text-zinc-500">
              Ringkasan peserta berdasarkan rentang usia.
            </p>
          </div>
          <button
            type="button"
            className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full border-collapse text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Age Range</th>
                <th className="px-3 py-2 font-semibold text-right">
                  Number of Participants
                </th>
                <th className="px-3 py-2 font-semibold text-right">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const total = data.reduce((sum, a) => sum + a.count, 0);
                const percentage = total
                  ? ((item.count / total) * 100).toFixed(1)
                  : "0.0";

                return (
                  <tr
                    key={item.range}
                    className={index % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}
                  >
                    <td className="px-3 py-1.5 text-zinc-800">{item.range}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-700">
                      {item.count}
                    </td>
                    <td className="px-3 py-1.5 text-right text-zinc-600">
                      {percentage}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

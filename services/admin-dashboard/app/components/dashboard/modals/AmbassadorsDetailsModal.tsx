"use client";

import React from "react";

interface AmbassadorDatum {
  name: string;
  country: string;
  referrals: number;
}

interface AmbassadorsDetailsModalProps {
  open: boolean;
  onClose: () => void;
  data: AmbassadorDatum[];
}

export function AmbassadorsDetailsModal({ open, onClose, data }: AmbassadorsDetailsModalProps) {
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
            <h2 className="text-sm font-semibold text-zinc-900">
              Top Ambassadors Details
            </h2>
            <p className="text-[11px] text-zinc-500">
              Daftar lengkap ambassador dan jumlah referalnya.
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
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Nationality</th>
                <th className="px-3 py-2 text-right font-semibold">Referrals</th>
              </tr>
            </thead>
            <tbody>
              {data.map((amb, index) => (
                <tr
                  key={amb.name}
                  className={index % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}
                >
                  <td className="px-3 py-1.5 text-zinc-800">{amb.name}</td>
                  <td className="px-3 py-1.5 text-zinc-700">{amb.country}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-700">
                    {amb.referrals}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// services/admin-dashboard/app/components/programAwardsMasterData/ProgramAwardsTable.tsx
"use client";

import { PencilSquareIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import type { ProgramAward } from "@/src/shared/api-client";

interface ProgramAwardsTableProps {
  awards: ProgramAward[];
  togglingId: string | null;
  canWrite: boolean;
  onEdit: (award: ProgramAward) => void;
  onDelete: (award: ProgramAward) => void;
  onToggleActive: (award: ProgramAward) => void;
}

const COLUMNS = ["Order", "Name", "Category", "Tier", "Winners", "Tags", "Status", "Actions"];

export function ProgramAwardsTable({ awards, togglingId, canWrite, onEdit, onDelete, onToggleActive }: ProgramAwardsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <table className="min-w-full text-left text-[11px]">
        <thead className="bg-zinc-50 text-zinc-600">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} className={`px-3 py-2 font-semibold ${column === "Actions" ? "text-right" : ""}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {awards.map((award, idx) => (
            <tr key={award.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
              <td className="px-3 py-2 text-zinc-400">{award.order}</td>
              <td className="max-w-xs px-3 py-2">
                <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                  {award.color && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: award.color }} />}
                  {award.name}
                </div>
                {award.description && <div className="mt-0.5 line-clamp-1 text-zinc-500">{award.description}</div>}
              </td>
              <td className="px-3 py-2 text-zinc-700">{award.category || <span className="text-zinc-400">—</span>}</td>
              <td className="px-3 py-2">
                {award.tier
                  ? <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{award.tier}</span>
                  : <span className="text-zinc-400">—</span>}
              </td>
              <td className="px-3 py-2 text-zinc-700">{award.winnerCount ?? <span className="text-zinc-400">—</span>}</td>
              <td className="px-3 py-2">
                {award.tags.length > 0
                  ? <div className="flex flex-wrap gap-1">{award.tags.map((tag) => <span key={tag} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">{tag}</span>)}</div>
                  : <span className="text-zinc-400">—</span>}
              </td>
              <td className="px-3 py-2">
                {canWrite ? (
                <button
                  type="button"
                  onClick={() => onToggleActive(award)}
                  disabled={togglingId === award.id}
                  title={award.isActive ? "Click to deactivate" : "Click to activate"}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition disabled:cursor-wait ${
                    award.isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:bg-emerald-50/40"
                      : "border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:bg-zinc-50"
                  }`}
                >
                  {award.isActive ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
                  {award.isActive ? "Active" : "Inactive"}
                </button>
                ) : (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${award.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-100 text-zinc-600"}`}>
                    {award.isActive ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
                    {award.isActive ? "Active" : "Inactive"}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {canWrite && <div className="flex items-center justify-end gap-1">
                  <button type="button" aria-label={`Edit ${award.name}`} onClick={() => onEdit(award)} className="rounded-md border border-zinc-200 p-1 text-zinc-500 hover:bg-zinc-50"><PencilSquareIcon className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label={`Delete ${award.name}`} onClick={() => onDelete(award)} className="rounded-md border border-red-100 p-1 text-red-400 hover:bg-red-50"><TrashIcon className="h-3.5 w-3.5" /></button>
                </div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { 
  AwardSearch, 
  AddAwardAction, 
  ViewAwardAction, 
  EditAwardAction, 
  DeleteAwardAction 
} from "./AwardActions";

// TYPES
export type AwardStatus = "Active" | "Inactive";

export type ProgramAward = {
  id: number;
  award: string; 
  title: string; 
  type: "Winner" | "Runner Up" | "Honorable Mention" | "Other";
  order: number; 
  description: string;
  status: AwardStatus;
};

// UTILS
function getAwardTypeBadgeClass(type: ProgramAward["type"]): string {
  switch (type) {
    case "Winner": return "bg-emerald-50 text-emerald-700";
    case "Runner Up": return "bg-blue-50 text-blue-700";
    case "Honorable Mention": return "bg-amber-50 text-amber-700";
    case "Other":
    default: return "bg-zinc-100 text-zinc-700";
  }
}

// MAIN SERVER COMPONENT
export function ProgramAwardsTable({ 
  data, 
  currentSearch 
}: { 
  data: ProgramAward[], 
  currentSearch: string 
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search Awards</label>
          <div className="flex w-full gap-3">
            <AwardSearch initialSearch={currentSearch} />
            <AddAwardAction />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">No</th>
              <th className="px-6 py-4 font-semibold">Award</th>
              <th className="px-6 py-4 font-semibold">Title</th>
              <th className="px-6 py-4 font-semibold">Award Type</th>
              <th className="px-6 py-4 text-center font-semibold">Order</th>
              <th className="px-6 py-4 font-semibold">Description</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-zinc-500">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="font-semibold text-zinc-900">No awards found</span>
                    <span className="text-xs text-zinc-500">
                      Adjust your search or use the Add Award button to create one.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((award, index) => (
                <tr key={award.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 align-top font-semibold text-zinc-900">
                    {award.award}
                  </td>
                  <td className="px-6 py-4 align-top text-zinc-700">
                    {award.title}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex items-center justify-center rounded px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap ${getAwardTypeBadgeClass(award.type)}`}>
                      {award.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-center text-zinc-700">
                    {award.order}
                  </td>
                  <td className="px-6 py-4 align-top text-sm leading-relaxed text-zinc-700 max-w-sm">
                    {award.description}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${award.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-600"}`}>
                      {award.status === "Active" ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                      <span>{award.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <ViewAwardAction award={award} />
                      <EditAwardAction award={award} />
                      <DeleteAwardAction id={award.id} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
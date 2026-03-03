import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { 
  RundownSearch, 
  AddRundownAction, 
  ViewRundownAction, 
  EditRundownAction, 
  DeleteRundownAction 
} from "./RundownActions";

export type ProgramRundownRow = {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  description: string;
  status: "Active" | "Inactive";
};

export function ProgramRundownsTable({ 
  data, 
  currentSearch 
}: { 
  data: ProgramRundownRow[], 
  currentSearch: string 
}) {
  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-900">Program Rundowns</h2>
          <p className="text-sm text-zinc-500">
            Manage the detailed schedule blocks for this program.
          </p>
        </div>
        {/* LEAF CLIENT COMPONENT */}
        <AddRundownAction />
      </div>

      {/* Filter / Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search</label>
          {/* LEAF CLIENT COMPONENT */}
          <RundownSearch initialSearch={currentSearch} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">No</th>
              <th className="px-6 py-4 font-semibold">Title</th>
              <th className="w-32 px-6 py-4 font-semibold">Start Time</th>
              <th className="w-32 px-6 py-4 font-semibold">End Time</th>
              <th className="w-32 px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                  No rundowns configured yet.
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                  
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-900">{row.title}</div>
                      <div className="max-w-md text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                        {row.description}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 align-top">
                    <span className="inline-flex items-center rounded-md text-xs font-medium text-zinc-700">
                      {row.startTime}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 align-top">
                    <span className="inline-flex items-center rounded-md text-xs font-medium text-zinc-700">
                      {row.endTime}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${row.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-600 "}`}>
                      {/* {row.status === "Active" ? (
                        <CheckCircleIcon className="h-4 w-4" />
                      ) : (
                        <XCircleIcon className="h-4 w-4" />
                      )} */}
                      <span>{row.status}</span>
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 align-top text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      {/* LEAF CLIENT COMPONENTS */}
                      <ViewRundownAction rundown={row} />
                      <EditRundownAction rundown={row} />
                      <DeleteRundownAction id={row.id} />
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
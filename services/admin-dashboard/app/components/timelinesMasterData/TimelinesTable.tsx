import { CalendarDaysIcon } from "@heroicons/react/24/solid";
import { 
  TimelineSearch, 
  AddTimelineAction, 
  ViewTimelineAction, 
  EditTimelineAction, 
  DeleteTimelineAction 
} from "./TimelineActions";

export type TimelineRow = {
  id: number;
  name: string;
  order: number;
  startDate: string;
  endDate: string;
  startDateIso: string;
  endDateIso: string;
  description: string;
  status: "Active" | "Inactive";
};

export function TimelinesTable({ data, currentSearch }: { data: TimelineRow[], currentSearch: string }) {
  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-900">Timelines</h2>
          <p className="text-sm text-zinc-500">
            Configure important milestones and phases for this program.
          </p>
        </div>
        <AddTimelineAction />
      </div>

      {/* Filter / Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search</label>
          <TimelineSearch initialSearch={currentSearch} />
        </div>
      </div>

      {/* Table  */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">No</th>
              <th className="px-6 py-4 font-semibold">Name</th>
              <th className="px-6 py-4 font-semibold">Start Date</th>
              <th className="px-6 py-4 font-semibold">End Date</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                  No timelines configured yet.
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <CalendarDaysIcon className="h-4 w-4" />
                      </span>
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-zinc-900">{row.name}</div>
                        <div className="text-xs text-zinc-500">Order #{row.order}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top text-xs text-zinc-700 font-medium">{row.startDate}</td>
                  <td className="px-6 py-4 align-top text-xs text-zinc-700 font-medium">{row.endDate}</td>
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${row.status === "Active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <ViewTimelineAction timeline={row} />
                      <EditTimelineAction timeline={row} />
                      <DeleteTimelineAction id={row.id} />
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
import { UsersIcon } from "@heroicons/react/24/solid";
import { AddCategoryAction, EditCategoryAction, DeleteCategoryAction } from "./CategoryActions";

export interface ParticipationCategoryRow {
  id: number;
  name: string;
  description: string;
  status: "Active" | "Inactive";
}

export function ParticipationCategoriesTable({ data }: { data: ParticipationCategoryRow[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <UsersIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Participation Categories</h2>
            <p className="text-sm text-zinc-500">Define available participation categories for this program.</p>
          </div>
        </div>
        <AddCategoryAction />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
                <th className="w-12 px-6 py-4 font-semibold">No</th>
                <th className="px-6 py-4 font-semibold">Category Name</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                    No participation categories configured yet.
                  </td>
                </tr>
              ) : (
                data.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                    <td className="px-6 py-4 align-top font-semibold text-zinc-900">{row.name}</td>
                    <td className="px-6 py-4 align-top text-zinc-600">{row.description}</td>
                    <td className="px-6 py-4 align-top">
                      <span className={`inline-flex rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${row.status === "Active" ? " bg-emerald-50 text-emerald-700" : " bg-zinc-50 text-zinc-600"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <EditCategoryAction category={row} />
                        <DeleteCategoryAction id={row.id} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
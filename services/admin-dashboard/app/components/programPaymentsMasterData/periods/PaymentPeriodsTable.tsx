import { Fragment } from "react";
import { CalendarDaysIcon } from "@heroicons/react/24/solid";
import { AddPeriodAction, EditPeriodAction, DeletePeriodAction } from "./periodActions";

export type PeriodRow = {
  id: string;
  name: string;
  base: boolean;
  typeLabel: "Base Period" | "Continuation";
  description: string;
  start: string;
  end: string;
  startRaw: string;
  endRaw: string;
  order: number;
  status: "Active" | "Inactive";
  isUpcoming?: boolean;
  fromParentInfo?: string;
};

export function PaymentPeriodsTable({
  data,
  tierId,
  onRefresh,
}: {
  data: PeriodRow[];
  tierId: string;
  onRefresh?: () => void;
}) {
  const baseRows = data.filter((row) => row.base);

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <CalendarDaysIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Payment Periods</h2>
            <p className="text-sm text-zinc-500">List of active schedules for this payment.</p>
          </div>
        </div>
        <AddPeriodAction tierId={tierId} onSaved={onRefresh} periods={data} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">#</th>
              <th className="px-6 py-4 font-semibold">Period Name</th>
              <th className="px-6 py-4 font-semibold">Type</th>
              <th className="px-6 py-4 font-semibold">Description</th>
              <th className="px-6 py-4 font-semibold">Start & End</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {baseRows.length === 0 ? (
               <tr>
                 <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                   No periods configured yet.
                 </td>
               </tr>
            ) : (
              baseRows.map((baseRow, index) => {
                const children = data.filter((row) => !row.base); 
                return (
                  <Fragment key={baseRow.id}>
                    <tr className="transition-colors hover:bg-zinc-50/50">
                      <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <CalendarDaysIcon className="mt-0.5 h-4 w-4 text-blue-500" />
                          <div className="space-y-1">
                            <div className="font-semibold text-zinc-900">{baseRow.name}</div>
                            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Currently Active
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                          {baseRow.typeLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-zinc-700">{baseRow.description}</td>
                      <td className="px-6 py-4 align-top text-xs text-zinc-600">
                        <div className="font-medium text-zinc-900">{baseRow.start}</div>
                        <div>to {baseRow.end}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          {baseRow.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <EditPeriodAction period={baseRow} onSaved={onRefresh} periods={data} />
                          <DeletePeriodAction id={baseRow.id} onDeleted={onRefresh} />
                        </div>
                      </td>
                    </tr>

                    {children.map((child) => (
                      <tr key={child.id} className="bg-zinc-50/40 transition-colors hover:bg-zinc-50">
                        <td className="px-6 py-4 align-top" />
                        <td className="px-6 py-4 align-top">
                          <div className="ml-6 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-zinc-400">↳</span>
                              <span className="font-semibold text-zinc-900">{child.name}</span>
                            </div>
                            {child.isUpcoming && (
                              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Upcoming
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-700">
                            {child.typeLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-zinc-700">
                          <div>{child.description}</div>
                          {child.fromParentInfo && (
                            <div className="mt-1.5 text-xs font-medium text-zinc-500">{child.fromParentInfo}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top text-xs text-zinc-600">
                          <div className="font-medium text-zinc-900">{child.start}</div>
                          <div>to {child.end}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            {child.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <EditPeriodAction period={child} onSaved={onRefresh} periods={data} />
                            <DeletePeriodAction id={child.id} onDeleted={onRefresh} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

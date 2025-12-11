"use client";

import { Fragment, useState } from "react";
import { CalendarDaysIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/solid";

export type PeriodRow = {
  id: number;
  name: string;
  base: boolean;
  typeLabel: "Base Period" | "Continuation";
  description: string;
  start: string;
  end: string;
  order: number;
  status: "Active" | "Inactive";
  isUpcoming?: boolean;
  fromParentInfo?: string;
};

const mockPeriods: PeriodRow[] = [
  {
    id: 1,
    name: "Registration Period",
    base: true,
    typeLabel: "Base Period",
    description: "Registration period for Japan Youth Summit 2026",
    start: "Nov 19, 2025 12:01 AM",
    end: "Feb 10, 2026 11:59 PM",
    order: 1,
    status: "Active",
  },
  {
    id: 2,
    name: "Period I",
    base: false,
    typeLabel: "Continuation",
    description: "Period I",
    start: "Nov 19, 2025 12:01 AM",
    end: "Feb 10, 2026 11:59 PM",
    order: 2,
    status: "Active",
    isUpcoming: true,
    fromParentInfo: "From parent period. Extension starts: Feb 11, 2026",
  },
  {
    id: 3,
    name: "Period II",
    base: false,
    typeLabel: "Continuation",
    description: "Period II",
    start: "Nov 19, 2025 12:01 AM",
    end: "Feb 12, 2026 11:59 PM",
    order: 3,
    status: "Active",
    isUpcoming: true,
    fromParentInfo: "From parent period. Extension starts: Feb 11, 2026",
  },
  {
    id: 4,
    name: "Period III",
    base: false,
    typeLabel: "Continuation",
    description: "Period III",
    start: "Nov 19, 2025 12:01 AM",
    end: "Feb 13, 2026 11:59 PM",
    order: 4,
    status: "Active",
    isUpcoming: true,
    fromParentInfo: "From parent period. Extension starts: Feb 12, 2026",
  },
  {
    id: 5,
    name: "Period IV",
    base: false,
    typeLabel: "Continuation",
    description: "Period IV",
    start: "Nov 19, 2025 12:01 AM",
    end: "Feb 14, 2026 11:59 PM",
    order: 5,
    status: "Active",
    isUpcoming: true,
    fromParentInfo: "From parent period. Extension starts: Feb 13, 2026",
  },
  {
    id: 6,
    name: "Period V",
    base: false,
    typeLabel: "Continuation",
    description: "Period V",
    start: "Nov 19, 2025 12:01 AM",
    end: "Feb 15, 2026 11:59 PM",
    order: 6,
    status: "Active",
    isUpcoming: true,
    fromParentInfo: "From parent period. Extension starts: Feb 14, 2026",
  },
];

export function PaymentPeriodsTable({
  onAddPeriod,
  onEditPeriod,
}: {
  onAddPeriod: () => void;
  onEditPeriod: (period: PeriodRow) => void;
}) {
  const [rows] = useState<PeriodRow[]>(mockPeriods);

  const baseRows = rows.filter((row) => row.base);

  return (
    <section className="space-y-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 md:text-base">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <CalendarDaysIcon className="h-4 w-4" />
          </span>
          <span>Payment Periods</span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-600"
          onClick={onAddPeriod}
        >
          <CalendarDaysIcon className="h-4 w-4" />
          <span>Add Period</span>
        </button>
      </div>

      <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 bg-white">
        <table className="min-w-full border-collapse text-left text-[11px]">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="w-10 px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Period Name</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 font-semibold">Start Date</th>
              <th className="px-3 py-2 font-semibold">End Date</th>
              <th className="px-3 py-2 font-semibold">Order</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {baseRows.map((baseRow, index) => {
              const children = rows.filter((row) => !row.base);
              return (
                <Fragment key={baseRow.id}>
                  <tr className="border-b border-zinc-100">
                    <td className="px-3 py-2 align-top text-zinc-500">{index + 1}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-2">
                        <CalendarDaysIcon className="h-4 w-4 text-blue-500" />
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-zinc-900">{baseRow.name}</div>
                          <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Currently Active
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                        {baseRow.typeLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-700">{baseRow.description}</td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-700">{baseRow.start}</td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-700">{baseRow.end}</td>
                    <td className="px-3 py-2 align-top text-[11px] text-zinc-700">{baseRow.order}</td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        {baseRow.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                          aria-label="Edit period"
                          onClick={() => onEditPeriod(baseRow)}
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                          aria-label="Delete period"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {children.map((child) => (
                    <tr key={child.id} className="border-b border-zinc-100 last:border-b-0 bg-zinc-50/40">
                      <td className="px-3 py-2 align-top" />
                      <td className="px-3 py-2 align-top">
                        <div className="ml-4 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">↳</span>
                            <span className="text-xs font-semibold text-zinc-900">{child.name}</span>
                          </div>
                          {child.isUpcoming && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Upcoming
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                          {child.typeLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-zinc-700">
                        <div>{child.description}</div>
                        {child.fromParentInfo && (
                          <div className="text-[10px] text-zinc-500">{child.fromParentInfo}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-zinc-700">{child.start}</td>
                      <td className="px-3 py-2 align-top text-[11px] text-zinc-700">{child.end}</td>
                      <td className="px-3 py-2 align-top text-[11px] text-zinc-700">{child.order}</td>
                      <td className="px-3 py-2 align-top">
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          {child.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                            aria-label="Edit period"
                            onClick={() => onEditPeriod(child)}
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                            aria-label="Delete period"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

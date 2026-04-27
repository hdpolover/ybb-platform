import { CalendarDaysIcon } from "@heroicons/react/24/solid";
import { 
  PaymentOptionSearch,
  AddPaymentOptionAction, 
  EditPaymentOptionAction, 
  DeletePaymentOptionAction,
  ManagePeriodsAction
} from "./PaymentOptionActions";

export interface PaymentOptionRow {
  id: number;
  _id: string; // real UUID from backend
  optionName: string;
  category: "Registration Fee" | "Program Fee 1" | "Program Fee 2";
  fundingType: "All" | "Self Funded" | "Fully Funded";
  amountUsd: number;
  amountIdrApprox: string;
  currentActivePeriodLabel: string | null;
  currentActivePeriodRange: string | null;
  currentActiveStatusBadge?: "Active Now" | null;
  lastActivePeriodLabel: string | null;
  lastActivePeriodRange: string | null;
  lastActiveStatusBadge?: "Upcoming" | null;
  status: "Active" | "Inactive";
  description: string;
  benefits?: string[];
  requirements?: string[];
}

export function ProgramPaymentsTable({
  data,
  currentSearch,
  onRefresh,
  programId,
}: {
  data: PaymentOptionRow[];
  currentSearch: string;
  onRefresh?: () => void;
  programId?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-900">Payment Options</h2>
          <p className="text-sm text-zinc-500">Configure payment options, funding types, and their active periods.</p>
        </div>
        <AddPaymentOptionAction programId={programId} onSaved={onRefresh} />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search</label>
          <PaymentOptionSearch initialSearch={currentSearch} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">#</th>
              <th className="px-6 py-4 font-semibold">Payment Option</th>
              <th className="px-6 py-4 font-semibold">Amount</th>
              <th className="px-6 py-4 font-semibold">Current Period</th>
              <th className="px-6 py-4 font-semibold">Last Period</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">No payment options configured yet.</td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                  
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-900">{row.optionName}</div>
                      <span className="inline-flex rounded bg-blue-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
                        {row.category}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-zinc-900">${row.amountUsd.toFixed(2)}</div>
                      <div className="text-xs text-zinc-500">{row.amountIdrApprox}</div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 align-top">
                    {row.currentActivePeriodRange ? (
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CalendarDaysIcon className="h-4 w-4" />
                          <span>{row.currentActivePeriodLabel}</span>
                        </div>
                        <div className="text-xs text-zinc-600">{row.currentActivePeriodRange}</div>
                        {row.currentActiveStatusBadge === "Active Now" && (
                          <span className="inline-flex rounded bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            Active Now
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 text-xs text-zinc-500">
                        <div>No Active Period</div>
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 align-top">
                    {row.lastActivePeriodLabel ? (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-zinc-900">{row.lastActivePeriodLabel}</div>
                        <div className="text-xs text-zinc-600">{row.lastActivePeriodRange}</div>
                        {row.lastActiveStatusBadge === "Upcoming" && (
                          <span className="inline-flex rounded bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            Upcoming
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500">No Period Set</div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${row.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-600"}`}>
                      {row.status}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 align-top text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <ManagePeriodsAction optionId={row._id} />
                      <EditPaymentOptionAction option={row} onSaved={onRefresh} />
                      <DeletePaymentOptionAction id={row._id} onDeleted={onRefresh} />
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
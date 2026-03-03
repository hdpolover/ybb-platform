import Image from "next/image";
import { CreditCardIcon } from "@heroicons/react/24/solid";
import { AddPaymentMethodAction, ViewPaymentMethodAction, EditPaymentMethodAction, DeletePaymentMethodAction, SearchInput } from "./PaymentMethodActions";

export type PaymentMethodRow = {
  id: number;
  name: string;
  type: "Bank Transfer" | "Virtual Account" | "E-Wallet" | "Credit/Debit Card";
  imageAlt: string;
  imageSrc: string | null;
  paymentType: "Manual" | "Gateway";
  description: string;
  status: "Active" | "Inactive";
};

export function PaymentMethodsTable({ data, currentSearch }: { data: PaymentMethodRow[], currentSearch: string }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-900">Payment Methods</h2>
          <p className="text-sm text-zinc-500">Configure available payment options, including bank transfers, virtual accounts, and e-wallets.</p>
        </div>
        <AddPaymentMethodAction />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search</label>
          <SearchInput initialSearch={currentSearch} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">No</th>
              <th className="px-6 py-4 font-semibold">Name</th>
              <th className="px-6 py-4 font-semibold">Type</th>
              <th className="px-6 py-4 font-semibold">Image</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                  No payment methods configured yet.
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <CreditCardIcon className="h-4 w-4" />
                      </span>
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-zinc-900">{row.name}</div>
                        <div className="text-xs text-zinc-500">Program-wide method</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className="inline-flex rounded bg-blue-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white">
                        {row.imageSrc ? (
                          <Image src={row.imageSrc} alt={row.imageAlt} width={40} height={40} className="object-contain" />
                        ) : (
                          <span className="text-xs font-semibold text-zinc-500">{row.imageAlt.charAt(0)}</span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500">{row.imageAlt}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${row.status === "Active" ? "bg-emerald-50 text-emerald-700 " : "bg-zinc-50 text-zinc-600 border border-zinc-200"}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <ViewPaymentMethodAction method={row} />
                      <EditPaymentMethodAction method={row} />
                      <DeletePaymentMethodAction id={row.id} />
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
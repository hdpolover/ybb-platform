import React from "react";
import Link from "next/link";

interface PaymentTableProps {
  programId: string;
}

export function PaymentTable({ programId }: PaymentTableProps) {
  // Untuk sementara dikosongkan. Saat mulai fetch data, 
  // queryString ini bisa dioper via props dari page.tsx (searchParams)
  const queryString = "";

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-zinc-200">
      <table className="min-w-full border-collapse text-left text-[11px]">
        <thead className="bg-zinc-50 text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-semibold">Date</th>
            <th className="px-3 py-2 font-semibold">Payment Info</th>
            <th className="px-3 py-2 font-semibold">Participant</th>
            <th className="px-3 py-2 font-semibold">Payment Details</th>
            <th className="px-3 py-2 text-right font-semibold">Status</th>
            <th className="px-3 py-2 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-white border-b border-zinc-100">
            <td className="align-top px-3 py-2 text-zinc-800">
              <div className="font-medium">Nov 30, 2025 16:18</div>
            </td>
            <td className="align-top px-3 py-2 text-zinc-700">
              <div className="font-medium text-zinc-900">Payment ID: 18502</div>
              <div className="text-zinc-600">Transaction Code: TR-18502-1764320001</div>
              <div className="text-[10px] text-zinc-500">
                Order ID: 185021764320001958756
              </div>
            </td>
            <td className="align-top px-3 py-2 text-zinc-700">
              <div className="font-semibold text-zinc-900">AYA GAMAL</div>
              <div className="text-zinc-600">ayagamal453@gmail.com</div>
              <div className="text-[10px] text-zinc-500">Egypt</div>
            </td>
            <td className="align-top px-3 py-2 text-zinc-700">
              <div className="font-medium">Fully Funded Registration Fee</div>
              <div className="text-zinc-600">Rp169.000,00</div>
              <div className="text-[10px] text-zinc-500">
                Debit or Credit card ( Visa or Mastercard )
              </div>
            </td>
            <td className="align-top px-3 py-2 text-right">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Success
              </span>
            </td>
            <td className="align-top px-3 py-2 text-right text-zinc-500">
              <Link
                href={`/programs/${programId}/payments/18502${queryString}`}
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                View details
              </Link>
            </td>
          </tr>

          <tr className="bg-zinc-50/60 border-b border-zinc-100">
            <td className="align-top px-3 py-2 text-zinc-800">
              <div className="font-medium">Nov 29, 2025 10:42</div>
            </td>
            <td className="align-top px-3 py-2 text-zinc-700">
              <div className="font-medium text-zinc-900">Payment ID: 18488</div>
              <div className="text-zinc-600">Transaction Code: TR-18488-1764301001</div>
              <div className="text-[10px] text-zinc-500">
                Order ID: 184881764301001958756
              </div>
            </td>
            <td className="align-top px-3 py-2 text-zinc-700">
              <div className="font-semibold text-zinc-900">Nur Aisyah</div>
              <div className="text-zinc-600">nur.aisyah@example.com</div>
              <div className="text-[10px] text-zinc-500">Indonesia</div>
            </td>
            <td className="align-top px-3 py-2 text-zinc-700">
              <div className="font-medium">Self Funded Registration Fee</div>
              <div className="text-zinc-600">Rp1.352.000,00</div>
              <div className="text-[10px] text-zinc-500">BCA</div>
            </td>
            <td className="align-top px-3 py-2 text-right">
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Pending
              </span>
            </td>
            <td className="align-top px-3 py-2 text-right text-zinc-500">
              <Link
                href={`/programs/${programId}/payments/18488${queryString}`}
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                View details
              </Link>
            </td>
          </tr>

          <tr className="bg-white">
            <td className="align-top px-3 py-2 text-zinc-800">
              <div className="font-medium">Nov 28, 2025 21:05</div>
            </td>
            <td className="align-top px-3 py-2 text-zinc-700">
              <div className="font-medium text-zinc-900">Payment ID: 18460</div>
              <div className="text-zinc-600">Transaction Code: TR-18460-1764200008</div>
              <div className="text-[10px] text-zinc-500">
                Order ID: 184601764200008958756
              </div>
            </td>
            <td className="align-top px-3 py-2 text-zinc-700">
              <div className="font-semibold text-zinc-900">Mohammed Ali</div>
              <div className="text-zinc-600">mohammed.ali@example.com</div>
              <div className="text-[10px] text-zinc-500">Pakistan</div>
            </td>
            <td className="align-top px-3 py-2 text-zinc-700">
              <div className="font-medium">Batch 1 Installment</div>
              <div className="text-zinc-600">$ 120.00</div>
              <div className="text-[10px] text-zinc-500">Paypal</div>
            </td>
            <td className="align-top px-3 py-2 text-right">
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                Rejected
              </span>
            </td>
            <td className="align-top px-3 py-2 text-right text-zinc-500">
              <Link
                href={`/programs/${programId}/payments/18460${queryString}`}
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                View details
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
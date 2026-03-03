import React from "react";
import { CheckIcon } from "@heroicons/react/24/solid";
import { CalendarIcon } from "@heroicons/react/24/outline";

export interface HistoryItem {
  id: number;
  statusLabel: string;
  title: string;
  description: string;
  date: string;
}

interface PaymentHistorySectionProps {
  histories: HistoryItem[];
}

export function PaymentHistorySection({ histories }: PaymentHistorySectionProps) {
  return (
    <section className="flex flex-col">
      {/* KOREKSI: Menggunakan text-base agar konsisten dengan judul section lain */}
      <h3 className="mb-6 text-base font-semibold text-zinc-900">Payment History</h3>
      
      <div className="relative">
        {histories.map((item, index) => {
          const isLast = index === histories.length - 1;

          return (
            <div key={item.id} className="relative flex gap-4 pb-8">
              {!isLast && (
                <div className="absolute left-3 top-7 bottom-0 w-px bg-green-500" />
              )}

              <div className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500 shadow-sm">
                <CheckIcon className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div>
                  {/* KOREKSI: text-[10px] diubah menjadi text-xs */}
                  <span className="inline-flex items-center rounded bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                    {item.statusLabel}
                  </span>
                </div>
                
                {/* KOREKSI: Font bold diubah ke semibold agar hierarkinya lebih elegan, sesuai text-sm */}
                <h4 className="text-sm font-semibold text-zinc-900">{item.title}</h4>
                <p className="text-xs text-zinc-700">{item.description}</p>
                
                <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{item.date}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
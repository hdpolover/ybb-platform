import React from "react";
import Link from "next/link";
import { EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { PaymentHeaderActions } from "./PaymentHeaderActions";
import { NotifyParticipantButton } from "./NotifyParticipantButton";

export interface PaymentHeaderData {
  transactionId: string;
  status: "Created" | "Pending" | "Success" | "Cancelled" | "Rejected" | string;
  participantName: string;
  email: string;
  phone: string;
}

interface PaymentDetailHeaderProps {
  data: PaymentHeaderData;
  programId: string;
}

export function PaymentDetailHeader({ data, programId }: PaymentDetailHeaderProps) {
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === "success") return "bg-emerald-500 text-emerald-600";
    if (s === "pending") return "bg-amber-500 text-amber-600";
    if (s === "cancelled" || s === "rejected") return "bg-rose-500 text-rose-600";
    return "bg-zinc-500 text-zinc-600";
  };

  const statusStyle = getStatusColor(data.status);

  return (
    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide">
          <span className="text-zinc-500">Transaction #{data.transactionId}</span>
          <span className="text-zinc-300">•</span>
          <div className={`flex items-center gap-1.5 ${statusStyle.split(' ')[1]}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${statusStyle.split(' ')[0]}`}></div>
            <span>{data.status}</span>
          </div>
        </div>
        
        <h1 className="mt-1 text-2xl font-bold uppercase text-zinc-900">
          {data.participantName}
        </h1>
        
        <div className="mt-3 flex flex-wrap items-center gap-6 text-[11px] text-zinc-600">
          <div className="flex items-center gap-1.5">
            <EnvelopeIcon className="h-4 w-4" />
            <span>{data.email}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <PhoneIcon className="h-4 w-4" />
            <span>{data.phone}</span>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          <NotifyParticipantButton email={data.email} />
          <Link 
            href={`/programs/${programId}/participants/${data.transactionId}`}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 focus:ring-2 focus:ring-zinc-200"
          >
            See Profile
          </Link>
        </div>
      </div>
      <PaymentHeaderActions 
        programId={programId} 
        transactionId={data.transactionId} 
      />
    </div>
  );
}
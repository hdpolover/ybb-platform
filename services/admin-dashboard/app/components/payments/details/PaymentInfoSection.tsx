import React from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { DownloadProofButton } from "./DownloadProofButton";

interface PaymentDetailData {
  transactionId: string;
  orderId: string;
  transactionCode: string;
  dateCreated: string;
  paymentVia: string;
  registrationType: string;
  paymentDesc: string;
  proofFileName?: string;
  proofFileSize?: string;
}

interface PaymentInfoSectionProps {
  data: PaymentDetailData;
}

export function PaymentInfoSection({ data }: PaymentInfoSectionProps) {
  const fileName = data.proofFileName || `PaymentProof_${data.transactionId}.jpg`;
  const fileSize = data.proofFileSize || "Unknown size";

  return (
    <section className="flex flex-col">
      <h3 className="text-base font-semibold text-zinc-900">Payment Information</h3>
      
      <div className="mt-4 grid grid-cols-1 gap-y-5 gap-x-8 sm:grid-cols-2 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Order ID</span>
          <span className="text-sm font-semibold text-zinc-900">{data.orderId}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Transaction Code</span>
          <span className="text-sm font-semibold text-zinc-900">{data.transactionCode}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Date Created</span>
          <span className="text-sm font-semibold text-zinc-900">{data.dateCreated}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Payment Via</span>
          <span className="text-sm font-semibold text-zinc-900">{data.paymentVia}</span>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium text-zinc-500">Registration Type</span>
          <span className="text-sm font-semibold text-zinc-900">{data.registrationType}</span>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2 md:col-span-3">
          <span className="text-xs font-medium text-zinc-500">Payment Description</span>
          <span className="text-sm font-semibold text-zinc-900">{data.paymentDesc}</span>
        </div>
      </div>

      <h3 className="mt-8 text-base font-semibold text-zinc-900">Payment Proof</h3>
      <div className="mt-3 flex max-w-md items-center justify-between rounded-md border border-zinc-200 bg-zinc-50/50 p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white border border-zinc-200 text-blue-500 shadow-sm">
            <DocumentTextIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-zinc-900 truncate max-w-[180px]" title={fileName}>
              {fileName}
            </span>
            <span className="text-xs text-zinc-500">{fileSize}</span>
          </div>
        </div>
        
        <DownloadProofButton 
          transactionId={data.transactionId} 
          fileName={fileName} 
        />
      </div>
    </section>
  );
}
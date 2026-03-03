// services/admin-dashboard/app/components/payments/details/PaymentHeaderActions.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PencilIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { Button } from "@/app/components/ui/Button";
import { UpdatePaymentStatusModal } from "./UpdatePaymentStatusModal";

interface PaymentHeaderActionsProps {
  programId: string;
  transactionId: string;
}

export function PaymentHeaderActions({ programId, transactionId }: PaymentHeaderActionsProps) {
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button 
          variant="blue" 
          size="sm"
          startIcon={<ArrowPathIcon className="h-3.5 w-3.5" />}
          onClick={() => setIsUpdateModalOpen(true)}
        >
          Update Status
        </Button>
        
        <Link 
          href={`/programs/${programId}/payments/${transactionId}/edit`}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 focus:ring-2 focus:ring-zinc-200"
        >
          <PencilIcon className="h-3.5 w-3.5" />
          Edit
        </Link>
      </div>

      <UpdatePaymentStatusModal 
        open={isUpdateModalOpen} 
        onClose={() => setIsUpdateModalOpen(false)} 
      />
    </>
  );
}
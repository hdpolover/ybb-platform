import React from "react";
import { PaymentFilters } from "./PaymentFilters";
import { PaymentTable } from "./PaymentTable";

interface AllPaymentsSectionProps {
  programId: string; // Terima id dari PaymentsSummary
}

export function AllPaymentsSection({ programId }: AllPaymentsSectionProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
      <PaymentFilters />
      <PaymentTable programId={programId} />
    </section>
  );
}
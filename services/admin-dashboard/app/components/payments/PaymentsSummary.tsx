import React from "react";
import { PaymentsOverviewSection } from "./sections/PaymentsOverviewSection";
import { PaymentStatusSection } from "./sections/PaymentStatusSection";
import { PaymentDetailsSection } from "./sections/PaymentDetailsSection"; 
import { AllPaymentsSection } from "./sections/AllPaymentsSection";

type PaymentsSummaryProps = {
  selectedProgramId: string;
};

export function PaymentsSummary({ selectedProgramId }: PaymentsSummaryProps) {  
  return (
    <div className="space-y-8 pb-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <PaymentsOverviewSection />
          <PaymentStatusSection />
        </div>
        <div className="lg:col-span-1 h-auto lg:h-full">
          <PaymentDetailsSection />
        </div>
      </div>
      <AllPaymentsSection programId={selectedProgramId} />
    </div>
  );
}
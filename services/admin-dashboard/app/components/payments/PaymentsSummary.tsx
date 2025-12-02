"use client";

import React, { useState } from "react";
import { PaymentsOverviewSection } from "./sections/PaymentsOverviewSection";
import { PaymentStatusSection } from "./sections/PaymentStatusSection";
import { AllPaymentsSection } from "./sections/AllPaymentsSection";
import { MakePaymentModal } from "./modals/MakePaymentModal";

type PaymentsSummaryProps = {
  selectedProgramId: string;
};

export function PaymentsSummary({}: PaymentsSummaryProps) {
  const [showMakePaymentModal, setShowMakePaymentModal] = useState(false);

  return (
    <div className="space-y-4">
      <PaymentsOverviewSection />
      <PaymentStatusSection />
      <AllPaymentsSection onOpenMakePayment={() => setShowMakePaymentModal(true)} />
      <MakePaymentModal
        open={showMakePaymentModal}
        onClose={() => setShowMakePaymentModal(false)}
      />
    </div>
  );
}

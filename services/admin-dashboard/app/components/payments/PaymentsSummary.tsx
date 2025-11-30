"use client";

import React, { useState } from "react";
import { programs } from "../navbar/ProgramSelect";
import { SelectedProgramHeader } from "../program/SelectedProgramHeader";
import { PaymentsOverviewSection } from "./sections/PaymentsOverviewSection";
import { PaymentStatusSection } from "./sections/PaymentStatusSection";
import { AllPaymentsSection } from "./sections/AllPaymentsSection";
import { MakePaymentModal } from "./modals/MakePaymentModal";

type PaymentsSummaryProps = {
  selectedProgramId: string;
};

export function PaymentsSummary({ selectedProgramId }: PaymentsSummaryProps) {
  const [showMakePaymentModal, setShowMakePaymentModal] = useState(false);

  const program = programs.find((p) => p.id === selectedProgramId) ?? null;

  return (
    <div className="space-y-4">
      {program && (
        <SelectedProgramHeader
          program={program}
          subtitle="Dashboard program terpilih."
        />
      )}
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
